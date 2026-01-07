import csv
import os
import random
import string
import threading
import time
from collections import deque
from typing import Optional

from locust import HttpUser, task, between, events


def _rand_id(prefix: str = "lt") -> str:
    # Short unique-ish id for idempotent sources
    return f"{prefix}-{int(time.time() * 1000)}-{''.join(random.choices(string.ascii_lowercase + string.digits, k=6))}"


class CredPool:
    """
    Thread-safe round-robin credential feeder.
    Expects CSV with header: username,password
    """
    _lock = threading.Lock()
    _pool: deque[tuple[str, str]] = deque()
    _loaded = False

    @classmethod
    def load(cls, csv_path: Optional[str] = None):
        if cls._loaded:
            return
        with cls._lock:
            if cls._loaded:
                return
            # Resolve default csv path relative to repo root
            # Try loadtest/consumers.csv first (written by seed_loadtest_data)
            default_csv = csv_path or os.getenv("CREDENTIALS_CSV") or os.path.join(os.path.dirname(__file__), "consumers.csv")
            items: list[tuple[str, str]] = []
            try:
                with open(default_csv, "r", encoding="utf-8") as f:
                    reader = csv.DictReader(f)
                    for row in reader:
                        u = (row.get("username") or "").strip()
                        p = row.get("password") or ""
                        if u:
                            items.append((u, p))
            except FileNotFoundError:
                # Allow running with a single fallback user from env for smoke tests
                env_user = os.getenv("LT_USER")
                env_pass = os.getenv("LT_PASS", "")
                if env_user:
                    items.append((env_user, env_pass))
            if not items:
                # Last resort: a placeholder that will 401; helps surface misconfig
                items.append(("missing_user", "missing_pass"))
            cls._pool = deque(items)
            cls._loaded = True

    @classmethod
    def next_cred(cls) -> tuple[str, str]:
        cls.load()
        with cls._lock:
            item = cls._pool.popleft()
            cls._pool.append(item)
            return item


def extract_access_token(resp_json: dict) -> Optional[str]:
    # Prefer SimpleJWT default
    tok = resp_json.get("access")
    if tok:
        return tok
    # Sometimes custom views may return 'token' or nested structures
    for k in ("token", "jwt", "id_token"):
        if resp_json.get(k):
            return resp_json[k]
    # Look for any string-like value that seems like a JWT (two dots)
    for v in resp_json.values():
        if isinstance(v, str) and v.count(".") == 2:
            return v
    return None


class ConsumerUser(HttpUser):
    """
    Simulates a consumer performing read flows and activation requests.

    Endpoints exercised:
      - POST /api/accounts/login/
      - GET  /healthz
      - GET  /api/coupons/codes/consumer-overview
      - GET  /api/coupons/codes/mine?page=1 (defensive, though employees-only; safe fallback)
      - POST /api/v1/coupon/activate/  (50 or 150) → enqueues background task
      - GET  /api/jobs/{task_id}/status/         → optional follow-up
    """
    # Between 0.2s to 1.2s between tasks to create staggered pressure
    wait_time = between(float(os.getenv("LT_WAIT_MIN", "0.2")), float(os.getenv("LT_WAIT_MAX", "1.2")))

    # Task weights (tune via env)
    weight_overview = int(os.getenv("LT_WEIGHT_OVERVIEW", "6"))
    weight_codes = int(os.getenv("LT_WEIGHT_CODES", "2"))
    weight_activate = int(os.getenv("LT_WEIGHT_ACTIVATE", "2"))

    access_token: Optional[str] = None
    username: Optional[str] = None

    def on_start(self):
        # Authenticate once per simulated user
        u, p = CredPool.next_cred()
        self.username = u
        payload = {"username": u, "password": p}
        with self.client.post("/api/accounts/login/", json=payload, name="auth_login", catch_response=True) as resp:
            if not resp.ok:
                resp.failure(f"Login failed {resp.status_code}")
                return
            try:
                data = resp.json()
            except Exception as e:
                resp.failure(f"Login JSON parse error: {e}")
                return
            tok = extract_access_token(data)
            if not tok:
                resp.failure("No access token in response")
                return
            self.access_token = tok

    def _auth_headers(self) -> dict:
        if not self.access_token:
            return {}
        return {"Authorization": f"Bearer {self.access_token}"}

    def _reauth_if_unauthorized(self, response):
        if response is not None and response.status_code == 401:
            # Retry a single re-login in case token expired
            self.on_start()

    # Heavily-hit read endpoint
    @task(weight_overview)
    def t_consumer_overview(self):
        with self.client.get(
            "/api/coupons/codes/consumer-overview",
            headers=self._auth_headers(),
            name="consumer_overview",
            catch_response=True,
        ) as resp:
            if resp.status_code == 401:
                self._reauth_if_unauthorized(resp)
            # Always mark non-2xx as failure to get proper stats
            if not resp.ok:
                resp.failure(f"status={resp.status_code}")

    # Additional lightweight read
    @task(weight_codes)
    def t_codes_mine_consumer(self):
        with self.client.get(
            "/api/coupons/codes/mine-consumer?page_size=25",
            headers=self._auth_headers(),
            name="codes_mine_consumer",
            catch_response=True,
        ) as resp:
            if resp.status_code == 401:
                self._reauth_if_unauthorized(resp)
            if not resp.ok:
                resp.failure(f"status={resp.status_code}")

    # Activation path that enqueues a background task quickly
    @task(weight_activate)
    def t_activate(self):
        # Alternate between 50 and 150 to exercise both code paths
        typ = random.choice(["50", "150"])
        body = {
            "type": typ,
            # Use unique id to make activation idempotent per-source
            "source": {"type": "loadtest", "id": _rand_id("act"), "channel": "app"},
        }
        with self.client.post(
            "/api/v1/coupon/activate/",
            json=body,
            headers=self._auth_headers(),
            name=f"activate_{typ}",
            catch_response=True,
        ) as resp:
            if resp.status_code == 401:
                self._reauth_if_unauthorized(resp)
            if not resp.ok:
                resp.failure(f"status={resp.status_code}")
                return
            # Optional follow-up on the background task
            try:
                data = resp.json()
            except Exception:
                data = {}
            task_id = data.get("task_id")
            if task_id:
                self.client.get(
                    f"/api/jobs/{int(task_id)}/status/",
                    headers=self._auth_headers(),
                    name="job_status",
                )

    # Very cheap health-check
    @task(1)
    def t_healthz(self):
        self.client.get("/healthz", name="healthz")


@events.test_start.add_listener
def _(environment, **kwargs):
    # Allow pointing to different CSV via ENV
    csv_override = os.getenv("CREDENTIALS_CSV")
    if csv_override:
        CredPool.load(csv_override)
    else:
        CredPool.load()

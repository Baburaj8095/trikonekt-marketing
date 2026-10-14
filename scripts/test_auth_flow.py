import hmac
import hashlib
import base64
import json
import urllib.request
import time
import threading

def generate_jwt(payload, secret):
    header = base64.urlsafe_b64encode(json.dumps({"alg": "HS256", "typ": "JWT"}).encode()).decode().rstrip("=")
    payload_b64 = base64.urlsafe_b64encode(json.dumps(payload).encode()).decode().rstrip("=")
    signature = base64.urlsafe_b64encode(hmac.new(secret.encode(), f"{header}.{payload_b64}".encode(), hashlib.sha256).digest()).decode().rstrip("=")
    return f"{header}.{payload_b64}.{signature}"

JWT_SECRET = "trikonekt_captain_academy_super_secret_key_2026"
token = generate_jwt({"id": "USER_9999999999", "phone": "9999999999", "role": "e-Edu Agent"}, JWT_SECRET)

headers = {
    "Authorization": f"Bearer {token}",
    "Content-Type": "application/json",
    "User-Agent": "Mozilla/5.0"
}

def call(name, url):
    t0 = time.time()
    try:
        req = urllib.request.Request(url, headers=headers)
        with urllib.request.urlopen(req, timeout=15) as r:
            code = r.status
            res = json.loads(r.read().decode())
        t1 = time.time()
        print(f"[{name}] {code} in {(t1-t0)*1000:.1f}ms - success={res.get('success')}")
    except Exception as e:
        print(f"[{name}] FAILED: {e}")

print("--- Testing Sequential Authenticated Calls ---")
call("Profile", "https://trieducation.in/api/auth/profile")
call("Wallet", "https://trieducation.in/api/wallet/overview")
call("Courses", "https://trieducation.in/api/courses")
call("Courses Level 0", "https://trieducation.in/api/courses?rankLevel=0")
call("Courses Level 1", "https://trieducation.in/api/courses?rankLevel=1")

print("\n--- Testing Parallel Page-Load Calls (Exact match to screenshot!) ---")
t_start = time.time()
threads = [
    threading.Thread(target=call, args=("P-Profile", "https://trieducation.in/api/auth/profile")),
    threading.Thread(target=call, args=("P-Wallet", "https://trieducation.in/api/wallet/overview")),
    threading.Thread(target=call, args=("P-Courses", "https://trieducation.in/api/courses")),
    threading.Thread(target=call, args=("P-Courses L0", "https://trieducation.in/api/courses?rankLevel=0")),
    threading.Thread(target=call, args=("P-Courses L1", "https://trieducation.in/api/courses?rankLevel=1")),
]
for t in threads: t.start()
for t in threads: t.join()
print(f"All 5 parallel calls finished in: {(time.time()-t_start)*1000:.1f}ms!")

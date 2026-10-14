import urllib.request
import json
import time

def test_url(name, url, method="GET", payload=None):
    t0 = time.time()
    try:
        data = json.dumps(payload).encode('utf-8') if payload else None
        headers = {'Content-Type': 'application/json', 'User-Agent': 'Mozilla/5.0'}
        req = urllib.request.Request(url, data=data, headers=headers, method=method)
        with urllib.request.urlopen(req, timeout=30) as r:
            status = r.status
        t1 = time.time()
        print(f"[{name}] {method} {url} -> Status: {status}, Time: {t1-t0:.3f}s")
    except urllib.error.HTTPError as e:
        t1 = time.time()
        print(f"[{name}] {method} {url} -> Status: {e.code}, Time: {t1-t0:.3f}s")
    except Exception as e:
        print(f"[{name}] FAILED: {e}")

test_url("asiyapp ranks", "https://asiyapp.com/api/ranks/")
test_url("asiyapp login (bad)", "https://asiyapp.com/api/accounts/login/", method="POST", payload={"username":"9999999999", "password":"wrongpassword"})
test_url("trieducation health", "https://trieducation.in/api/health")
test_url("trieducation courses", "https://trieducation.in/api/courses")
test_url("trieducation login", "https://trieducation.in/api/auth/login", method="POST", payload={"username":"9999999999", "password":"wrongpassword"})
test_url("trieducation profile (anon)", "https://trieducation.in/api/auth/profile")

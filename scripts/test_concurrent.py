import urllib.request
import json
import time
import threading

def call_endpoint(name, url, method="GET", payload=None):
    t0 = time.time()
    try:
        data = json.dumps(payload).encode('utf-8') if payload else None
        headers = {'Content-Type': 'application/json', 'User-Agent': 'Mozilla/5.0'}
        req = urllib.request.Request(url, data=data, headers=headers, method=method)
        with urllib.request.urlopen(req, timeout=30) as r:
            status = r.status
        t1 = time.time()
        print(f"[{name}] Done -> Status: {status}, Time: {t1-t0:.3f}s")
    except urllib.error.HTTPError as e:
        t1 = time.time()
        print(f"[{name}] Done -> Status: {e.code}, Time: {t1-t0:.3f}s")
    except Exception as e:
        print(f"[{name}] FAILED: {e}")

print("Simulating concurrent page load (4 requests simultaneously)...")
t_start = time.time()
threads = [
    threading.Thread(target=call_endpoint, args=("courses 1", "https://trieducation.in/api/courses")),
    threading.Thread(target=call_endpoint, args=("login test", "https://trieducation.in/api/auth/login", "POST", {"username":"9999999999", "password":"wrongpassword"})),
    threading.Thread(target=call_endpoint, args=("sponsor val", "https://trieducation.in/api/auth/validate-sponsor?sponsor=9999999999")),
    threading.Thread(target=call_endpoint, args=("courses 2", "https://trieducation.in/api/courses?rankLevel=0")),
]

for t in threads:
    t.start()
for t in threads:
    t.join()

print(f"All 4 finished in: {time.time()-t_start:.3f}s")

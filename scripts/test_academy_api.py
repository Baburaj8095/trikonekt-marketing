import urllib.request
import json

url = "http://127.0.0.1:5005/api/auth/login"
data = json.dumps({"username": "9999999999", "password": "123456"}).encode('utf-8')
req = urllib.request.Request(url, data=data, headers={'Content-Type': 'application/json'})

try:
    with urllib.request.urlopen(req) as resp:
        res = json.loads(resp.read().decode('utf-8'))
        print("LOGIN RESPONSE:")
        print(json.dumps(res, indent=2))
        token = res.get("token")
        
        # Test my-orders
        orders_req = urllib.request.Request("http://127.0.0.1:5005/api/orders/my-orders", headers={'Authorization': f'Bearer {token}'})
        with urllib.request.urlopen(orders_req) as o_resp:
            print("MY ORDERS:")
            print(json.dumps(json.loads(o_resp.read().decode('utf-8')), indent=2))

        # Test profile
        prof_req = urllib.request.Request("http://127.0.0.1:5005/api/auth/profile", headers={'Authorization': f'Bearer {token}'})
        with urllib.request.urlopen(prof_req) as p_resp:
            print("PROFILE:")
            print(json.dumps(json.loads(p_resp.read().decode('utf-8')), indent=2))

except Exception as e:
    print(f"Error: {e}")

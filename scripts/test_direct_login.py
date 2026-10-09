import urllib.request
import json

req = urllib.request.Request(
    'http://127.0.0.1:8001/api/accounts/login/',
    data=json.dumps({'username': '9999999999', 'password': '123456'}).encode('utf-8'),
    headers={'Content-Type': 'application/json'}
)

try:
    with urllib.request.urlopen(req) as resp:
        body = resp.read().decode()
        data = json.loads(body)
        print('HTTP Status:', resp.status)
        print('Login Successful!')
        print('Tokens returned keys:', list(data.keys()))
        print('User Info:', data.get('user', {}))
        
        # Test refresh token
        refresh_token = data.get('refresh') or data.get('tokens', {}).get('refresh')
        if refresh_token:
            req_ref = urllib.request.Request(
                'http://127.0.0.1:8001/api/accounts/token/refresh/',
                data=json.dumps({'refresh': refresh_token}).encode('utf-8'),
                headers={'Content-Type': 'application/json'}
            )
            with urllib.request.urlopen(req_ref) as resp_ref:
                print('Token Refresh Status:', resp_ref.status)
except urllib.error.HTTPError as e:
    print('HTTP ERROR:', e.code, e.read().decode())

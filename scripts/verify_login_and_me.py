import urllib.request
import json

login_req = urllib.request.Request(
    'http://127.0.0.1:8001/api/accounts/login/',
    data=json.dumps({'username': '9999999999', 'password': '123456'}).encode('utf-8'),
    headers={'Content-Type': 'application/json'}
)

try:
    with urllib.request.urlopen(login_req) as resp:
        body = json.loads(resp.read().decode())
        print('1. Login HTTP Status:', resp.status)
        access_token = body.get('access')
        print('2. Access token obtained successfully.')

        # Fetch /api/accounts/me/
        me_req = urllib.request.Request(
            'http://127.0.0.1:8001/api/accounts/me/',
            headers={'Authorization': f'Bearer {access_token}'}
        )
        with urllib.request.urlopen(me_req) as me_resp:
            me_data = json.loads(me_resp.read().decode())
            print('3. /api/accounts/me/ HTTP Status:', me_resp.status)
            print('   Username:', me_data.get('username'))
            print('   Role:', me_data.get('role'))
            print('   Category:', me_data.get('category'))
            print('   Rank Profile:', me_data.get('rank_profile'))
except Exception as e:
    print('Error:', e)

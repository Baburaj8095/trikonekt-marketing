import os
import sys
import json
import urllib.request

def test_api_calls():
    print("=== TESTING TRIACADEMY & BACKEND APIS FOR TEST USERS ===")
    
    users = ["9999999999", "9999999991", "9999999992", "9999999993", "9999999994", "9999999995"]
    
    for u in users:
        print(f"\n--- Testing Login & Wallet for {u} ---")
        
        # 1. Test Login to Django Port 8001
        try:
            req = urllib.request.Request(
                "http://127.0.0.1:8001/api/accounts/login/",
                data=json.dumps({"username": u, "password": "123456", "role": "user"}).encode("utf-8"),
                headers={"Content-Type": "application/json"}
            )
            with urllib.request.urlopen(req) as resp:
                data = json.loads(resp.read().decode("utf-8"))
                access_token = data.get("access") or data.get("token") or (data.get("tokens", {}).get("access"))
                print(f"• Django Login (Port 8001): SUCCESS (Status {resp.status}) | User ID: {data.get('user', {}).get('id')}")
                
                # Query Wallet Me
                if access_token:
                    w_req = urllib.request.Request(
                        "http://127.0.0.1:8001/api/user/wallet/me/",
                        headers={"Authorization": f"Bearer {access_token}"}
                    )
                    with urllib.request.urlopen(w_req) as w_resp:
                        w_data = json.loads(w_resp.read().decode("utf-8"))
                        print(f"  Wallet API Response: Main Balance: ₹{w_data.get('balance', w_data.get('main_wallet_balance', 0))}, Self Pocket: ₹{w_data.get('self_account_balance', 0)}, Vouchers: ₹{w_data.get('voucher_balance', 0)}")
        except Exception as e:
            print(f"• Django Login / Wallet error for {u}: {e}")

        # 2. Test Direct DB Overview via TriAcademy Bridge Script
        try:
            cmd = f"/srv/trikonekt/staging/backend/.venv/bin/python /srv/trikonekt/tri-academy/backend/src/scripts/growth_bridge_exec.py --action user_overview --phone {u}"
            output = os.popen(cmd).read()
            data = json.loads(output.strip().split("\n")[-1])
            print(f"• TriAcademy Bridge user_overview: SUCCESS -> Rank: L{data.get('rankLevel')}, Main Wallet: ₹{data.get('mainWalletBalance')}, Self Account: ₹{data.get('selfAccount')}, Vouchers: ₹{data.get('voucherBalance')}")
        except Exception as e:
            print(f"• TriAcademy Bridge error for {u}: {e}")

if __name__ == "__main__":
    test_api_calls()

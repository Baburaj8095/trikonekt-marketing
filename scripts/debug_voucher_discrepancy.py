import subprocess

ssh_key = r"C:\Users\babur\Downloads\TRI_MARKETING.pem"
remote_cmd = r"""
sudo /srv/trikonekt/staging/backend/.venv/bin/python - << 'EOF'
import sys, os, traceback, json
sys.path.insert(0, '/srv/trikonekt/staging/backend')

try:
    if os.path.exists('/etc/trikonekt/staging-backend.env'):
        with open('/etc/trikonekt/staging-backend.env') as f:
            for line in f:
                line = line.strip()
                if '=' in line and not line.startswith('#'):
                    k, v = line.split('=', 1)
                    os.environ[k] = v

    os.environ.setdefault('DJANGO_SETTINGS_MODULE', 'core.settings')
    import django
    django.setup()

    from accounts.models import CustomUser
    from business.models import SPPGiftCard
    from business.services.spp_service import SPPService

    u = CustomUser.objects.filter(phone='9999999999').first() or CustomUser.objects.filter(username='9999999999').first()
    print("User:", u.id, u.username)

    # Update any existing cards for user to match standardized code and ACTIVE status
    cards = list(SPPGiftCard.objects.filter(user=u))
    for c in cards:
        c.coupon_code = f"TK-SPP-M{c.box_number}-9999-1000"
        c.status = "ACTIVE"
        c.qr_code_data = json.dumps({
            "brand": "TRIKONEKT",
            "type": "SPP_GIFT_CARD",
            "coupon_code": c.coupon_code,
            "phone": "9999999999",
            "amount": 1000.0,
            "season": c.season_number,
            "box": c.box_number,
            "status": "ACTIVE"
        })
        c.save(update_fields=["coupon_code", "status", "qr_code_data"])
        print(f"Updated card #{c.id}: code={c.coupon_code}, status={c.status}")

    # Now run sync_gift_cards_for_user to ensure it runs cleanly
    synced = SPPService.sync_gift_cards_for_user(u)
    print(f"Sync returned {len(synced)} cards.")

    # Test API response
    from rest_framework.test import APIRequestFactory, force_authenticate
    from business.views import SPPGiftCardListView

    factory = APIRequestFactory()
    request = factory.get('/api/business/spp/gift-cards/?season=1')
    force_authenticate(request, user=u)

    view = SPPGiftCardListView.as_view()
    response = view(request)
    print("API STATUS:", response.status_code)
    print("API RESPONSE RESULTS COUNT:", len(response.data.get('results', [])))
    print("SUMMARY:", json.dumps(response.data.get('summary', {}), indent=2))
    for r in response.data.get('results', []):
        print("RESULT CARD:", r['coupon_code'], "Box:", r['box_number'], "Status:", r['status'], "Amount:", r['amount'])

except Exception as e:
    traceback.print_exc()
EOF
"""

cmd = ["ssh", "-i", ssh_key, "-o", "StrictHostKeyChecking=no", "ubuntu@65.0.40.184", remote_cmd]
res = subprocess.run(cmd, capture_output=True, text=True)
print("STDOUT:")
print(res.stdout)
if res.stderr:
    print("STDERR:")
    print(res.stderr)

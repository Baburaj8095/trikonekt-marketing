import os
import sys

sys.path.insert(0, '/srv/trikonekt/staging/backend')
os.environ.setdefault("DJANGO_SETTINGS_MODULE", "core.settings")

import django
django.setup()

from business.models import PromoPurchase
from accounts.models import CustomUser

def fix_spp_boxes():
    print("=== ADJUSTING SPP BOXES TO EXACT 1 MONTH (₹1,000 VOUCHER) FOR DIRECTS ===")
    phones = ["9999999991", "9999999992", "9999999993", "9999999994", "9999999995"]
    
    for p in phones:
        u = CustomUser.objects.filter(phone=p).first() or CustomUser.objects.filter(username=p).first()
        if not u:
            continue
        spp_purchases = PromoPurchase.objects.filter(user=u, package__type='MONTHLY')
        for sp in spp_purchases:
            sp.quantity = 1
            sp.boxes_json = [1]
            sp.save()
            print(f"• User {u.username}: SPP PromoPurchase #{sp.id} updated -> quantity=1, boxes=[1] (₹1,000 Voucher)")

    print("\n=== VERIFYING TRIACADEMY BRIDGE USER OVERVIEW ===")
    for p in phones:
        cmd = f"/srv/trikonekt/staging/backend/.venv/bin/python /srv/trikonekt/tri-academy/backend/src/scripts/growth_bridge_exec.py --action user_overview --phone {p}"
        output = os.popen(cmd).read()
        import json
        data = json.loads(output.strip().split("\n")[-1])
        print(f"• User {p}: Voucher Balance: ₹{data.get('voucherBalance')} | Purchased Boxes: {data.get('purchasedBoxes')}")

if __name__ == "__main__":
    fix_spp_boxes()

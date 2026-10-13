import sys, os
env_path = "/etc/trikonekt/staging-backend.env"
if os.path.exists(env_path):
    with open(env_path) as f:
        for line in f:
            line = line.strip()
            if line and not line.startswith("#") and "=" in line:
                k, v = line.split("=", 1)
                os.environ[k.strip()] = v.strip()

sys.path.insert(0, '/srv/trikonekt/staging/backend')
os.environ.setdefault('DJANGO_SETTINGS_MODULE', 'core.settings')
import django
django.setup()

from accounts.models import CustomUser
from business.models import PromoPurchase, PromoMonthlyBox, AutoPoolAccount
from mlm_ranks.models import RankUpgrade

test_ids = [1, 2, 3, 15, 1102, 1103, 1104, 1105, 1106, 1114, 1115]
for uid in test_ids:
    u = CustomUser.objects.filter(id=uid).first()
    if not u:
        continue
    print(f"\n================ USER #{u.id} ({u.username}) ================")
    print("first_purchase_activated_at:", u.first_purchase_activated_at)
    print("account_active:", u.account_active)
    
    # Check PromoPurchases
    pps = list(PromoPurchase.objects.filter(user=u).order_by("id"))
    print(f"PromoPurchase count: {len(pps)}")
    for pp in pps:
        print(f"  PP #{pp.id} | pkg: {getattr(pp.package, 'name', None)} ({getattr(pp.package, 'code', None)}) | status: {pp.status} | req: {pp.requested_at} | app: {pp.approved_at} | slug: {pp.tri_app_slug}")
        
    # Check PromoMonthlyBox
    mbs = list(PromoMonthlyBox.objects.filter(user=u).order_by("id"))
    print(f"PromoMonthlyBox count: {len(mbs)}")
    for mb in mbs:
        print(f"  MB #{mb.id} | box #{mb.box_number} | created: {mb.created_at}")
        
    # Check RankUpgrade
    rugs = list(RankUpgrade.objects.filter(user=u).order_by("id"))
    print(f"RankUpgrade count: {len(rugs)}")
    for ru in rugs:
        print(f"  RU #{ru.id} | L{ru.from_rank.level_number}->L{ru.to_rank.level_number} | status: {ru.payment_status} | upgraded_at: {ru.upgraded_at} | created: {ru.created_at}")
        
    # Check AutoPoolAccount
    aps = list(AutoPoolAccount.objects.filter(owner=u).order_by("id"))
    print(f"AutoPoolAccount count: {len(aps)}")
    for ap in aps:
        print(f"  AP #{ap.id} | {ap.pool_type} | entry_idx: {ap.user_entry_index} | created: {ap.created_at}")

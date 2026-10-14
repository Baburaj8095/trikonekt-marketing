import os, sys, django
sys.path.insert(0, "/srv/trikonekt/staging/backend")
os.environ.setdefault("DJANGO_SETTINGS_MODULE", "core.settings")
django.setup()
from accounts.models import CustomUser, Wallet
from business.models import PromoPurchase, AutoPoolAccount, PromoMonthlyBox
from mlm_ranks.models import RankUpgrade

for u in CustomUser.objects.all().order_by("id"):
    p_cnt = PromoPurchase.objects.filter(user=u).count()
    pool_cnt = AutoPoolAccount.objects.filter(owner=u).count()
    box_cnt = PromoMonthlyBox.objects.filter(user=u).count()
    rank_cnt = RankUpgrade.objects.filter(user=u).count()
    w = Wallet.objects.filter(user=u).first()
    bal = getattr(w, "balance", 0) if w else 0
    earn = getattr(w, "total_earned", getattr(w, "main_balance", 0)) if w else 0
    if p_cnt > 0 or pool_cnt > 0 or box_cnt > 0 or rank_cnt > 0 or bal > 0 or earn > 0:
        print(f"User ID: {u.id} | {u.username} | Phone: {u.phone} | Purchases: {p_cnt} | Pools: {pool_cnt} | Boxes: {box_cnt} | Ranks: {rank_cnt} | Bal: {bal} | Earn: {earn}")

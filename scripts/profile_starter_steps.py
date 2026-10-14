import time
import sys
sys.path.insert(0, '/srv/trikonekt/tri-academy/backend/src/scripts')
import growth_bridge_exec
from django.utils import timezone
from accounts.models import CustomUser, Wallet, WalletTransaction
from business.models import PromoPurchase, PromoPackage, CommissionConfig
from mlm_ranks.models import Rank, RankUpgrade
from mlm_ranks.services.commission import CommissionDistributor
from business.services.prime import distribute_prime_750_payouts
from business.services.monthly import distribute_monthly_759_payouts

user = growth_bridge_exec.get_user('9999999999')
print(f"User: {user}")

t0 = time.time()
growth_bridge_exec.fix_commission_config()
print(f"fix_commission_config: {time.time() - t0:.4f}s")

t0 = time.time()
pkg750 = PromoPackage.objects.filter(code="PRIME750").first() or PromoPackage.objects.filter(price=750).first()
p_join = PromoPurchase.objects.create(
    user=user,
    package=pkg750,
    status="APPROVED",
    prime750_choice="REDEEM",
    approved_at=timezone.now(),
)
print(f"create PromoPurchase: {time.time() - t0:.4f}s")

t0 = time.time()
distribute_prime_750_payouts(user, source={"type": "PRIME_750", "id": p_join.id})
print(f"distribute_prime_750_payouts: {time.time() - t0:.4f}s")

t0 = time.time()
pkg759 = PromoPackage.objects.filter(code="MONTHLY759").first() or PromoPackage.objects.filter(price=759).first()
p_spp = PromoPurchase.objects.create(
    user=user,
    package=pkg759,
    quantity=1,
    status="APPROVED",
    boxes_json=[1],
    approved_at=timezone.now(),
)
distribute_monthly_759_payouts(user, is_first_month=True, source={"type": "MONTHLY_FIRST_SEASON-1", "id": p_spp.id})
print(f"distribute_monthly_759_payouts: {time.time() - t0:.4f}s")

t0 = time.time()
r1 = Rank.objects.filter(level_number=1).first()
ru = RankUpgrade.objects.create(
    user=user,
    from_rank=r1,
    to_rank=r1,
    upgrade_amount=250,
    gst_amount=45,
    net_amount=205,
    payment_status=RankUpgrade.STATUS_SUCCESS,
    upgraded_at=timezone.now(),
)
from mlm_ranks.services.five_matrix import FiveMatrixService
FiveMatrixService.on_rank1_approval(ru)
print(f"FiveMatrixService.on_rank1_approval: {time.time() - t0:.4f}s")

t0 = time.time()
CommissionDistributor.distribute(ru)
print(f"CommissionDistributor.distribute: {time.time() - t0:.4f}s")

t0 = time.time()
overview = growth_bridge_exec.get_user_overview(user.username)
print(f"get_user_overview: {time.time() - t0:.4f}s")

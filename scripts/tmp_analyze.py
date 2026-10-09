
from accounts.models import CustomUser, Wallet, WalletTransaction
from business.models import PromoPurchase, PromoPackage
from mlm_ranks.models import Rank, RankUpgrade, UpgradeCommission

u = CustomUser.objects.filter(username='8095918105').first()
sp = CustomUser.objects.filter(username='9999999999').first()

print("=== 1. PROMO PURCHASES FOR 8095918105 ===")
for p in PromoPurchase.objects.filter(user=u).order_by('id'):
    print(f"ID #{p.id} | Package: {p.package.code if p.package else None} | Price: {p.package.price if p.package else None} | Status: {p.status} | PkgNum: {p.package_number} | Boxes: {p.boxes_json} | Date: {p.requested_at}")

print("\n=== 2. SPONSOR (9999999999) WALLET TRANSACTIONS ===")
txs = WalletTransaction.objects.filter(user=sp).order_by('id')
for t in txs:
    print(f"TX #{t.id:<5} | Type: {t.type:<22} | Amount: ₹{t.amount:<8.2f} | BalanceAfter: ₹{t.balance_after:<8.2f} | Meta: {t.meta}")

print("\n=== 3. RANK UPGRADES FOR 8095918105 ===")
for ru in RankUpgrade.objects.filter(user=u).order_by('to_rank__level_number'):
    print(f"Rank L{ru.to_rank.level_number} ({ru.to_rank.rank_name}) | NetAmt: ₹{ru.net_amount} | Status: {ru.payment_status} | UpgradedAt: {ru.upgraded_at}")

print("\n=== 4. UPGRADE COMMISSIONS DISTRIBUTED TO SPONSOR ===")
for uc in UpgradeCommission.objects.filter(upgrade__user=u).order_by('id'):
    print(f"UC #{uc.id} | Upgrade L{uc.upgrade.to_rank.level_number} | Beneficiary: {uc.beneficiary.username} | Type: {uc.commission_type} | Amt: ₹{uc.amount} | Level: {uc.level}")

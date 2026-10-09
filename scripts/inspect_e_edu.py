import os
import django

os.environ.setdefault('DJANGO_SETTINGS_MODULE', 'core.settings')
django.setup()

from django.contrib.auth import get_user_model
from accounts.models import WalletTransaction, WalletAccount
from mlm_ranks.models import RankUpgrade, UpgradeCommission, CommissionHold, UserRank

User = get_user_model()

u_admin = User.objects.filter(username='admin').first()
u_root = User.objects.filter(username='9999999999').first()
u_buyer = User.objects.filter(username='8095918105').first()

print("==================================================")
print("ALL RANK UPGRADES IN SYSTEM:")
print("==================================================")
for ru in RankUpgrade.objects.all().order_by('id'):
    print(f"Upgrade #{ru.id:3d} | User: {ru.user.username} (ID {ru.user.id}) | From: {ru.from_rank.rank_name if ru.from_rank else 'None'} -> To: {ru.to_rank.rank_name} (L{ru.to_rank.level_number}) | Amt: ₹{ru.upgrade_amount} | Time: {ru.created_at}")

print("\n==================================================")
print("UPGRADE COMMISSIONS GENERATED:")
print("==================================================")
for uc in UpgradeCommission.objects.all().order_by('id'):
    fields = {f.name: getattr(uc, f.name) for f in uc._meta.fields}
    print(f"UC #{uc.id:3d} |", fields)

print("\n==================================================")
print("TRANSACTIONS CREDITED TO ADMIN (USER 1):")
print("==================================================")
for wt in WalletTransaction.objects.filter(user=u_admin).order_by('id'):
    print(f"WT #{wt.id:4d} | Amt: ₹{wt.amount:7.2f} | Type: {wt.type:20s} | Src: {wt.source_type:18s} | Meta: {wt.meta}")

print("\n==================================================")
print("TRANSACTIONS CREDITED TO 9999999999 (USER 78):")
print("==================================================")
for wt in WalletTransaction.objects.filter(user=u_root).order_by('id'):
    print(f"WT #{wt.id:4d} | Amt: ₹{wt.amount:7.2f} | Type: {wt.type:20s} | Src: {wt.source_type:18s} | Meta: {wt.meta}")

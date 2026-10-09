import sys, os
sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
from run_remote_helper import run_remote

code = """
from accounts.models import CustomUser, WalletTransaction
from mlm_ranks.models import RankUpgrade, Rank
from business.models import CommissionConfig, PromoPurchase
from django.utils import timezone
from datetime import datetime
import subprocess

print('=== 1. CHECKING USERS WITH RANKS >= 7 ===')
upgrades = RankUpgrade.objects.filter(payment_status='SUCCESS', to_rank__level_number__gte=7).select_related('user', 'to_rank', 'user__state', 'user__city')
for u in upgrades:
    print(f"User: {u.user.username} ({u.user.phone}) | Rank: L{u.to_rank.level_number} | State: {getattr(u.user.state, 'name', None)} | City: {getattr(u.user.city, 'name', None)} | UpgradedAt: {u.upgraded_at}")

print('\\n=== 2. ALL USERS AT RANK 8, 9, 10 ===')
l8_upgrades = RankUpgrade.objects.filter(payment_status='SUCCESS', to_rank__level_number__gte=8).select_related('user', 'to_rank')
print(f"Total L8+ upgrades: {l8_upgrades.count()}")
for u in l8_upgrades:
    print(f"User: {u.user.username} | Rank L{u.to_rank.level_number} | UpgradedAt: {u.upgraded_at}")

print('\\n=== 3. CHECKING ALL USERS IN DB (Highest Rank achieved) ===')
users = CustomUser.objects.filter(account_active=True).exclude(role='admin')[:20]
for usr in users:
    r_max = RankUpgrade.objects.filter(user=usr, payment_status='SUCCESS').order_by('-to_rank__level_number').first()
    if r_max:
        print(f"User: {usr.username} ({usr.phone}) -> Highest Rank: L{r_max.to_rank.level_number}")

print('\\n=== 4. CHECKING CRON / AUTOMATED JOBS FOR MIDNIGHT POOL ===')
try:
    crontab_out = subprocess.run(['sudo', 'crontab', '-l'], capture_output=True, text=True).stdout
    print('Root Crontab:\\n' + (crontab_out or 'EMPTY'))
except Exception as e:
    print('Crontab error:', e)

try:
    ubuntu_cron = subprocess.run(['crontab', '-l'], capture_output=True, text=True).stdout
    print('Ubuntu Crontab:\\n' + (ubuntu_cron or 'EMPTY'))
except Exception as e:
    print('Ubuntu crontab error:', e)

print('\\n=== 5. SYSTEMD TIMERS / SERVICES ===')
try:
    timers = subprocess.run(['systemctl', 'list-timers', '--all'], capture_output=True, text=True).stdout
    print('Systemd Timers:\\n' + timers)
except Exception as e:
    print('Systemd timers error:', e)

print('\\n=== 6. RECENT DAILY_POOL_DISTRIBUTION TRANSACTIONS ===')
daily_txs = WalletTransaction.objects.filter(source_type='DAILY_POOL_DISTRIBUTION').order_by('-created_at')[:10]
print(f"Total daily pool transactions: {daily_txs.count()}")
for t in daily_txs:
    print(f"{t.created_at} | User: {t.user.username} | Amount: {t.amount} | Type: {t.type} | SourceId: {t.source_id}")
"""

run_remote(code)

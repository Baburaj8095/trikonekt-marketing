import os
import sys
import django
from decimal import Decimal

# Set up Django environment
sys.path.insert(0, '/srv/trikonekt/staging/backend')
os.environ.setdefault('DJANGO_SETTINGS_MODULE', 'core.settings')
django.setup()

from django.db import connection
from accounts.models import CustomUser, Wallet, WalletTransaction
from business.models import PromoPackage, PromoPurchase, AutoPoolAccount
from mlm_ranks.models import Rank, RankUpgrade, RankMatrixRoot, RankMatrixNode

phone = "9999999999"
u = CustomUser.objects.filter(phone=phone).first() or CustomUser.objects.filter(username=phone).first()

print("="*60)
print(f"USER: {u.id} | {u.username} | {u.phone} | active={u.account_active} | sponsor={u.sponsor_id}")

print("\n--- PROMO PURCHASES ---")
for p in PromoPurchase.objects.filter(user=u).order_by("requested_at"):
    print(f"ID={p.id} | pkg={p.package.name} ({p.package.code}, ₹{p.package.price}) | status={p.status} | mode={p.payment_mode} | at={p.requested_at}")

print("\n--- RANK UPGRADES ---")
for r in RankUpgrade.objects.filter(user=u).order_by("created_at"):
    from_lvl = r.from_rank.level_number if r.from_rank else "-"
    to_lvl = r.to_rank.level_number if r.to_rank else "-"
    print(f"ID={r.id} | {from_lvl} -> {to_lvl} ({r.to_rank.rank_name if r.to_rank else ''}) | amount={r.upgrade_amount} | net={r.net_amount} | status={r.payment_status} | at={r.created_at}")

print("\n--- WALLETS ---")
w = Wallet.objects.filter(user=u).first()
if w:
    print(f"Legacy Wallet: balance={w.balance} | main_balance={w.main_balance}")

with connection.cursor() as c:
    c.execute("SELECT column_name FROM information_schema.columns WHERE table_name = 'accounts_walletaccount'")
    cols = [r[0] for r in c.fetchall()]
    print("accounts_walletaccount columns:", cols)
    c.execute(f"SELECT * FROM accounts_walletaccount WHERE user_id = %s", [u.id])
    for row in c.fetchall():
        print("  WalletAccount row:", dict(zip(cols, row)))

print("\n--- RECENT TRANSACTIONS ---")
for tx in WalletTransaction.objects.filter(user=u).order_by("-created_at")[:20]:
    print(f"TX={tx.id} | type={tx.type} | amt={tx.amount} | bal_after={tx.balance_after} | src={tx.source_type} ({tx.source_id}) | meta={tx.meta} | at={tx.created_at}")

print("\n--- AUTOPOOL ACCOUNTS (count={}) ---".format(AutoPoolAccount.objects.filter(owner=u).count()))
for ap in AutoPoolAccount.objects.filter(owner=u).order_by("id"):
    parent_id = ap.parent_account_id
    print(f"AP ID={ap.id} | pool={ap.pool_type} | idx={ap.user_entry_index} | key={ap.username_key} | src={ap.source_type} ({ap.source_id}) | parent={parent_id} | lvl={ap.level} | status={ap.status}")

print("\n--- VOUCHERS / COUPONS ---")
with connection.cursor() as c:
    c.execute("""
        SELECT table_name FROM information_schema.tables WHERE table_name LIKE '%voucher%' OR table_name LIKE '%coupon%'
    """)
    tbls = [r[0] for r in c.fetchall()]
    print("Tables:", tbls)
    for t in tbls:
        try:
            c.execute(f"SELECT COUNT(*) FROM {t} WHERE user_id = %s", [u.id])
            cnt = c.fetchone()[0]
            print(f"{t}: count for user = {cnt}")
            if cnt > 0:
                c.execute(f"SELECT * FROM {t} WHERE user_id = %s ORDER BY id DESC LIMIT 5", [u.id])
                for r in c.fetchall():
                    print(f"  {r}")
        except Exception as e:
            # maybe user column is assigned_to_id
            try:
                c.execute(f"SELECT COUNT(*) FROM {t} WHERE assigned_to_id = %s", [u.id])
                cnt = c.fetchone()[0]
                print(f"{t} (assigned_to): count for user = {cnt}")
                if cnt > 0:
                    c.execute(f"SELECT * FROM {t} WHERE assigned_to_id = %s ORDER BY id DESC LIMIT 5", [u.id])
                    for r in c.fetchall():
                        print(f"  {r}")
            except Exception:
                pass

print("="*60)

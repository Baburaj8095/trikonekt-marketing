import os
import sys

sys.path.insert(0, '/srv/trikonekt/staging/backend')
os.environ.setdefault('DJANGO_SETTINGS_MODULE', 'core.settings')

if os.path.exists('/etc/trikonekt/staging-backend.env'):
    with open('/etc/trikonekt/staging-backend.env') as f:
        for line in f:
            line = line.strip()
            if line and not line.startswith('#') and '=' in line:
                k, v = line.split('=', 1)
                os.environ[k.strip()] = v.strip().strip('"\'')

import django
django.setup()
from django.contrib.auth import get_user_model
from mlm_ranks.models import RankMatrixNode, UserRank, RankUpgrade, UpgradeCommission

User = get_user_model()
users = User.objects.filter(phone__endswith='779')
for u779 in users:
    print('==============================')
    print(f'User: {u779.username} | phone: {u779.phone} | id: {u779.id}')
    sponsor = getattr(u779, 'parent', None)
    print(f'Direct Sponsor (parent): {sponsor.username if sponsor else None} (phone: {sponsor.phone if sponsor else None})')
    
    # Check RankMatrixNode
    nodes = RankMatrixNode.objects.filter(placed_user=u779)
    for node in nodes:
        print(f'RankMatrix Node under Root {node.root_user.phone if node.root_user else None} -> Parent: {node.parent_user.phone if node.parent_user else None} | level_depth: {node.level_depth} | pos: {node.position}')
    
    curr = u779
    dist = 0
    print('Ancestors up the RankMatrix chain (under root 9999999999):')
    while curr:
        n = RankMatrixNode.objects.filter(placed_user=curr).first()
        if not n or not n.parent_user:
            break
        dist += 1
        curr = n.parent_user
        ur = UserRank.objects.filter(user=curr).first()
        rk = ur.current_rank.level_number if ur and ur.current_rank else 'None'
        print(f'  Distance {dist} Ancestor: {curr.username} (phone: {curr.phone}) | Current Rank: {rk}')

    # Upgrades for this user
    upgrades = RankUpgrade.objects.filter(user=u779).order_by('to_rank__level_number')
    print(f'Upgrades for {u779.username}: {upgrades.count()}')
    for upg in upgrades:
        print(f'  To Rank: {upg.to_rank.level_number if upg.to_rank else None} | Status: {upg.payment_status} | Amount: {upg.upgrade_amount}')
        comms = UpgradeCommission.objects.filter(upgrade=upg)
        for c in comms:
            print(f'    -> Comm: {c.commission_type} to {c.to_user.phone} amount: {c.commission_amount} status: {c.status} level: {c.level}')

    from accounts.models import Wallet, WalletTransaction
    cu_txs = WalletTransaction.objects.filter(type="RANK_OVERFLOW", meta__from_user_id=u779.id).order_by('id')
    print(f'Overflow / Washed out transactions from user {u779.phone}: {cu_txs.count()}')
    for t in cu_txs:
        meta = t.meta or {}
        print(f'  Tx {t.id} | Level {meta.get("level")} Washed Out | Amount: ₹{t.amount} | Type: {t.type} | To: {t.user.username}')



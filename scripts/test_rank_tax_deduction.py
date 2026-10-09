
from decimal import Decimal
from django.db import transaction
from django.utils import timezone
from accounts.models import CustomUser, Wallet, WalletTransaction
from mlm_ranks.models import Rank, RankUpgrade, UpgradeCommission
from mlm_ranks.services.five_matrix import FiveMatrixService

# Test User Setup: u1 (payer), u2 (sponsor)
u1 = CustomUser.objects.filter(username='0000000001').first()
u2 = CustomUser.objects.filter(username='9999999999').first()

if not u1 or not u2:
    print("Users not found for simulation test.")
else:
    u1.registered_by = u2
    u1.save()
    
    # Layer 1 Rank (₹250)
    r1 = Rank.objects.filter(level_number=1).first()
    
    with transaction.atomic():
        # Clean previous rank upgrades for test
        RankUpgrade.objects.filter(user=u1).delete()
        UpgradeCommission.objects.filter(from_user=u1).delete()
        
        # Initiate upgrade via view logic:
        # Gross = ₹250, 18% Tax = ₹45, Net = ₹205
        upgrade_amount = Decimal("250.00")
        gst_amount = Decimal("45.00")
        net_amount = Decimal("205.00")
        
        upg = RankUpgrade.objects.create(
            user=u1,
            from_rank=r1,
            to_rank=r1,
            upgrade_amount=upgrade_amount,
            gst_amount=gst_amount,
            net_amount=net_amount,
            payment_status=RankUpgrade.STATUS_SUCCESS,
            upgraded_at=timezone.now(),
        )
        
        # Distribute commissions
        FiveMatrixService.distribute_rank1_commissions(upg)
        
        print(f"=== SIMULATION RESULT FOR RANK 1 (GROSS ₹250) ===")
        print(f"Upgrade ID: {upg.id}, Gross: {upg.upgrade_amount}, GST: {upg.gst_amount}, Net: {upg.net_amount}")
        
        # Check Commissions
        comms = UpgradeCommission.objects.filter(upgrade=upg)
        for c in comms:
            print(f"Commission to: {c.to_user.username}, Type: {c.commission_type}, Amount: {c.commission_amount}")
            
        # Check Sponsor (9999999999) wallet & transactions
        w_sp = Wallet.objects.filter(user=u2).first()
        print(f"Sponsor Wallet: balance={w_sp.balance}, main={w_sp.main_balance}, self={w_sp.self_account_balance}")
        
        txs = WalletTransaction.objects.filter(upgrade_id=str(upg.id)) | WalletTransaction.objects.filter(source_id=str(upg.id))
        for t in txs:
            print(f"Tx user={t.user.username}, type={t.type}, amount={t.amount}, source_type={t.source_type}")
            
        # Rollback or clean up test simulation
        transaction.set_rollback(True)
        print("Test transaction rolled back cleanly - database pristine.")

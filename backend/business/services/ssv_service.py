from decimal import Decimal
import uuid
from django.utils import timezone
from django.db import transaction
from django.conf import settings
from accounts.models import CustomUser, Wallet, WalletTransaction
import logging

logger = logging.getLogger(__name__)

class SSVService:
    TOTAL_VOUCHERS_TARGET = 15
    MONTHLY_BOX_AMOUNT = Decimal("1000.00")
    TRANSFER_FEE_PERCENT_PACKAGE = Decimal("7.00")
    CYCLE_1_E_EDU_FEE_PERCENT = Decimal("15.00")
    CYCLE_2_E_EDU_FEE_PERCENT = Decimal("25.00")

    @classmethod
    def get_user_ssv_summary(cls, user: CustomUser):
        """
        Returns summary of the 15-voucher Smart Shopping Voucher system:
        - 1 initial paid (via ₹2,000 package)
        - 12 monthly subscription vouchers
        - 2 company bonus vouchers upon completing all 12 monthly payments
        """
        from business.models import SPPGiftCard

        # Map SPPGiftCards as SSV records for this user
        cards = SPPGiftCard.objects.filter(user=user, season_number=1).order_by("box_number", "id")
        
        total_boxes = cards.count()
        used_count = cards.filter(status="REDEEMED").count()
        active_count = cards.filter(status="ACTIVE").count()
        locked_count = cards.filter(status="LOCKED").count()
        matured_count = cards.filter(status__in=["MATURITY_ELIGIBLE", "MATURED_PAID"]).count()

        # Check if user has initial package
        has_initial_package = user.purchases.filter(package__price__gte=2000, status__in=["approved", "completed"]).exists() or total_boxes >= 1

        # If user has completed 12 boxes, +2 bonus vouchers are awarded (total 15)
        has_bonus = total_boxes >= 12

        vouchers_data = []
        for i in range(1, 16):
            card = cards.filter(box_number=i).first() if i <= 13 else None
            
            if i == 1:
                v_type = "INITIAL_PAID"
                v_label = "Box 1 (Auto-purchased with ₹2,000 Package)"
                v_amount = "1000.00"
                is_available = has_initial_package
            elif 2 <= i <= 13:
                month_num = i
                v_type = "MONTHLY_PAID"
                v_label = f"Month {month_num} Subscription Box"
                v_amount = "1000.00"
                is_available = total_boxes >= (i - 1)
            else: # 14, 15 (Bonus vouchers of ₹2,000 each)
                bonus_idx = i - 13
                v_type = "BONUS_COMPANY"
                v_label = f"Company Shopping/Merchant Bonus Voucher {bonus_idx} (₹2,000)"
                v_amount = "2000.00"
                is_available = total_boxes >= 12

            status = "AVAILABLE" if is_available else "LOCKED"
            if card:
                status = "USED" if card.status == "REDEEMED" else card.status

            vouchers_data.append({
                "voucher_number": i,
                "label": v_label,
                "type": v_type,
                "amount": v_amount,
                "code": card.coupon_code if card else f"SPP-M{i:02d}-{user.phone or user.id}-{str(uuid.uuid4())[:4].upper()}",
                "status": status,
                "is_used": status == "USED",
                "used_at": card.redeemed_at.strftime("%d %b %Y, %I:%M %p") if card and card.redeemed_at else None,
                "invoice_number": f"INV-SPP-2026-{user.id:04d}-{i:02d}",
                "invoice_date": card.purchased_at.strftime("%d %b %Y") if card else timezone.now().strftime("%d %b %Y"),
                "redeemable_for": "Trikonekt Shopping & Near Store Merchant",
            })

        return {
            "total_target": cls.TOTAL_VOUCHERS_TARGET,
            "total_completed": total_boxes + (2 if has_bonus else 0),
            "months_paid": min(12, total_boxes),
            "bonus_awarded": 2 if has_bonus else 0,
            "bonus_amount": "4000.00" if has_bonus else "0.00",
            "has_initial_package": has_initial_package,
            "active_count": active_count + (1 if has_initial_package and total_boxes == 0 else 0),
            "used_count": used_count,
            "vouchers": vouchers_data,
        }

    @classmethod
    @transaction.atomic
    def process_p2p_coupon_transfer(cls, sender: CustomUser, recipient_phone: str, amount: Decimal, coupon_type: str = "PACKAGE_COUPON"):
        """
        Transfers coupon/wallet balance P2P with exact fee deduction:
        - PACKAGE_COUPON: 7% deduction fee
        - E_EDU_COUPON Cycle 1: 15% deduction fee
        - E_EDU_COUPON Cycle 2+: 25% deduction fee
        """
        recipient = CustomUser.objects.filter(phone=recipient_phone.strip()).first()
        if not recipient:
            recipient = CustomUser.objects.filter(username=recipient_phone.strip()).first()
        if not recipient:
            raise ValueError(f"Recipient user '{recipient_phone}' not found.")

        if sender.id == recipient.id:
            raise ValueError("Cannot transfer coupons to yourself.")

        # Determine fee percentage
        if coupon_type == "PACKAGE_COUPON":
            fee_percent = cls.TRANSFER_FEE_PERCENT_PACKAGE # 7%
        elif coupon_type == "E_EDU_COUPON_CYCLE_2":
            fee_percent = cls.CYCLE_2_E_EDU_FEE_PERCENT # 25%
        else:
            # Check user cycle
            transfer_count = WalletTransaction.objects.filter(
                user=sender,
                type__in=["P2P_PACKAGE_COUPON_SEND", "P2P_TRANSFER_SEND"]
            ).count()
            fee_percent = cls.CYCLE_2_E_EDU_FEE_PERCENT if transfer_count >= 1 else cls.CYCLE_1_E_EDU_FEE_PERCENT

        fee_amount = (amount * fee_percent / Decimal("100.00")).quantize(Decimal("0.01"))
        net_amount = amount - fee_amount

        # Check sender wallet balance
        sender_wallet = Wallet.get_or_create_for_user(sender)
        current_bal = sender_wallet.withdrawable_balance
        if current_bal < amount:
            raise ValueError(f"Insufficient withdrawable balance (₹{current_bal}) to transfer ₹{amount}.")

        # Deduct from sender withdrawable balance
        sender_wallet.withdrawable_balance -= amount
        sender_wallet.save(update_fields=["withdrawable_balance", "updated_at"])

        WalletTransaction.objects.create(
            user=sender,
            amount=-amount,
            balance_after=sender_wallet.withdrawable_balance,
            type="P2P_PACKAGE_COUPON_SEND",
            meta={
                "recipient_id": recipient.id,
                "recipient_phone": recipient.phone or recipient.username,
                "gross_amount": str(amount),
                "fee_percent": str(fee_percent),
                "fee_amount": str(fee_amount),
                "net_amount": str(net_amount),
                "coupon_type": coupon_type,
            }
        )

        # Credit recipient withdrawable balance (net amount)
        recipient_wallet = Wallet.get_or_create_for_user(recipient)
        recipient_wallet.withdrawable_balance += net_amount
        recipient_wallet.save(update_fields=["withdrawable_balance", "updated_at"])

        WalletTransaction.objects.create(
            user=recipient,
            amount=net_amount,
            balance_after=recipient_wallet.withdrawable_balance,
            type="P2P_PACKAGE_COUPON_RECEIVE",
            meta={
                "sender_id": sender.id,
                "sender_phone": sender.phone or sender.username,
                "gross_amount": str(amount),
                "fee_percent": str(fee_percent),
                "fee_amount": str(fee_amount),
                "net_amount": str(net_amount),
                "coupon_type": coupon_type,
            }
        )

        # Record admin charges ledger entry for company fee
        admin_user = CustomUser.objects.filter(is_superuser=True).first() or sender
        WalletTransaction.objects.create(
            user=admin_user,
            amount=fee_amount,
            balance_after=Decimal("0.00"),
            type="ADMIN_CHARGE_P2P_FEE",
            meta={
                "source_user_id": sender.id,
                "source_user_phone": sender.phone or sender.username,
                "fee_percent": str(fee_percent),
                "charge_category": "P2P_TRANSACTION_FEE",
                "gross_amount": str(amount),
            }
        )

        return {
            "success": True,
            "sender": sender.phone or sender.username,
            "recipient": recipient.phone or recipient.username,
            "gross_amount": float(amount),
            "fee_percent": float(fee_percent),
            "fee_amount": float(fee_amount),
            "net_amount": float(net_amount),
            "transferred_at": timezone.now().strftime("%d %b %Y, %I:%M %p"),
        }

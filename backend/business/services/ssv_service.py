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
    def process_p2p_coupon_transfer(cls, sender: CustomUser, recipient_phone: str, amount: Decimal, coupon_type: str = "PACKAGE_COUPON", fund_source: str = "MAIN"):
        """
        Transfers coupon/wallet balance P2P with exact fee deduction:
        - PACKAGE_COUPON: Admin-configured deduction fee (defaults to 7%) and generates assigned ConsumerVoucher
        - E_EDU_COUPON Cycle 1: 15% deduction fee
        - E_EDU_COUPON Cycle 2+: 25% deduction fee
        """
        from datetime import timedelta
        from business.models import CommissionConfig
        from accounts.models import ConsumerVoucher

        recipient = CustomUser.objects.filter(phone=recipient_phone.strip()).first()
        if not recipient:
            recipient = CustomUser.objects.filter(username=recipient_phone.strip()).first()
        if not recipient:
            raise ValueError(f"Recipient user '{recipient_phone}' not found.")

        if sender.id == recipient.id:
            raise ValueError("Cannot transfer coupons to yourself.")

        cfg = CommissionConfig.get_solo()
        # Determine fee percentage
        if coupon_type == "PACKAGE_COUPON":
            fee_percent = cfg.get_p2p_package_tax_percent()
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
        main_bal = sender_wallet.main_balance
        withdraw_bal = sender_wallet.withdrawable_balance
        
        if main_bal >= amount:
            sender_wallet.main_balance -= amount
            sender_wallet.save(update_fields=["main_balance", "updated_at"])
            balance_after = sender_wallet.main_balance
        elif withdraw_bal >= amount:
            sender_wallet.withdrawable_balance -= amount
            sender_wallet.save(update_fields=["withdrawable_balance", "updated_at"])
            balance_after = sender_wallet.withdrawable_balance
        else:
            raise ValueError(f"Insufficient available balance (₹{max(main_bal, withdraw_bal)}) to transfer ₹{amount}.")

        voucher_code = None
        if coupon_type == "PACKAGE_COUPON":
            voucher_code = f"PKG-{uuid.uuid4().hex[:8].upper()}"
            voucher = ConsumerVoucher.objects.create(
                creator=sender,
                assigned_to=recipient,
                voucher_type=ConsumerVoucher.TYPE_PACKAGE_PURCHASE,
                code=voucher_code,
                amount=net_amount,
                status=ConsumerVoucher.STATUS_ACTIVE,
                expires_at=timezone.now() + timedelta(days=90),
                note=f"P2P package coupon from {sender.phone or sender.username}",
            )

        send_tx = WalletTransaction.objects.create(
            user=sender,
            amount=-amount,
            balance_after=balance_after,
            type="P2P_PACKAGE_COUPON_SEND",
            meta={
                "recipient_id": recipient.id,
                "recipient_phone": recipient.phone or recipient.username,
                "gross_amount": str(amount),
                "fee_percent": str(fee_percent),
                "fee_amount": str(fee_amount),
                "net_amount": str(net_amount),
                "coupon_type": coupon_type,
                "voucher_code": voucher_code or "",
            }
        )

        if voucher_code and 'voucher' in locals():
            voucher.debit_transaction = send_tx
            voucher.save(update_fields=["debit_transaction"])

        # If not package coupon (direct internal balance send), credit recipient withdrawable balance
        if coupon_type != "PACKAGE_COUPON":
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
        else:
            # Create notification transaction for recipient indicating voucher received
            WalletTransaction.objects.create(
                user=recipient,
                amount=Decimal("0.00"),
                balance_after=Wallet.get_or_create_for_user(recipient).withdrawable_balance,
                type="P2P_PACKAGE_COUPON_RECEIVE",
                meta={
                    "sender_id": sender.id,
                    "sender_phone": sender.phone or sender.username,
                    "gross_amount": str(amount),
                    "fee_percent": str(fee_percent),
                    "fee_amount": str(fee_amount),
                    "net_amount": str(net_amount),
                    "coupon_type": coupon_type,
                    "voucher_code": voucher_code,
                    "status": "VOUCHER_ASSIGNED",
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
                "voucher_code": voucher_code or "",
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
            "voucher_code": voucher_code,
            "transferred_at": timezone.now().strftime("%d %b %Y, %I:%M %p"),
        }

    @classmethod
    def send_due_date_reminders(cls, dry_run: bool = False):
        """
        Automated SSV 2nd-month due-date reminder task:
        Finds all users who purchased SSV / Smart Product Package Month 1 (box_number=1)
        and have not yet purchased Month 2 (box_number=2).
        Calculates Month 2 due date = box1.created_at.date() + 30 days.
        Sends:
          - 3 days before due date (days_remaining == 3)
          - 1 day before due date (days_remaining == 1)
          - Due today (days_remaining == 0)
        Prevents duplicate sends on the same calendar day.
        """
        from datetime import timedelta
        from django.core.cache import cache
        from django.core.mail import send_mail
        from business.models import PromoMonthlyBox
        from notifications.models import Notification

        today = timezone.localdate()
        box1_records = PromoMonthlyBox.objects.filter(box_number=1).select_related("user")

        processed = 0
        reminders_3_days = 0
        reminders_1_day = 0
        reminders_due_today = 0
        overdue_count = 0
        dispatched = 0
        user_results = []

        for b1 in box1_records:
            user = b1.user
            processed += 1

            # Check if user already purchased box 2
            has_box2 = PromoMonthlyBox.objects.filter(user=user, box_number=2).exists()
            if has_box2:
                continue

            b1_date = b1.created_at.date() if b1.created_at else today
            due_date = b1_date + timedelta(days=30)
            days_remaining = (due_date - today).days

            event_type = None
            title = None
            body = None
            priority = "normal"

            user_display = getattr(user, "full_name", None) or getattr(user, "username", "Partner")
            due_date_str = due_date.strftime("%d %b %Y")

            if days_remaining == 3:
                event_type = "3_DAYS_BEFORE"
                reminders_3_days += 1
                title = "SSV Box 2 Subscription Due in 3 Days 📦"
                body = (
                    f"Hello {user_display}, your Smart Product Package (SSV) Month 2 subscription box "
                    f"of Rs. 1,000 is due in 3 days on {due_date_str}. Complete payment on trieducation.in "
                    f"to maintain uninterrupted active benefits."
                )
            elif days_remaining == 1:
                event_type = "1_DAY_BEFORE"
                reminders_1_day += 1
                priority = "high"
                title = "Urgent: SSV Box 2 Due Tomorrow ⏳"
                body = (
                    f"Hello {user_display}, your SSV Month 2 subscription box of Rs. 1,000 is due tomorrow "
                    f"({due_date_str}). Renew today on trieducation.in to secure your monthly product box "
                    f"and loyalty rewards!"
                )
            elif days_remaining == 0:
                event_type = "DUE_TODAY"
                reminders_due_today += 1
                priority = "high"
                title = "Action Required: SSV Box 2 Due Today ⚠️"
                body = (
                    f"Hello {user_display}, your SSV Month 2 subscription box is due today ({due_date_str}). "
                    f"Please complete your renewal on trieducation.in now to keep your rewards active."
                )
            elif days_remaining < 0:
                overdue_count += 1

            if event_type:
                cache_key = f"ssv_reminder:{user.id}:box2:{event_type}:{today.isoformat()}"
                already_sent = bool(cache.get(cache_key))

                if not already_sent and not dry_run:
                    # In-app notification
                    try:
                        Notification.objects.create(
                            user=user,
                            title=title,
                            body=body,
                            channel="in_app",
                            priority=priority,
                            deep_link="https://trieducation.in",
                        )
                    except Exception as ne:
                        logger.warning(f"Notification create error: {ne}")

                    # Email notification
                    if user.email and getattr(settings, "MAIL_ENABLED", False):
                        try:
                            send_mail(
                                title,
                                f"{body}\n\nRenew directly on: https://trieducation.in\n\nRegards,\nTrikonekt Team",
                                getattr(settings, "DEFAULT_FROM_EMAIL", None) or getattr(settings, "EMAIL_HOST_USER", None),
                                [user.email],
                                fail_silently=True,
                            )
                        except Exception as me:
                            logger.warning(f"Email dispatch error for {user.email}: {me}")

                    cache.set(cache_key, True, timeout=86400 * 2)
                    dispatched += 1

                user_results.append({
                    "user_id": user.id,
                    "username": user.username,
                    "phone": user.phone or "",
                    "box1_date": b1_date.isoformat(),
                    "due_date": due_date.isoformat(),
                    "days_remaining": days_remaining,
                    "event_type": event_type,
                    "already_sent": already_sent,
                })

        return {
            "processed_users": processed,
            "reminders_3_days": reminders_3_days,
            "reminders_1_day": reminders_1_day,
            "reminders_due_today": reminders_due_today,
            "overdue_count": overdue_count,
            "dispatched_notifications": dispatched,
            "dry_run": dry_run,
            "results": user_results,
        }

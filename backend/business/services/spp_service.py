from __future__ import annotations

import uuid
import json
import logging
from decimal import Decimal
from datetime import timedelta
from typing import List, Optional, Dict, Any

from django.db import transaction, models
from django.utils import timezone
from django.conf import settings

from accounts.models import CustomUser, Wallet, WalletTransaction
from accounts.finance_constants import WalletTypes, FinanceCategories, LedgerDirections
from accounts.wallet_engine import WalletEngine, LedgerPosting
from business.models import SPPGiftCard, PromoPurchase, PromoMonthlyBox

logger = logging.getLogger(__name__)


class SPPService:
    @staticmethod
    def generate_unique_coupon_code(user: CustomUser) -> str:
        """
        Generate alphanumeric voucher code containing the user's phone number or username:
        e.g., SPP-9876543210-AB12CD
        """
        raw_phone = str(getattr(user, "phone", "") or getattr(user, "phone_number", "") or "").strip()
        # Keep alphanumeric / digits only
        clean_phone = "".join(ch for ch in raw_phone if ch.isalnum())
        if not clean_phone:
            clean_phone = str(getattr(user, "username", "USER")).strip().upper()[:10]

        while True:
            suffix = uuid.uuid4().hex[:6].upper()
            code = f"SPP-{clean_phone}-{suffix}"
            if not SPPGiftCard.objects.filter(coupon_code=code).exists():
                return code

    @classmethod
    def generate_gift_cards_for_boxes(
        cls,
        user: CustomUser,
        purchase: Optional[PromoPurchase],
        season_number: int,
        boxes: List[int],
    ) -> List[SPPGiftCard]:
        """
        Create an SPPGiftCard for each monthly box purchased.
        - ₹1,000 face value
        - Lock for 60 days
        - Valid / Redeemable for 30 days after unlock (Total 90-day window)
        - Generates QR code payload with alphanumeric code containing phone
        """
        created_cards = []
        now = timezone.now()
        base_time = getattr(purchase, "requested_at", None) or now

        # 60 days lock, 30 days active validity (total 90 days)
        unlock_at = base_time + timedelta(days=60)
        expires_at = unlock_at + timedelta(days=30)

        with transaction.atomic():
            for b in boxes:
                try:
                    box_num = int(b)
                except Exception:
                    continue

                # Check if card already exists for this purchase and box
                existing = SPPGiftCard.objects.filter(
                    user=user,
                    season_number=season_number,
                    box_number=box_num,
                    purchase=purchase,
                ).first()

                if existing:
                    created_cards.append(existing)
                    continue

                code = cls.generate_unique_coupon_code(user)
                qr_payload = json.dumps({
                    "brand": "TRIKONEKT",
                    "type": "SPP_GIFT_CARD",
                    "coupon_code": code,
                    "phone": str(getattr(user, "phone", "") or getattr(user, "username", "")),
                    "amount": 1000.00,
                    "season": season_number,
                    "box": box_num,
                    "unlock_at": unlock_at.isoformat(),
                    "expires_at": expires_at.isoformat(),
                })

                card = SPPGiftCard.objects.create(
                    user=user,
                    purchase=purchase,
                    season_number=season_number,
                    box_number=box_num,
                    amount=Decimal("1000.00"),
                    coupon_code=code,
                    qr_code_data=qr_payload,
                    status="LOCKED",
                    unlock_at=unlock_at,
                    expires_at=expires_at,
                )
                created_cards.append(card)

        logger.info("Generated %d SPPGiftCards for User %s (Season %s)", len(created_cards), user.id, season_number)
        return created_cards

    @classmethod
    def evaluate_gift_card_statuses(cls, user: Optional[CustomUser] = None) -> Dict[str, int]:
        """
        Transitions gift cards according to elapsed time:
        - LOCKED (0 to 60 days): transitions to ACTIVE once unlock_at is reached.
        - ACTIVE (60 to 90 days): transitions to MATURITY_ELIGIBLE once expires_at is passed without holiday redemption.
        """
        now = timezone.now()
        qs = SPPGiftCard.objects.all()
        if user:
            qs = qs.filter(user=user)

        # 1. LOCKED -> ACTIVE (after 60 days, before expiry)
        unlocked_count = qs.filter(
            status="LOCKED",
            unlock_at__lte=now,
            expires_at__gt=now,
        ).update(status="ACTIVE")

        # 2. LOCKED or ACTIVE -> MATURITY_ELIGIBLE (after 90 days without redemption)
        matured_count = qs.filter(
            status__in=["LOCKED", "ACTIVE"],
            expires_at__lte=now,
        ).update(status="MATURITY_ELIGIBLE")

        return {
            "unlocked_to_active": unlocked_count,
            "expired_to_maturity_eligible": matured_count,
        }

    @classmethod
    def check_and_process_annual_maturity(
        cls,
        user: CustomUser,
        season_number: int = 1,
    ) -> Dict[str, Any]:
        """
        Annual Maturity Bonus Rule:
        - If a user has purchased all 12 monthly boxes (1 to 12) for a given season (total ₹12,000)
        - And NONE of the 12 gift cards were used/redeemed for Tri Holiday packages
        - Credit ₹12,000 (purchased) + ₹2,000 (bonus) = ₹14,000.00 into user's Main Wallet.
        - Mark all 12 cards as MATURED_PAID.
        """
        # Ensure latest statuses
        cls.evaluate_gift_card_statuses(user=user)

        cards = list(SPPGiftCard.objects.filter(user=user, season_number=season_number).order_by("box_number"))
        if len(cards) < 12:
            return {
                "eligible": False,
                "reason": f"Only {len(cards)}/12 boxes purchased in Season {season_number}.",
                "boxes_count": len(cards),
            }

        # Verify distinct boxes 1..12
        box_set = {c.box_number for c in cards}
        if len(box_set) < 12:
            return {
                "eligible": False,
                "reason": f"Purchased boxes do not cover all 1-12 ({len(box_set)}/12 unique).",
                "boxes_count": len(box_set),
            }

        # Check if already paid
        already_paid = any(c.status == "MATURED_PAID" for c in cards)
        if already_paid:
            return {
                "eligible": False,
                "already_paid": True,
                "reason": f"Season {season_number} maturity bonus already paid.",
            }

        # Check if any coupon was redeemed for holiday
        redeemed_cards = [c for c in cards if c.status == "REDEEMED"]
        if redeemed_cards:
            return {
                "eligible": False,
                "reason": f"{len(redeemed_cards)} gift cards were already redeemed for Tri Holiday packages.",
                "redeemed_count": len(redeemed_cards),
            }

        # Total payout: ₹12,000 principal + ₹2,000 bonus = ₹14,000
        payout_amount = Decimal("14000.00")
        per_card_payout = payout_amount / Decimal("12.00")
        now = timezone.now()

        with transaction.atomic():
            w = Wallet.get_or_create_for_user(user)
            tx = w.credit(
                payout_amount,
                tx_type="SPP_ANNUAL_MATURITY_PAYOUT",
                source_type="SPP_MATURITY",
                source_id=f"spp-season-{season_number}-{user.id}",
                meta={
                    "season": season_number,
                    "boxes": 12,
                    "principal_amount": "12000.00",
                    "bonus_amount": "2000.00",
                    "total_payout": str(payout_amount),
                    "reason": "SPP 12-Month Annual Maturity & Bonus Payout",
                },
            )

            try:
                system_user = WalletEngine.get_system_user()
                WalletEngine.post_transaction(
                    category=FinanceCategories.REWARD_DISTRIBUTION,
                    user=user,
                    source_module="SPP_MATURITY",
                    source_id=f"spp-season-{season_number}-{user.id}",
                    destination_module=WalletTypes.MAIN,
                    gross_amount=payout_amount,
                    net_amount=payout_amount,
                    idempotency_key=f"spp_annual_maturity:{user.id}:{season_number}",
                    legacy_wallet_transaction=tx,
                    created_by=system_user,
                    approved_by=system_user,
                    remarks=f"SPP 12-Month Annual Maturity Payout (₹12,000 + ₹2,000 Bonus) Season {season_number}",
                    metadata={"season": season_number, "user_id": user.id, "bonus": 2000, "principal": 12000},
                    postings=[
                        LedgerPosting(system_user, WalletTypes.SYSTEM, LedgerDirections.DEBIT, payout_amount, metadata={"user_id": user.id}),
                        LedgerPosting(user, WalletTypes.MAIN, LedgerDirections.CREDIT, payout_amount, metadata={"season": season_number}),
                    ],
                )
            except Exception as e:
                logger.warning("WalletEngine post failed for SPP maturity: %s", e)

            # Update all 12 cards to MATURED_PAID
            SPPGiftCard.objects.filter(
                id__in=[c.id for c in cards]
            ).update(
                status="MATURED_PAID",
                payout_at=now,
                payout_amount=per_card_payout,
            )

            try:
                from coupons.models import AuditTrail
                AuditTrail.objects.create(
                    action="spp_annual_maturity_paid",
                    actor=user,
                    notes=f"SPP Season {season_number} 12-Month Maturity & Bonus ₹14,000 paid to User {user.id}",
                    metadata={
                        "user_id": user.id,
                        "season_number": season_number,
                        "principal": "12000.00",
                        "bonus": "2000.00",
                        "payout_amount": str(payout_amount),
                    },
                )
            except Exception:
                pass

        logger.info("Successfully credited ₹14,000 SPP Annual Maturity to User %s (Season %s)", user.id, season_number)
        return {
            "eligible": True,
            "success": True,
            "payout_amount": str(payout_amount),
            "season_number": season_number,
            "message": "Congratulations! Your ₹14,000 SPP Annual Maturity & Bonus (₹12k + ₹2k) has been credited to your Main Wallet.",
        }

    @classmethod
    def redeem_gift_card_for_holiday(
        cls,
        user: CustomUser,
        coupon_code: str,
        trip_id: str,
        trip_name: str,
    ) -> Dict[str, Any]:
        """
        Redeems an ACTIVE SPP gift card towards a Tri Holiday package purchase.
        """
        cls.evaluate_gift_card_statuses(user=user)

        card = SPPGiftCard.objects.filter(
            coupon_code__iexact=str(coupon_code).strip(),
            user=user,
        ).first()

        if not card:
            return {"success": False, "detail": "Invalid SPP Gift Card code."}

        if card.status == "LOCKED":
            days_left = max(0, (card.unlock_at - timezone.now()).days)
            return {
                "success": False,
                "detail": f"This gift card is locked for {days_left} more day(s). It can only be redeemed 60 days after box purchase.",
            }

        if card.status == "REDEEMED":
            return {"success": False, "detail": f"Gift card has already been redeemed for trip: {card.redeemed_trip_name or card.redeemed_trip_id}."}

        if card.status in ["MATURITY_ELIGIBLE", "MATURED_PAID"]:
            return {
                "success": False,
                "detail": "This gift card has passed its 30-day holiday redemption window and is now part of your 12-month Annual Maturity Bonus.",
            }

        if card.status != "ACTIVE":
            return {"success": False, "detail": f"Gift card is not active for redemption (Current status: {card.status})."}

        with transaction.atomic():
            card.status = "REDEEMED"
            card.redeemed_at = timezone.now()
            card.redeemed_trip_id = str(trip_id)
            card.redeemed_trip_name = str(trip_name)
            card.save(update_fields=["status", "redeemed_at", "redeemed_trip_id", "redeemed_trip_name"])

            try:
                from coupons.models import AuditTrail
                AuditTrail.objects.create(
                    action="spp_gift_card_redeemed_holiday",
                    actor=user,
                    notes=f"SPP Gift Card {card.coupon_code} (₹1,000) redeemed for Tri Holiday: {trip_name}",
                    metadata={
                        "user_id": user.id,
                        "card_id": card.id,
                        "coupon_code": card.coupon_code,
                        "trip_id": str(trip_id),
                        "trip_name": str(trip_name),
                        "amount": "1000.00",
                    },
                )
            except Exception:
                pass

        return {
            "success": True,
            "discount_amount": str(card.amount),
            "coupon_code": card.coupon_code,
            "trip_name": trip_name,
            "message": f"SPP Gift Card ₹{card.amount} successfully applied to Tri Holiday package '{trip_name}'!",
        }

    @classmethod
    def get_user_renewal_cadence(cls, user: CustomUser, season_number: int = 1) -> Dict[str, Any]:
        """
        Calculates user's 30-day recurring purchase cadence and countdown:
        - If purchased on Sept 23 -> Next purchase due on Oct 23.
        - Returns days remaining, days overdue, streak progress, and next box number.
        """
        from django.utils import timezone
        from business.models import PromoPurchase, SPPGiftCard
        from datetime import timedelta

        cards = list(SPPGiftCard.objects.filter(user=user, season_number=season_number).order_by("box_number"))
        unique_boxes = {c.box_number for c in cards}
        boxes_completed = len(unique_boxes)

        latest_purchase = PromoPurchase.objects.filter(
            user=user,
            package__type="MONTHLY",
            status="APPROVED",
        ).order_by("-requested_at", "-id").first()

        now = timezone.now()
        now_date = now.date()

        if latest_purchase and latest_purchase.requested_at:
            last_date = latest_purchase.requested_at.date()
            next_date = last_date + timedelta(days=30)
            days_diff = (next_date - now_date).days
            days_remaining = max(0, days_diff)
            days_overdue = abs(days_diff) if days_diff < 0 else 0
            is_due = days_diff <= 0

            if days_diff > 5:
                cadence_status = "ON_TRACK"
                status_label = f"Next box due in {days_diff} days"
            elif days_diff > 0:
                cadence_status = "DUE_SOON"
                status_label = f"Due in {days_diff} day{'s' if days_diff > 1 else ''}"
            elif days_diff == 0:
                cadence_status = "DUE_TODAY"
                status_label = "Due Today"
            else:
                cadence_status = "OVERDUE"
                status_label = f"Overdue by {days_overdue} day{'s' if days_overdue > 1 else ''}"

            next_box_num = min(12, boxes_completed + 1)
        else:
            last_date = None
            next_date = now_date
            days_remaining = 0
            days_overdue = 0
            is_due = True
            cadence_status = "READY_FOR_BOX_1"
            status_label = "Ready to start Box 1"
            next_box_num = 1

        return {
            "last_purchase_date": last_date.strftime("%Y-%m-%d") if last_date else None,
            "next_purchase_date": next_date.strftime("%Y-%m-%d") if next_date else None,
            "days_remaining": days_remaining,
            "days_overdue": days_overdue,
            "is_due": is_due,
            "cadence_status": cadence_status,
            "status_label": status_label,
            "boxes_completed": boxes_completed,
            "next_box_number": next_box_num,
            "total_season_boxes": 12,
            "season_number": season_number,
            "is_season_completed": boxes_completed >= 12,
            "universal_usage_note": "SPP monthly boxes and gift cards are universally redeemable across Trikonekt products, packages, coupons, holiday vouchers, or accumulated for the ₹14,000 year-end maturity.",
        }

    @classmethod
    def get_admin_spp_cadence_report(cls, season_number: int = 1) -> Dict[str, Any]:
        """
        Generates comprehensive SPP monthly retention & renewal report for all SPP consumers.
        """
        from accounts.models import CustomUser
        from business.models import PromoPurchase, SPPGiftCard

        user_ids = PromoPurchase.objects.filter(
            package__type="MONTHLY",
            status="APPROVED",
        ).values_list("user_id", flat=True).distinct()

        users = CustomUser.objects.filter(id__in=user_ids).order_by("username")
        report_rows = []

        total_active_spp = len(users)
        on_track_count = 0
        due_soon_count = 0
        due_today_count = 0
        overdue_count = 0
        completed_count = 0

        for u in users:
            cadence = cls.get_user_renewal_cadence(u, season_number=season_number)
            st = cadence["cadence_status"]
            if cadence["is_season_completed"]:
                completed_count += 1
            elif st == "ON_TRACK":
                on_track_count += 1
            elif st == "DUE_SOON":
                due_soon_count += 1
            elif st == "DUE_TODAY":
                due_today_count += 1
            elif st == "OVERDUE":
                overdue_count += 1

            report_rows.append({
                "user_id": u.id,
                "username": u.username,
                "full_name": getattr(u, "full_name", "") or u.username,
                "phone": getattr(u, "phone", "") or "-",
                "boxes_completed": cadence["boxes_completed"],
                "next_box_number": cadence["next_box_number"],
                "last_purchase_date": cadence["last_purchase_date"],
                "next_purchase_date": cadence["next_purchase_date"],
                "days_remaining": cadence["days_remaining"],
                "days_overdue": cadence["days_overdue"],
                "cadence_status": cadence["cadence_status"],
                "status_label": cadence["status_label"],
                "is_due": cadence["is_due"],
                "total_invested": f"{(cadence['boxes_completed'] * 1000.00):.2f}",
            })

        report_rows.sort(key=lambda x: (0 if x["is_due"] else 1, x["days_remaining"]))

        return {
            "summary": {
                "total_spp_users": total_active_spp,
                "on_track_count": on_track_count,
                "due_soon_count": due_soon_count,
                "due_today_count": due_today_count,
                "overdue_count": overdue_count,
                "completed_count": completed_count,
            },
            "results": report_rows,
        }


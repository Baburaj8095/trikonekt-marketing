from decimal import Decimal
from django.http import JsonResponse, HttpResponse
from rest_framework.views import APIView
from rest_framework.permissions import IsAuthenticated
from rest_framework.response import Response
from rest_framework import status
from django.utils import timezone
from accounts.models import CustomUser, WalletTransaction
from .services.ssv_service import SSVService
import logging

logger = logging.getLogger(__name__)

class SSVSummaryView(APIView):
    permission_classes = [IsAuthenticated]

    def get(self, request):
        try:
            summary = SSVService.get_user_ssv_summary(request.user)
            return Response(summary, status=status.HTTP_200_OK)
        except Exception as e:
            logger.exception("Failed to get SSV summary")
            return Response({"detail": str(e)}, status=status.HTTP_500_INTERNAL_SERVER_ERROR)

class P2PCouponTransferView(APIView):
    permission_classes = [IsAuthenticated]

    def post(self, request):
        recipient_phone = request.data.get("recipient_phone") or request.data.get("phone")
        amount = request.data.get("amount")
        coupon_type = request.data.get("coupon_type", "PACKAGE_COUPON")

        if not recipient_phone:
            return Response({"detail": "Recipient phone or username is required."}, status=status.HTTP_400_BAD_REQUEST)
        if not amount:
            return Response({"detail": "Amount is required."}, status=status.HTTP_400_BAD_REQUEST)

        try:
            amount_dec = Decimal(str(amount))
            if amount_dec <= Decimal("0.00"):
                return Response({"detail": "Amount must be positive."}, status=status.HTTP_400_BAD_REQUEST)

            res = SSVService.process_p2p_coupon_transfer(
                sender=request.user,
                recipient_phone=str(recipient_phone),
                amount=amount_dec,
                coupon_type=coupon_type,
            )
            return Response(res, status=status.HTTP_200_OK)
        except ValueError as ve:
            return Response({"detail": str(ve)}, status=status.HTTP_400_BAD_REQUEST)
        except Exception as e:
            logger.exception("P2P transfer error")
            return Response({"detail": str(e)}, status=status.HTTP_500_INTERNAL_SERVER_ERROR)

class P2PCouponHistoryView(APIView):
    permission_classes = [IsAuthenticated]

    def get(self, request):
        try:
            sent_txs = WalletTransaction.objects.filter(
                user=request.user,
                type="P2P_PACKAGE_COUPON_SEND"
            ).order_by("-id")[:50]

            recv_txs = WalletTransaction.objects.filter(
                user=request.user,
                type="P2P_PACKAGE_COUPON_RECEIVE"
            ).order_by("-id")[:50]

            def serialize_tx(tx, mode):
                meta = tx.meta or {}
                return {
                    "id": tx.id,
                    "mode": mode,
                    "type": tx.type,
                    "amount": float(tx.amount),
                    "gross_amount": float(meta.get("gross_amount", tx.amount)),
                    "fee_percent": float(meta.get("fee_percent", 7.0)),
                    "fee_amount": float(meta.get("fee_amount", 0.0)),
                    "net_amount": float(meta.get("net_amount", tx.amount)),
                    "counterparty": meta.get("recipient_phone") if mode == "SENT" else meta.get("sender_phone"),
                    "date": tx.created_at.strftime("%d %b %Y, %I:%M %p") if tx.created_at else "",
                }

            results = [serialize_tx(t, "SENT") for t in sent_txs] + [serialize_tx(t, "RECEIVED") for t in recv_txs]
            results.sort(key=lambda x: x["id"], reverse=True)

            return Response({"results": results}, status=status.HTTP_200_OK)
        except Exception as e:
            return Response({"detail": str(e)}, status=status.HTTP_500_INTERNAL_SERVER_ERROR)

class TotalAdminChargesListView(APIView):
    """
    Admin Endpoint: Returns complete audit history of all Admin Charges:
    1. Package Activation Charges
    2. Transaction Fee Charges (7% P2P fees, 15%/25% E-edu fees)
    3. Admin / Withdrawal Withholding Charges
    """
    permission_classes = [IsAuthenticated]

    def get(self, request):
        if not (request.user.is_staff or request.user.is_superuser or getattr(request.user, 'admin_role', None)):
            return Response({"detail": "Admin authorization required."}, status=status.HTTP_403_FORBIDDEN)

        # Aggregate charges
        charge_txs = WalletTransaction.objects.filter(
            type__in=[
                "ADMIN_CHARGE_P2P_FEE",
                "ADMIN_FEE_HOLD",
                "WITHDRAWAL_TDS_DEDUCTION",
                "WITHDRAWAL_ADMIN_FEE",
                "PACKAGE_ACTIVATION_FEE",
                "SYSTEM_ADMIN_FEE",
            ]
        ).order_by("-id")[:200]

        total_p2p_fees = Decimal("0.00")
        total_activation_fees = Decimal("0.00")
        total_withdrawal_admin_fees = Decimal("0.00")

        items = []
        for tx in charge_txs:
            meta = tx.meta or {}
            amt = tx.amount or Decimal("0.00")
            cat = meta.get("charge_category", tx.type)

            if "P2P" in tx.type or "P2P" in cat:
                total_p2p_fees += amt
                charge_label = "P2P Transaction Fee (7% / 15% / 25%)"
            elif "ACTIVATION" in tx.type:
                total_activation_fees += amt
                charge_label = "Package Activation Fee"
            else:
                total_withdrawal_admin_fees += amt
                charge_label = "Admin / TDS Withholding Charge"

            items.append({
                "id": tx.id,
                "user_phone": meta.get("source_user_phone") or getattr(tx.user, "phone", "") or str(tx.user_id),
                "charge_type": charge_label,
                "raw_type": tx.type,
                "amount": float(amt),
                "gross_amount": float(meta.get("gross_amount", amt)),
                "fee_percent": float(meta.get("fee_percent", 0.0)),
                "date": tx.created_at.strftime("%d %b %Y, %I:%M %p") if tx.created_at else "",
            })

        return Response({
            "summary": {
                "total_admin_charges": float(total_p2p_fees + total_activation_fees + total_withdrawal_admin_fees),
                "total_p2p_fees": float(total_p2p_fees),
                "total_activation_fees": float(total_activation_fees),
                "total_withdrawal_admin_fees": float(total_withdrawal_admin_fees),
                "total_transactions_count": len(items),
            },
            "results": items,
        }, status=status.HTTP_200_OK)

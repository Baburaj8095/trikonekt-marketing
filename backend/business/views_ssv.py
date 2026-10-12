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


class PlatformTaxConfigView(APIView):
    """
    Exposes and allows configuration of platform taxes:
    - P2P Package Coupon Transfer Tax %
    - P2P Coupon Pocket Transfer Tax %
    - Withdrawal Pocket Tax / TDS %
    """
    permission_classes = [IsAuthenticated]

    def get(self, request):
        from business.models import CommissionConfig
        cfg = CommissionConfig.get_solo()
        return Response({
            "p2p_package_tax_percent": float(cfg.get_p2p_package_tax_percent()),
            "p2p_coupon_tax_percent": float(cfg.get_p2p_coupon_tax_percent()),
            "withdrawal_tax_percent": float(cfg.get_withdrawal_tax_percent()),
        }, status=status.HTTP_200_OK)

    def post(self, request):
        if not (request.user.is_staff or request.user.is_superuser or getattr(request.user, 'admin_role', None)):
            return Response({"detail": "Admin authorization required."}, status=status.HTTP_403_FORBIDDEN)
        from business.models import CommissionConfig
        from decimal import Decimal as D
        cfg = CommissionConfig.get_solo()
        master = dict(cfg.master_commission_json or {})
        tc = dict(master.get("taxes_and_charges") or {})

        if "p2p_package_tax_percent" in request.data:
            tc["p2p_package_tax_percent"] = float(D(str(request.data["p2p_package_tax_percent"])))
        if "p2p_coupon_tax_percent" in request.data:
            tc["p2p_coupon_tax_percent"] = float(D(str(request.data["p2p_coupon_tax_percent"])))
        if "withdrawal_tax_percent" in request.data:
            tc["withdrawal_tax_percent"] = float(D(str(request.data["withdrawal_tax_percent"])))

        master["taxes_and_charges"] = tc
        cfg.master_commission_json = master
        cfg.save(update_fields=["master_commission_json", "updated_at"])

        return Response({
            "status": "ok",
            "message": "Platform tax configuration updated successfully.",
            "taxes_and_charges": tc
        }, status=status.HTTP_200_OK)


# =========================================================================
# Admin SSV Vouchers Management (Matching Developer Flow & Screen Spec)
# =========================================================================
import csv
from datetime import datetime, date
from django.db.models import Q, Count, Sum
from locations.models import State
from business.models import StateSSVPool, SSVCycle, SSVVoucher, PromoMonthlyBox


def _format_cycle_duration(start_date, end_date):
    s_str = start_date.strftime("%d-%m-%Y") if start_date else ""
    e_str = end_date.strftime("%d-%m-%Y") if end_date else ""
    if s_str and e_str:
        return f"{s_str} to {e_str}"
    elif s_str:
        return f"From {s_str} (Active)"
    return "Active / Open"


def _ensure_default_cycles_for_state(state):
    """
    Ensure Cycle 1 and Cycle 2 exist for the selected State.
    Cycles do NOT have an end date. Admin enables cycles as users progress.
    """
    SSVCycle.objects.get_or_create(
        state=state,
        cycle_number=1,
        defaults={
            "cycle_label": "Cycle 1",
            "start_date": None,
            "end_date": None,
            "is_active": True,
        }
    )
    SSVCycle.objects.get_or_create(
        state=state,
        cycle_number=2,
        defaults={
            "cycle_label": "Cycle 2",
            "start_date": None,
            "end_date": None,
            "is_active": False,
        }
    )


class AdminSSVStatesView(APIView):
    """Returns all states with their active and available cycles."""
    permission_classes = [IsAuthenticated]

    def get(self, request):
        if not (request.user.is_staff or request.user.is_superuser or getattr(request.user, 'admin_role', None)):
            return Response({"detail": "Admin authorization required."}, status=status.HTTP_403_FORBIDDEN)

        all_states = list(State.objects.all())
        # Deduplicate states by name, ensuring no duplicate entries in dropdown
        seen_names = set()
        states = []
        for s in all_states:
            s_name = s.name.strip().title()
            if s_name.lower() in seen_names:
                continue
            seen_names.add(s_name.lower())
            states.append(s)
        states.sort(key=lambda s: (0 if "karnataka" in s.name.lower() else 1, s.name.lower()))
        if not states:
            karnataka, _ = State.objects.get_or_create(name="Karnataka", country_id=1)
            states = [karnataka]

        res_states = []
        for s in states:
            _ensure_default_cycles_for_state(s)
            cycles = list(SSVCycle.objects.filter(state=s).order_by("cycle_number").values(
                "id", "cycle_number", "cycle_label", "start_date", "end_date", "is_active"
            ))
            formatted_cycles = []
            for c in cycles:
                s_str = c["start_date"].strftime("%d-%m-%Y") if c["start_date"] else ""
                e_str = c["end_date"].strftime("%d-%m-%Y") if c["end_date"] else ""
                dur = _format_cycle_duration(c["start_date"], c["end_date"])
                formatted_cycles.append({
                    "id": c["id"],
                    "cycle_number": c["cycle_number"],
                    "label": f"{c['cycle_label']} ({dur})",
                    "duration": dur,
                    "start_date": s_str,
                    "end_date": e_str,
                    "is_active": c["is_active"],
                })

            matching_states = State.objects.filter(Q(id=s.id) | Q(name__iexact=s.name))
            matching_pools = StateSSVPool.objects.filter(state__in=matching_states)
            tot_amt = float(sum(p.total_accumulated() for p in matching_pools))

            res_states.append({
                "id": s.id,
                "name": s.name,
                "cycles": formatted_cycles,
                "accumulated_amount": tot_amt,
            })

        return Response({"states": res_states}, status=status.HTTP_200_OK)


class AdminSSVDashboardView(APIView):
    """
    Returns the real KPI summary, 4 Category Cards, and Cycle-Wise Summary
    for the selected State and Cycle based 100% on real database records.
    """
    permission_classes = [IsAuthenticated]

    def get(self, request):
        if not (request.user.is_staff or request.user.is_superuser or getattr(request.user, 'admin_role', None)):
            return Response({"detail": "Admin authorization required."}, status=status.HTTP_403_FORBIDDEN)

        state_id = request.query_params.get("state_id")
        cycle_num = int(request.query_params.get("cycle", 1))

        state = None
        if state_id:
            state = State.objects.filter(id=state_id).first()
        if not state:
            state = State.objects.filter(name__iexact="Karnataka").first() or State.objects.first()

        if not state:
            return Response({"detail": "State not found."}, status=status.HTTP_404_NOT_FOUND)

        _ensure_default_cycles_for_state(state)
        current_cycle = SSVCycle.objects.filter(state=state, cycle_number=cycle_num).first()
        cycle_duration_str = _format_cycle_duration(current_cycle.start_date if current_cycle else None, current_cycle.end_date if current_cycle else None)

        # 1. State Real Accumulated Total Amount (aggregating across state variations)
        matching_states = State.objects.filter(Q(id=state.id) | Q(name__iexact=state.name))
        matching_pools = StateSSVPool.objects.filter(state__in=matching_states)
        total_voucher_amount = float(sum(p.total_accumulated() for p in matching_pools))

        # 2. Users in state
        user_qs = CustomUser.objects.filter(
            Q(state=state) | Q(state__name__iexact=state.name),
            is_active=True
        ).exclude(role="admin").exclude(is_superuser=True)

        user_ids = list(user_qs.values_list("id", flat=True))

        # Filter monthly boxes that belong strictly to this cycle (package_number = cycle_num)
        cycle_box_filter = Q(user_id__in=user_ids, package_number=cycle_num)

        box_records = PromoMonthlyBox.objects.filter(cycle_box_filter).values("user_id", "box_number")
        user_boxes = {}
        for br in box_records:
            uid = br["user_id"]
            if uid not in user_boxes:
                user_boxes[uid] = set()
            user_boxes[uid].add(br["box_number"])

        # Issued vouchers in this cycle
        cycle_vouchers = SSVVoucher.objects.filter(state=state, cycle_number=cycle_num)
        voucher_user_categories = {v.user_id: v.period_category for v in cycle_vouchers}

        m1_users = []
        m3_users = []
        m6_users = []
        m12_users = []

        for uid in user_ids:
            cnt = len(user_boxes.get(uid, set()))
            v_cat = voucher_user_categories.get(uid)

            if v_cat == "1_MONTH" or (not v_cat and cnt in (1, 2)):
                m1_users.append(uid)
            elif v_cat == "3_MONTHS" or (not v_cat and 3 <= cnt <= 5):
                m3_users.append(uid)
            elif v_cat == "6_MONTHS" or (not v_cat and 6 <= cnt <= 11):
                m6_users.append(uid)
            elif v_cat == "12_MONTHS" or (not v_cat and cnt >= 12):
                m12_users.append(uid)

        c1_count = len(m1_users)
        c3_count = len(m3_users)
        c6_count = len(m6_users)
        c12_count = len(m12_users)
        total_eligible = c1_count + c3_count + c6_count + c12_count

        # Vouchers Created & Redeemed (strictly real DB counts)
        vouchers_created = cycle_vouchers.count()
        vouchers_redeemed = cycle_vouchers.filter(status="REDEEMED").count()
        pending_vouchers = cycle_vouchers.filter(status="CREATED").count()

        # Real Cycle-Wise Summary for all cycles of this state
        all_cycles = SSVCycle.objects.filter(state=state).order_by("cycle_number")
        cycle_summary = []
        for c in all_cycles:
            c_p_str = _format_cycle_duration(c.start_date, c.end_date)
            c_vouchers = SSVVoucher.objects.filter(state=state, cycle_number=c.cycle_number)
            c_created = c_vouchers.count()
            c_redeemed = c_vouchers.filter(status="REDEEMED").count()
            c_pending = c_vouchers.filter(status="CREATED").count()

            # Eligible users in cycle c (strictly based on package_number = c.cycle_number or existing voucher)
            c_box_users = set(PromoMonthlyBox.objects.filter(
                user_id__in=user_ids,
                package_number=c.cycle_number
            ).values_list("user_id", flat=True))
            c_voucher_users = set(c_vouchers.values_list("user_id", flat=True))
            c_eligible = len(c_box_users | c_voucher_users)

            cycle_summary.append({
                "cycle_id": c.id,
                "cycle": f"Cycle {c.cycle_number}",
                "cycle_number": c.cycle_number,
                "cycle_label": c.cycle_label,
                "period": c_p_str,
                "start_date": c.start_date.strftime("%Y-%m-%d") if c.start_date else "",
                "end_date": c.end_date.strftime("%Y-%m-%d") if c.end_date else "",
                "eligible": c_eligible,
                "created": c_created,
                "redeemed": c_redeemed,
                "pending": c_pending,
                "is_active": c.is_active,
            })

        return Response({
            "state_id": state.id,
            "state_name": state.name,
            "cycle_number": cycle_num,
            "cycle_duration": cycle_duration_str,
            "kpi": {
                "total_voucher_amount": total_voucher_amount,
                "total_eligible_users": total_eligible,
                "vouchers_created": vouchers_created,
                "vouchers_redeemed": vouchers_redeemed,
                "pending_vouchers": pending_vouchers,
            },
            "category_cards": [
                {
                    "key": "1_MONTH",
                    "title": "1 Month",
                    "user_count": c1_count,
                    "payment_display": "₹ 1,000 Or ₹ 2,000",
                    "theme": "blue",
                },
                {
                    "key": "3_MONTHS",
                    "title": "3 Months",
                    "user_count": c3_count,
                    "payment_display": "₹ 3,000",
                    "theme": "orange",
                },
                {
                    "key": "6_MONTHS",
                    "title": "6 Months",
                    "user_count": c6_count,
                    "payment_display": "₹ 6,000",
                    "theme": "purple",
                },
                {
                    "key": "12_MONTHS",
                    "title": "12 Months",
                    "user_count": c12_count,
                    "payment_display": "₹ 12,000",
                    "theme": "red",
                },
            ],
            "cycle_summary": cycle_summary,
        }, status=status.HTTP_200_OK)


class AdminSSVUsersListView(APIView):
    """
    Returns filtered and paginated user details matching the selected State,
    Cycle, Month Tab, Search, Status, and Voucher Status based on real DB records.
    """
    permission_classes = [IsAuthenticated]

    def get(self, request):
        if not (request.user.is_staff or request.user.is_superuser or getattr(request.user, 'admin_role', None)):
            return Response({"detail": "Admin authorization required."}, status=status.HTTP_403_FORBIDDEN)

        state_id = request.query_params.get("state_id")
        cycle_num = int(request.query_params.get("cycle", 1))
        period_tab = request.query_params.get("period", "1_MONTH")
        search_query = (request.query_params.get("search") or "").strip().lower()
        status_filter = (request.query_params.get("status") or "all").lower()
        voucher_status_filter = (request.query_params.get("voucher_status") or "all").upper()

        page = max(1, int(request.query_params.get("page", 1)))
        page_size = max(1, min(100, int(request.query_params.get("page_size", 10))))

        state = None
        if state_id:
            state = State.objects.filter(id=state_id).first()
        if not state:
            state = State.objects.filter(name__iexact="Karnataka").first() or State.objects.first()

        cycle = SSVCycle.objects.filter(state=state, cycle_number=cycle_num).first()

        # Fetch candidate users
        user_qs = CustomUser.objects.filter(
            Q(state=state) | Q(state__name__iexact=state.name if state else ""),
            is_active=True
        ).exclude(role="admin").exclude(is_superuser=True).order_by("id")

        if search_query:
            user_qs = user_qs.filter(
                Q(username__icontains=search_query) |
                Q(phone__icontains=search_query) |
                Q(first_name__icontains=search_query) |
                Q(last_name__icontains=search_query) |
                Q(prefixed_id__icontains=search_query)
            )

        if status_filter == "active":
            user_qs = user_qs.filter(is_active=True)
        elif status_filter == "inactive":
            user_qs = user_qs.filter(is_active=False)

        user_ids = list(user_qs.values_list("id", flat=True)[:1000])

        # Filter monthly boxes belonging strictly to this cycle (package_number = cycle_num)
        cycle_box_filter = Q(user_id__in=user_ids, package_number=cycle_num)

        box_records = PromoMonthlyBox.objects.filter(cycle_box_filter).values("user_id", "box_number")
        user_boxes = {}
        for br in box_records:
            uid = br["user_id"]
            if uid not in user_boxes:
                user_boxes[uid] = set()
            user_boxes[uid].add(br["box_number"])

        # Fetch existing SSV vouchers in this cycle
        vouchers_map = {
            v.user_id: v for v in SSVVoucher.objects.filter(
                user_id__in=user_ids,
                state=state,
                cycle_number=cycle_num
            )
        }

        # Build user rows matching real database data
        eligible_rows = []
        for u in user_qs[:1000]:
            paid_boxes = len(user_boxes.get(u.id, set()))
            v = vouchers_map.get(u.id)

            if v:
                user_cat = v.period_category
                months_cnt = paid_boxes if paid_boxes > 0 else (12 if user_cat == "12_MONTHS" else 6 if user_cat == "6_MONTHS" else 3 if user_cat == "3_MONTHS" else 1)
            else:
                if paid_boxes in (1, 2):
                    user_cat = "1_MONTH"
                    months_cnt = paid_boxes
                elif 3 <= paid_boxes <= 5:
                    user_cat = "3_MONTHS"
                    months_cnt = paid_boxes
                elif 6 <= paid_boxes <= 11:
                    user_cat = "6_MONTHS"
                    months_cnt = paid_boxes
                elif paid_boxes >= 12:
                    user_cat = "12_MONTHS"
                    months_cnt = paid_boxes
                else:
                    user_cat = "NONE"
                    months_cnt = 0

            # Filter by period_tab:
            # If user explicitly searched, allow them through so they can be viewed / issued vouchers
            if period_tab in ("1_MONTH", "3_MONTHS", "6_MONTHS", "12_MONTHS"):
                if user_cat != period_tab and not search_query:
                    continue

            total_payment = float(months_cnt * 1000)

            if v:
                v_status = v.status
                v_code = v.voucher_code
                v_amount = float(v.amount)
            else:
                v_status = "NOT_CREATED"
                v_code = "-"
                v_amount = total_payment

            if voucher_status_filter != "ALL" and v_status != voucher_status_filter:
                continue

            user_code = u.prefixed_id or u.user_code or f"TK{u.id + 100000:06d}"
            name = u.get_full_name() or u.username
            phone = u.phone or "-"
            join_dt = u.date_joined.strftime("%d-%m-%Y") if u.date_joined else ""

            eligible_rows.append({
                "row_number": len(eligible_rows) + 1,
                "user_pk": u.id,
                "user_id": user_code,
                "name": name,
                "mobile": phone,
                "join_date": join_dt,
                "months_completed": f"{months_cnt} Month" if months_cnt == 1 else f"{months_cnt} Months",
                "months_count": months_cnt,
                "total_payment": total_payment,
                "voucher_status": v_status,
                "voucher_code": v_code,
                "voucher_amount": v_amount,
                "account_active": getattr(u, "account_active", True),
            })

        total_rows = len(eligible_rows)
        start_idx = (page - 1) * page_size
        end_idx = start_idx + page_size
        paged_rows = eligible_rows[start_idx:end_idx]

        return Response({
            "count": total_rows,
            "page": page,
            "page_size": page_size,
            "results": paged_rows,
        }, status=status.HTTP_200_OK)


class AdminSSVCyclesView(APIView):
    """
    Returns all cycles for a state with their duration, eligible users,
    created vouchers, redeemed vouchers, pending vouchers, and is_active flag.
    """
    permission_classes = [IsAuthenticated]

    def get(self, request):
        if not (request.user.is_staff or request.user.is_superuser or getattr(request.user, 'admin_role', None)):
            return Response({"detail": "Admin authorization required."}, status=status.HTTP_403_FORBIDDEN)

        state_id = request.query_params.get("state_id")
        state = State.objects.filter(id=state_id).first() if state_id else State.objects.filter(name__iexact="Karnataka").first() or State.objects.first()

        if not state:
            return Response({"detail": "State not found."}, status=status.HTTP_404_NOT_FOUND)

        _ensure_default_cycles_for_state(state)
        cycles = SSVCycle.objects.filter(state=state).order_by("cycle_number")

        user_ids = list(CustomUser.objects.filter(
            Q(state=state) | Q(state__name__iexact=state.name),
            is_active=True
        ).exclude(role="admin").exclude(is_superuser=True).values_list("id", flat=True))

        results = []
        for c in cycles:
            c_vouchers = SSVVoucher.objects.filter(state=state, cycle_number=c.cycle_number)
            c_created = c_vouchers.count()
            c_redeemed = c_vouchers.filter(status="REDEEMED").count()
            c_pending = c_vouchers.filter(status="CREATED").count()

            # Eligible users in cycle c (strictly based on package_number = c.cycle_number or existing voucher)
            c_box_users = set(PromoMonthlyBox.objects.filter(
                user_id__in=user_ids,
                package_number=c.cycle_number
            ).values_list("user_id", flat=True))
            c_voucher_users = set(c_vouchers.values_list("user_id", flat=True))
            c_eligible = len(c_box_users | c_voucher_users)

            s_str = c.start_date.strftime("%d-%m-%Y") if c.start_date else ""
            e_str = c.end_date.strftime("%d-%m-%Y") if c.end_date else ""
            dur = _format_cycle_duration(c.start_date, c.end_date)

            results.append({
                "id": c.id,
                "cycle_number": c.cycle_number,
                "cycle_label": c.cycle_label,
                "start_date": c.start_date.strftime("%Y-%m-%d") if c.start_date else "",
                "end_date": c.end_date.strftime("%Y-%m-%d") if c.end_date else "",
                "start_display": s_str,
                "end_display": e_str,
                "duration": dur,
                "is_active": c.is_active,
                "eligible_users": c_eligible,
                "vouchers_created": c_created,
                "vouchers_redeemed": c_redeemed,
                "pending_vouchers": c_pending,
            })

        return Response({
            "state_id": state.id,
            "state_name": state.name,
            "cycles": results,
        }, status=status.HTTP_200_OK)


class AdminSSVActivateCycleView(APIView):
    """
    Activates the specified cycle for a state, marking all other cycles for that state as inactive.
    """
    permission_classes = [IsAuthenticated]

    def post(self, request):
        if not (request.user.is_staff or request.user.is_superuser or getattr(request.user, 'admin_role', None)):
            return Response({"detail": "Admin authorization required."}, status=status.HTTP_403_FORBIDDEN)

        cycle_id = request.data.get("cycle_id")
        state_id = request.data.get("state_id")
        cycle_number = request.data.get("cycle_number")

        cycle = None
        if cycle_id:
            cycle = SSVCycle.objects.filter(id=cycle_id).first()
        elif state_id and cycle_number:
            cycle = SSVCycle.objects.filter(state_id=state_id, cycle_number=int(cycle_number)).first()

        if not cycle:
            return Response({"detail": "Cycle not found."}, status=status.HTTP_404_NOT_FOUND)

        # Deactivate all cycles for this state
        SSVCycle.objects.filter(state=cycle.state).update(is_active=False)
        # Activate this cycle
        cycle.is_active = True
        cycle.save(update_fields=["is_active"])

        return Response({
            "success": True,
            "message": f"{cycle.cycle_label} is now active for {cycle.state.name}.",
            "active_cycle": {
                "id": cycle.id,
                "cycle_number": cycle.cycle_number,
                "cycle_label": cycle.cycle_label,
                "duration": _format_cycle_duration(cycle.start_date, cycle.end_date),
                "is_active": True,
            }
        }, status=status.HTTP_200_OK)


class AdminSSVSaveCycleView(APIView):
    """
    Creates or updates an SSV Cycle for a state.
    Cycles do not have end dates. Admin activates cycles as users reach their earning limits.
    """
    permission_classes = [IsAuthenticated]

    def post(self, request):
        if not (request.user.is_staff or request.user.is_superuser or getattr(request.user, 'admin_role', None)):
            return Response({"detail": "Admin authorization required."}, status=status.HTTP_403_FORBIDDEN)

        cycle_id = request.data.get("id")
        state_id = request.data.get("state_id")
        cycle_number = request.data.get("cycle_number")
        cycle_label = (request.data.get("cycle_label") or "").strip()
        start_date_str = request.data.get("start_date")
        end_date_str = request.data.get("end_date")
        is_active = bool(request.data.get("is_active", False))

        if not state_id:
            return Response({"detail": "state_id is required."}, status=status.HTTP_400_BAD_REQUEST)
        if not cycle_number:
            return Response({"detail": "cycle_number is required."}, status=status.HTTP_400_BAD_REQUEST)

        state = State.objects.filter(id=state_id).first()
        if not state:
            return Response({"detail": "State not found."}, status=status.HTTP_404_NOT_FOUND)

        start_date = None
        if start_date_str:
            try:
                start_date = datetime.strptime(start_date_str, "%Y-%m-%d").date()
            except Exception:
                return Response({"detail": "Invalid start_date format. Use YYYY-MM-DD."}, status=status.HTTP_400_BAD_REQUEST)

        end_date = None
        if end_date_str:
            try:
                end_date = datetime.strptime(end_date_str, "%Y-%m-%d").date()
            except Exception:
                return Response({"detail": "Invalid end_date format. Use YYYY-MM-DD."}, status=status.HTTP_400_BAD_REQUEST)

        if start_date and end_date and end_date <= start_date:
            return Response({"detail": "End date must be after start date."}, status=status.HTTP_400_BAD_REQUEST)

        if cycle_id:
            cycle = SSVCycle.objects.filter(id=cycle_id, state=state).first()
            if not cycle:
                return Response({"detail": "Cycle not found to update."}, status=status.HTTP_404_NOT_FOUND)
            cycle.cycle_number = int(cycle_number)
            cycle.cycle_label = cycle_label or f"Cycle {cycle_number}"
            cycle.start_date = start_date
            cycle.end_date = end_date
            cycle.save()
        else:
            cycle, _ = SSVCycle.objects.update_or_create(
                state=state,
                cycle_number=int(cycle_number),
                defaults={
                    "cycle_label": cycle_label or f"Cycle {cycle_number}",
                    "start_date": start_date,
                    "end_date": end_date,
                    "is_active": is_active,
                }
            )

        if is_active:
            SSVCycle.objects.filter(state=state).exclude(id=cycle.id).update(is_active=False)
            cycle.is_active = True
            cycle.save(update_fields=["is_active"])

        return Response({
            "success": True,
            "message": f"Cycle {cycle.cycle_number} saved successfully.",
            "cycle": {
                "id": cycle.id,
                "cycle_number": cycle.cycle_number,
                "cycle_label": cycle.cycle_label,
                "start_date": cycle.start_date.strftime("%Y-%m-%d") if cycle.start_date else "",
                "end_date": cycle.end_date.strftime("%Y-%m-%d") if cycle.end_date else "",
                "duration": _format_cycle_duration(cycle.start_date, cycle.end_date),
                "is_active": cycle.is_active,
            }
        }, status=status.HTTP_200_OK)


class AdminSSVCreateVoucherView(APIView):
    """
    Creates an SSV Voucher for a specific user, validates payment eligibility,
    prevents duplicate creation, and marks voucher status as CREATED.
    """
    permission_classes = [IsAuthenticated]

    def post(self, request):
        if not (request.user.is_staff or request.user.is_superuser or getattr(request.user, 'admin_role', None)):
            return Response({"detail": "Admin authorization required."}, status=status.HTTP_403_FORBIDDEN)

        user_ident = request.data.get("user_id")
        amount = request.data.get("amount")
        remarks = request.data.get("remarks", "")
        state_id = request.data.get("state_id")
        cycle_num = int(request.data.get("cycle", 1))
        period_cat = request.data.get("period", "1_MONTH")

        if not user_ident:
            return Response({"detail": "User ID is required."}, status=status.HTTP_400_BAD_REQUEST)
        if not amount:
            return Response({"detail": "Voucher Amount is required."}, status=status.HTTP_400_BAD_REQUEST)

        # Lookup user
        user = CustomUser.objects.filter(
            Q(id__iexact=user_ident if str(user_ident).isdigit() else 0) |
            Q(username__iexact=str(user_ident)) |
            Q(prefixed_id__iexact=str(user_ident)) |
            Q(phone__iexact=str(user_ident))
        ).first()

        if not user:
            return Response({"detail": f"User '{user_ident}' not found."}, status=status.HTTP_404_NOT_FOUND)

        state = State.objects.filter(id=state_id).first() if state_id else getattr(user, "state", None) or State.objects.filter(name__iexact="Karnataka").first() or State.objects.first()

        # Check duplicate
        existing = SSVVoucher.objects.filter(
            user=user,
            state=state,
            cycle_number=cycle_num,
            period_category=period_cat,
            status__in=["CREATED", "REDEEMED"]
        ).first()

        if existing:
            return Response({
                "detail": f"Voucher already exists for {user.username} in Cycle {cycle_num} ({existing.voucher_code}).",
                "voucher_code": existing.voucher_code,
                "status": existing.status,
            }, status=status.HTTP_400_BAD_REQUEST)

        import uuid
        code = f"SSV-{state.name[:3].upper() if state else 'GEN'}-{user.id:04d}-{str(uuid.uuid4())[:6].upper()}"

        voucher = SSVVoucher.objects.create(
            user=user,
            state=state,
            cycle_number=cycle_num,
            period_category=period_cat,
            amount=Decimal(str(amount)),
            voucher_code=code,
            status="CREATED",
            remarks=remarks,
            issued_by=request.user,
        )

        return Response({
            "success": True,
            "message": f"SSV Voucher {code} created successfully for {user.get_full_name() or user.username}.",
            "voucher": {
                "id": voucher.id,
                "voucher_code": voucher.voucher_code,
                "amount": float(voucher.amount),
                "status": voucher.status,
                "user_id": user.prefixed_id or user.username,
                "name": user.get_full_name() or user.username,
                "created_at": voucher.created_at.strftime("%d-%m-%Y %H:%M"),
            }
        }, status=status.HTTP_201_CREATED)


class AdminSSVRedeemVoucherView(APIView):
    """Marks a created voucher as REDEEMED."""
    permission_classes = [IsAuthenticated]

    def post(self, request):
        if not (request.user.is_staff or request.user.is_superuser or getattr(request.user, 'admin_role', None)):
            return Response({"detail": "Admin authorization required."}, status=status.HTTP_403_FORBIDDEN)

        code = request.data.get("voucher_code")
        v_id = request.data.get("voucher_id")

        voucher = SSVVoucher.objects.filter(Q(id=v_id) | Q(voucher_code=code)).first()
        if not voucher:
            return Response({"detail": "Voucher not found."}, status=status.HTTP_404_NOT_FOUND)

        if voucher.status == "REDEEMED":
            return Response({"detail": "Voucher is already redeemed."}, status=status.HTTP_400_BAD_REQUEST)

        voucher.status = "REDEEMED"
        voucher.redeemed_at = timezone.now()
        voucher.save(update_fields=["status", "redeemed_at"])

        return Response({
            "success": True,
            "message": f"Voucher {voucher.voucher_code} successfully redeemed.",
            "voucher_code": voucher.voucher_code,
            "status": voucher.status,
        }, status=status.HTTP_200_OK)


class AdminSSVExportCSVView(APIView):
    """Exports filtered user list into CSV format strictly using real data."""
    permission_classes = [IsAuthenticated]

    def get(self, request):
        if not (request.user.is_staff or request.user.is_superuser or getattr(request.user, 'admin_role', None)):
            return HttpResponse("Unauthorized", status=403)

        state_id = request.query_params.get("state_id")
        cycle_num = int(request.query_params.get("cycle", 1))
        period_tab = request.query_params.get("period", "1_MONTH")

        state = None
        if state_id:
            state = State.objects.filter(id=state_id).first()
        if not state:
            state = State.objects.filter(name__iexact="Karnataka").first() or State.objects.first()

        state_name = state.name if state else "All"
        cycle = SSVCycle.objects.filter(state=state, cycle_number=cycle_num).first()

        response = HttpResponse(content_type="text/csv")
        response["Content-Disposition"] = f'attachment; filename="SSV_Users_{state_name}_Cycle{cycle_num}_{period_tab}.csv"'

        writer = csv.writer(response)
        writer.writerow(["#", "User ID", "Name", "Mobile", "Join Date", "Months Completed", "Total Payment (Rs)", "Voucher Status"])

        user_qs = CustomUser.objects.filter(
            Q(state=state) | Q(state__name__iexact=state.name if state else ""),
            is_active=True
        ).exclude(role="admin").exclude(is_superuser=True).order_by("id")[:1000]

        user_ids = list(user_qs.values_list("id", flat=True))

        # Filter monthly boxes that belong strictly to this cycle (package_number = cycle_num)
        cycle_box_filter = Q(user_id__in=user_ids, package_number=cycle_num)

        box_records = PromoMonthlyBox.objects.filter(cycle_box_filter).values("user_id", "box_number")
        user_boxes = {}
        for br in box_records:
            uid = br["user_id"]
            if uid not in user_boxes:
                user_boxes[uid] = set()
            user_boxes[uid].add(br["box_number"])

        vouchers_map = {
            v.user_id: v for v in SSVVoucher.objects.filter(
                user_id__in=user_ids,
                state=state,
                cycle_number=cycle_num
            )
        }

        row_num = 1
        for u in user_qs:
            paid_boxes = len(user_boxes.get(u.id, set()))
            v = vouchers_map.get(u.id)

            if v:
                user_cat = v.period_category
                months_cnt = paid_boxes if paid_boxes > 0 else (12 if user_cat == "12_MONTHS" else 6 if user_cat == "6_MONTHS" else 3 if user_cat == "3_MONTHS" else 1)
            else:
                if paid_boxes in (1, 2):
                    user_cat = "1_MONTH"
                    months_cnt = paid_boxes
                elif 3 <= paid_boxes <= 5:
                    user_cat = "3_MONTHS"
                    months_cnt = paid_boxes
                elif 6 <= paid_boxes <= 11:
                    user_cat = "6_MONTHS"
                    months_cnt = paid_boxes
                elif paid_boxes >= 12:
                    user_cat = "12_MONTHS"
                    months_cnt = paid_boxes
                else:
                    user_cat = "NONE"
                    months_cnt = 0

            if period_tab in ("1_MONTH", "3_MONTHS", "6_MONTHS", "12_MONTHS"):
                if user_cat != period_tab:
                    continue

            total_pay = months_cnt * 1000
            v_status = v.status if v else "NOT_CREATED"
            u_code = u.prefixed_id or u.user_code or f"TK{u.id + 100000:06d}"
            u_name = u.get_full_name() or u.username
            u_phone = u.phone or "-"
            join_dt = u.date_joined.strftime("%d-%m-%Y") if u.date_joined else ""

            writer.writerow([
                row_num,
                u_code,
                u_name,
                u_phone,
                join_dt,
                f"{months_cnt} Month" if months_cnt == 1 else f"{months_cnt} Months",
                total_pay,
                v_status
            ])
            row_num += 1

        return response




"""
Views for Franchise / Agency Territory Command Centers.
Provides:
1. DistrictPincodesView:
   - For District Heads and District Coordinators
   - Returns all pincodes under the assigned district(s)
   - Indicates active/inactive/vacant status of Pincode Head and Pincode Coordinator
   - Headcounts of active users, merchants, and captains
2. StateDistrictsView:
   - For State Heads and State Coordinators
   - Returns all districts under the assigned state(s)
   - Indicates active/inactive/vacant status of District Head and District Coordinator
   - Headcounts of active users, merchants, and captains
"""

from rest_framework.views import APIView
from rest_framework.response import Response
from rest_framework import permissions, status
from django.db.models import Count, Q
from accounts.models import CustomUser, AgencyRegionAssignment
from locations.views import _build_district_index, india_place_variants
from locations.models import State


class DistrictPincodesView(APIView):
    """
    GET /api/agency/district-pincodes/
    Query Params:
      - district: optional district name (defaults to user's assigned district)
      - state: optional state name (defaults to user's assigned state or 'Karnataka')
    """
    permission_classes = [permissions.IsAuthenticated]

    def get(self, request):
        user = request.user
        req_district = (request.query_params.get("district") or "").strip()
        req_state = (request.query_params.get("state") or "").strip()

        # 1. Discover user's assigned districts & states from AgencyRegionAssignment
        assignments = AgencyRegionAssignment.objects.filter(user=user)
        assigned_districts = list(
            assignments.filter(level="district")
            .exclude(district="")
            .values_list("district", flat=True)
            .distinct()
        )
        assigned_states = list(
            assignments.filter(level="state")
            .values_list("state__name", flat=True)
            .distinct()
        )

        # Fallback to user fields if assignments empty
        if not assigned_districts and getattr(user, "city", None):
            assigned_districts = [user.city]
        if not assigned_states and getattr(user, "state", None):
            assigned_states = [user.state.name if hasattr(user.state, "name") else str(user.state)]

        # Select target district
        target_district = req_district
        if not target_district:
            if assigned_districts:
                target_district = assigned_districts[0]
            else:
                target_district = "Tumakuru"  # Default fallback

        # Select target state
        target_state = req_state
        if not target_state:
            if assigned_states:
                target_state = assigned_states[0]
            else:
                target_state = "Karnataka"

        # 2. Collect all pincodes for the target district
        idx = _build_district_index()
        variants = india_place_variants(target_district) or [target_district]
        pins = set()
        skey = (target_state or "").strip().lower()

        for d in variants:
            dkey = (d or "").strip().lower()
            if skey:
                pins.update(idx.get((skey, dkey), set()))
            pins.update(idx.get(("", dkey), set()))

        sorted_pins = sorted(list(pins))

        # 3. Batch query Agency Region Assignments for these pincodes
        pincode_assignments = (
            AgencyRegionAssignment.objects.filter(level="pincode", pincode__in=sorted_pins)
            .select_related("user")
        )
        # Also check direct user.pincode for agency users
        direct_agency_users = (
            CustomUser.objects.filter(
                pincode__in=sorted_pins,
                category__in=["agency_pincode", "agency_pincode_coordinator"],
            )
        )

        # Map pincode -> agency officer
        pincode_heads = {}
        pincode_coords = {}

        for a in pincode_assignments:
            u = a.user
            is_act = bool(u.is_active and getattr(u, "account_active", True))
            status_str = "ACTIVE" if is_act else "INACTIVE"
            info = {
                "status": status_str,
                "name": u.get_full_name() or u.username,
                "phone": u.phone,
                "code": u.unique_id or f"TRPN{u.id:04d}",
            }
            if u.category == "agency_pincode":
                pincode_heads[a.pincode] = info
            elif u.category == "agency_pincode_coordinator":
                pincode_coords[a.pincode] = info

        for u in direct_agency_users:
            pin = u.pincode
            if not pin:
                continue
            is_act = bool(u.is_active and getattr(u, "account_active", True))
            status_str = "ACTIVE" if is_act else "INACTIVE"
            info = {
                "status": status_str,
                "name": u.get_full_name() or u.username,
                "phone": u.phone,
                "code": u.unique_id or f"TRPN{u.id:04d}",
            }
            if u.category == "agency_pincode" and pin not in pincode_heads:
                pincode_heads[pin] = info
            elif u.category == "agency_pincode_coordinator" and pin not in pincode_coords:
                pincode_coords[pin] = info

        # 4. Batch query user counts per pincode
        # Total consumers/agents
        consumer_counts = dict(
            CustomUser.objects.filter(pincode__in=sorted_pins, account_active=True)
            .exclude(category__startswith="agency_")
            .exclude(category="merchant")
            .exclude(category__icontains="captain")
            .values("pincode")
            .annotate(cnt=Count("id"))
            .values_list("pincode", "cnt")
        )

        # Merchants
        merchant_counts = dict(
            CustomUser.objects.filter(pincode__in=sorted_pins, category="merchant", account_active=True)
            .values("pincode")
            .annotate(cnt=Count("id"))
            .values_list("pincode", "cnt")
        )

        # Captains
        captain_counts = dict(
            CustomUser.objects.filter(pincode__in=sorted_pins, category__icontains="captain", account_active=True)
            .values("pincode")
            .annotate(cnt=Count("id"))
            .values_list("pincode", "cnt")
        )

        # 5. Build results list and summary
        pincode_list = []
        active_agencies = 0
        vacant_agencies = 0
        active_agencies = 0
        inactive_agencies = 0
        vacant_agencies = 0
        active_coords = 0
        inactive_coords = 0
        vacant_coords = 0
        total_users = 0
        total_merchants = 0
        total_captains = 0

        for pin in sorted_pins:
            head_info = pincode_heads.get(pin, {"status": "VACANT", "name": None, "phone": None, "code": None})
            coord_info = pincode_coords.get(pin, {"status": "VACANT", "name": None, "phone": None, "code": None})

            if head_info["status"] == "ACTIVE":
                active_agencies += 1
            elif head_info["status"] == "INACTIVE":
                inactive_agencies += 1
            else:
                vacant_agencies += 1

            if coord_info["status"] == "ACTIVE":
                active_coords += 1
            elif coord_info["status"] == "INACTIVE":
                inactive_coords += 1
            else:
                vacant_coords += 1

            u_cnt = consumer_counts.get(pin, 0)
            m_cnt = merchant_counts.get(pin, 0)
            c_cnt = captain_counts.get(pin, 0)

            total_users += u_cnt
            total_merchants += m_cnt
            total_captains += c_cnt

            pincode_list.append({
                "pincode": pin,
                "district": target_district,
                "state": target_state,
                "agency": head_info,
                "coordinator": coord_info,
                "user_count": u_cnt,
                "merchant_count": m_cnt,
                "captain_count": c_cnt,
            })

        summary = {
            "total_pincodes": len(sorted_pins),
            "active_agencies": active_agencies,
            "inactive_agencies": inactive_agencies,
            "vacant_agencies": vacant_agencies,
            "active_coordinators": active_coords,
            "inactive_coordinators": inactive_coords,
            "vacant_coordinators": vacant_coords,
            "total_users": total_users,
            "total_merchants": total_merchants,
            "total_captains": total_captains,
        }

        return Response({
            "district": target_district,
            "state": target_state,
            "assigned_districts": assigned_districts,
            "summary": summary,
            "pincodes": pincode_list,
        })


class StateDistrictsView(APIView):
    """
    GET /api/agency/state-districts/
    Query Params:
      - state: optional state name (defaults to user's assigned state or 'Karnataka')
    """
    permission_classes = [permissions.IsAuthenticated]

    def get(self, request):
        user = request.user
        req_state = (request.query_params.get("state") or "").strip()

        # 1. Discover user's assigned states from AgencyRegionAssignment
        assignments = AgencyRegionAssignment.objects.filter(user=user)
        assigned_states = list(
            assignments.filter(level="state")
            .values_list("state__name", flat=True)
            .distinct()
        )
        if not assigned_states and getattr(user, "state", None):
            assigned_states = [user.state.name if hasattr(user.state, "name") else str(user.state)]

        target_state = req_state
        if not target_state:
            if assigned_states:
                target_state = assigned_states[0]
            else:
                target_state = "Karnataka"

        # 2. Collect all districts for target state
        idx = _build_district_index()
        skey = target_state.strip().lower()

        districts_set = set()
        for (s, d) in idx.keys():
            if s == skey and d:
                districts_set.add(d.title())

        sorted_districts = sorted(list(districts_set))
        if not sorted_districts:
            # Fallback to hardcoded list if dataset not indexed
            from frontend_compat_districts import DEFAULT_KARNATAKA_DISTRICTS  # or list
            sorted_districts = ["Tumakuru", "Bengaluru Urban", "Bengaluru Rural", "Mysuru", "Hassan", "Shivamogga"]

        # 3. Query district agency assignments in this state
        district_assignments = (
            AgencyRegionAssignment.objects.filter(level="district", state__name__iexact=target_state)
            .select_related("user")
        )

        district_heads = {}
        district_coords = {}

        for a in district_assignments:
            u = a.user
            d_name = (a.district or "").title()
            is_act = bool(u.is_active and getattr(u, "account_active", True))
            status_str = "ACTIVE" if is_act else "INACTIVE"
            info = {
                "status": status_str,
                "name": u.get_full_name() or u.username,
                "phone": u.phone,
                "code": u.unique_id or f"TRDT{u.id:04d}",
            }
            if u.category == "agency_district":
                district_heads[d_name] = info
            elif u.category == "agency_district_coordinator":
                district_coords[d_name] = info

        # 4. User counts per district (match city or pincode mapping)
        # Build pincode to district reverse mapping for this state
        pin_to_district = {}
        for d in sorted_districts:
            d_variants = india_place_variants(d) or [d]
            for dv in d_variants:
                d_pins = idx.get((skey, (dv or "").strip().lower()), set())
                for p in d_pins:
                    pin_to_district[p] = d

        # Query all active users in state
        all_state_users = (
            CustomUser.objects.filter(state__name__iexact=target_state, account_active=True)
            .values("pincode", "city__name", "category")
        )

        merchants_by_district = {}
        captains_by_district = {}
        consumers_by_district = {}

        for u in all_state_users:
            pin = u.get("pincode") or ""
            raw_city = u.get("city__name") or ""
            city = str(raw_city).title() if raw_city else ""
            cat = u.get("category") or ""

            # Resolve user's district
            resolved_d = pin_to_district.get(pin) or (city if city in sorted_districts else None)
            if not resolved_d:
                continue

            if cat == "merchant":
                merchants_by_district[resolved_d] = merchants_by_district.get(resolved_d, 0) + 1
            elif "captain" in cat.lower():
                captains_by_district[resolved_d] = captains_by_district.get(resolved_d, 0) + 1
            elif not cat.startswith("agency_"):
                consumers_by_district[resolved_d] = consumers_by_district.get(resolved_d, 0) + 1

        # 5. Build results list and summary
        districts_list = []
        active_heads = 0
        inactive_heads = 0
        vacant_heads = 0
        active_coords = 0
        inactive_coords = 0
        vacant_coords = 0
        total_merchants = 0
        total_captains = 0
        total_users = 0

        for d in sorted_districts:
            head_info = district_heads.get(d, {"status": "VACANT", "name": None, "phone": None, "code": None})
            coord_info = district_coords.get(d, {"status": "VACANT", "name": None, "phone": None, "code": None})

            if head_info["status"] == "ACTIVE":
                active_heads += 1
            elif head_info["status"] == "INACTIVE":
                inactive_heads += 1
            else:
                vacant_heads += 1

            if coord_info["status"] == "ACTIVE":
                active_coords += 1
            elif coord_info["status"] == "INACTIVE":
                inactive_coords += 1
            else:
                vacant_coords += 1

            m_cnt = merchants_by_district.get(d, 0)
            c_cnt = captains_by_district.get(d, 0)
            u_cnt = consumers_by_district.get(d, 0)

            total_merchants += m_cnt
            total_captains += c_cnt
            total_users += u_cnt

            # Count pincodes in this district
            d_pins = idx.get((skey, d.strip().lower()), set())

            districts_list.append({
                "district": d,
                "district_head": head_info,
                "district_coordinator": coord_info,
                "merchants_count": m_cnt,
                "captains_count": c_cnt,
                "users_count": u_cnt,
                "pincodes_count": len(d_pins),
            })

        summary = {
            "total_districts": len(sorted_districts),
            "active_heads": active_heads,
            "inactive_heads": inactive_heads,
            "vacant_heads": vacant_heads,
            "active_coordinators": active_coords,
            "inactive_coordinators": inactive_coords,
            "vacant_coordinators": vacant_coords,
            "total_merchants": total_merchants,
            "total_captains": total_captains,
            "total_users": total_users,
        }

        return Response({
            "state": target_state,
            "assigned_states": assigned_states,
            "summary": summary,
            "districts": districts_list,
        })

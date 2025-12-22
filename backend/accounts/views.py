from rest_framework import generics
from rest_framework.pagination import PageNumberPagination
from .models import CustomUser, AgencyRegionAssignment, Wallet, WalletTransaction, SupportTicket, SupportTicketMessage
from .serializers import RegisterSerializer, PublicUserSerializer, UserKYCSerializer, WithdrawalRequestSerializer, ProfileMeSerializer, SupportTicketSerializer, SupportTicketMessageSerializer
from rest_framework.permissions import AllowAny, IsAuthenticated
from rest_framework_simplejwt.views import TokenObtainPairView
from .token_serializers import CustomTokenObtainPairSerializer
from rest_framework.views import APIView
from rest_framework.response import Response
from rest_framework import status, serializers, parsers
from rest_framework.exceptions import NotFound
from django.contrib.auth import get_user_model
from django.contrib.auth.password_validation import validate_password
from django.core.exceptions import ValidationError
from django.db.models import Q, Sum, Count
from locations.views import _build_district_index, india_place_variants
from locations.models import State
from django.http import HttpResponse
from django.conf import settings
from django.utils import timezone
from django.contrib.staticfiles import finders
from io import BytesIO
import os
from xhtml2pdf import pisa


class RegisterView(generics.CreateAPIView):
    queryset = CustomUser.objects.all()
    permission_classes = [AllowAny]
    serializer_class = RegisterSerializer

    def perform_create(self, serializer):
        """
        Create the user and send a welcome email containing the username
        to the registered email address. Make email non-blocking and
        skip when mailing is not enabled, to avoid worker timeouts.
        """
        user = serializer.save()

        # Defer referral/franchise payouts until first activation; no payouts on registration
        # Intentionally removed calls to referral.on_user_join and franchise.distribute_franchise_benefit here.

        # Defer and guard email to avoid blocking the request thread
        try:
            from django.conf import settings
            from django.core.mail import send_mail
            from threading import Thread
            from django.db import transaction
            import logging
            logger = logging.getLogger(__name__)

            recipient = getattr(user, "email", None)
            if not recipient or not getattr(settings, "MAIL_ENABLED", False):
                return

            full_name = getattr(user, "full_name", "") or ""
            raw_password = str(getattr(self.request, "data", {}).get("password") or "")
            subject = "Welcome to Trikonekt - Your account details"
            message = (
                f"Hello {full_name or 'there'},\n\n"
                "Welcome to Trikonekt!\n\n"
                f"Username: {user.username}\n"
                f"Password: {raw_password}\n\n"
                "You can now log in and start using the app.\n\n"
                "Regards,\nTrikonekt Team"
            )

            def _send():
                try:
                    # Explicit from_email and fail_silently=False to surface SMTP issues
                    send_mail(
                        subject,
                        message,
                        getattr(settings, "DEFAULT_FROM_EMAIL", None) or getattr(settings, "EMAIL_HOST_USER", None),
                        [recipient],
                        fail_silently=False,
                    )
                except Exception as e:
                    try:
                        logger.warning("Welcome email send failed: %s", e)
                    except Exception:
                        pass

            # Execute after DB commit if inside a transaction; else start immediately
            try:
                transaction.on_commit(lambda: Thread(target=_send, daemon=True).start())
            except Exception:
                Thread(target=_send, daemon=True).start()
        except Exception:
            # Silently ignore any email errors to avoid breaking registration
            pass


class CustomTokenObtainPairView(TokenObtainPairView):
    serializer_class = CustomTokenObtainPairSerializer


class ResetPasswordView(APIView):
    permission_classes = [AllowAny]

    def post(self, request):
        initial_username = request.data.get('username')
        phone = request.data.get('phone')
        new_password = request.data.get('new_password')

        if not (initial_username or phone) or not new_password:
            return Response({'detail': 'username or phone, and new_password are required.'}, status=status.HTTP_400_BAD_REQUEST)

        # Normalize to digits if phone provided or username is digits-only
        def only_digits(s: str) -> str:
            return ''.join(c for c in (s or '') if c.isdigit())

        phone_digits = only_digits(phone or initial_username)

        User = get_user_model()
        user = None
        try:
            # Resolve by phone digits or exact legacy username
            if phone_digits:
                user = User.objects.filter(Q(phone__iexact=phone_digits) | Q(username__iexact=phone_digits)).first()
            if user is None and initial_username:
                user = User.objects.filter(username__iexact=initial_username).first()
        except Exception:
            user = None

        if not user:
            return Response({'detail': 'User not found.'}, status=status.HTTP_404_NOT_FOUND)

        try:
            validate_password(new_password, user=user)
        except ValidationError as ve:
            return Response({'detail': ve.messages}, status=status.HTTP_400_BAD_REQUEST)

        user.set_password(new_password)
        user.save()
        return Response({'detail': 'Password reset successful.'}, status=status.HTTP_200_OK)


class MeView(generics.RetrieveAPIView):
    serializer_class = PublicUserSerializer
    permission_classes = [IsAuthenticated]

    def get_object(self):
        return self.request.user


class ProfileMeView(generics.RetrieveUpdateAPIView):
    """
    Get/Update my profile (email, phone, age, pincode, address, avatar, geo fields).
    Supports multipart for avatar upload.
    """
    permission_classes = [IsAuthenticated]
    serializer_class = ProfileMeSerializer
    parser_classes = [parsers.MultiPartParser, parsers.FormParser, parsers.JSONParser]

    def get_object(self):
        return self.request.user


class UsersListView(generics.ListAPIView):
    """
    List users with filters by pincode/state/country/category/role.
    - pincode: exact match
    - state_id: numeric State PK
    - country_id: numeric Country PK
    - category: one of CustomUser.CATEGORY_CHOICES codes
    - role: user/agency/employee
    - registered_by: 'me' or user id
    """
    serializer_class = PublicUserSerializer
    permission_classes = [IsAuthenticated]

    def get_queryset(self):
        qs = CustomUser.objects.all().select_related('country', 'state', 'city', 'registered_by')

        pincode = self.request.query_params.get('pincode')
        state_id = self.request.query_params.get('state_id')
        country_id = self.request.query_params.get('country_id')
        category = self.request.query_params.get('category')
        role = self.request.query_params.get('role')
        registered_by = self.request.query_params.get('registered_by')

        # Default scoping and "assignable" filter for agencies
        # - If assignable=1 and actor is an agency, restrict to employees either registered_by=me OR in my pincode.
        # - Else, if actor is an agency querying role=employee without pincode/registered_by, default scope to my pincode.
        try:
            user = self.request.user
            role_param = (role or "").strip().lower()
            is_agency_actor = (getattr(user, "role", None) == "agency") or str(getattr(user, "category", "")).startswith("agency_")
            me_pin = (getattr(user, "pincode", "") or "").strip()
            assignable = self.request.query_params.get('assignable')
            if is_agency_actor and role_param == "employee":
                if assignable:
                    if me_pin:
                        qs = qs.filter(Q(registered_by=user) | Q(pincode__iexact=me_pin))
                    else:
                        qs = qs.filter(registered_by=user)
                elif not pincode and not registered_by:
                    if me_pin:
                        qs = qs.filter(pincode__iexact=me_pin)
        except Exception:
            pass

        # Support pincode=me to use the current authenticated user's pincode (useful for agency logins)
        if pincode == 'me':
            me_pin = getattr(self.request.user, 'pincode', '') or ''
            pincode = me_pin if me_pin else None

        if pincode:
            qs = qs.filter(pincode__iexact=pincode)
        if state_id:
            qs = qs.filter(state_id=state_id)
        if country_id:
            qs = qs.filter(country_id=country_id)
        if category:
            qs = qs.filter(category=category)
        if role:
            # Be tolerant for legacy data: treat "employee" role also as category=employee,
            # and "agency" role also as any agency_* category.
            if role == 'employee':
                qs = qs.filter(Q(role='employee') | Q(category='employee'))
            elif role == 'agency':
                qs = qs.filter(Q(role='agency') | Q(category__startswith='agency_'))
            else:
                qs = qs.filter(role=role)
        if registered_by == 'me':
            qs = qs.filter(registered_by=self.request.user)
        elif registered_by:
            qs = qs.filter(registered_by_id=registered_by)

        return qs.order_by('-date_joined')


class MyEmployeesListView(generics.ListAPIView):
    serializer_class = PublicUserSerializer
    permission_classes = [IsAuthenticated]

    def get_queryset(self):
        return (
            CustomUser.objects
            .filter(registered_by=self.request.user)
            .filter(Q(category='employee') | Q(role='employee'))
            .select_related('country', 'state', 'city', 'registered_by')
            .order_by('-date_joined')
        )


class AgencyEmployeeActivationView(APIView):
    """
    Agency can activate/deactivate their own employee accounts.
    PATCH body: { "account_active": true|false } (if omitted, toggles current state)
    """
    permission_classes = [IsAuthenticated]

    def patch(self, request, pk: int):
        actor = request.user
        # Actor must be an agency account (role=agency or category startswith 'agency')
        is_agency_actor = (str(getattr(actor, "role", "")).lower() == "agency") or str(getattr(actor, "category", "")).startswith("agency")
        if not is_agency_actor:
            return Response({"detail": "Only agency users can activate/deactivate their employees."}, status=status.HTTP_403_FORBIDDEN)

        target = CustomUser.objects.filter(pk=pk).first()
        if not target:
            return Response({"detail": "Employee not found."}, status=status.HTTP_404_NOT_FOUND)

        # Target must be an employee under this agency
        is_employee = (str(getattr(target, "role", "")).lower() == "employee") or (str(getattr(target, "category", "")).lower() == "employee")
        if not is_employee:
            return Response({"detail": "Target is not an employee account."}, status=status.HTTP_400_BAD_REQUEST)
        if getattr(target, "registered_by_id", None) != getattr(actor, "id", None):
            return Response({"detail": "You can only manage employees registered by you."}, status=status.HTTP_403_FORBIDDEN)

        val = (request.data or {}).get("account_active", None)
        if val is None:
            new_active = not bool(getattr(target, "account_active", False))
        else:
            sval = str(val).strip().lower()
            new_active = sval in ("1", "true", "yes", "on")

        if bool(getattr(target, "account_active", False)) != new_active:
            target.account_active = new_active
            target.save(update_fields=["account_active"])

        return Response(PublicUserSerializer(target).data, status=status.HTTP_200_OK)


class MyBusinessesListView(generics.ListAPIView):
    serializer_class = PublicUserSerializer
    permission_classes = [IsAuthenticated]

    def get_queryset(self):
        return (
            CustomUser.objects
            .filter(registered_by=self.request.user, category='business')
            .select_related('country', 'state', 'city', 'registered_by')
            .order_by('-date_joined')
        )


# Regions available under a sponsor to drive dynamic registration UI
# AllowAny so registration form can use this before login
from rest_framework.decorators import api_view, permission_classes
from rest_framework.permissions import AllowAny

def _collect_pincodes_from_user_assignments(user):
    """
    Collect pincodes covered by a user's region assignments.
    - Direct pincode assignments are used as-is.
    - District assignments expand to pincodes via offline index (with synonyms).
    - State assignments expand to all pincodes under that state via offline index.
    - If no pins on the user, walk up registered_by chain (max depth 5) to derive from parent.
    """
    pins = set()
    try:
        try:
            idx = _build_district_index()
        except Exception:
            idx = {}

        assigns = AgencyRegionAssignment.objects.filter(user=user).select_related('state')
        for a in assigns:
            if a.level == 'pincode':
                p = (a.pincode or '').strip()
                if p and p.isdigit() and len(p) == 6:
                    pins.add(p)
            elif a.level == 'district':
                state_name = (getattr(a.state, 'name', '') or '').strip()
                skey = state_name.lower()
                dvars = india_place_variants(a.district) or [a.district]
                for dv in dvars:
                    dkey = (dv or '').strip().lower()
                    pins.update(idx.get((skey, dkey), set()))
                    pins.update(idx.get(("", dkey), set()))
            elif a.level == 'state':
                state_name = (getattr(a.state, 'name', '') or '').strip().lower()
                if state_name:
                    for (s, _d), sset in (idx.items() if hasattr(idx, 'items') else []):
                        if s == state_name:
                            pins.update(sset)
    except Exception:
        pass

    # Ancestor fallback: look at parents if no pins on current user
    if not pins:
        try:
            cur = user
            for _ in range(5):
                parent = getattr(cur, 'registered_by', None)
                if not parent or getattr(parent, 'id', None) in (None, cur.id):
                    break
                parent_pins = _collect_pincodes_from_user_assignments(parent)
                if parent_pins:
                    pins.update(parent_pins)
                    break
                cur = parent
        except Exception:
            pass

    # Fallbacks from user's own profile when no explicit assignments found
    if not pins:
        try:
            # Sponsor's own pincode field
            upin = (getattr(user, 'pincode', '') or '').strip()
            if upin.isdigit() and len(upin) == 6:
                pins.add(upin)

            # Derive from user's City/District and State via offline index
            if not pins:
                idx2 = _build_district_index()
                state_name = (getattr(getattr(user, 'state', None), 'name', '') or '').strip().lower()
                city_name = (getattr(getattr(user, 'city', None), 'name', '') or '').strip()
                dvars = india_place_variants(city_name) or [city_name]
                for dv in dvars:
                    dkey = (dv or '').strip().lower()
                    if state_name:
                        pins.update(idx2.get((state_name, dkey), set()))
                    pins.update(idx2.get(('', dkey), set()))
        except Exception:
            pass

    return pins

@api_view(["GET"])
@permission_classes([AllowAny])
def regions_by_sponsor(request):
    # Normalize sponsor param in case a full URL or querystring was pasted
    def _norm_sponsor(val: str) -> str:
        try:
            s = (val or "").strip()
            if not s:
                return ""
            if "://" in s or "?" in s or "=" in s or "/" in s:
                try:
                    from urllib.parse import urlparse, parse_qs
                    u = urlparse(s)
                    q = parse_qs(u.query or "")
                    inner = (q.get("sponsor") or [None])[0]
                    if inner:
                        return _norm_sponsor(inner)
                    # If only a raw querystring was passed
                    if "sponsor=" in s:
                        qs = s.split("?", 1)[1] if "?" in s else s
                        q2 = parse_qs(qs)
                        inner2 = (q2.get("sponsor") or [None])[0]
                        if inner2:
                            return _norm_sponsor(inner2)
                except Exception:
                    pass
            import re
            token = "".join(re.findall(r"[A-Za-z0-9_-]+", s)) or ""
            return token
        except Exception:
            return ""

    sponsor = _norm_sponsor(request.query_params.get('sponsor'))
    level = (request.query_params.get('level') or '').strip().lower()
    registration_type = (request.query_params.get('registration_type') or request.query_params.get('category') or '').strip().lower()
    if not sponsor or level not in ('state', 'district', 'pincode'):
        return Response({'detail': 'sponsor and valid level (state|district|pincode) are required.'}, status=status.HTTP_400_BAD_REQUEST)

    sponsor_digits = ''.join(c for c in sponsor if c.isdigit())
    q = Q(username__iexact=sponsor) | Q(sponsor_id__iexact=sponsor)
    if sponsor_digits:
        q = q | Q(phone__iexact=sponsor_digits)
    sponsor_user = CustomUser.objects.filter(q).first()
    if not sponsor_user:
        return Response({'detail': 'Sponsor not found.'}, status=status.HTTP_404_NOT_FOUND)

    qs = AgencyRegionAssignment.objects.filter(user=sponsor_user, level=level)

    # Optional filters to narrow down
    state_id = request.query_params.get('state_id')
    if state_id:
        try:
            sid = int(state_id)
            qs = qs.filter(state_id=sid)
        except (TypeError, ValueError):
            pass

    district = (request.query_params.get('district') or '').strip()
    if district:
        qs = qs.filter(district__iexact=district)

    if level == 'state':
        # Return distinct states. If sponsor has only district/pincode assignments,
        # derive the covered states from those assignments as fallback.
        out_states = []
        seen = set()

        state_rows = list(qs.select_related('state'))
        if not state_rows:
            state_rows = list(
                AgencyRegionAssignment.objects
                .filter(user=sponsor_user, level__in=('district', 'pincode'))
                .select_related('state')
            )

        for a in state_rows:
            if a.state_id and a.state_id not in seen:
                seen.add(a.state_id)
                out_states.append({'id': a.state_id, 'name': a.state.name if a.state else None})

        # Final fallback: if still empty and sponsor has a state set, include it
        try:
            if not out_states and getattr(sponsor_user, 'state_id', None):
                s = sponsor_user.state
                out_states.append({'id': sponsor_user.state_id, 'name': s.name if s else None})
        except Exception:
            pass

        # Ancestor fallback: walk up registered_by chain to derive states from parent's assignments
        if not out_states:
            try:
                cur = sponsor_user
                for _ in range(5):
                    parent = getattr(cur, 'registered_by', None)
                    if not parent or getattr(parent, 'id', None) in (None, cur.id):
                        break
                    p_rows = list(
                        AgencyRegionAssignment.objects
                        .filter(user=parent, level='state')
                        .select_related('state')
                    )
                    if not p_rows:
                        p_rows = list(
                            AgencyRegionAssignment.objects
                            .filter(user=parent, level__in=('district', 'pincode'))
                            .select_related('state')
                        )
                    for a in p_rows:
                        if a.state_id and a.state_id not in seen:
                            seen.add(a.state_id)
                            out_states.append({'id': a.state_id, 'name': a.state.name if a.state else None})
                    if out_states:
                        break
                    cur = parent
            except Exception:
                pass

        try:
            pins_set = _collect_pincodes_from_user_assignments(sponsor_user)
            out_pincodes = sorted(pins_set)
        except Exception:
            out_pincodes = []

        # Group pincodes by state to allow frontend to auto-select state without pincode lookup
        pins_by_state = []
        try:
            idx = _build_district_index() or {}
            grouped = {}
            assigns_all = AgencyRegionAssignment.objects.filter(user=sponsor_user).select_related('state')
            for a in assigns_all:
                if a.level == 'state' and a.state_id and a.state:
                    sname = (a.state.name or '').strip().lower()
                    # union all pins under this state from the offline index
                    sset_total = set()
                    for (skey, _d), pset in (idx.items() if hasattr(idx, 'items') else []):
                        if skey == sname:
                            sset_total.update(pset)
                    if sset_total:
                        grouped.setdefault(a.state_id, set()).update(sset_total)
                elif a.level == 'district' and a.state_id and a.state:
                    sname = (a.state.name or '').strip().lower()
                    dvars = india_place_variants(a.district) or [a.district]
                    for dv in dvars:
                        dkey = (dv or '').strip().lower()
                        pins = idx.get((sname, dkey), set())
                        if pins:
                            grouped.setdefault(a.state_id, set()).update(pins)
                elif a.level == 'pincode':
                    p = (a.pincode or '').strip()
                    if p and p.isdigit() and len(p) == 6:
                        # try to map this pincode to a state via reverse lookup in the index
                        found_state_name = None
                        for (skey, _d), pset in (idx.items() if hasattr(idx, 'items') else []):
                            if p in pset:
                                found_state_name = skey
                                break
                        if found_state_name:
                            st = State.objects.filter(name__iexact=found_state_name).first()
                            if st:
                                grouped.setdefault(st.id, set()).add(p)

            # Fallback: if still no grouping and sponsor has a profile state, include all pins under that state
            if not grouped and getattr(sponsor_user, 'state_id', None) and getattr(sponsor_user, 'state', None):
                sname = (getattr(sponsor_user.state, 'name', '') or '').strip().lower()
                sset_total = set()
                for (skey, _d), pset in (idx.items() if hasattr(idx, 'items') else []):
                    if skey == sname:
                        sset_total.update(pset)
                if sset_total:
                    grouped[sponsor_user.state_id] = sset_total

            # Serialize pins_by_state aligned with out_states for names
            for sid, pins in grouped.items():
                st = None
                try:
                    st = next((s for s in out_states if s['id'] == sid), None)
                except Exception:
                    st = None
                pins_by_state.append({
                    'state_id': sid,
                    'state': (st['name'] if isinstance(st, dict) and 'name' in st else None),
                    'pincodes': sorted(pins),
                })
        except Exception:
            pins_by_state = []

        full_name = getattr(sponsor_user, 'full_name', '') or sponsor_user.username
        try:
            derived_pin = out_pincodes[0] if out_pincodes else None
        except Exception:
            derived_pin = None
        pincode = (getattr(sponsor_user, 'pincode', '') or '') or (derived_pin or '')
        return Response({'states': out_states, 'pincodes': out_pincodes, 'pins_by_state': pins_by_state, 'sponsor': {'username': sponsor_user.username, 'full_name': full_name, 'pincode': pincode}}, status=status.HTTP_200_OK)

    if level == 'district':
        # Return distinct districts (optionally filtered by state)
        out_districts = []
        seen = set()
        for a in qs.select_related('state'):
            if a.district:
                key = (a.state_id, a.district.lower())
                if key not in seen:
                    seen.add(key)
                    out_districts.append({
                        'state_id': a.state_id,
                        'state': a.state.name if a.state else None,
                        'district': a.district
                    })

        # Enhancement for Sub-Franchise registration:
        # If registration_type indicates sub-franchise AND a specific district filter is provided,
        # include all pincodes for that district irrespective of sponsor assignments.
        resp = {'districts': out_districts}
        if registration_type in ('agency_sub_franchise', 'sub_franchise', 'sub-franchise', 'sf'):
            try:
                idx = _build_district_index() or {}
                pins = set()

                # Resolve state name if provided
                sname = ''
                try:
                    if state_id:
                        sid = int(state_id)
                        st = State.objects.filter(pk=sid).first()
                        if st and getattr(st, 'name', None):
                            sname = (st.name or '').strip().lower()
                except Exception:
                    sname = ''

                district_norm = (district or '').strip()
                if district_norm:
                    dvars = india_place_variants(district_norm) or [district_norm]
                    for dv in dvars:
                        dkey = (dv or '').strip().lower()
                        if sname:
                            pins.update(idx.get((sname, dkey), set()))
                        pins.update(idx.get(('', dkey), set()))
                if pins:
                    resp['pincodes'] = sorted(pins)
            except Exception:
                # Fail silently and just return districts if anything goes wrong
                pass

        full_name = getattr(sponsor_user, 'full_name', '') or sponsor_user.username
        pins = resp.get('pincodes') or []
        if not pins:
            try:
                pins = sorted(_collect_pincodes_from_user_assignments(sponsor_user))
            except Exception:
                pins = []
        pincode = (getattr(sponsor_user, 'pincode', '') or '') or (pins[0] if pins else '')
        resp['sponsor'] = {'username': sponsor_user.username, 'full_name': full_name, 'pincode': pincode}
        return Response(resp, status=status.HTTP_200_OK)

    # level == 'pincode'
    # Special case: For sub-franchise registration, enable ALL relevant pincodes:
    # - If district provided: all pincodes for that district (existing behavior)
    # - Else if state_id provided: all pincodes within that state
    # - Else: all pincodes across the entire index (All-India)
    if registration_type in ('agency_sub_franchise', 'sub_franchise', 'sub-franchise', 'sf'):
        try:
            idx = _build_district_index() or {}
            pins = set()

            # Resolve state name if provided
            sname = ''
            try:
                if state_id:
                    sid = int(state_id)
                    st = State.objects.filter(pk=sid).first()
                    if st and getattr(st, 'name', None):
                        sname = (st.name or '').strip().lower()
            except Exception:
                sname = ''

            district_norm = (district or '').strip()
            if district_norm:
                # Return all pins within the given district
                dvars = india_place_variants(district_norm) or [district_norm]
                for dv in dvars:
                    dkey = (dv or '').strip().lower()
                    if sname:
                        pins.update(idx.get((sname, dkey), set()))
                    pins.update(idx.get(('', dkey), set()))
            elif sname:
                # Return all pins within the given state
                for (skey, _d), pset in (idx.items() if hasattr(idx, 'items') else []):
                    if skey == sname:
                        pins.update(pset)
            else:
                # Return all pins across the entire index (All-India)
                for _key, pset in (idx.items() if hasattr(idx, 'items') else []):
                    pins.update(pset)

            pins_sorted = sorted(pins)
            full_name = getattr(sponsor_user, 'full_name', '') or sponsor_user.username
            pincode = (getattr(sponsor_user, 'pincode', '') or '') or (pins_sorted[0] if pins_sorted else '')
            return Response({'pincodes': pins_sorted, 'sponsor': {'username': sponsor_user.username, 'full_name': full_name, 'pincode': pincode}}, status=status.HTTP_200_OK)
        except Exception:
            # fall back to sponsor-derived behavior below if any error
            pass
    out_pins = []
    seenp = set()
    for a in qs.only('pincode'):
        if a.pincode and a.pincode not in seenp:
            seenp.add(a.pincode)
            out_pins.append(a.pincode)

    # Fallback: derive pincodes from district/state assignments or parent's assignments
    if not out_pins:
        try:
            derived = sorted(_collect_pincodes_from_user_assignments(sponsor_user))
        except Exception:
            derived = []
        out_pins = derived

    full_name = getattr(sponsor_user, 'full_name', '') or sponsor_user.username
    pincode = (getattr(sponsor_user, 'pincode', '') or '') or (out_pins[0] if out_pins else '')
    return Response({'pincodes': out_pins, 'sponsor': {'username': sponsor_user.username, 'full_name': full_name, 'pincode': pincode}}, status=status.HTTP_200_OK)


# Simple hierarchy endpoint for audits and dashboards
from rest_framework.permissions import IsAuthenticated

@api_view(["GET"])
@permission_classes([IsAuthenticated])
def hierarchy(request):
    username = (request.query_params.get('username') or '').strip()
    if username:
        u = CustomUser.objects.filter(username__iexact=username).first()
        if not u:
            return Response({'detail': 'User not found.'}, status=status.HTTP_404_NOT_FOUND)
    else:
        u = request.user

    # Build chain upwards (limit depth to avoid cycles)
    chain_up = []
    visited = set()
    cur = u
    for _ in range(10):
        parent = getattr(cur, 'registered_by', None)
        if not parent or parent.id in visited:
            break
        chain_up.append({
            'id': parent.id,
            'username': parent.username,
            'category': parent.category,
            'role': parent.role,
        })
        visited.add(parent.id)
        cur = parent

    # Immediate children
    children_qs = CustomUser.objects.filter(registered_by=u).only('id', 'username', 'category', 'role').order_by('-date_joined')[:200]
    children = [{'id': c.id, 'username': c.username, 'category': c.category, 'role': c.role} for c in children_qs]

    return Response({
        'user': {'id': u.id, 'username': u.username, 'category': u.category, 'role': u.role},
        'chain_up': chain_up,
        'children': children,
    }, status=status.HTTP_200_OK)


class MyMatrixTree(APIView):
    """
    Returns the authenticated user's 5-matrix genealogy tree (spillover-based).
    Query params:
      - max_depth: optional (default 6, capped at 20)
    Response:
      { id, username, full_name, level, matrix_position, depth, children:[...] }
    """
    permission_classes = [IsAuthenticated]

    def get(self, request):
        user = request.user
        try:
            max_depth = int(request.query_params.get("max_depth") or 6)
        except Exception:
            max_depth = 6
        max_depth = max(1, min(max_depth, 20))

        def build_node(u, level: int):
            node = {
                "id": u.id,
                "username": u.username,
                "full_name": u.full_name,
                "level": level,
                "matrix_position": getattr(u, "matrix_position", None),
                "depth": getattr(u, "depth", 0),
                "children": [],
            }
            if level >= max_depth:
                return node
            children = list(
                CustomUser.objects.filter(parent_id=u.id)
                .only("id", "username", "full_name", "matrix_position", "depth")
                .order_by("matrix_position", "id")
            )
            for ch in children:
                node["children"].append(build_node(ch, level + 1))
            return node

        tree = build_node(user, 1)
        return Response(tree, status=status.HTTP_200_OK)


class MyMatrixTreeByRoot(APIView):
    """
    Returns a user's 5-matrix subtree by an arbitrary root_user_id, but only if that
    root lies within the authenticated user's downline (spillover tree).
    Query params:
      - root_user_id: required
      - max_depth: optional (default 6, capped at 20)
    Response is identical to MyMatrixTree.
    """
    permission_classes = [IsAuthenticated]

    def get(self, request):
        try:
            root_id = int(request.query_params.get("root_user_id") or "0")
        except Exception:
            return Response({"detail": "root_user_id must be integer"}, status=status.HTTP_400_BAD_REQUEST)
        if root_id <= 0:
            return Response({"detail": "root_user_id is required"}, status=status.HTTP_400_BAD_REQUEST)

        # Security: ensure requested root is in caller's downline (walk up parent_id)
        me_id = getattr(request.user, "id", None)
        if not me_id:
            return Response({"detail": "Unauthorized"}, status=status.HTTP_401_UNAUTHORIZED)

        target = CustomUser.objects.filter(id=root_id).only("id", "parent_id").first()
        if not target:
            return Response({"detail": "root user not found"}, status=status.HTTP_404_NOT_FOUND)

        cur = target
        in_downline = False
        # allow same user (self)
        for _ in range(7):  # depth up to 6 + self check
            if not cur:
                break
            if cur.id == me_id:
                in_downline = True
                break
            pid = getattr(cur, "parent_id", None)
            if not pid:
                break
            cur = CustomUser.objects.filter(id=pid).only("id", "parent_id").first()

        if not in_downline:
            return Response({"detail": "Requested root is not inside your downline"}, status=status.HTTP_403_FORBIDDEN)

        # Depth
        try:
            max_depth = int(request.query_params.get("max_depth") or 6)
        except Exception:
            max_depth = 6
        max_depth = max(1, min(max_depth, 20))

        # Build subtree
        def build_node(u, level: int):
            node = {
                "id": u.id,
                "username": u.username,
                "full_name": u.full_name,
                "level": level,
                "matrix_position": getattr(u, "matrix_position", None),
                "depth": getattr(u, "depth", 0),
                "children": [],
            }
            if level >= max_depth:
                return node
            children = list(
                CustomUser.objects.filter(parent_id=u.id)
                .only("id", "username", "full_name", "matrix_position", "depth")
                .order_by("matrix_position", "id")
            )
            for ch in children:
                node["children"].append(build_node(ch, level + 1))
            return node

        root = CustomUser.objects.filter(id=root_id).first()
        tree = build_node(root, 1)
        return Response(tree, status=status.HTTP_200_OK)


class MySponsorTree(APIView):
    """
    Returns the authenticated user's sponsor-based genealogy tree (registered_by/sponsor_id).
    Query params:
      - max_depth: optional (default 6, capped at 20)
    Response:
      { id, username, full_name, children:[...] }
    """
    permission_classes = [IsAuthenticated]

    def get(self, request):
        try:
            max_depth = int(request.query_params.get("max_depth") or 6)
        except Exception:
            max_depth = 6
        max_depth = max(1, min(max_depth, 20))

        def build_node(u, level: int, visited=None):
            if visited is None:
                visited = set()
            if getattr(u, "id", None) in visited:
                return None
            visited.add(u.id)
            node = {
                "id": u.id,
                "username": u.username,
                "full_name": getattr(u, "full_name", ""),
                "children": [],
            }
            if level >= max_depth:
                return node
            children = list(
                CustomUser.objects.filter(
                    Q(registered_by_id=u.id)
                    | (Q(registered_by__isnull=True) & Q(sponsor_id__iexact=getattr(u, "prefixed_id", "")))
                )
                .exclude(id=u.id)
                .only("id", "username", "full_name")
                .order_by("-id")
                .distinct()
            )
            for ch in children:
                cn = build_node(ch, level + 1, visited)
                if cn:
                    node["children"].append(cn)
            return node

        tree = build_node(request.user, 1)
        return Response(tree, status=status.HTTP_200_OK)


class MySponsorTreeByRoot(APIView):
    """
    Returns sponsor-based downline tree for a root user within caller's sponsor downline.
    Query params:
      - root_user_id: required
      - max_depth: optional (default 6, capped at 20)
    """
    permission_classes = [IsAuthenticated]

    def get(self, request):
        try:
            root_id = int(request.query_params.get("root_user_id") or "0")
        except Exception:
            return Response({"detail": "root_user_id must be integer"}, status=status.HTTP_400_BAD_REQUEST)
        if root_id <= 0:
            return Response({"detail": "root_user_id is required"}, status=status.HTTP_400_BAD_REQUEST)

        root = CustomUser.objects.filter(id=root_id).first()
        if not root:
            return Response({"detail": "root user not found"}, status=status.HTTP_404_NOT_FOUND)

        # Security: ensure requested root is inside caller’s sponsor-based downline (or self)
        me = request.user
        cur = root
        allowed = False

        def _resolve_sponsor_parent(user):
            try:
                sid = (getattr(user, "sponsor_id", "") or "").strip()
            except Exception:
                sid = ""
            if not sid:
                return None
            q = Q(username__iexact=sid) | Q(prefixed_id__iexact=sid) | Q(unique_id__iexact=sid)
            digits = "".join(ch for ch in sid if ch.isdigit())
            if digits:
                q = q | Q(phone__iexact=digits) | Q(username__iexact=digits)
            return CustomUser.objects.filter(q).only("id").first()

        for _ in range(50):
            if not cur:
                break
            if cur.id == me.id:
                allowed = True
                break
            parent = getattr(cur, "registered_by", None)
            if not parent:
                parent = _resolve_sponsor_parent(cur)
            if not parent or getattr(parent, "id", None) == getattr(cur, "id", None):
                break
            cur = parent

        if not allowed:
            return Response({"detail": "Requested root is not inside your sponsor downline"}, status=status.HTTP_403_FORBIDDEN)

        try:
            max_depth = int(request.query_params.get("max_depth") or 6)
        except Exception:
            max_depth = 6
        max_depth = max(1, min(max_depth, 20))

        def build_node(u, level: int, visited=None):
            if visited is None:
                visited = set()
            if getattr(u, "id", None) in visited:
                return None
            visited.add(u.id)
            node = {
                "id": u.id,
                "username": u.username,
                "full_name": getattr(u, "full_name", ""),
                "children": [],
            }
            if level >= max_depth:
                return node
            children = list(
                CustomUser.objects.filter(
                    Q(registered_by_id=u.id)
                    | (Q(registered_by__isnull=True) & Q(sponsor_id__iexact=getattr(u, "prefixed_id", "")))
                )
                .exclude(id=u.id)
                .only("id", "username", "full_name")
                .order_by("-id")
                .distinct()
            )
            for ch in children:
                cn = build_node(ch, level + 1, visited)
                if cn:
                    node["children"].append(cn)
            return node

        tree = build_node(root, 1)
        return Response(tree, status=status.HTTP_200_OK)


# ====================
# Team / Earnings APIs
# ====================
class TeamSummaryView(APIView):
    """
    Returns a consolidated "My Team" snapshot for the logged-in user:
    - Downline counts (Direct + L1..L5)
    - Earnings totals by category: direct referral, generation levels, autopool, franchise
    - Matrix progress (UserMatrixProgress) for THREE_50 / THREE_150 / FIVE_150
    - Recent team members and recent reward transactions (limited)
    """
    permission_classes = [IsAuthenticated]

    def get(self, request):
        user = request.user

        # Downline counts up to 5 levels (by registered_by chain)
        def downline_counts(u, max_depth=5):
            counts = []
            current_ids = [u.id]
            for d in range(max_depth):
                lvl_ids = list(
                    CustomUser.objects.filter(registered_by_id__in=current_ids).values_list("id", flat=True)
                )
                counts.append(len(lvl_ids))
                if not lvl_ids:
                    counts.extend([0] * (max_depth - d - 1))
                    break
                current_ids = lvl_ids
            return counts

        levels_1_5 = downline_counts(user, 5)
        direct_count = levels_1_5[0] if levels_1_5 else 0

        # Earnings totals (wallet transactions)
        tx = WalletTransaction.objects.filter(user=user)
        def _sum(qs):
            val = qs.aggregate(total=Sum("amount"))["total"] or 0
            return str(val)

        totals = {
            "direct_referral": _sum(tx.filter(type="DIRECT_REF_BONUS")),
            "generation_levels": _sum(tx.filter(type="LEVEL_BONUS")),
            "autopool_three": _sum(tx.filter(type="AUTOPOOL_BONUS_THREE")),
            "autopool_five": _sum(tx.filter(type="AUTOPOOL_BONUS_FIVE")),
            "franchise_income": _sum(tx.filter(type="FRANCHISE_INCOME")),
            "commissions": _sum(tx.filter(type="COMMISSION_CREDIT")),
            "rewards": _sum(tx.filter(type="REWARD_CREDIT")),
        }

        # Generation earnings breakdown by level (L1..L5)
        gen_breakdown = {"1": "0", "2": "0", "3": "0", "4": "0", "5": "0"}
        try:
            from decimal import Decimal as D
            accum = {1: D("0"), 2: D("0"), 3: D("0"), 4: D("0"), 5: D("0")}
            for r in tx.filter(type="LEVEL_BONUS").values("amount", "meta"):
                meta = r.get("meta") or {}
                try:
                    lvl = int(meta.get("level") or meta.get("level_index") or 0)
                except Exception:
                    lvl = 0
                if 1 <= lvl <= 5:
                    try:
                        amt = D(str(r.get("amount") or "0"))
                        accum[lvl] = accum[lvl] + amt
                    except Exception:
                        pass
            gen_breakdown = {str(k): str(v) for k, v in accum.items()}
        except Exception:
            # best-effort
            pass

        # Commission split by role for COMMISSION_CREDIT
        comm_split = {"employee": "0", "agency": "0"}
        try:
            from decimal import Decimal as D
            emp = D("0"); ag = D("0")
            for r in tx.filter(type="COMMISSION_CREDIT").values("amount", "meta"):
                meta = r.get("meta") or {}
                role = (meta.get("role") or "").strip().lower()
                try:
                    amt = D(str(r.get("amount") or "0"))
                except Exception:
                    amt = D("0")
                if role == "employee":
                    emp += amt
                elif role == "agency":
                    ag += amt
            comm_split = {"employee": str(emp), "agency": str(ag)}
        except Exception:
            # best-effort
            pass

        # Matrix progress (per pool_type)
        try:
            from business.models import UserMatrixProgress
            mp_qs = UserMatrixProgress.objects.filter(user=user).order_by("-updated_at")
            matrix = [
                {
                    "pool_type": m.pool_type,
                    "total_earned": str(m.total_earned),
                    "level_reached": int(m.level_reached or 0),
                    "per_level_counts": m.per_level_counts or {},
                    "per_level_earned": m.per_level_earned or {},
                    "updated_at": m.updated_at,
                }
                for m in mp_qs
            ]
        except Exception:
            matrix = []

        # Recent team members (latest 10)
        recent_team = list(
            CustomUser.objects.filter(registered_by=user)
            .order_by("-date_joined")
            .values("id", "username", "category", "role", "date_joined", "account_active")[:10]
        )

        # Recent reward-related wallet transactions (latest 20 across relevant types)
        relevant_types = [
            "DIRECT_REF_BONUS", "LEVEL_BONUS",
            "AUTOPOOL_BONUS_THREE", "AUTOPOOL_BONUS_FIVE",
            "COMMISSION_CREDIT", "FRANCHISE_INCOME", "REWARD_CREDIT"
        ]
        recent_tx = list(
            tx.filter(type__in=relevant_types)
            .order_by("-created_at")
            .values("id", "amount", "type", "source_type", "source_id", "meta", "created_at")[:20]
        )
        # Cast Decimal amounts to strings
        for r in recent_tx:
            try:
                r["amount"] = str(r["amount"])
            except Exception:
                pass

        # Direct team (all direct referrals) with phone, pincode, and their direct referral counts
        try:
            direct_qs = (
                CustomUser.objects
                .filter(registered_by=user)
                .annotate(direct_referrals=Count("registrations", distinct=True))
                .order_by("-date_joined")
            )
            direct_active = direct_qs.filter(account_active=True).count()
            direct_inactive = direct_qs.filter(account_active=False).count()
            # Limit to reasonable number for UI; frontend can page later if needed
            direct_team = list(
                direct_qs.values(
                    "id", "username", "full_name", "category", "role", "date_joined",
                    "account_active", "phone", "pincode", "direct_referrals"
                )[:200]
            )
            direct_counts = {"active": direct_active, "inactive": direct_inactive}
        except Exception:
            direct_team = []
            direct_counts = {"active": 0, "inactive": 0}

        return Response(
            {
                "downline": {
                    "direct": direct_count,
                    "levels": {
                        "l1": levels_1_5[0] if len(levels_1_5) > 0 else 0,
                        "l2": levels_1_5[1] if len(levels_1_5) > 1 else 0,
                        "l3": levels_1_5[2] if len(levels_1_5) > 2 else 0,
                        "l4": levels_1_5[3] if len(levels_1_5) > 3 else 0,
                        "l5": levels_1_5[4] if len(levels_1_5) > 4 else 0,
                    },
                },
                "totals": totals,
                "generation_levels_breakdown": gen_breakdown,
                "commissions_split": comm_split,
                "matrix_progress": matrix,
                "direct_team": direct_team,
                "direct_team_counts": direct_counts,
                "recent_team": recent_team,
                "recent_transactions": recent_tx,
            },
            status=status.HTTP_200_OK,
        )


# ====================
# Wallet API Endpoints
# ====================

class WalletMe(APIView):
    permission_classes = [IsAuthenticated]

    def get(self, request):
        # If account is inactive, always show zero balances
        inactive = False
        try:
            inactive = not bool(getattr(request.user, "account_active", False))
        except Exception:
            inactive = False

        # Lazy import to avoid circulars and to read current tax config
        try:
            from business.models import CommissionConfig
            cfg = CommissionConfig.get_solo()
            tax_percent = str(getattr(cfg, "tax_percent", 10))
        except Exception:
            tax_percent = "10"

        if inactive:
            return Response({
                "balance": "0",
                "main_balance": "0",
                "withdrawable_balance": "0",
                "tax_percent": tax_percent,
                "updated_at": None,
                "auto_block": {
                    "block_size": "1000.00",
                    "total_blocks": 0,
                    "applied_blocks": 0,
                    "pending_blocks": 0,
                    "last_applied": None
                },
                "breakdown_per_block": {
                    "coupon_cost": "150.00",
                    "tds": "50.00",
                    "direct_ref_bonus": "50.00"
                },
                "redeem_points": {
                    "self": 0,
                    "refer": 0
                },
                "next_block": {
                    "completed_in_current_block": "0.00",
                    "remaining_to_next_block": "1000.00",
                    "progress_percent": 0
                }
            }, status=status.HTTP_200_OK)

        w = Wallet.get_or_create_for_user(request.user)
        # Auto-apply any pending ₹1000 blocks on wallet fetch (idempotent via AuditTrail)
        try:
            w._apply_auto_block_rule(w)
        except Exception:
            pass

        # Enhanced wallet meta for UI (best-effort; all exceptions guarded)
        try:
            from decimal import Decimal as D
            block_size = D("1000.00")
            main = D(str(getattr(w, "main_balance", 0) or 0))
            total_blocks = int(main // block_size)
            try:
                from coupons.models import AuditTrail
                applied_blocks = int(
                    AuditTrail.objects.filter(action="auto_1k_block_applied", actor=request.user).count()
                )
                last_obj = (
                    AuditTrail.objects
                    .filter(action="auto_1k_block_applied", actor=request.user)
                    .only("id", "created_at", "metadata")
                    .order_by("-id")
                    .first()
                )
                last_applied = {
                    "id": getattr(last_obj, "id", None),
                    "created_at": getattr(last_obj, "created_at", None),
                    "metadata": getattr(last_obj, "metadata", None),
                } if last_obj else None
            except Exception:
                applied_blocks = 0
                last_applied = None
            pending_blocks = max(0, total_blocks - applied_blocks)
            rem = main - (block_size * D(str(total_blocks)))
            if rem < D("0"):
                rem = D("0")
            try:
                progress_percent = int((rem / block_size) * D("100"))
            except Exception:
                progress_percent = 0
            remaining_to_next = (block_size - rem) if block_size > rem else D("0")
        except Exception:
            block_size = "1000.00"
            total_blocks = 0
            applied_blocks = 0
            pending_blocks = 0
            rem = 0
            progress_percent = 0
            remaining_to_next = "1000.00"
            last_applied = None

        # Redeem point counters (self vs direct referrals), best-effort
        try:
            from coupons.models import AuditTrail
            self_redeems = int(AuditTrail.objects.filter(action="coupon_activated", actor=request.user).count())
            direct_ids = list(CustomUser.objects.filter(registered_by=request.user).values_list("id", flat=True))
            refer_redeems = int(AuditTrail.objects.filter(action="coupon_activated", actor_id__in=direct_ids).count()) if direct_ids else 0
        except Exception:
            self_redeems = 0
            refer_redeems = 0

        # ===== Wallet summary extras for Consumer Wallet UI (best-effort; guarded) =====
        try:
            from django.utils import timezone as _tz
            today = _tz.localdate()
            tx_all = WalletTransaction.objects.filter(user=request.user)

            def _sum_t(qs):
                val = qs.aggregate(total=Sum("amount"))["total"] or 0
                return str(val)

            direct_ref_total = _sum_t(tx_all.filter(type="DIRECT_REF_BONUS"))
            matrix_five_total = _sum_t(tx_all.filter(type="AUTOPOOL_BONUS_FIVE"))
            matrix_three_total = _sum_t(tx_all.filter(type="AUTOPOOL_BONUS_THREE"))
            matrix_total = _sum_t(tx_all.filter(type__in=["LEVEL_BONUS", "AUTOPOOL_BONUS_THREE", "AUTOPOOL_BONUS_FIVE"]))
            global_tri_total = _sum_t(tx_all.filter(type="GLOBAL_ROYALTY"))
            global_turnover_total = _sum_t(tx_all.filter(type="GLOBAL_ACTIVATION_CREDIT"))
            from decimal import Decimal as D
            withdrawal_benefit_total = _sum_t(tx_all.filter(type="LIFETIME_WITHDRAWAL_BONUS"))
            commission_total = _sum_t(tx_all.filter(type="COMMISSION_CREDIT"))
            franchise_total = _sum_t(tx_all.filter(type="FRANCHISE_INCOME"))
            direct_ref_withdraw_commission_total = _sum_t(
                tx_all.filter(type="DIRECT_REF_BONUS").filter(Q(meta__auto_rule="AUTO_1K_BLOCK") | Q(source_type="AUTO_1K_BLOCK"))
            )
            # Level-only bonus = matrix_total - (five + three)
            try:
                level_bonus_total = str(
                    (D(str(matrix_total)) - D(str(matrix_five_total)) - D(str(matrix_three_total))).quantize(D("0.01"))
                )
            except Exception:
                level_bonus_total = "0"
            # Today earning: sum of positive credits across ALL income sources (exclude debits/withholding)
            today_earning = _sum_t(
                tx_all.filter(
                    created_at__date=today,
                    amount__gt=0,
                    type__in=[
                        "DIRECT_REF_BONUS",
                        "LEVEL_BONUS",
                        "AUTOPOOL_BONUS_FIVE",
                        "AUTOPOOL_BONUS_THREE",
                        "GLOBAL_ROYALTY",
                        "GLOBAL_ACTIVATION_CREDIT",
                        "COMMISSION_CREDIT",
                        "FRANCHISE_INCOME",
                        "LIFETIME_WITHDRAWAL_BONUS",
                    ],
                )
            )
            # All earnings (gross without TDS): sum of positive credits across all earning types
            earn_types = [
                "DIRECT_REF_BONUS",
                "LEVEL_BONUS",
                "AUTOPOOL_BONUS_FIVE",
                "AUTOPOOL_BONUS_THREE",
                "GLOBAL_ROYALTY",
                "GLOBAL_ACTIVATION_CREDIT",
                "COMMISSION_CREDIT",
                "FRANCHISE_INCOME",
                "LIFETIME_WITHDRAWAL_BONUS",
                "REWARD_CREDIT",
                "REDEEM_ECOUPON_CREDIT",
                "SELF_BONUS_ACTIVE",
            ]
            all_earnings_total = _sum_t(tx_all.filter(amount__gt=0, type__in=earn_types))
        except Exception:
            direct_ref_total = "0"
            matrix_five_total = "0"
            matrix_three_total = "0"
            matrix_total = "0"
            global_tri_total = "0"
            global_turnover_total = "0"
            withdrawal_benefit_total = "0"
            commission_total = "0"
            franchise_total = "0"
            level_bonus_total = "0"
            today_earning = "0"
            direct_ref_withdraw_commission_total = "0"
            all_earnings_total = "0"

        # Prime and Monthly activity snapshot
        try:
            from business.models import PromoPurchase, PromoMonthlyBox
            prime_active_count = PromoPurchase.objects.filter(user=request.user, package__type="PRIME", status="APPROVED").count()
            last_prime = PromoPurchase.objects.filter(user=request.user, package__type="PRIME", status="APPROVED").order_by("-approved_at").first()
            last_prime_date = getattr(last_prime, "approved_at", None)
            monthly_active_count = PromoMonthlyBox.objects.filter(user=request.user).count()
        except Exception:
            prime_active_count = 0
            last_prime_date = None
            monthly_active_count = 0

        # Spin & Win eligibility
        try:
            from uploads.models import LuckySpinDraw, LuckySpinAttempt
            now = timezone.now()
            draw = LuckySpinDraw.objects.filter(locked=True, start_at__lte=now, end_at__gte=now).order_by("start_at").first()
            spin_eligible = False
            if draw:
                att = LuckySpinAttempt.objects.filter(draw=draw, user=request.user).first()
                spin_eligible = False if att else True
        except Exception:
            spin_eligible = False

        # Coupon activity summary
        try:
            from django.utils import timezone as _tz2
            from coupons.models import AuditTrail as _AT
            self_activated = int(_AT.objects.filter(action="coupon_activated", actor=request.user).count())
            month_start = _tz2.now().replace(day=1).date()
            monthly_self_benefit = int(WalletTransaction.objects.filter(user=request.user, type="SELF_BONUS_ACTIVE", created_at__date__gte=month_start).count())
        except Exception:
            self_activated = 0
            monthly_self_benefit = 0

        return Response({
            "balance": str(w.balance),                       # total (legacy)
            "main_balance": str(getattr(w, "main_balance", 0) or 0),
            "withdrawable_balance": str(getattr(w, "withdrawable_balance", 0) or 0),
            "tax_percent": tax_percent,
            "updated_at": w.updated_at,
            "auto_block": {
                "block_size": str(block_size),
                "total_blocks": int(total_blocks),
                "applied_blocks": int(applied_blocks),
                "pending_blocks": int(pending_blocks),
                "last_applied": last_applied
            },
            "breakdown_per_block": {
                "coupon_cost": "150.00",
                "tds": "50.00",
                "direct_ref_bonus": "50.00"
            },
            "redeem_points": {
                "self": int(self_redeems),
                "refer": int(refer_redeems)
            },
            "next_block": {
                "completed_in_current_block": str(rem),
                "remaining_to_next_block": str(remaining_to_next),
                "progress_percent": int(progress_percent)
            },
            # Sketch-driven wallet summary extensions
            "prime": {
                "activeCount": int(prime_active_count),
                "monthlyActiveCount": int(monthly_active_count),
                "lastActiveDate": last_prime_date,
            },
            "today": {
                "earning": str(today_earning),
                "spinEligible": bool(spin_eligible),
            },
            "income": {
                "directReferral": str(direct_ref_total),
                "matrixFive": str(matrix_five_total),
                "matrixThree": str(matrix_three_total),
                "levelBonus": str(level_bonus_total),
                "commission": str(commission_total),
                "franchise": str(franchise_total),
                "directRefWithdrawCommission": str(direct_ref_withdraw_commission_total),
                "withdrawalBenefit": str(withdrawal_benefit_total),
                "matrixLevel": str(matrix_total),
                "globalTri": str(global_tri_total),
                "globalTurnover": str(global_turnover_total),
            },
            "coupons": {
                "selfActivated": int(self_activated),
                "monthlySelfBenefitActivated": int(monthly_self_benefit),
                "monthlyActivated": int(monthly_active_count),
            },
            "totals": {
                "allEarnings": str(all_earnings_total)
            },
            "limits": {
                "minWithdraw": 500
            }
        }, status=status.HTTP_200_OK)


class WalletTransactionSerializer(serializers.ModelSerializer):
    tr_username = serializers.SerializerMethodField()
    full_name = serializers.SerializerMethodField()
    pincode = serializers.SerializerMethodField()
    commission = serializers.SerializerMethodField()

    class Meta:
        model = WalletTransaction
        fields = [
            "id",
            "amount",
            "commission",
            "balance_after",
            "type",
            "source_type",
            "source_id",
            "meta",
            "created_at",
            "tr_username",
            "full_name",
            "pincode",
        ]

    def get_commission(self, obj):
        try:
            return str(obj.amount)
        except Exception:
            return None

    def _resolve_counterparty(self, obj):
        try:
            meta = obj.meta or {}
        except Exception:
            meta = {}
        uid = meta.get("from_user_id") or meta.get("user_id")
        uname = meta.get("from_user") or meta.get("username")
        u = None
        try:
            if uid:
                u = CustomUser.objects.filter(id=uid).only("id", "username", "full_name", "pincode").first()
            if not u and uname:
                u = CustomUser.objects.filter(username__iexact=str(uname)).only("id", "username", "full_name", "pincode").first()
        except Exception:
            u = None
        return u or getattr(obj, "user", None)

    def get_tr_username(self, obj):
        u = self._resolve_counterparty(obj)
        return getattr(u, "username", None)

    def get_full_name(self, obj):
        u = self._resolve_counterparty(obj)
        return getattr(u, "full_name", None)

    def get_pincode(self, obj):
        u = self._resolve_counterparty(obj)
        return getattr(u, "pincode", None)


class LenientWalletTxnPagination(PageNumberPagination):
    page_size = 10
    page_size_query_param = "page_size"
    max_page_size = 100

    def paginate_queryset(self, queryset, request, view=None):
        try:
            return super().paginate_queryset(queryset, request, view)
        except NotFound:
            # When requested page is out of range, return empty page instead of 404
            self.request = request
            try:
                self.count = queryset.count()
            except Exception:
                self.count = 0
            self.page = None
            return []

    def get_paginated_response(self, data):
        if getattr(self, "page", None) is None:
            return Response({
                "count": int(getattr(self, "count", 0) or 0),
                "next": None,
                "previous": None,
                "results": data,
            })
        return super().get_paginated_response(data)


class WalletTransactionsList(generics.ListAPIView):
    permission_classes = [IsAuthenticated]
    serializer_class = WalletTransactionSerializer
    pagination_class = LenientWalletTxnPagination

    def get_queryset(self):
        qs = WalletTransaction.objects.filter(user=self.request.user).order_by("-created_at")
        t = (self.request.query_params.get("type") or "").strip()
        if t:
            qs = qs.filter(type=t)

        # Optional date range filtering on created_at (date). Apply only if provided.
        date_from = (self.request.query_params.get("date_from") or "").strip()
        date_to = (self.request.query_params.get("date_to") or "").strip()
        if date_from:
            qs = qs.filter(created_at__date__gte=date_from)
        if date_to:
            qs = qs.filter(created_at__date__lte=date_to)

        return qs


# ====================
# KYC + Withdrawals API
# ====================

class UserKYCMeView(generics.RetrieveUpdateAPIView):
    permission_classes = [IsAuthenticated]
    serializer_class = UserKYCSerializer

    def get_object(self):
        # Ensure the user's KYC row exists
        from .models import UserKYC
        obj, _ = UserKYC.objects.get_or_create(user=self.request.user)
        return obj


class WithdrawalCreateView(generics.CreateAPIView):
    permission_classes = [IsAuthenticated]
    serializer_class = WithdrawalRequestSerializer
    queryset = WalletTransaction.objects.none()  # unused, but DRF requires queryset on generic views

    def perform_create(self, serializer):
        serializer.save()


class MyWithdrawalsListView(generics.ListAPIView):
    permission_classes = [IsAuthenticated]
    serializer_class = WithdrawalRequestSerializer

    def get_queryset(self):
        from .models import WithdrawalRequest
        return WithdrawalRequest.objects.filter(user=self.request.user).order_by("-requested_at")


# ====================
# Support Portal (User)
# ====================

class SupportTicketListCreate(generics.ListCreateAPIView):
    """
    List my support tickets and create a new ticket.
    """
    permission_classes = [IsAuthenticated]
    serializer_class = SupportTicketSerializer

    def get_queryset(self):
        return SupportTicket.objects.filter(user=self.request.user).order_by("-updated_at", "-id")

    def perform_create(self, serializer):
        serializer.save(user=self.request.user)


class SupportTicketDetail(generics.RetrieveAPIView):
    """
    Retrieve a specific ticket (restricted to the owner).
    """
    permission_classes = [IsAuthenticated]
    serializer_class = SupportTicketSerializer

    def get_queryset(self):
        return SupportTicket.objects.filter(user=self.request.user)


class SupportTicketMessageCreate(generics.CreateAPIView):
    """
    Post a message on my ticket (simple 1:1 conversation thread with admin).
    """
    permission_classes = [IsAuthenticated]
    serializer_class = SupportTicketMessageSerializer

    def perform_create(self, serializer):
        try:
            pk = int(self.kwargs.get("pk") or 0)
        except Exception:
            pk = 0
        ticket = SupportTicket.objects.filter(pk=pk, user=self.request.user).first()
        if not ticket:
            raise serializers.ValidationError({"detail": "Ticket not found."})
        serializer.save(ticket=ticket, author=self.request.user)

# ====================
# Employee Offer Letter (PDF)
# ====================
def _xhtml2pdf_link_callback(uri, rel):
    """
    Convert STATIC/MEDIA URIs to absolute system paths for xhtml2pdf.
    Falls back to returning the original URI if the file is not resolvable.
    """
    try:
        sUrl = (getattr(settings, "STATIC_URL", None) or "/static/").rstrip("/") + "/"
        sRoot = getattr(settings, "STATIC_ROOT", "") or ""
        mUrl = (getattr(settings, "MEDIA_URL", None) or "/media/").rstrip("/") + "/"
        mRoot = getattr(settings, "MEDIA_ROOT", "") or ""

        if uri.startswith(mUrl) and mRoot:
            path = os.path.join(mRoot, uri[len(mUrl):])
        elif uri.startswith(sUrl):
            # Prefer staticfiles finders during development
            rel_path = uri[len(sUrl):]
            path = finders.find(rel_path)
            if not path and sRoot:
                path = os.path.join(sRoot, rel_path)
        else:
            return uri

        if path and os.path.isfile(path):
            return path
    except Exception:
        pass
    return uri


class OfferLetterPDFView(APIView):
    """
    Generate a dynamic Employment Offer Letter (PDF) for the logged-in employee.
    Includes Trikonekt company branding and user details.
    """
    permission_classes = [IsAuthenticated]

    def get(self, request):
        user = request.user
        # Restrict to employees only (either role or category marked as employee)
        if str(getattr(user, "role", "")).lower() != "employee" and str(getattr(user, "category", "")).lower() != "employee":
            return Response({"detail": "Offer letter is available for employees only."}, status=status.HTTP_403_FORBIDDEN)

        today = timezone.now().strftime("%d %B %Y")
        company = "Trikonekt"

        full_name = getattr(user, "full_name", "") or getattr(user, "username", "")
        username = getattr(user, "username", "") or ""
        unique_id = getattr(user, "unique_id", "") or ""
        prefixed_id = getattr(user, "prefixed_id", "") or ""
        address = getattr(user, "address", "") or ""
        pincode = getattr(user, "pincode", "") or ""
        city = getattr(getattr(user, "city", None), "name", "") or ""
        state_name = getattr(getattr(user, "state", None), "name", "") or ""

        # Static logo path under /static/branding/trikonekt.png (optional).
        # If not present, PDF will render without image.
        base_static_url = (getattr(settings, "STATIC_URL", None) or "/static/").rstrip("/") + "/"
        logo_uri = f"{base_static_url}branding/trikonekt.png"

        html = f"""<!DOCTYPE html>
<html>
<head>
<meta charset="utf-8" />
<style>
  @page {{
    size: A4;
    margin: 28mm 20mm 20mm 20mm;
  }}
  body {{ font-family: DejaVu Sans, Arial, Helvetica, sans-serif; color: #111827; font-size: 12pt; }}
  .header {{ text-align: center; margin-bottom: 16px; }}
  .logo {{ height: 56px; }}
  .company {{ font-weight: 700; font-size: 20pt; color: #0C2D48; margin-top: 8px; }}
  .title {{ text-align: center; font-weight: 700; font-size: 16pt; margin: 18px 0; text-transform: uppercase; }}
  .meta {{ margin: 10px 0 18px 0; line-height: 1.5; }}
  .para {{ margin: 12px 0; text-align: justify; line-height: 1.65; }}
  .sig {{ margin-top: 32px; }}
  .row {{ display: block; margin: 2px 0; }}
  .label {{ width: 150px; display: inline-block; color: #374151; }}
  .value {{ font-weight: 600; }}
  .footer {{ position: fixed; bottom: 10mm; left: 0; right: 0; text-align: center; color: #6b7280; font-size: 9pt; }}
</style>
</head>
<body>
  <div class="header">
    <img src="{logo_uri}" class="logo" />
    <div class="company">{company}</div>
  </div>

  <div class="title">Employment Offer Letter</div>

  <div class="meta">
    <div class="row"><span class="label">Date:</span> <span class="value">{today}</span></div>
    <div class="row"><span class="label">Employee Name:</span> <span class="value">{full_name}</span></div>
    <div class="row"><span class="label">Username:</span> <span class="value">{username}</span></div>
    <div class="row"><span class="label">Employee ID:</span> <span class="value">{prefixed_id or unique_id}</span></div>
    <div class="row"><span class="label">Designation:</span> <span class="value">Employee</span></div>
    <div class="row"><span class="label">Location:</span> <span class="value">{(city + ', ' if city else '') + (state_name or '')} {pincode}</span></div>
  </div>

  <div class="para">
    We are pleased to offer you the position of <b>Employee</b> with <b>{company}</b>. Your skills and experience will be a valuable
    addition to our team. The terms and conditions of your employment, including compensation, responsibilities, and policies,
    will be communicated separately and may be updated from time to time as per company norms.
  </div>

  <div class="para">
    Your joining is effective upon acceptance of this offer and completion of requisite onboarding formalities.
    Please keep this letter for your records. This letter is system generated and does not require a physical signature.
  </div>

  <div class="sig">
    <div class="row"><span class="label">For:</span> <span class="value">{company}</span></div>
    <div class="row" style="margin-top: 22px;"><span class="label">Authorized Signatory:</span> <span class="value">HR Department</span></div>
  </div>

  <div class="footer">
    {company} • www.trikonekt.com
  </div>
</body>
</html>
"""

        # Render PDF
        pdf_io = BytesIO()
        result = pisa.CreatePDF(src=html, dest=pdf_io, link_callback=_xhtml2pdf_link_callback)
        if getattr(result, "err", False):
            return Response({"detail": "Failed to generate PDF."}, status=status.HTTP_500_INTERNAL_SERVER_ERROR)

        filename = f'Trikonekt_Offer_Letter_{username}.pdf'
        resp = HttpResponse(pdf_io.getvalue(), content_type='application/pdf')
        resp['Content-Disposition'] = f'attachment; filename="{filename}"'
        return resp

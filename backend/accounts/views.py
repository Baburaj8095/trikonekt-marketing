from rest_framework import generics
from .models import CustomUser, AgencyRegionAssignment, Wallet, WalletTransaction
from .serializers import RegisterSerializer, PublicUserSerializer
from rest_framework.permissions import AllowAny, IsAuthenticated
from rest_framework_simplejwt.views import TokenObtainPairView
from .token_serializers import CustomTokenObtainPairSerializer
from rest_framework.views import APIView
from rest_framework.response import Response
from rest_framework import status, serializers
from django.contrib.auth import get_user_model
from django.contrib.auth.password_validation import validate_password
from django.core.exceptions import ValidationError
from django.db.models import Q
from locations.views import _build_district_index, india_place_variants
from locations.models import State


class RegisterView(generics.CreateAPIView):
    queryset = CustomUser.objects.all()
    permission_classes = [AllowAny]
    serializer_class = RegisterSerializer

    def perform_create(self, serializer):
        """
        Create the user and send a welcome email containing the username
        to the registered email address. Email send failures are ignored
        so registration is not blocked.
        """
        user = serializer.save()
        try:
            from django.core.mail import send_mail
            full_name = getattr(user, "full_name", "") or ""
            subject = "Welcome to Trikonekt - Your username"
            message = (
                f"Hello {full_name or 'there'},\n\n"
                f"Your Trikonekt username is: {user.username}\n\n"
                "Thank you for registering with Trikonekt.\n\n"
                "Regards,\nTrikonekt Team"
            )
            recipient = getattr(user, "email", None)
            if recipient:
                # From email is picked from DEFAULT_FROM_EMAIL in settings when None is passed
                send_mail(
                    subject,
                    message,
                    None,
                    [recipient],
                    fail_silently=True,
                )
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

        return Response({'states': out_states, 'pincodes': out_pincodes, 'pins_by_state': pins_by_state}, status=status.HTTP_200_OK)

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

            return Response({'pincodes': sorted(pins)}, status=status.HTTP_200_OK)
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

    return Response({'pincodes': out_pins}, status=status.HTTP_200_OK)


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


# ====================
# Wallet API Endpoints
# ====================

class WalletMe(APIView):
    permission_classes = [IsAuthenticated]

    def get(self, request):
        w = Wallet.get_or_create_for_user(request.user)
        return Response({
            "balance": str(w.balance),
            "updated_at": w.updated_at
        }, status=status.HTTP_200_OK)


class WalletTransactionSerializer(serializers.ModelSerializer):
    class Meta:
        model = WalletTransaction
        fields = ["id", "amount", "balance_after", "type", "source_type", "source_id", "meta", "created_at"]


class WalletTransactionsList(generics.ListAPIView):
    permission_classes = [IsAuthenticated]
    serializer_class = WalletTransactionSerializer

    def get_queryset(self):
        qs = WalletTransaction.objects.filter(user=self.request.user).order_by("-created_at")
        t = (self.request.query_params.get("type") or "").strip()
        if t:
            qs = qs.filter(type=t)
        return qs

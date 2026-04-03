from typing import Dict, Any, List, Set

from django.db.models import Q
from rest_framework.views import APIView
from rest_framework.permissions import IsAuthenticated
from rest_framework.response import Response
from rest_framework import status

from .models import CustomUser
try:
    from business.models import AutoPoolAccount, CommissionConfig
except Exception:  # pragma: no cover
    AutoPoolAccount = None  # type: ignore
    CommissionConfig = None  # type: ignore


class MyFiveMatrixTeamV1(APIView):
    """
    Authenticated user's 5-matrix style genealogy (entry-agnostic, user-centric).
    - Uses matrix placement links on CustomUser (parent/matrix_position/depth) so it reflects actual spillover.
    - Root is the logged-in user, or an allowed subtree inside caller's matrix downline (?root_user_id=).
    - Per-node fanout is capped to the matrix width (5 for FIVE_150, 3 for THREE_x).
    - Includes:
        id, username, full_name
        level (relative from requested root, root=1)
        matrix_position, depth (as persisted on CustomUser)
        autopool_level (absolute AutoPoolAccount.level for owner, if available for selected pool)
        autopool_status (ACTIVE/PENDING/CLOSED or null)
        account_active (bool)
        pincode (string)
        team_count (descendant node count)
        children: [...]
    Query params:
      - pool: FIVE_150 | THREE_150 | THREE_50 (default FIVE_150)
      - max_depth: optional (default from CommissionConfig, capped at 20)
      - root_user_id: optional subtree root; must be inside caller's matrix downline (or self)
    """
    permission_classes = [IsAuthenticated]

    def get(self, request):
        # Pool and fanout
        pool = (request.query_params.get("pool") or "FIVE_150").strip().upper()
        if pool not in ("FIVE_150", "THREE_150", "THREE_50"):
            pool = "FIVE_150"
        fanout = 5 if pool == "FIVE_150" else 3

        # Depth defaults from config
        default_levels = 6
        try:
            if CommissionConfig:
                cfg = CommissionConfig.get_solo()
                default_levels = int(cfg.get_matrix_five_levels() if pool == "FIVE_150" else cfg.get_matrix_three_levels())
        except Exception:
            default_levels = 6 if pool == "FIVE_150" else 15

        try:
            max_depth = int(request.query_params.get("max_depth") or default_levels)
        except Exception:
            max_depth = default_levels
        max_depth = max(1, min(int(max_depth), 20))

        # Optionally fill remaining first-row slots with direct (sponsor-based) children
        try:
            val = (request.query_params.get("include_sponsor_fallback") or "1")
            include_sponsor_fallback = str(val).strip().lower() in ("1", "true", "yes", "on")
        except Exception:
            include_sponsor_fallback = True

        # Resolve root: self or subtree (enforce security: root must be in caller's matrix downline or equal to self)
        me = request.user
        root = me
        try:
            rraw = request.query_params.get("root_user_id") or ""
            if str(rraw).strip():
                rid = int(rraw)
                cand = CustomUser.objects.filter(id=rid).only("id", "parent_id").first()
                if not cand:
                    return Response({"detail": "root user not found"}, status=status.HTTP_404_NOT_FOUND)
                # Self allowed
                if cand.id != me.id:
                    # Allow drilling into owner's top row (including sponsor-fallback) when explicitly drilling with spill_from_owner_id
                    allowed = False
                    try:
                        sraw_sec = request.query_params.get("spill_from_owner_id") or ""
                        spill_owner_id_sec = int(sraw_sec) if str(sraw_sec).strip() else 0
                    except Exception:
                        spill_owner_id_sec = 0

                    try:
                        if spill_owner_id_sec:
                            # Owner must itself be within caller's downline (or equal to caller)
                            owner_allowed = False
                            if spill_owner_id_sec == int(getattr(me, "id", 0) or 0):
                                owner_allowed = True
                            else:
                                owner = CustomUser.objects.filter(id=spill_owner_id_sec).only("id", "parent_id").first()
                                cur_owner = owner
                                for _ in range(max_depth + 1):
                                    if not cur_owner:
                                        break
                                    if cur_owner.id == me.id:
                                        owner_allowed = True
                                        break
                                    pid = getattr(cur_owner, "parent_id", None)
                                    if not pid:
                                        break
                                    cur_owner = CustomUser.objects.filter(id=pid).only("id", "parent_id").first()

                            if owner_allowed:
                                # Build owner's top row exactly as in root view: matrix children first, then sponsor fallback to fill to fanout
                                owner_matrix_qs = list(
                                    CustomUser.objects.filter(parent_id=spill_owner_id_sec)
                                    .only("id", "matrix_position")
                                    .order_by("matrix_position", "id")[:fanout]
                                )
                                owner_top_children_ids = [int(getattr(x, "id", 0) or 0) for x in owner_matrix_qs]
                                if include_sponsor_fallback and len(owner_top_children_ids) < fanout:
                                    needed = fanout - len(owner_top_children_ids)
                                    # Legacy-safe: include sponsor_id-based directs when registered_by is NULL
                                    try:
                                        owner_user = (
                                            CustomUser.objects
                                            .only("id", "username", "prefixed_id", "unique_id", "phone")
                                            .filter(id=spill_owner_id_sec)
                                            .first()
                                        )
                                    except Exception:
                                        owner_user = None
                                    try:
                                        vals = [
                                            (getattr(owner_user, "prefixed_id", "") or "").strip(),
                                            (getattr(owner_user, "username", "") or "").strip(),
                                            (getattr(owner_user, "unique_id", "") or "").strip(),
                                            (getattr(owner_user, "phone", "") or "").strip(),
                                        ]
                                        digs_user = "".join(ch for ch in ((getattr(owner_user, "username", "") or "")) if ch.isdigit())
                                        digs_phone = "".join(ch for ch in ((getattr(owner_user, "phone", "") or "")) if ch.isdigit())
                                        if digs_user:
                                            vals.append(digs_user)
                                        if digs_phone:
                                            vals.append(digs_phone)
                                        tr = (getattr(owner_user, "prefixed_id", "") or "").strip()
                                        if tr and "-" not in tr and len(tr) > 2 and tr[:2].isalpha():
                                            vals.append(f"{tr[:2]}-{tr[2:]}")
                                        idents = [s for s in {v for v in vals if v}]
                                    except Exception:
                                        idents = []
                                    sponsored_q = Q(registered_by_id=spill_owner_id_sec) | (Q(registered_by__isnull=True) & Q(sponsor_id__in=idents))

                                    direct_fallback_qs = list(
                                        CustomUser.objects.filter(sponsored_q)
                                        .exclude(id__in=owner_top_children_ids)
                                        .only("id")
                                        .order_by("-id")[:needed]
                                    )
                                    owner_top_children_ids.extend(int(getattr(x, "id", 0) or 0) for x in direct_fallback_qs)

                                if int(rid) in owner_top_children_ids:
                                    allowed = True
                    except Exception:
                        pass

                    if not allowed:
                        # Walk up matrix parents to verify ancestry for the requested root candidate
                        cur = cand
                        for _ in range(max_depth + 1):
                            if not cur:
                                break
                            if cur.id == me.id:
                                allowed = True
                                break
                            pid = getattr(cur, "parent_id", None)
                            if not pid:
                                break
                            cur = CustomUser.objects.filter(id=pid).only("id", "parent_id").first()
                    if not allowed:
                        return Response({"detail": "Requested root is not inside your matrix downline"}, status=status.HTTP_403_FORBIDDEN)
                root = cand
        except ValueError:
            return Response({"detail": "root_user_id must be integer"}, status=status.HTTP_400_BAD_REQUEST)
        except Exception:
            # Best-effort: fall back to self
            root = me

        # Build tree using matrix (parent/matrix_position) so spillover layout is preserved
        encountered_ids: Set[int] = set()

        def serialize_user(u: CustomUser, level: int) -> Dict[str, Any]:
            node = {
                "id": u.id,
                "username": u.username,
                "full_name": getattr(u, "full_name", ""),
                "level": int(level),
                "matrix_position": getattr(u, "matrix_position", None),
                "depth": getattr(u, "depth", 0),
                "autopool_level": None,   # annotated later
                "autopool_status": None,  # annotated later
                "has_self_account": False,  # annotated later (entry_idx >= 1)
                "self_account_status": None,  # annotated later (status of entry_idx=1)
                "account_active": bool(getattr(u, "account_active", False)),
                "pincode": getattr(u, "pincode", None),
                "team_count": 0,          # annotated later
                "children": [],
            }
            return node

        def build(u: CustomUser, level: int) -> Dict[str, Any]:
            if not u or getattr(u, "id", None) is None:
                return {}
            encountered_ids.add(int(u.id))
            node = serialize_user(u, level)
            if level >= max_depth:
                return node
            # Up to 'fanout' children ordered by matrix_position then id
            try:
                children_qs = list(
                    CustomUser.objects.filter(parent_id=u.id)
                    .only("id", "username", "full_name", "parent_id", "matrix_position", "depth", "account_active", "pincode")
                    .order_by("matrix_position", "id")[:fanout]
                )
            except Exception:
                children_qs = []
            # Append sponsor-based directs to fill first row up to fanout, if enabled
            extra_children = []
            try:
                # Disable child's own sponsor fallback when drilling from an owner, to avoid duplicating owner's top-row members
                try:
                    sraw_local = request.query_params.get("spill_from_owner_id") or ""
                    in_spill_mode = bool(int(sraw_local) if str(sraw_local).strip() else 0)
                except Exception:
                    in_spill_mode = False
                if include_sponsor_fallback and (not in_spill_mode) and level == 1 and len(children_qs) < fanout:
                    already_ids = set(int(getattr(c, "id", 0) or 0) for c in children_qs)
                    needed = fanout - len(children_qs)
                    # Legacy-safe: include sponsor_id-based directs when registered_by is NULL
                    try:
                        vals = [
                            (getattr(u, "prefixed_id", "") or "").strip(),
                            (getattr(u, "username", "") or "").strip(),
                            (getattr(u, "unique_id", "") or "").strip(),
                            (getattr(u, "phone", "") or "").strip(),
                        ]
                        digs_user = "".join(ch for ch in ((getattr(u, "username", "") or "")) if ch.isdigit())
                        digs_phone = "".join(ch for ch in ((getattr(u, "phone", "") or "")) if ch.isdigit())
                        if digs_user:
                            vals.append(digs_user)
                        if digs_phone:
                            vals.append(digs_phone)
                        tr = (getattr(u, "prefixed_id", "") or "").strip()
                        if tr and "-" not in tr and len(tr) > 2 and tr[:2].isalpha():
                            vals.append(f"{tr[:2]}-{tr[2:]}")
                        idents = [s for s in {v for v in vals if v}]
                    except Exception:
                        idents = []
                    sponsored_q = Q(registered_by_id=u.id) | (Q(registered_by__isnull=True) & Q(sponsor_id__in=idents))

                    direct_qs = list(
                        CustomUser.objects.filter(sponsored_q)
                        .exclude(id__in=already_ids)
                        .only("id", "username", "full_name", "parent_id", "matrix_position", "depth", "account_active", "pincode")
                        .order_by("-id")[:needed]
                    )
                    extra_children = direct_qs
            except Exception:
                extra_children = []
            for ch in list(children_qs) + list(extra_children):
                cid = int(getattr(ch, "id", 0) or 0)
                if cid in encountered_ids:
                    continue
                encountered_ids.add(cid)
                node["children"].append(build(ch, level + 1))

            # Top-up spill from ancestor owner's pending directs when drilling into the first child
            try:
                sraw = request.query_params.get("spill_from_owner_id") or ""
                spill_owner_id = int(sraw) if str(sraw).strip() else 0
            except Exception:
                spill_owner_id = 0

            if level == 1 and spill_owner_id:
                # Top-up only when this subtree is the FIRST top-row child of the owner.
                # Compute owner's top row exactly like the root view (matrix children first, then sponsor fallback to fill fanout).
                try:
                    owner_matrix_qs = list(
                        CustomUser.objects.filter(parent_id=spill_owner_id)
                        .only("id", "matrix_position")
                        .order_by("matrix_position", "id")[:fanout]
                    )
                    owner_matrix_ids = [int(getattr(x, "id", 0) or 0) for x in owner_matrix_qs]
                except Exception:
                    owner_matrix_ids = []
                owner_top_children_ids = list(owner_matrix_ids)
                try:
                    if include_sponsor_fallback and len(owner_top_children_ids) < fanout:
                        needed = fanout - len(owner_top_children_ids)
                        direct_fallback_qs = list(
                            CustomUser.objects.filter(registered_by_id=spill_owner_id)
                            .exclude(id__in=owner_top_children_ids)
                            .only("id")
                            .order_by("-id")[:needed]
                        )
                        owner_top_children_ids.extend(int(getattr(x, "id", 0) or 0) for x in direct_fallback_qs)
                except Exception:
                    pass

                # Verify this subtree root is the first top-row child
                is_first = False
                try:
                    first_id = int(owner_top_children_ids[0]) if owner_top_children_ids else 0
                    is_first = first_id == int(getattr(u, "id", 0) or 0)
                except Exception:
                    is_first = False

                if is_first:
                    # Pending = owner's directs not already shown in owner's top row
                    try:
                        # Legacy-safe: include sponsor_id-based directs when registered_by is NULL
                        try:
                            owner_user2 = (
                                CustomUser.objects
                                .only("id", "username", "prefixed_id", "unique_id", "phone")
                                .filter(id=spill_owner_id)
                                .first()
                            )
                        except Exception:
                            owner_user2 = None
                        try:
                            vals2 = [
                                (getattr(owner_user2, "prefixed_id", "") or "").strip(),
                                (getattr(owner_user2, "username", "") or "").strip(),
                                (getattr(owner_user2, "unique_id", "") or "").strip(),
                                (getattr(owner_user2, "phone", "") or "").strip(),
                            ]
                            digs_user2 = "".join(ch for ch in ((getattr(owner_user2, "username", "") or "")) if ch.isdigit())
                            digs_phone2 = "".join(ch for ch in ((getattr(owner_user2, "phone", "") or "")) if ch.isdigit())
                            if digs_user2:
                                vals2.append(digs_user2)
                            if digs_phone2:
                                vals2.append(digs_phone2)
                            tr2 = (getattr(owner_user2, "prefixed_id", "") or "").strip()
                            if tr2 and "-" not in tr2 and len(tr2) > 2 and tr2[:2].isalpha():
                                vals2.append(f"{tr2[:2]}-{tr2[2:]}")
                            idents2 = [s for s in {v for v in vals2 if v}]
                        except Exception:
                            idents2 = []
                        sponsored_q2 = Q(registered_by_id=spill_owner_id) | (Q(registered_by__isnull=True) & Q(sponsor_id__in=idents2))

                        owner_direct_ids = list(
                            CustomUser.objects.filter(sponsored_q2)
                            .order_by("id")
                            .values_list("id", flat=True)
                        )
                    except Exception:
                        owner_direct_ids = []
                    shown = set(int(x) for x in owner_top_children_ids)
                    pending_ids = [int(i) for i in owner_direct_ids if int(i) not in shown]

                    try:
                        present_ids = {int(c.get("id") or 0) for c in (node.get("children") or [])}
                    except Exception:
                        present_ids = set()

                    slots = max(0, fanout - len(node.get("children") or []))
                    for pid in pending_ids:
                        if slots <= 0:
                            break
                        if pid in present_ids or pid in encountered_ids:
                            continue
                        u2 = (
                            CustomUser.objects.filter(id=pid)
                            .only("id", "username", "full_name", "parent_id", "matrix_position", "depth", "account_active", "pincode")
                            .first()
                        )
                        if not u2:
                            continue
                        encountered_ids.add(pid)
                        node["children"].append(build(u2, level + 1))
                        present_ids.add(pid)
                        slots -= 1

            return node

        tree = build(root, 1)

        # After building tree, distribute any remaining direct (sponsor-based) referrals as BFS spillover under first row
        # Skip this when drilling (spill_from_owner_id is provided) so subtree doesn't inject sponsor-only children.
        try:
            sraw = request.query_params.get("spill_from_owner_id") or ""
            spill_owner_id = int(sraw) if str(sraw).strip() else 0
        except Exception:
            spill_owner_id = 0
        try:
            if include_sponsor_fallback and not spill_owner_id and root and getattr(root, "id", None):
                direct_ids = list(
                    CustomUser.objects.filter(registered_by_id=root.id)
                    .values_list("id", flat=True)
                    .order_by("id")
                )
                remaining_ids = [int(i) for i in direct_ids if int(i) not in encountered_ids]
                if remaining_ids and isinstance(tree.get("children") or [], list):
                    # Fetch users in one query and preserve remaining_ids order
                    extras_qs = list(
                        CustomUser.objects.filter(id__in=remaining_ids)
                        .only("id", "username", "full_name", "parent_id", "matrix_position", "depth", "account_active", "pincode")
                    )
                    id2user = {int(getattr(u, "id", 0) or 0): u for u in extras_qs}
                    extras_users = [id2user.get(i) for i in remaining_ids if id2user.get(i)]

                    # Level 2 nodes (first row under root)
                    top_children = tree.get("children") or []
                    # BFS insert semantics: fill earliest node to capacity before moving right
                    for tc in top_children:
                        if not extras_users:
                            break
                        kids = tc.get("children") or []
                        remaining_slots = max(0, fanout - len(kids))
                        for _ in range(remaining_slots):
                            if not extras_users:
                                break
                            u = extras_users.pop(0)
                            # Append built subtree with correct relative level (root=1 => this is level 3)
                            new_node = build(u, 3)
                            kids.append(new_node)
                        tc["children"] = kids
        except Exception:
            # best-effort: ignore spillover fill errors
            pass

        # Annotate autopool (absolute entry level/status) for all encountered owners using earliest account per owner with preference ACTIVE
        if AutoPoolAccount and encountered_ids:
            info: Dict[int, Dict[str, Any]] = {}
            self_acct_info: Dict[int, Dict[str, Any]] = {}
            try:
                rows = list(
                    AutoPoolAccount.objects.filter(owner_id__in=encountered_ids, pool_type=pool)
                    .only("id", "owner_id", "status", "level", "user_entry_index")
                    .order_by("owner_id", "status", "id")
                )
                # Prefer ACTIVE; else pick first seen
                for r in rows:
                    oid = int(getattr(r, "owner_id", 0) or 0)
                    if oid <= 0:
                        continue
                    entry_idx = int(getattr(r, "user_entry_index", 0) or 0)
                    cur = info.get(oid)
                    st = str(getattr(r, "status", "") or "")
                    lvl = int(getattr(r, "level", 0) or 0)
                    
                    # Track general autopool info (any entry)
                    if cur is None:
                        info[oid] = {"autopool_level": lvl, "autopool_status": st}
                    else:
                        # If current is not ACTIVE and this one is ACTIVE, replace
                        if st == "ACTIVE" and (cur.get("autopool_status") or "") != "ACTIVE":
                            info[oid] = {"autopool_level": lvl, "autopool_status": st}
                    
                    # Track self account info (entry_idx >= 1)
                    if entry_idx >= 1:
                        if oid not in self_acct_info:
                            self_acct_info[oid] = {"has_self_account": True, "self_account_status": st}
                        else:
                            # Prefer ACTIVE for self account status
                            if st == "ACTIVE" and self_acct_info[oid].get("self_account_status") != "ACTIVE":
                                self_acct_info[oid]["self_account_status"] = st
            except Exception:
                info = {}
                self_acct_info = {}

            def annotate_autopool(n: Dict[str, Any]):
                try:
                    oid = int(n.get("id") or 0)
                except Exception:
                    oid = 0
                row = info.get(oid)
                if row:
                    n["autopool_level"] = row.get("autopool_level")
                    n["autopool_status"] = row.get("autopool_status")
                
                # Annotate self account info
                self_row = self_acct_info.get(oid)
                if self_row:
                    n["has_self_account"] = self_row.get("has_self_account", False)
                    n["self_account_status"] = self_row.get("self_account_status")
                
                for c in (n.get("children") or []):
                    annotate_autopool(c)

            try:
                annotate_autopool(tree)
            except Exception:
                pass

        # Annotate team_count as number of descendants
        def annotate_team(n: Dict[str, Any]) -> int:
            try:
                kids = n.get("children") or []
            except Exception:
                kids = []
            total = 0
            for c in kids:
                total += 1 + annotate_team(c)
            n["team_count"] = int(total)
            return total

        try:
            annotate_team(tree)
        except Exception:
            pass

        return Response(tree, status=status.HTTP_200_OK)


class MyMatrix5EntriesTree(APIView):
    """
    Authenticated user's entry-based 5/3-matrix tree (AutoPoolAccount graph), similar to AdminMatrix5Tree but restricted to the caller.
    Query params:
      - pool: FIVE_150 | THREE_150 | THREE_50 (default FIVE_150)
      - max_depth: optional (default from CommissionConfig; capped to default levels and 20)
      - start_entry_id: optional AutoPoolAccount.id (must belong to caller, ACTIVE, same pool)
      - display_user_id/root_user_id: optional (must equal caller's id, else 403); used only to mirror admin API signature
    Behavior:
      - Chooses root as caller's earliest ACTIVE entry for the pool unless start_entry_id is provided (and owned by caller).
      - BFS over ACTIVE entries, ordered (parent_account_id, position, id), per-parent fanout width (5 for FIVE_150, 3 for THREE_x).
      - Response shape:
        {
          account_id, owner_id, username, username_key,
          level, abs_level, position, status, team_count, fanout,
          children: [...]
        }
      - No sentinel fallback; shows only placed ACTIVE nodes under the caller's entry.
    """
    permission_classes = [IsAuthenticated]

    def get(self, request):
        # Pool + fanout
        pool = (request.query_params.get("pool") or "FIVE_150").strip().upper()
        if pool not in ("FIVE_150", "THREE_150", "THREE_50"):
            pool = "FIVE_150"
        fanout = 5 if pool == "FIVE_150" else 3

        # Depth defaults (from config; safety cap 20)
        default_levels = 6
        try:
            if CommissionConfig:
                cfg = CommissionConfig.get_solo()
                default_levels = int(cfg.get_matrix_five_levels() if pool == "FIVE_150" else cfg.get_matrix_three_levels())
        except Exception:
            default_levels = 6 if pool == "FIVE_150" else 15
        try:
            max_depth = int(request.query_params.get("max_depth") or default_levels)
        except Exception:
            max_depth = default_levels
        max_depth = max(1, min(int(max_depth), int(default_levels), 20))

        # Caller and optional start params
        me = request.user
        try:
            start_entry_id = int(request.query_params.get("start_entry_id") or "0")
        except Exception:
            start_entry_id = 0
        # Accept display_user_id/root_user_id for signature parity, but restrict to self
        try:
            display_user_id = int(request.query_params.get("display_user_id") or request.query_params.get("root_user_id") or 0)
        except Exception:
            display_user_id = 0
        if display_user_id and display_user_id != int(getattr(me, "id", 0) or 0):
            return Response({"detail": "Forbidden"}, status=status.HTTP_403_FORBIDDEN)

        # Resolve root AutoPoolAccount for this user/pool
        root_acc = None
        if start_entry_id > 0 and AutoPoolAccount:
            # Allow drilling into a child's ACTIVE entry if it lies within the caller's subtree.
            # Security: Walk up the parent_account chain and ensure some ancestor entry is owned by the caller.
            cand = (
                AutoPoolAccount.objects.select_related("owner", "parent_account")
                .only("id", "owner_id", "parent_account_id", "pool_type", "status")
                .filter(id=start_entry_id, pool_type=pool, status="ACTIVE")
                .first()
            )
            if cand:
                allowed = False
                cur = cand
                # Limit ancestry walk to avoid infinite loops; generous cap for deep drill-down
                for _ in range(50):
                    if not cur:
                        break
                    try:
                        if int(getattr(cur, "owner_id", 0) or 0) == int(getattr(me, "id", 0) or 0):
                            allowed = True
                            break
                    except Exception:
                        pass
                    pid = getattr(cur, "parent_account_id", None)
                    if not pid:
                        break
                    cur = (
                        AutoPoolAccount.objects
                        .only("id", "owner_id", "parent_account_id", "pool_type", "status")
                        .filter(id=pid, pool_type=pool, status="ACTIVE")
                        .first()
                    )
                if allowed:
                    root_acc = cand
        if not root_acc and AutoPoolAccount:
            root_acc = (
                AutoPoolAccount.objects.select_related("owner")
                .filter(owner=me, pool_type=pool, status="ACTIVE")
                .order_by("id")
                .first()
            )
        if not root_acc:
            return Response({"detail": "No ACTIVE matrix account found for this user and pool."}, status=status.HTTP_404_NOT_FOUND)

        # Serializer for nodes
        def serialize_node(acc, rel_level: int):
            try:
                owner = getattr(acc, "owner", None)
            except Exception:
                owner = None
            full_name = ""
            if owner:
                fn = getattr(owner, "first_name", "") or ""
                ln = getattr(owner, "last_name", "") or ""
                full_name = f"{fn} {ln}".strip()
            return {
                "account_id": int(getattr(acc, "id", 0) or 0),
                "owner_id": int(getattr(owner, "id", None) or getattr(acc, "owner_id", 0) or 0),
                "username": getattr(owner, "username", None),
                "full_name": full_name,
                "username_key": getattr(acc, "username_key", None),
                "level": int(rel_level),                        # relative to requested root (root=1)
                "abs_level": int(getattr(acc, "level", 0) or 0),# absolute persisted level
                "position": getattr(acc, "position", None),
                "status": getattr(acc, "status", "ACTIVE"),
                "team_count": 0,                                # annotated after BFS
                "direct_count": 0,                              # annotated after BFS
                "children": [],
            }

        root = serialize_node(root_acc, 1)
        try:
            root["fanout"] = int(fanout)
        except Exception:
            pass

        # BFS
        nodes_by_account = {int(root_acc.id): root}
        current_parent_ids = [int(root_acc.id)]
        rel_levels = {int(root_acc.id): 1}
        levels_used = 1

        while current_parent_ids and levels_used < max_depth:
            try:
                rows = list(
                    AutoPoolAccount.objects.select_related("owner")
                    .filter(pool_type=pool, status="ACTIVE", parent_account_id__in=current_parent_ids)
                    .order_by("parent_account_id", "position", "id")
                )
            except Exception:
                rows = []
            if not rows:
                break

            counts = {}
            next_parent_ids = []
            for acc in rows:
                try:
                    pid = int(getattr(acc, "parent_account_id", 0) or 0)
                except Exception:
                    continue
                if pid not in nodes_by_account:
                    continue
                used = counts.get(pid, 0)
                if used >= fanout:
                    continue
                parent_node = nodes_by_account[pid]
                parent_rel = int(rel_levels.get(pid, levels_used))
                child_rel = parent_rel + 1
                child_node = serialize_node(acc, child_rel)
                parent_node["children"].append(child_node)
                nodes_by_account[int(getattr(acc, "id", 0) or 0)] = child_node
                rel_levels[int(getattr(acc, "id", 0) or 0)] = child_rel
                counts[pid] = used + 1
                next_parent_ids.append(int(getattr(acc, "id", 0) or 0))

            if not next_parent_ids:
                break
            current_parent_ids = next_parent_ids
            levels_used += 1

        # Annotate team_count and direct_count using a full-depth BFS from all
        # loaded nodes — this gives accurate counts even when max_depth < actual depth.
        try:
            parent_to_children: Dict[int, List[int]] = {}
            frontier: List[int] = list(nodes_by_account.keys())
            visited_ids: set = set(frontier)

            while frontier:
                children_rows = list(
                    AutoPoolAccount.objects.filter(
                        pool_type=pool,
                        status="ACTIVE",
                        parent_account_id__in=frontier,
                    ).values("id", "parent_account_id")
                )
                next_frontier: List[int] = []
                for row in children_rows:
                    pid = int(row["parent_account_id"] or 0)
                    cid = int(row["id"] or 0)
                    parent_to_children.setdefault(pid, []).append(cid)
                    if cid not in visited_ids:
                        visited_ids.add(cid)
                        next_frontier.append(cid)
                frontier = next_frontier

            count_memo: Dict[int, int] = {}

            def _count_all(nid: int) -> int:
                if nid in count_memo:
                    return count_memo[nid]
                kids = parent_to_children.get(nid, [])
                total = len(kids)
                for kid in kids:
                    total += _count_all(kid)
                count_memo[nid] = total
                return total

            for acc_id, node in nodes_by_account.items():
                node["direct_count"] = len(parent_to_children.get(acc_id, []))
                node["team_count"] = _count_all(acc_id)
        except Exception:
            # Fallback: count only loaded descendants
            def _annotate_team(n: Dict[str, Any]) -> int:
                kids = n.get("children") or []
                n["direct_count"] = len(kids)
                total = 0
                for ch in kids:
                    total += 1 + _annotate_team(ch)
                n["team_count"] = int(total)
                return total
            _annotate_team(root)

        return Response(root, status=status.HTTP_200_OK)


class FiveMatrixCountsView(APIView):
    """
    GET /api/genealogy/5m/counts?root_id={id}&depth=10
    Returns level-wise counts (1..depth), total, and active_levels_reached for the selected FIVE_150 root.
    Rules:
      - Only ACTIVE AutoPoolAccount rows are traversed (placed users only)
      - Counts all placed ACTIVE nodes (ignore owner/user status)
      - Exclude root from counts
      - Depth hard-capped at 10
      - If root_id is not provided, pick earliest created_at ACTIVE FIVE_150 account for the logged-in user
      - No users outside the selected root subtree are counted
      - Cycles are guarded (visited set) to avoid double counting
    """
    permission_classes = [IsAuthenticated]

    def get(self, request):
        # Pool: FIVE_150 (default) or THREE_150
        pool = str(request.query_params.get("pool") or "FIVE_150").strip().upper()
        if pool not in ("FIVE_150", "THREE_150"):
            pool = "FIVE_150"
        branch_factor = 3 if pool == "THREE_150" else 5

        # Depth: cap at 15 for THREE, 10 for FIVE
        max_cap = 15 if pool == "THREE_150" else 10
        try:
            depth = int(request.query_params.get("depth") or max_cap)
        except Exception:
            depth = max_cap
        depth = max(1, min(max_cap, int(depth)))

        # Resolve root
        rid = request.query_params.get("root_id")
        root = None
        try:
            if rid is not None and str(rid).strip():
                root = (
                    AutoPoolAccount.objects
                    .filter(id=int(rid), pool_type=pool, status="ACTIVE", owner=request.user)
                    .only("id", "owner_id")
                    .first()
                )
                if not root:
                    return Response({"detail": "Root not found for this user"}, status=status.HTTP_403_FORBIDDEN)
        except Exception:
            root = None

        if not root:
            # Earliest created_at active account for the logged-in user
            try:
                root = (
                    AutoPoolAccount.objects
                    .filter(owner=request.user, pool_type=pool, status="ACTIVE")
                    .only("id", "owner_id", "created_at")
                    .order_by("created_at", "id")
                    .first()
                )
            except Exception:
                root = None

        if not root:
            levels = [{"level": i, "team_count": 0, "max_count": branch_factor ** i} for i in range(1, depth + 1)]
            return Response(
                {
                    "root_id": None,
                    "pool": pool,
                    "branch_factor": branch_factor,
                    "matrix_type": branch_factor,
                    "depth": depth,
                    "levels": levels,
                    "total_team": 0,
                    "active_levels_reached": 0,
                },
                status=status.HTTP_200_OK,
            )

        # BFS traversal restricted to this root subtree
        levels_counts = {i: 0 for i in range(1, depth + 1)}
        visited: Set[int] = set([int(getattr(root, "id", 0) or 0)])
        frontier: List[int] = [int(getattr(root, "id", 0) or 0)]

        for lvl in range(1, depth + 1):
            if not frontier:
                break

            # Fetch children of current frontier strictly within pool and ACTIVE
            try:
                rows = list(
                    AutoPoolAccount.objects
                    .filter(parent_account_id__in=frontier, pool_type=pool, status="ACTIVE")
                    .only("id", "owner_id")
                    .order_by("position", "id")
                    .values("id", "owner_id")
                )
            except Exception:
                rows = []

            child_ids: List[int] = []
            for r in rows:
                try:
                    cid = int(r.get("id") or 0)
                except Exception:
                    continue
                if cid in visited:
                    continue
                child_ids.append(cid)


            # Count only eligible nodes at this level; still traverse all ACTIVE nodes structurally
            count = 0
            for r in rows:
                try:
                    cid = int(r.get("id") or 0)
                except Exception:
                    continue
                if cid in visited:
                    continue
                count += 1
                visited.add(cid)

            levels_counts[lvl] = int(count)
            frontier = child_ids  # proceed to next level

        # Build response arrays 1..depth (zeros for missing)
        levels = [
            {
                "level": i,
                "team_count": int(levels_counts.get(i, 0)),
                "max_count": branch_factor ** i,
            }
            for i in range(1, depth + 1)
        ]
        total_team = int(sum(x["team_count"] for x in levels))

        # Highest contiguous active level starting from 1
        active_reached = 0
        for i in range(1, depth + 1):
            if int(levels_counts.get(i, 0)) > 0:
                active_reached = i
            else:
                break

        # Count fully completed levels (team_count >= max_count)
        levels_completed = sum(1 for x in levels if x["team_count"] >= x["max_count"] and x["max_count"] > 0)

        # Per-pool earning for the current user
        total_earned = "0"
        try:
            from accounts.models import WalletTransaction
            from django.db.models import Sum
            tx_type = "AUTOPOOL_BONUS_FIVE" if pool == "FIVE_150" else "AUTOPOOL_BONUS_THREE"
            earned = (
                WalletTransaction.objects
                .filter(user=request.user, type=tx_type, amount__gt=0)
                .aggregate(total=Sum("amount"))["total"]
            )
            total_earned = str(earned or 0)
        except Exception:
            pass

        return Response(
            {
                "root_id": int(getattr(root, "id", 0) or 0),
                "pool": pool,
                "branch_factor": branch_factor,
                "matrix_type": branch_factor,
                "depth": depth,
                "levels": levels,
                "total_team": total_team,
                "active_levels_reached": int(active_reached),
                "levels_completed": int(levels_completed),
                "total_earned": total_earned,
            },
            status=status.HTTP_200_OK,
        )

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
                                    direct_fallback_qs = list(
                                        CustomUser.objects.filter(registered_by_id=spill_owner_id_sec)
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
                    direct_qs = list(
                        CustomUser.objects.filter(registered_by_id=u.id)
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
                        owner_direct_ids = list(
                            CustomUser.objects.filter(registered_by_id=spill_owner_id)
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
            try:
                rows = list(
                    AutoPoolAccount.objects.filter(owner_id__in=encountered_ids, pool_type=pool)
                    .only("id", "owner_id", "status", "level")
                    .order_by("owner_id", "status", "id")
                )
                # Prefer ACTIVE; else pick first seen
                for r in rows:
                    oid = int(getattr(r, "owner_id", 0) or 0)
                    if oid <= 0:
                        continue
                    cur = info.get(oid)
                    st = str(getattr(r, "status", "") or "")
                    lvl = int(getattr(r, "level", 0) or 0)
                    if cur is None:
                        info[oid] = {"autopool_level": lvl, "autopool_status": st}
                    else:
                        # If current is not ACTIVE and this one is ACTIVE, replace
                        if st == "ACTIVE" and (cur.get("autopool_status") or "") != "ACTIVE":
                            info[oid] = {"autopool_level": lvl, "autopool_status": st}
            except Exception:
                info = {}

            def annotate_autopool(n: Dict[str, Any]):
                try:
                    oid = int(n.get("id") or 0)
                except Exception:
                    oid = 0
                row = info.get(oid)
                if row:
                    n["autopool_level"] = row.get("autopool_level")
                    n["autopool_status"] = row.get("autopool_status")
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

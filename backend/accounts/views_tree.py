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
                    # Walk up matrix parents to verify ancestry
                    cur = cand
                    allowed = False
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
            for ch in children_qs:
                encountered_ids.add(int(getattr(ch, "id", 0) or 0))
                node["children"].append(build(ch, level + 1))
            return node

        tree = build(root, 1)

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

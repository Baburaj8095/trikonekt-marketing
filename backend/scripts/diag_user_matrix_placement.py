#!/usr/bin/env python
import os
import sys
import json
from datetime import datetime

# Setup Django (run from backend/)
BASE_DIR = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
os.chdir(BASE_DIR)
sys.path.append(BASE_DIR)
os.environ.setdefault("DJANGO_SETTINGS_MODULE", "core.settings")

import django  # noqa: E402
django.setup()

from django.db.models import Q  # noqa: E402
from accounts.models import CustomUser  # noqa: E402
from business.models import AutoPoolAccount, CommissionConfig  # noqa: E402


def resolve_user(identifier: str):
    """
    Resolve a user like admin endpoints do:
    - exact prefixed_id
    - numeric id
    - username/email/unique_id
    - phone digits
    """
    ident = (identifier or "").strip()
    if not ident:
        return None

    # exact prefixed_id
    u = CustomUser.objects.filter(prefixed_id__iexact=ident).first()
    if u:
        return u

    digits = "".join(ch for ch in ident if ch.isdigit())
    if digits and digits == ident and digits.isdigit():
        # treat as numeric id
        u = CustomUser.objects.filter(id=int(digits)).first()
        if u:
            return u

    # username/email/unique_id (case-insensitive) + phone digits
    q = (Q(username__iexact=ident) | Q(email__iexact=ident) | Q(unique_id__iexact=ident))
    if digits:
        q = q | Q(phone__iexact=digits) | Q(username__iexact=digits)
    return CustomUser.objects.filter(q).first()


def get_default_levels_for_pool(pool: str) -> int:
    try:
        cfg = CommissionConfig.get_solo()
        if pool == "FIVE_150":
            return int(getattr(cfg, "five_matrix_levels", 6) or 6)
        else:
            return int(getattr(cfg, "three_matrix_levels", 15) or 15)
    except Exception:
        return 6 if pool == "FIVE_150" else 15


def serialize_entry(acc, rel_level: int):
    return {
        "account_id": acc.id,
        "owner_id": getattr(acc.owner, "id", None),
        "username": getattr(acc.owner, "username", None),
        "abs_level": int(getattr(acc, "level", 0) or 0),
        "position": getattr(acc, "position", None),
        "status": getattr(acc, "status", None),
        "rel_level": int(rel_level),
        "children": [],
    }


def build_bfs_tree(root_acc, pool: str, max_depth: int):
    """
    Build a compact BFS tree from root_acc up to max_depth (relative levels).
    Matches AdminMatrix5Tree traversal semantics: per-parent fanout and ordering by (position, id).
    """
    fanout = 5 if pool == "FIVE_150" else 3
    root = serialize_entry(root_acc, 1)
    nodes_by_id = {int(root_acc.id): root}
    current_parents = [int(root_acc.id)]
    rel_levels = {int(root_acc.id): 1}
    used_levels = 1

    while current_parents and used_levels < max_depth:
        rows = list(
            AutoPoolAccount.objects.select_related("owner")
            .filter(
                pool_type=pool,
                status="ACTIVE",
                parent_account_id__in=current_parents,
            )
            .order_by("parent_account_id", "position", "id")
        )
        if not rows:
            break

        per_parent_count = {}
        next_parents = []
        for acc in rows:
            pid = getattr(acc, "parent_account_id", None)
            if pid is None or int(pid) not in nodes_by_id:
                continue
            used = per_parent_count.get(int(pid), 0)
            if used >= fanout:
                continue
            parent_node = nodes_by_id[int(pid)]
            parent_rel = int(rel_levels.get(int(pid), used_levels))
            child_rel = parent_rel + 1
            child_node = serialize_entry(acc, child_rel)
            parent_node["children"].append(child_node)
            nodes_by_id[int(acc.id)] = child_node
            rel_levels[int(acc.id)] = child_rel
            per_parent_count[int(pid)] = used + 1
            next_parents.append(int(acc.id))

        if not next_parents:
            break
        current_parents = next_parents
        used_levels += 1

    return root


def earliest_active_entry_for_user(user_id: int, pool: str):
    return (
        AutoPoolAccount.objects.select_related("owner")
        .filter(owner_id=user_id, pool_type=pool, status="ACTIVE")
        .order_by("id")
        .first()
    )


def parent_chain_until(acc_id: int, limit_steps: int = 20):
    """
    Return [(acc_id, parent_id, position), ...] up to the root or limit.
    """
    out = []
    cur_id = int(acc_id) if acc_id else 0
    steps = 0
    while cur_id and steps < limit_steps:
        row = (
            AutoPoolAccount.objects
            .only("id", "parent_account_id", "position")
            .filter(id=cur_id)
            .first()
        )
        if not row:
            break
        pid = getattr(row, "parent_account_id", None)
        pos = getattr(row, "position", None)
        out.append((int(row.id), int(pid) if pid else None, pos))
        if not pid:
            break
        cur_id = int(pid)
        steps += 1
    return out


def analyze_directs_placement(root_acc, directs, pool: str):
    """
    For each direct (registered_by), find their earliest active entry and determine:
      - whether it is under root_acc
      - at which relative depth from root_acc
      - its immediate parent (under root scope) and position
    """
    results = []
    root_id = int(getattr(root_acc, "id", 0) or 0)
    for du in directs:
        entry = earliest_active_entry_for_user(du.id, pool)
        row = {
            "direct_user_id": du.id,
            "direct_username": du.username,
            "has_entry": bool(entry),
            "entry_id": getattr(entry, "id", None),
            "under_root": False,
            "depth_from_root": None,
            "parent_under_root_id": None,
            "position": None,
        }
        if entry:
            chain = parent_chain_until(entry.id, limit_steps=50)
            # chain is [(acc_id, parent_id, position), ...] starting from entry upwards
            # compute distance to root_acc
            depth = 0
            for acc_id, parent_id, pos in chain:
                if acc_id == root_id:
                    # Found root itself (entry is the root)
                    row["under_root"] = True
                    row["depth_from_root"] = depth  # 0 means root node itself (shouldn't happen for directs)
                    row["parent_under_root_id"] = None
                    row["position"] = None
                    break
                if parent_id == root_id:
                    # Direct child of root
                    row["under_root"] = True
                    row["depth_from_root"] = 1
                    row["parent_under_root_id"] = root_id
                    row["position"] = pos
                    break
                depth += 1
            else:
                # If not found immediate parent match, see if any ancestor equals root
                for idx, (acc_id, parent_id, pos) in enumerate(chain):
                    if acc_id == root_id:
                        row["under_root"] = True
                        row["depth_from_root"] = idx  # idx steps from entry up to root node
                        # Parent under root is the item just before root in chain (moving downward)
                        # Reverse chain to compute downward traversal
                        rev = list(reversed(chain))
                        # find root in rev
                        parent_under_root = None
                        for j, (aid, pid, ppos) in enumerate(rev):
                            if aid == root_id:
                                # Next item in rev is child directly under root
                                if j + 1 < len(rev):
                                    parent_under_root = rev[j + 1][0]
                                    row["position"] = rev[j + 1][2]
                                break
                        row["parent_under_root_id"] = parent_under_root
                        break
        results.append(row)
    return results


def main():
    ident = sys.argv[1] if len(sys.argv) > 1 else "9964716666"
    user = resolve_user(ident)
    out = {
        "generated_at": datetime.utcnow().isoformat() + "Z",
        "query_identifier": ident,
        "resolved": {
            "found": bool(user),
            "id": getattr(user, "id", None),
            "username": getattr(user, "username", None),
            "phone": getattr(user, "phone", None),
            "prefixed_id": getattr(user, "prefixed_id", None),
        },
        "pools": {},
    }
    if not user:
        print(json.dumps(out, indent=2))
        return

    # Direct referrals (sponsor-based)
    directs = list(
        CustomUser.objects
        .filter(registered_by_id=user.id, category="consumer")
        .only("id", "username")
        .order_by("id")
    )
    out["directs_count"] = len(directs)
    out["directs_sample"] = [{"id": d.id, "username": d.username} for d in directs[:20]]

    for pool in ("FIVE_150", "THREE_150"):
        fanout = 5 if pool == "FIVE_150" else 3
        default_levels = get_default_levels_for_pool(pool)
        node = {"pool": pool, "fanout": fanout, "default_levels": default_levels}

        root_acc = earliest_active_entry_for_user(user.id, pool)
        if not root_acc:
            node["has_entry"] = False
            out["pools"][pool] = node
            continue

        node["has_entry"] = True
        node["root_entry"] = {
            "account_id": root_acc.id,
            "level": int(getattr(root_acc, "level", 0) or 0),
            "position": getattr(root_acc, "position", None),
            "status": getattr(root_acc, "status", None),
        }

        # Build a compact BFS tree (up to 3 levels for quick inspection)
        tree = build_bfs_tree(root_acc, pool, max_depth=min(3, default_levels))
        # Flatten level-1 summary
        lvl1 = []
        for ch in (tree.get("children") or []):
            lvl1.append({
                "account_id": ch.get("account_id"),
                "owner_id": ch.get("owner_id"),
                "username": ch.get("username"),
                "position": ch.get("position"),
            })
        node["level1_children"] = lvl1
        node["level1_count"] = len(lvl1)

        # Analyze where directs landed in this pool
        placements = analyze_directs_placement(root_acc, directs, pool)
        node["directs_placement"] = placements
        node["activated_directs_in_pool"] = sum(1 for p in placements if p.get("has_entry"))
        node["placed_under_root_count"] = sum(1 for p in placements if p.get("under_root"))

        out["pools"][pool] = node

    # Save JSON to logs
    logs_dir = os.path.join(BASE_DIR, "logs")
    try:
        os.makedirs(logs_dir, exist_ok=True)
    except Exception:
        pass
    out_path = os.path.join(logs_dir, f"placement_{getattr(user, 'id', 'na')}_{ident}.json")
    with open(out_path, "w", encoding="utf-8") as f:
        json.dump(out, f, indent=2, ensure_ascii=False)

    # Print a concise human-readable summary
    print("User:", out["resolved"])
    for pool, node in out["pools"].items():
        print("\nPool:", pool)
        if not node.get("has_entry"):
            print("  No active entry for this user in this pool.")
            continue
        print("  Root entry:", node["root_entry"])
        print("  Level-1 children (count={}):".format(node.get("level1_count", 0)))
        for c in node.get("level1_children", []):
            print("    - pos={pos} owner={u} (id={oid}) acc={aid}".format(
                pos=c.get("position"), u=c.get("username"), oid=c.get("owner_id"), aid=c.get("account_id")
            ))
        print("  Directs: total={} | with entry in pool={} | placed under root={}".format(
            len(out.get("directs_sample", [])) if out.get("directs_count", 0) <= 20 else out.get("directs_count", 0),
            node.get("activated_directs_in_pool", 0),
            node.get("placed_under_root_count", 0),
        ))
        # Show up to first 10 directs placement
        shown = 0
        for p in node.get("directs_placement", []):
            if shown >= 10:
                break
            print("    direct {u} (id={uid}) -> entry={eid} has={h} under_root={ur} depth={d} parent_under_root={pur} pos={pos}".format(
                u=p.get("direct_username"),
                uid=p.get("direct_user_id"),
                eid=p.get("entry_id"),
                h=p.get("has_entry"),
                ur=p.get("under_root"),
                d=p.get("depth_from_root"),
                pur=p.get("parent_under_root_id"),
                pos=p.get("position"),
            ))
            shown += 1

    print("\nWritten JSON:", out_path)


if __name__ == "__main__":
    main()

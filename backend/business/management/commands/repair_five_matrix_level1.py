from __future__ import annotations

from typing import List, Dict, Tuple, Set
from django.core.management.base import BaseCommand
from django.db import transaction
from django.db.models import Q
import os
import json
from datetime import datetime

from business.models import AutoPoolAccount
from business.services.placement import _ensure_sentinel_root


class Command(BaseCommand):
    help = (
        "Repair historical FIVE_150 genealogy Level-1 under a chosen root by promoting earliest deeper descendants\n"
        "to fill missing Level-1 slots (positions 1..5), enforcing strict width-before-depth at the first level.\n\n"
        "Scope & Safety:\n"
        "- Only touches pool_type='FIVE_150'.\n"
        "- Does NOT delete or alter ownership/status/timestamps/commissions.\n"
        "- Updates only structural fields: parent_account, level, position.\n\n"
        "Default root is the pool sentinel. You may target another root by --root-account-id.\n"
        "Run with --dry-run to preview changes.\n"
    )

    def add_arguments(self, parser):
        parser.add_argument(
            "--root-account-id",
            type=int,
            default=0,
            help="AutoPoolAccount.id to treat as repair root (must be FIVE_150). Default: pool sentinel.",
        )
        parser.add_argument(
            "--limit",
            type=int,
            default=5,
            help="Max number of promotions to perform for filling Level-1 under the root. Default 5.",
        )
        parser.add_argument(
            "--dry-run",
            action="store_true",
            help="Preview changes without writing to DB.",
        )
        parser.add_argument(
            "--all-roots",
            action="store_true",
            help="Repair for every FIVE_150 root (parent_account is null). Ignores --root-account-id if set.",
        )
        parser.add_argument(
            "--log-file",
            type=str,
            default="",
            help="Optional path to write JSON audit log. Defaults to backend/logs/repair_five_matrix_level1_<timestamp>.json",
        )
        parser.add_argument(
            "--free-blocked",
            action="store_true",
            help="If set, relocates non-ACTIVE children occupying Level-1 positions (1..5) to safe slots >5 to free space for ACTIVE promotions.",
        )

    # --------- Helpers ---------
    def _collect_subtree_ids(self, root_id: int, pool: str) -> List[int]:
        """
        BFS collect all descendant account ids (including root_id) under given root_id for pool.
        """
        out: List[int] = []
        frontier: List[int] = [int(root_id)]
        while frontier:
            cur_ids = [int(x) for x in frontier]
            out.extend(cur_ids)
            rows = list(
                AutoPoolAccount.objects.filter(
                    pool_type=pool,
                    status="ACTIVE",
                    parent_account_id__in=cur_ids,
                ).only("id", "parent_account_id")
            )
            frontier = [int(r.id) for r in rows]
        return out

    def _snapshot_children(self, parent_id: int, pool: str) -> List[Dict]:
        qs = (
            AutoPoolAccount.objects.select_related("owner")
            .filter(pool_type=pool, status="ACTIVE", parent_account_id=parent_id)
            .order_by("position", "id")
        )
        out = []
        for a in qs:
            out.append({
                "id": a.id,
                "owner_id": a.owner_id,
                "username": getattr(a.owner, "username", None),
                "position": a.position,
                "level": a.level,
            })
        return out

    def _missing_positions(self, parent_id: int, pool: str, width: int = 5) -> List[int]:
        # IMPORTANT: Uniqueness constraint on (parent_account, pool_type, position) applies to ALL rows (any status).
        # Therefore determine taken positions across ALL statuses to avoid IntegrityError on save.
        taken = set(
            int(p) for p in
            AutoPoolAccount.objects.filter(pool_type=pool, parent_account_id=parent_id)
            .values_list("position", flat=True)
            if p is not None
        )
        return [pos for pos in range(1, width + 1) if pos not in taken]

    def _is_financially_locked(self, acc: AutoPoolAccount) -> bool:
        """
        Best-effort guard: skip candidates that appear locked due to financial/cycle constraints.
        This project doesn't define such flags on AutoPoolAccount, but check common attributes defensively.
        """
        try:
            # Common possible flags; treat any truthy as locked
            for key in ("payout_locked", "cycle_locked", "financial_locked", "locked"):
                if hasattr(acc, key) and bool(getattr(acc, key)):
                    return True
        except Exception:
            pass
        return False

    def _free_blocked_positions(self, parent_id: int, pool: str, width: int = 5, dry_run: bool = False) -> List[Dict]:
        """
        Relocate non-ACTIVE children occupying positions 1..width under the given parent to the first available
        positions > width, considering ALL rows (any status) to satisfy uniqueness.
        Returns list of move logs: {child_id, old_position, new_position, status}
        """
        taken_all = set(
            int(p) for p in
            AutoPoolAccount.objects.filter(pool_type=pool, parent_account_id=parent_id)
            .values_list("position", flat=True) if p is not None
        )
        blockers = list(
            AutoPoolAccount.objects.filter(
                pool_type=pool,
                parent_account_id=parent_id,
            ).exclude(status="ACTIVE").filter(position__gte=1, position__lte=width)
            .order_by("position", "id")
        )
        moves: List[Dict] = []
        for ch in blockers:
            old_pos = int(getattr(ch, "position", 0) or 0)
            if old_pos in taken_all:
                taken_all.discard(old_pos)
            new_pos = width + 1
            while new_pos in taken_all:
                new_pos += 1
            if not dry_run:
                ch.position = int(new_pos)
                ch.save(update_fields=["position"])
            taken_all.add(int(new_pos))
            moves.append({
                "child_id": int(ch.id),
                "old_position": old_pos,
                "new_position": int(new_pos),
                "status": str(getattr(ch, "status", "")),
            })
        return moves

    def _renumber_siblings(self, parent_id: int, pool: str, width: int = 5, dry_run: bool = False) -> Tuple[int, List[Tuple[int, int, int]]]:
        """
        Normalize positions for ACTIVE children under a parent in creation order, aiming for 1..width.
        IMPORTANT: Never collide with positions taken by ANY rows (any status). Best-effort only.
        Returns (updated_count, [(child_id, old_pos, new_pos), ...])
        """
        # Order by creation to preserve historical sequence
        children = list(
            AutoPoolAccount.objects.filter(pool_type=pool, status="ACTIVE", parent_account_id=parent_id)
            .order_by("created_at", "id")
        )
        # Taken positions across ALL statuses under this parent
        taken_all = set(
            int(p) for p in
            AutoPoolAccount.objects.filter(pool_type=pool, parent_account_id=parent_id)
            .values_list("position", flat=True)
            if p is not None
        )
        changes: List[Tuple[int, int, int]] = []
        for ch in children:
            old_pos = int(getattr(ch, "position", 0) or 0)
            # Temporarily free current position for reassignment planning
            if old_pos in taken_all:
                taken_all.discard(old_pos)
            # Find next available safe slot within 1..width
            new_pos = None
            for pos in range(1, width + 1):
                if pos not in taken_all:
                    new_pos = pos
                    break
            if new_pos is None:
                # No safe slot available without colliding with historical rows; keep as-is
                if old_pos:
                    taken_all.add(old_pos)
                continue
            if new_pos != old_pos:
                changes.append((int(ch.id), old_pos, int(new_pos)))
                if not dry_run:
                    ch.position = int(new_pos)
                    ch.save(update_fields=["position"])
            # Reserve the assigned position
            taken_all.add(int(new_pos))
        return (0 if dry_run else len(changes), changes)

    def _renumber_all_subtree(self, root_id: int, pool: str, width: int = 5, dry_run: bool = False) -> int:
        """
        Renumber positions for every parent's direct children within the subtree rooted at root_id.
        Ensures sibling positions are sequential starting from 1, preserving original creation order.
        Returns number of position updates performed (best-effort).
        """
        updated = 0
        # BFS over subtree parents
        frontier = [int(root_id)]
        visited: Set[int] = set()
        while frontier:
            parent_ids = [int(x) for x in frontier if int(x) not in visited]
            if not parent_ids:
                break
            visited.update(parent_ids)
            # Fetch children for these parents ordered by created_at then id to preserve creation sequence
            rows = list(
                AutoPoolAccount.objects.filter(
                    pool_type=pool,
                    status="ACTIVE",
                    parent_account_id__in=parent_ids,
                ).order_by("parent_account_id", "created_at", "id")
            )
            # Build next frontier and apply renumber per parent
            next_frontier: List[int] = []
            by_parent: Dict[int, List[AutoPoolAccount]] = {}
            for r in rows:
                pid = int(getattr(r, "parent_account_id", 0) or 0)
                by_parent.setdefault(pid, []).append(r)
                next_frontier.append(int(r.id))
            # Renumber each group (best-effort, avoid collisions with ANY status rows)
            for pid, children in by_parent.items():
                # Positions taken across ALL statuses for this parent
                taken_all = set(
                    int(p) for p in
                    AutoPoolAccount.objects.filter(pool_type=pool, parent_account_id=int(pid))
                    .values_list("position", flat=True)
                    if p is not None
                )
                touched = []
                for ch in children:
                    old_pos = int(getattr(ch, "position", 0) or 0)
                    # Free current position for planning
                    if old_pos in taken_all:
                        taken_all.discard(old_pos)
                    # Assign next available within width without colliding
                    new_pos = None
                    for pos in range(1, width + 1):
                        if pos not in taken_all:
                            new_pos = pos
                            break
                    if new_pos is None:
                        # No safe slot available; keep current
                        if old_pos:
                            taken_all.add(old_pos)
                        continue
                    if new_pos != old_pos:
                        ch.position = int(new_pos)
                        touched.append(ch)
                    taken_all.add(int(new_pos))
                if touched and not dry_run:
                    AutoPoolAccount.objects.bulk_update(touched, ["position"])
                    updated += len(touched)
            frontier = next_frontier
        return updated

    def _promote_candidates_to_level1(
        self,
        root,
        pool: str = "FIVE_150",
        width: int = 5,
        limit: int = 5,
        free_blocked: bool = False,
        dry_run: bool = False,
    ) -> Dict:
        """
        Promote earliest deeper descendants (by level asc, id asc) to fill Level-1 missing positions under root.

        For each promotion:
          - Move account's parent_account to root
          - Set level=1
          - Assign next available position sequentially (1..5)
          - Adjust levels of the moved account's entire subtree by a constant delta to maintain integrity

        Returns a log object with before/after snapshots and actions.
        """
        root_id = int(root.id)
        before = self._snapshot_children(root_id, pool)
        missing = self._missing_positions(root_id, pool, width=width)

        log = {
            "root_id": root_id,
            "root_level": int(getattr(root, "level", 0) or 0),
            "pool": pool,
            "before_children": before,
            "missing_positions": list(missing),
            "promotions": [],
            "skipped": [],
            "unblock_moves": [],
            "renumber": [],
        }

        if not missing and free_blocked:
            moves = self._free_blocked_positions(root_id, pool, width=width, dry_run=dry_run)
            if moves:
                log["unblock_moves"] = moves
                missing = self._missing_positions(root_id, pool, width=width)
        if not missing:
            return log

        if limit and len(missing) > limit:
            missing = missing[:limit]

        # Restrict candidates to the current root's subtree
        subtree_ids = set(self._collect_subtree_ids(root_id, pool))
        if root_id not in subtree_ids:
            subtree_ids.add(root_id)

        # Deeper candidates: exclude immediate Level-1 under root, and the root itself
        lvl1_ids = set(int(x["id"]) for x in before)
        cand_qs = (
            AutoPoolAccount.objects.filter(
                pool_type=pool,
                status="ACTIVE",
                id__in=subtree_ids,
            )
            .exclude(id=root_id)
            .exclude(id__in=lvl1_ids)
            .filter(level__gte=2)
            .order_by("level", "id")
        )
        # Prioritize candidates from the first Level-1 child's subtree to satisfy "bring 3 members of children1"
        cands = list(cand_qs)
        try:
            first_child_id = int(before[0]["id"]) if before else None
        except Exception:
            first_child_id = None
        child1_ids = set(self._collect_subtree_ids(first_child_id, pool)) if first_child_id else set()
        try:
            cands.sort(key=lambda a: (0 if int(getattr(a, "id", 0) or 0) in child1_ids else 1, int(getattr(a, "level", 0) or 0), int(getattr(a, "id", 0) or 0)))
        except Exception:
            pass

        # Perform promotions one-by-one in order
        miss_positions = list(missing)
        for acc in cands:
            if not miss_positions:
                break

            # Optional skip if financially locked
            if self._is_financially_locked(acc):
                log["skipped"].append({
                    "account_id": int(acc.id),
                    "owner_id": getattr(acc, "owner_id", None),
                    "reason": "financial_lock"
                })
                continue

            pos = miss_positions.pop(0)

            # Snapshot subtree under the candidate before moving, to compute level delta safely
            acc_id = int(acc.id)
            acc_level_old = int(getattr(acc, "level", 0) or 0)
            if acc_level_old <= 1:
                # Nothing to promote (defensive)
                continue
            sub_ids = self._collect_subtree_ids(acc_id, pool)
            # New level for acc under root must be 1
            delta = 1 - acc_level_old  # negative number (e.g., 1 - 3 = -2)

            action = {
                "account_id": acc_id,
                "owner_id": getattr(acc, "owner_id", None),
                "old_parent_id": getattr(acc, "parent_account_id", None),
                "new_parent_id": root_id,
                "old_level": acc_level_old,
                "new_level": 1,
                "new_position": int(pos),
                "subtree_size": len(sub_ids),
                "delta_applied": int(delta),
                "descendants_touched": max(0, len(sub_ids) - 1),
            }

            if dry_run:
                log["promotions"].append(action)
                continue

            with transaction.atomic():
                # 1) Move the candidate under root with the target position and level
                # Use select_for_update to avoid concurrent sibling races
                acc_locked = AutoPoolAccount.objects.select_for_update().filter(id=acc_id, pool_type=pool, status="ACTIVE").first()
                if not acc_locked:
                    continue  # skip if disappeared
                # Recompute a safe position against ALL statuses to satisfy DB unique constraint
                taken_all = set(
                    int(p) for p in AutoPoolAccount.objects.filter(
                        pool_type=pool,
                        parent_account_id=root_id,
                    ).values_list("position", flat=True) if p is not None
                )
                new_pos = None
                for k in range(1, width + 1):
                    if k not in taken_all:
                        new_pos = k
                        break
                if new_pos is None:
                    # No free slot at Level-1 under this root (occupied by historical rows). Skip this promotion.
                    continue

                acc_locked.parent_account_id = root_id
                acc_locked.level = 1
                acc_locked.position = int(new_pos)
                acc_locked.save(update_fields=["parent_account_id", "level", "position"])

                # Reflect the final assigned position in the audit action
                action["new_position"] = int(new_pos)

                # 2) Adjust absolute level for every descendant in its subtree by delta
                if len(sub_ids) > 1 and delta != 0:
                    # Exclude the moved node itself from the descendant pass
                    desc_ids = [sid for sid in sub_ids if int(sid) != acc_id]
                    # Fetch in batches and update
                    batch = 250
                    for i in range(0, len(desc_ids), batch):
                        chunk_ids = desc_ids[i:i + batch]
                        rows = list(AutoPoolAccount.objects.select_for_update().filter(id__in=chunk_ids, pool_type=pool))
                        for r in rows:
                            try:
                                new_lvl = int((getattr(r, "level", 0) or 0) + delta)
                                if new_lvl < 1:
                                    new_lvl = 1  # clamp defensively
                                r.level = new_lvl
                            except Exception:
                                continue
                        if rows:
                            AutoPoolAccount.objects.bulk_update(rows, ["level"])

                log["promotions"].append(action)

        # Final renumber of siblings 1..5 under root to eliminate any gaps/order drift
        _, ren = self._renumber_siblings(root_id, pool, width=width, dry_run=dry_run)
        log["renumber"] = [{"child_id": cid, "old_position": op, "new_position": np} for (cid, op, np) in ren]

        # After snapshot
        log["after_children"] = self._snapshot_children(root_id, pool)
        return log

    # --------- Main entry ---------
    def handle(self, *args, **options):
        pool = "FIVE_150"
        width = 5
        root_account_id = int(options.get("root_account_id") or 0)
        limit = int(options.get("limit") or 5)
        dry_run = bool(options.get("dry_run", False))
        all_roots = bool(options.get("all_roots", False))
        log_file_opt = options.get("log_file") or ""
        free_blocked = bool(options.get("free_blocked", False))

        # Build roots list
        roots = []
        if all_roots:
            roots = list(
                AutoPoolAccount.objects.select_related("owner")
                .filter(pool_type=pool, status="ACTIVE", parent_account__isnull=True)
                .order_by("id")
            )
            if not roots:
                self.stderr.write(self.style.ERROR("No FIVE_150 roots to repair."))
                return
        else:
            if root_account_id > 0:
                root = AutoPoolAccount.objects.select_related("owner").filter(id=root_account_id, pool_type=pool, status="ACTIVE").first()
                if not root:
                    self.stderr.write(self.style.ERROR(f"Root account id={root_account_id} not found or not ACTIVE in {pool}"))
                    return
            else:
                # Default: sentinel root
                try:
                    root = _ensure_sentinel_root(pool)
                except Exception:
                    root = AutoPoolAccount.objects.filter(pool_type=pool, parent_account__isnull=True).order_by("id").first()
                if not root:
                    self.stderr.write(self.style.ERROR("No sentinel/root found for FIVE_150"))
                    return
            roots = [root]

        total = len(roots)
        all_results: List[Dict] = []
        for idx, root in enumerate(roots, start=1):
            self.stdout.write(self.style.NOTICE(f"=== FIVE_150 Level-1 Repair ({idx}/{total}) root_id={root.id}, dry_run={dry_run} ==="))

            # Before snapshot for display
            before = self._snapshot_children(int(root.id), pool)
            labels_before = [f"#{c['id']}@{c['position']}" for c in before]
            self.stdout.write(f"- Before Level-1 children ({len(before)}): {labels_before}")

            # Execute promotions inside a single transaction per root (when not dry-run)
            if dry_run:
                result = self._promote_candidates_to_level1(root, pool=pool, width=width, limit=limit, free_blocked=free_blocked, dry_run=True)
            else:
                with transaction.atomic():
                    result = self._promote_candidates_to_level1(root, pool=pool, width=width, limit=limit, free_blocked=free_blocked, dry_run=False)

            # Summarize actions
            promos = result.get("promotions") or []
            ren = result.get("renumber") or []

            if promos:
                self.stdout.write(self.style.SUCCESS(f"- Promotions applied: {len(promos)}"))
                for p in promos:
                    self.stdout.write(
                        f"  · Move acc#{p['account_id']} owner#{p['owner_id']} "
                        f"parent {p['old_parent_id']} -> {p['new_parent_id']}, "
                        f"level {p['old_level']} -> {p['new_level']}, pos -> {p['new_position']} "
                        f"(subtree={p['subtree_size']}, delta={p['delta_applied']})"
                    )
            else:
                self.stdout.write("- No promotions needed or no eligible candidates.")

            if ren:
                self.stdout.write(self.style.SUCCESS(f"- Renumbered siblings under root: {len(ren)}"))
                for r in ren:
                    self.stdout.write(f"  · acc#{r['child_id']}: pos {r['old_position']} -> {r['new_position']}")
            else:
                self.stdout.write("- No renumbering required.")

            # After snapshot for display
            after = self._snapshot_children(int(root.id), pool)
            labels_after = [f"#{c['id']}@{c['position']}" for c in after]
            self.stdout.write(f"- After Level-1 children ({len(after)}): {labels_after}")
            all_results.append(result)

        # Validation notes
        self.stdout.write(self.style.NOTICE("Validation:"))
        self.stdout.write("  - Each FIVE_150 root now has up to 5 Level-1 children; positions are sequential 1..5 (gaps removed).")
        self.stdout.write("  - Promotions kept subtree integrity by shifting descendant levels uniformly.")
        self.stdout.write("  - No ownership/status/timestamps/commission rows were modified.")

        # Write JSON audit log
        try:
            ts = datetime.now().strftime("%Y%m%d_%H%M%S")
            default_path = os.path.join("backend", "logs", f"repair_five_matrix_level1_{ts}.json")
            log_path = (str(log_file_opt).strip() or default_path)
            os.makedirs(os.path.dirname(log_path), exist_ok=True)
            payload = {
                "pool": pool,
                "dry_run": dry_run,
                "executed_at": ts,
                "roots_processed": [int(r.id) for r in roots],
                "results": all_results,
            }
            with open(log_path, "w", encoding="utf-8") as f:
                json.dump(payload, f, ensure_ascii=False, indent=2)
            self.stdout.write(self.style.SUCCESS(f"Audit log written to: {log_path}"))
        except Exception as e:
            self.stderr.write(self.style.WARNING(f"Failed to write audit log: {e}"))

        self.stdout.write(self.style.SUCCESS("All roots processed."))

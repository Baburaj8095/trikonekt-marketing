from __future__ import annotations

from typing import List, Tuple
from decimal import Decimal

from django.core.management.base import BaseCommand
from django.contrib.auth import get_user_model
from django.db import transaction
from django.db.models import Q, Sum, Count

from accounts.models import CustomUser, WalletTransaction
from business.models import CommissionConfig


def bfs_level_counts(root_id: int, max_depth: int = 6) -> List[int]:
    counts: List[int] = []
    current_ids = [root_id]
    for _ in range(max_depth):
        level_qs = CustomUser.objects.filter(parent_id__in=current_ids).only("id")
        ids = list(level_qs.values_list("id", flat=True))
        counts.append(len(ids))
        current_ids = ids
        if not current_ids:
            # pad remaining with zeros
            if len(counts) < max_depth:
                counts.extend([0] * (max_depth - len(counts)))
            break
    return counts


def ancestry_chain(u: CustomUser, max_up: int = 10) -> List[Tuple[int, str, int | None]]:
    out: List[Tuple[int, str, int | None]] = []
    cur = u
    seen = set()
    for _ in range(max_up):
        pid = getattr(cur, "parent_id", None)
        if not pid or pid in seen:
            break
        p = CustomUser.objects.filter(id=pid).only("id", "username", "matrix_position").first()
        if not p:
            break
        out.append((p.id, p.username, getattr(cur, "matrix_position", None)))
        seen.add(pid)
        cur = p
    return out


class Command(BaseCommand):
    help = "Seed a demo 5×Matrix (spillover) genealogy under a root sponsor and print a test summary."

    def add_arguments(self, parser):
        parser.add_argument("--root", type=str, default="mxroot", help="Root sponsor username (default: mxroot)")
        parser.add_argument("--count", type=int, default=40, help="Number of referrals to create under root (default: 40)")
        parser.add_argument("--password", type=str, default="Pass@123", help="Password to set for created users")
        parser.add_argument("--pincode", type=str, default="560001", help="Pincode to assign to demo users (optional)")
        parser.add_argument("--email_domain", type=str, default="example.com", help="Email domain for demo users")

    @transaction.atomic
    def handle(self, *args, **opts):
        root_username: str = opts["root"].strip()
        count: int = int(opts["count"] or 0)
        password: str = opts["password"]
        pincode: str = (opts.get("pincode") or "").strip()
        email_domain: str = opts["email_domain"].strip() or "example.com"

        if count <= 0:
            self.stdout.write(self.style.ERROR("Count must be > 0"))
            return

        # Ensure CommissionConfig defaults for 5-matrix are set
        cfg = CommissionConfig.get_solo()
        updated_cfg = False
        if not (cfg.five_matrix_amounts_json or []):
            cfg.five_matrix_amounts_json = [15, 2, 2.5, 0.5, 0.05, 0.1]
            updated_cfg = True
        if (cfg.five_matrix_levels or 0) <= 0:
            cfg.five_matrix_levels = 6
            updated_cfg = True
        if updated_cfg:
            cfg.save(update_fields=["five_matrix_amounts_json", "five_matrix_levels"])
            self.stdout.write(self.style.WARNING("CommissionConfig updated with default FIVE amounts and levels"))

        # Create or get root sponsor
        User = get_user_model()
        root, created = User.objects.get_or_create(
            username=root_username,
            defaults={
                "email": f"{root_username}@{email_domain}",
                "full_name": "Matrix Root",
                "category": "consumer",
                "role": "user",
                "pincode": pincode,
            },
        )
        if created:
            root.set_password(password)
            root.save()
            self.stdout.write(self.style.SUCCESS(f"Created root user: {root.username} (id={root.id})"))
        else:
            # ensure sponsor_id is set to username and pincode optionally updated
            changed = False
            if not getattr(root, "pincode", None) and pincode:
                root.pincode = pincode
                changed = True
            if changed:
                root.save(update_fields=["pincode"])
            self.stdout.write(self.style.NOTICE(f"Using existing root user: {root.username} (id={root.id})"))

        # Create N direct registrations under root.
        # Spillover placement will occur automatically via signals (on_user_join) using BFS under the root genealogy.
        created_users = 0
        skipped_users = 0
        for i in range(1, count + 1):
            uname = f"{root_username}_u{i:04d}"
            if User.objects.filter(username=uname).exists():
                skipped_users += 1
                continue
            u = User(
                username=uname,
                email=f"{uname}@{email_domain}",
                full_name=f"User {i}",
                category="consumer",
                role="user",
                pincode=pincode,
                registered_by=root,  # sponsor
            )
            u.set_password(password)
            u.save()  # triggers post_save -> on_user_join -> spillover placement + payouts
            created_users += 1

        self.stdout.write(self.style.SUCCESS(f"Users created: {created_users}, skipped (already exist): {skipped_users}"))

        # Compute 5×Matrix level counts under root (by parent chain)
        lvl = bfs_level_counts(root.id, max_depth=6)
        self.stdout.write("")
        self.stdout.write(self.style.MIGRATE_HEADING("5×Matrix Level Counts (via parent chain)"))
        for idx, c in enumerate(lvl, start=1):
            self.stdout.write(f"L{idx}: {c} members")

        # Sanity check: max 5 direct children anywhere
        any_overflow = (
            CustomUser.objects
            .filter(children__isnull=False)
            .annotate(cnt_children_count=Count("children"))
            .filter(cnt_children_count__gt=5, id__in=CustomUser.objects.filter(Q(username=root_username) | Q(username__startswith=f"{root_username}_u")).values_list("id", flat=True))
            .exists()
        )
        if any_overflow:
            self.stdout.write(self.style.ERROR("Found a node with >5 children in the demo set!"))
        else:
            self.stdout.write(self.style.SUCCESS("All nodes satisfy ≤5 direct children."))

        # Wallet summaries for AUTOPOOL_BONUS_FIVE within the demo cohort (root + created users)
        cohort_ids = list(
            CustomUser.objects
            .filter(Q(username=root_username) | Q(username__startswith=f"{root_username}_u"))
            .values_list("id", flat=True)
        )
        tx_qs = WalletTransaction.objects.filter(
            user_id__in=cohort_ids,
            type="AUTOPOOL_BONUS_FIVE",
        )
        total_autopool_five = tx_qs.aggregate(s=Sum("amount"))["s"] or Decimal("0.00")

        self.stdout.write("")
        self.stdout.write(self.style.MIGRATE_HEADING("Wallet Summary (AUTOPOOL_BONUS_FIVE)"))
        self.stdout.write(f"Total AUTOPOOL_BONUS_FIVE across cohort: {total_autopool_five}")

        # Show top 5 recipients by amount
        top5 = (
            tx_qs.values("user_id")
            .annotate(total=Sum("amount"))
            .order_by("-total")[:5]
        )
        if top5:
            self.stdout.write("Top recipients:")
            for row in top5:
                uid = row["user_id"]
                amt = row["total"]
                u = CustomUser.objects.filter(id=uid).only("username").first()
                self.stdout.write(f"  - {u.username if u else uid}: {amt}")

        # Display ancestry chain for the last created user as a sample
        sample = CustomUser.objects.filter(username=f"{root_username}_u{count:04d}").first()
        if sample:
            chain = ancestry_chain(sample, max_up=10)
            self.stdout.write("")
            self.stdout.write(self.style.MIGRATE_HEADING(f"Sample ancestry for {sample.username} (child's matrix_position in parent):"))
            if not chain:
                self.stdout.write("  No parents found (placement may still be pending).")
            else:
                # printed from child upwards: parent(username) <- child matrix_position
                for idx, (pid, puname, child_pos) in enumerate(chain, start=1):
                    self.stdout.write(f"  U{idx}: parent={puname} (id={pid}), child's matrix_position={child_pos}")

        # Print endpoint hints
        self.stdout.write("")
        self.stdout.write(self.style.MIGRATE_HEADING("Test the genealogy via APIs"))
        self.stdout.write(f"- User tree (auth required as root):      GET /api/accounts/my/matrix/tree/?max_depth=6")
        self.stdout.write(f"- Subtree by root (auth as root):         GET /api/accounts/matrix/tree5/?root_user_id={root.id}&max_depth=6")
        self.stdout.write(f"- Admin tree by identifier (admin/staff): GET /api/admin/matrix/tree5/?identifier={root.username}&source=auto&max_depth=6")
        self.stdout.write("")
        self.stdout.write(self.style.SUCCESS("Seed complete."))

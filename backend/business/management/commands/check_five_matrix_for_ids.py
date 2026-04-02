from __future__ import annotations

from typing import List, Set
from django.core.management.base import BaseCommand
from django.utils import timezone
from datetime import timedelta


class Command(BaseCommand):
    help = "Check given user ids (and their downline) for presence of FIVE_150 AutoPoolAccount entries"

    def add_arguments(self, parser):
        parser.add_argument(
            "--ids",
            type=str,
            required=True,
            help="Comma-separated list of user ids or identifiers to inspect (e.g. 123,alice)",
        )
        parser.add_argument(
            "--depth",
            type=int,
            default=2,
            help="Depth of downline to traverse (default: 2)",
        )

    def handle(self, *args, **options):
        ids_raw: str = str(options.get("ids") or "")
        depth: int = int(options.get("depth") or 2)
        tokens: List[str] = [t.strip() for t in ids_raw.split(",") if t.strip()]

        try:
            from accounts.models import CustomUser
        except Exception:
            self.stderr.write("Could not import CustomUser from accounts.models; aborting")
            return
        try:
            from business.models import AutoPoolAccount
        except Exception:
            self.stderr.write("Could not import AutoPoolAccount from business.models; aborting")
            return

        def resolve_user(token: str):
            # Try integer id
            try:
                uid = int(token)
                u = CustomUser.objects.filter(id=uid).first()
                if u:
                    return u
            except Exception:
                pass
            # Try username
            try:
                u = CustomUser.objects.filter(username=token).first()
                if u:
                    return u
            except Exception:
                pass
            # Try common phone/mobile fields if present
            for fld in ("mobile", "phone", "phone_number"):
                try:
                    q = {fld: token}
                    u = CustomUser.objects.filter(**q).first()
                    if u:
                        return u
                except Exception:
                    continue
            return None

        # BFS traversal of downline via registered_by relation
        def collect_downline(start_user, max_depth: int) -> List:
            out = []
            frontier = [start_user]
            visited: Set[int] = set([getattr(start_user, "id", None)])
            for d in range(max_depth + 1):
                next_front = []
                for u in frontier:
                    out.append((d, u))
                    # find direct referrals
                    try:
                        refs = CustomUser.objects.filter(registered_by_id=getattr(u, "id", None)).order_by("id")
                    except Exception:
                        refs = []
                    for r in refs:
                        rid = getattr(r, "id", None)
                        if rid and rid not in visited:
                            visited.add(rid)
                            next_front.append(r)
                frontier = next_front
                if not frontier:
                    break
            return out

        self.stdout.write("user_id,identifier,depth,has_five,five_count,five_ids")
        for tok in tokens:
            u = resolve_user(tok)
            if not u:
                self.stderr.write(f"Could not resolve user for identifier: {tok}")
                continue
            rows = collect_downline(u, depth)
            for lvl, usr in rows:
                uid = getattr(usr, "id", None)
                identifier = getattr(usr, "username", None) or str(uid)
                f_qs = AutoPoolAccount.objects.filter(owner_id=uid, pool_type="FIVE_150")
                five_count = f_qs.count()
                five_ids = list(f_qs.values_list("id", flat=True)[:10])
                has_five = bool(five_count > 0)
                self.stdout.write(f"{uid},{identifier},{lvl},{int(has_five)},{five_count},{five_ids}")

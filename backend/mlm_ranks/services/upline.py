from __future__ import annotations

from typing import List, Optional, Set
from django.db.models import Q
try:
    from accounts.models import CustomUser  # type: ignore
except Exception:  # pragma: no cover
    CustomUser = None  # type: ignore


class UplineService:
    """
    Resolve direct sponsor and the upline chain (registered_by) for a user.
    This adapter reads existing relations without modifying any app:
      - Direct sponsor: user.registered_by (fallback: None)
      - Uplines: iterative registered_by up to `depth`, skipping cycles
    """

    @staticmethod
    def get_direct_sponsor(user) -> Optional[object]:
        """
        Resolve direct sponsor for a user.
        Priority:
          1) registered_by FK (authoritative)
          2) Fallback via sponsor_id heuristics (username/prefixed_id/unique_id/phone)
        """
        # 1) Registered FK if present
        try:
            sponsor = getattr(user, "registered_by", None)
            if sponsor and getattr(sponsor, "id", None):
                return sponsor
        except Exception:
            pass

        # 2) Fallback: resolve using sponsor_id string (legacy/imported accounts)
        try:
            if CustomUser is None:
                return None
            raw = (getattr(user, "sponsor_id", "") or "").strip()
            if not raw:
                return None

            # Build candidate identifiers (exact, hyphenated TR-code, digits-only, etc.)
            vals = [raw]
            # If looks like TR123... without hyphen, add TR-123...
            try:
                tr = str(raw)
                if tr and "-" not in tr and len(tr) > 2 and tr[:2].isalpha():
                    vals.append(f"{tr[:2]}-{tr[2:]}")
            except Exception:
                pass
            # Digits-only variant (for unique_id/phone match)
            try:
                digs = "".join(ch for ch in str(raw) if ch.isdigit())
                if digs:
                    vals.append(digs)
            except Exception:
                digs = None

            # Unique-id candidates (strictly digits, length 6 typically)
            uniq_candidates = [v for v in vals if v.isdigit()]

            # Integer PK candidates (if legacy sponsor_id stored sponsor's numeric user.id)
            int_ids = []
            for v in uniq_candidates:
                try:
                    int_ids.append(int(v))
                except Exception:
                    pass

            q = (
                Q(prefixed_id__in=vals)
                | Q(username__in=vals)
                | (Q(unique_id__in=uniq_candidates) if uniq_candidates else Q(pk__isnull=True))
                | Q(phone__in=(vals + ([digs] if digs else [])))
                | (Q(id__in=int_ids) if int_ids else Q(pk__isnull=True))
            )
            cand = (
                CustomUser.objects
                .filter(q)
                .only("id")
                .order_by("id")
                .first()
            )
            if cand and getattr(cand, "id", None):
                return cand
        except Exception:
            # best-effort; no sponsor resolved
            pass

        return None

    @staticmethod
    def get_uplines(user, depth: int = 10) -> List[object]:
        """
        Returns a list [L1, L2, ..., L{depth}] where:
          - L1 is direct sponsor
          - Stops early if chain ends
          - Skips cycles defensively
        """
        out: List[object] = []
        seen: Set[int] = set()
        cur = user
        for _ in range(max(0, int(depth))):
            try:
                cur = getattr(cur, "registered_by", None)
            except Exception:
                cur = None
            if not cur or not getattr(cur, "id", None):
                break
            uid = int(getattr(cur, "id", 0) or 0)
            if uid in seen:
                break
            out.append(cur)
            seen.add(uid)
        return out

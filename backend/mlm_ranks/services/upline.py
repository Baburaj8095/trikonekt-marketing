from __future__ import annotations

from typing import List, Optional, Set


class UplineService:
    """
    Resolve direct sponsor and the upline chain (registered_by) for a user.
    This adapter reads existing relations without modifying any app:
      - Direct sponsor: user.registered_by (fallback: None)
      - Uplines: iterative registered_by up to `depth`, skipping cycles
    """

    @staticmethod
    def get_direct_sponsor(user) -> Optional[object]:
        try:
            sponsor = getattr(user, "registered_by", None)
            if sponsor and getattr(sponsor, "id", None):
                return sponsor
        except Exception:
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

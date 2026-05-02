from __future__ import annotations

from rest_framework.throttling import AnonRateThrottle


class HubbleWebhookAnonThrottle(AnonRateThrottle):
    """Dedicated throttle for Hubble webhook endpoints.

    Why this exists:
    - We don't want webhook burst traffic (or abuse) to consume the global anon throttle budget
      and starve other endpoints.
    - This remains backward compatible because the rate is env/config driven.
    """

    scope = "hubble_webhook"

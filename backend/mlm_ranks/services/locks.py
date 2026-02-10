from __future__ import annotations

from functools import wraps
from typing import Callable

from django.db import transaction


def atomic(fn: Callable):
    """
    Decorator to ensure the wrapped function runs inside a DB transaction.
    """
    @wraps(fn)
    def _inner(*args, **kwargs):
        with transaction.atomic():
            return fn(*args, **kwargs)
    return _inner

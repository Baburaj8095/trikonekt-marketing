from __future__ import annotations

import re
from typing import Iterable

from django.core.management.base import BaseCommand, CommandParser
from django.db import transaction, models
from django.apps import apps


MOJIBAKE_MARKERS = [
    "â‚¹",  # INR sign mis-decoded
    "â€™", "â€˜",  # curly single quotes
    "â€œ", "â€",   # curly double quotes variants
    "â€“", "â€”",  # dashes
    "â€¢", "â€¦",  # bullet, ellipsis
    "Ã—", "Ã", "Â", "",  # misc
    "”¦", "”“", "”º", "”¹",
]
MARKER_RE = re.compile("|".join(re.escape(m) for m in MOJIBAKE_MARKERS))


def looks_like_mojibake(s: str) -> bool:
    if not isinstance(s, str) or not s:
        return False
    if MARKER_RE.search(s):
        return True
    # Control chars in C1 range (0x80..0x9F) surfaced as Unicode can hint mojibake
    return any(0x80 <= ord(ch) <= 0x9F for ch in s)


def try_fix_once(s: str) -> str:
    """
    Attempt to recover original UTF-8 string from a mis-decoded Latin-1/CP1252 string.
    Strategy:
      1) Re-encode as cp1252 ignoring errors, then decode as UTF-8.
      2) If that fails or still has markers, try latin-1 -> UTF-8.
      3) As a last step, apply a few common replacements.
    """
    if not isinstance(s, str):
        return s

    def _has_markers(x: str) -> bool:
        return looks_like_mojibake(x)

    # Step 1: cp1252 -> utf-8
    try:
        b = s.encode("cp1252", errors="ignore")
        out = b.decode("utf-8", errors="strict")
        if not _has_markers(out):
            return out
    except Exception:
        pass

    # Step 2: latin-1 -> utf-8
    try:
        b = s.encode("latin-1", errors="ignore")
        out = b.decode("utf-8", errors="strict")
        if not _has_markers(out):
            return out
    except Exception:
        pass

    # Step 3: targeted substitutions for common artifacts
    replacements = [
        ("â€™", "’"), ("â€˜", "‘"),
        ("â€œ", "“"), ("â€\x9d", "”"), ("â€\x9c", "“"), ("â€", "”"),
        ("â€“", "–"), ("â€”", "—"),
        ("â€¢", "•"), ("â€¦", "…"),
        ("â‚¹", "₹"),
        ("Ã—", "×"),
        ("â€º", "›"), ("â€¹", "‹"),
        ("Â©", "©"), ("Â®", "®"), ("Â±", "±"), ("Â·", "·"),
        ("Â", ""),
        ("”¢", "•"),
        ("”º", "›"), ("”¹", "‹"),
        ("”“", "–"),
        ("”¦", "…"),
    ]
    out = s
    for a, b in replacements:
        out = out.replace(a, b)
    return out


def iter_text_fields(model: type[models.Model]) -> Iterable[models.Field]:
    for f in model._meta.get_fields():
        if isinstance(f, (models.CharField, models.TextField)):
            yield f


class Command(BaseCommand):
    help = "Scan DB for mojibake text and optionally repair common UTF-8/CP1252 corruption."

    def add_arguments(self, parser: CommandParser) -> None:
        parser.add_argument("--app", action="append", default=[], help="Limit to specific Django app labels (can repeat).")
        parser.add_argument("--model", action="append", default=[], help="Limit to specific model names within selected apps (can repeat).")
        parser.add_argument("--field", action="append", default=[], help="Limit to specific field names (CharField/TextField).")
        parser.add_argument("--dry-run", action="store_true", help="Do not write changes, only report.")
        parser.add_argument("--limit", type=int, default=0, help="Max rows to process per model (0 = no limit).")
        parser.add_argument("--batch", type=int, default=500, help="Batch size for updates.")

    def handle(self, *args, **opts):
        apps_filter = set((opts.get("app") or []))
        models_filter = set((opts.get("model") or []))
        fields_filter = set((opts.get("field") or []))
        dry = bool(opts.get("dry_run"))
        limit = int(opts.get("limit") or 0)
        batch = int(opts.get("batch") or 500)

        total_scanned = 0
        total_flagged = 0
        total_fixed = 0

        for model in apps.get_models():
            app_label = model._meta.app_label
            model_name = model._meta.model_name
            if apps_filter and app_label not in apps_filter:
                continue
            if models_filter and model_name not in {m.lower() for m in models_filter}:
                continue

            text_fields = list(iter_text_fields(model))
            if fields_filter:
                text_fields = [f for f in text_fields if f.name in fields_filter]
            if not text_fields:
                continue

            q = model.objects.all().only("pk", *[f.name for f in text_fields])
            if limit and limit > 0:
                q = q[:limit]

            self.stdout.write(self.style.NOTICE(f"Scanning {app_label}.{model.__name__} fields {[f.name for f in text_fields]}"))

            to_update = []
            scanned = 0
            flagged = 0
            fixed = 0

            for obj in q.iterator(chunk_size=max(200, batch)):
                changed = False
                for f in text_fields:
                    val = getattr(obj, f.name, None)
                    if isinstance(val, str) and looks_like_mojibake(val):
                        flagged += 1
                        repaired = try_fix_once(val)
                        if repaired != val and repaired:
                            setattr(obj, f.name, repaired)
                            changed = True
                scanned += 1
                if changed:
                    to_update.append(obj)
                    if len(to_update) >= batch:
                        self._flush_updates(model, to_update, [f.name for f in text_fields], dry)
                        fixed += len(to_update)
                        to_update.clear()

            if to_update:
                self._flush_updates(model, to_update, [f.name for f in text_fields], dry)
                fixed += len(to_update)
                to_update.clear()

            total_scanned += scanned
            total_flagged += flagged
            total_fixed += fixed
            self.stdout.write(self.style.SUCCESS(f"Done {app_label}.{model.__name__}: scanned={scanned}, flagged={flagged}, {'fixed=' + str(fixed) if not dry else 'would_fix=' + str(fixed)}"))

        self.stdout.write("=== Summary ===")
        self.stdout.write(f"Scanned rows: {total_scanned}")
        self.stdout.write(f"Flagged rows: {total_flagged}")
        self.stdout.write(f"{'Fixed rows' if not dry else 'Would fix rows'}: {total_fixed}")

    @staticmethod
    @transaction.atomic
    def _flush_updates(model: type[models.Model], objs: list[models.Model], field_names: list[str], dry: bool) -> None:
        if dry:
            return
        # Update only changed textual fields
        model.objects.bulk_update(objs, field_names)

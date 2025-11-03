import json
import time
from pathlib import Path
from django.core.management.base import BaseCommand
from django.db import connection
from django.core.management.color import no_style
from locations.models import Country, State, City


def _bulk_create_in_chunks(model, objs_iter, chunk_size=5000, stdout=None, label="items"):
    count = 0
    buf = []
    for obj in objs_iter:
        buf.append(obj)
        if len(buf) >= chunk_size:
            model.objects.bulk_create(buf, ignore_conflicts=False)
            count += len(buf)
            if stdout:
                stdout.write(f"Inserted {count} {label}...")
            buf = []
    if buf:
        model.objects.bulk_create(buf, ignore_conflicts=False)
        count += len(buf)
        if stdout:
            stdout.write(f"Inserted {count} {label}...")
    return count


class Command(BaseCommand):
    help = "FAST loader for India-only (country_id=101) State/City using bulk_create in chunks; does not touch other countries."

    def add_arguments(self, parser):
        parser.add_argument(
            "--chunk",
            type=int,
            default=5000,
            help="Bulk create chunk size (default: 5000)",
        )

    def handle(self, *args, **options):
        started = time.time()
        chunk = int(options.get("chunk") or 5000)
        INDIA_ID = 101

        self.stdout.write(self.style.WARNING(f"Starting India-only locations load (chunk={chunk})"))

        # Ensure India country exists (countries should already be loaded)
        india = Country.objects.filter(id=INDIA_ID).first()
        if not india:
            # Create minimal India record if missing to allow FKs
            india = Country.objects.create(id=INDIA_ID, name="India", iso2="IN")
            self.stdout.write(self.style.WARNING("Created Country(id=101, name='India')"))

        # Resolve data dir
        data_dir = Path(__file__).resolve().parents[2] / "data"
        states_cities_path = data_dir / "states+cities.json"
        if not states_cities_path.exists():
            self.stdout.write(self.style.ERROR(f"Data file not found: {states_cities_path}"))
            return

        # Load JSON (one-time in memory)
        self.stdout.write("Reading states+cities.json (one-time parse)...")
        with open(states_cities_path, encoding="utf-8") as f:
            states_data = json.load(f)
        if not isinstance(states_data, list):
            self.stdout.write(self.style.ERROR("Unexpected JSON shape: expected a list"))
            return

        # Filter to India-only subset
        india_states_rows = [s for s in states_data if (s or {}).get("country_id") == INDIA_ID]
        self.stdout.write(self.style.WARNING(f"India states in JSON: {len(india_states_rows)}"))

        # FK-safe clear for India-only
        self.stdout.write("Clearing existing India states/cities ...")
        india_state_ids = list(State.objects.filter(country_id=INDIA_ID).values_list("id", flat=True))
        if india_state_ids:
            City.objects.filter(state_id__in=india_state_ids).delete()
            State.objects.filter(id__in=india_state_ids).delete()

        # Insert states (use country_id direct)
        self.stdout.write("Inserting India states ...")
        def _state_iter():
            for s in india_states_rows:
                sid = s.get("id")
                name = s.get("name")
                if sid is None:
                    continue
                yield State(id=int(sid), name=str(name or ""), country_id=INDIA_ID)

        inserted_s = _bulk_create_in_chunks(State, _state_iter(), chunk_size=chunk, stdout=self.stdout, label="states")
        self.stdout.write(self.style.SUCCESS(f"Inserted India states: {inserted_s}"))

        # Insert cities per state (stream)
        self.stdout.write("Inserting India cities (streaming) ...")
        def _cities_iter():
            for s in india_states_rows:
                sid = s.get("id")
                if sid is None:
                    continue
                for c in (s.get("cities") or []):
                    cid = c.get("id")
                    nm = c.get("name")
                    if cid is None:
                        continue
                    yield City(id=int(cid), name=str(nm or ""), state_id=int(sid))

        inserted_ci = _bulk_create_in_chunks(City, _cities_iter(), chunk_size=chunk, stdout=self.stdout, label="cities")
        self.stdout.write(self.style.SUCCESS(f"Inserted India cities: {inserted_ci}"))

        # Reset sequences for explicit ID inserts (safe on Postgres; no-op on SQLite)
        try:
            seq_sql = connection.ops.sequence_reset_sql(no_style(), [Country, State, City])
            with connection.cursor() as cursor:
                for sql in seq_sql:
                    cursor.execute(sql)
            self.stdout.write(self.style.SUCCESS("Reset DB sequences for Country, State, City"))
        except Exception as seq_err:
            self.stdout.write(self.style.WARNING(f"Sequence reset skipped: {seq_err}"))

        # Final counts
        total = {
            "countries": Country.objects.count(),
            "states_total": State.objects.count(),
            "cities_total": City.objects.count(),
            "india_states": State.objects.filter(country_id=INDIA_ID).count(),
            "india_cities": City.objects.filter(state__country_id=INDIA_ID).count(),
        }
        self.stdout.write(self.style.SUCCESS(f"Done in {time.time() - started:.1f}s; counts: {total}"))

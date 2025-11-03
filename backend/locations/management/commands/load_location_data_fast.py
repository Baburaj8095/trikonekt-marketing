import json
import time
from pathlib import Path
from django.core.management.base import BaseCommand
from django.db import transaction, connection
from django.core.management.color import no_style
from locations.models import Country, State, City


def _bulk_create_in_chunks(model, objs_iter, chunk_size=5000, stdout=None, label="items"):
    """
    Stream bulk_create to keep memory low. objs_iter yields model instances.
    """
    count = 0
    buffer = []
    for obj in objs_iter:
        buffer.append(obj)
        if len(buffer) >= chunk_size:
            model.objects.bulk_create(buffer, ignore_conflicts=False)
            count += len(buffer)
            if stdout:
                stdout.write(f"Inserted {count} {label}...")
            buffer = []
    if buffer:
        model.objects.bulk_create(buffer, ignore_conflicts=False)
        count += len(buffer)
        if stdout:
            stdout.write(f"Inserted {count} {label}...")
    return count


class Command(BaseCommand):
    help = "FAST loader for countries, states, cities using bulk_create in chunks and ID references"

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
        self.stdout.write(self.style.WARNING(f"Starting fast locations load (chunk={chunk})"))

        # Resolve data dir (backend/locations/data)
        data_dir = Path(__file__).resolve().parents[2] / "data"
        countries_path = data_dir / "countries.json"
        states_cities_path = data_dir / "states+cities.json"

        if not countries_path.exists() or not states_cities_path.exists():
            self.stdout.write(self.style.ERROR(f"Data files not found under: {data_dir}"))
            return

        # Load JSON (states+cities can be large; we still need json.load; stream chunking is for DB writes)
        self.stdout.write("Reading countries.json ...")
        with open(countries_path, encoding="utf-8") as f:
            countries_data = json.load(f)
        self.stdout.write(f"Countries in JSON: {len(countries_data)}")

        self.stdout.write("Reading states+cities.json ... this may take a moment ...")
        with open(states_cities_path, encoding="utf-8") as f:
            states_data = json.load(f)
        total_states = len(states_data) if isinstance(states_data, list) else 0
        self.stdout.write(f"States in JSON: {total_states}")

        # Clear in FK-safe order
        self.stdout.write("Clearing existing (City, State, Country)...")
        City.objects.all().delete()
        State.objects.all().delete()
        Country.objects.all().delete()

        # Insert countries in chunks
        self.stdout.write("Inserting countries ...")
        countries_iter = (Country(id=c.get("id"), name=c.get("name"), iso2=c.get("iso2")) for c in countries_data)
        inserted_c = _bulk_create_in_chunks(Country, countries_iter, chunk_size=chunk, stdout=self.stdout, label="countries")
        self.stdout.write(self.style.SUCCESS(f"Inserted total countries: {inserted_c}"))

        # Insert states referencing country_id (no DB fetch)
        self.stdout.write("Inserting states ...")
        missing_country_refs = 0

        def _state_iter():
            nonlocal missing_country_refs
            for s in states_data:
                cid = s.get("country_id")
                sid = s.get("id")
                name = s.get("name")
                if cid is None or sid is None:
                    continue
                try:
                    yield State(id=sid, name=str(name or ""), country_id=int(cid))
                except Exception:
                    missing_country_refs += 1
                    continue

        inserted_s = _bulk_create_in_chunks(State, _state_iter(), chunk_size=chunk, stdout=self.stdout, label="states")
        if missing_country_refs:
            self.stdout.write(self.style.WARNING(f"States skipped due to missing refs: {missing_country_refs}"))
        self.stdout.write(self.style.SUCCESS(f"Inserted total states: {inserted_s}"))

        # Insert cities referencing state_id; stream in chunks to keep memory bounded
        self.stdout.write("Inserting cities (streaming) ...")

        def _cities_iter():
            for s in states_data:
                sid = s.get("id")
                cities = s.get("cities") or []
                if sid is None:
                    continue
                for city in cities:
                    cid = city.get("id")
                    nm = city.get("name")
                    if cid is None:
                        continue
                    yield City(id=cid, name=str(nm or ""), state_id=int(sid))

        inserted_ci = _bulk_create_in_chunks(City, _cities_iter(), chunk_size=chunk, stdout=self.stdout, label="cities")
        self.stdout.write(self.style.SUCCESS(f"Inserted total cities: {inserted_ci}"))

        # Reset sequences for explicit ID inserts
        try:
            seq_sql = connection.ops.sequence_reset_sql(no_style(), [Country, State, City])
            with connection.cursor() as cursor:
                for sql in seq_sql:
                    cursor.execute(sql)
            self.stdout.write(self.style.SUCCESS("Reset DB sequences for Country, State, City"))
        except Exception as seq_err:
            self.stdout.write(self.style.WARNING(f"Sequence reset skipped: {seq_err}"))

        # Final counts
        final_counts = {
            "countries": Country.objects.count(),
            "states": State.objects.count(),
            "cities": City.objects.count(),
        }
        self.stdout.write(self.style.SUCCESS(f"Done in {time.time() - started:.1f}s; counts: {final_counts}"))

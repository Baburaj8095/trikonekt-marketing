import json
from pathlib import Path
from django.core.management.base import BaseCommand
from django.db import connection, transaction
from django.core.management.color import no_style
from locations.models import Country, State, City


def read_fixture_any_encoding(fpath: Path):
    """
    Try multiple common encodings and return parsed JSON (list of objects).
    """
    encodings = ["utf-8", "utf-8-sig", "cp1252", "latin-1"]
    last_err = None
    for enc in encodings:
        try:
            with open(fpath, "r", encoding=enc) as f:
                data = f.read()
            return json.loads(data)
        except Exception as e:
            last_err = e
            continue
    raise last_err or Exception("Unable to read fixture with common encodings")


class Command(BaseCommand):
    help = "Load Country/State/City from backend/fixtures/export/01_locations.json with robust encoding handling and reset sequences"

    def add_arguments(self, parser):
        parser.add_argument(
            "--fixture",
            default=None,
            help="Optional path to fixture JSON. Defaults to backend/fixtures/export/01_locations.json",
        )
        parser.add_argument(
            "--chunk",
            type=int,
            default=5000,
            help="Bulk create chunk size (default: 5000)",
        )

    def handle(self, *args, **options):
        try:
            # Resolve fixture path
            fixture_arg = options.get("fixture")
            if fixture_arg:
                fixture_path = Path(fixture_arg).resolve()
            else:
                # backend/<this_file>/../../.. = backend
                backend_dir = Path(__file__).resolve().parents[3]
                fixture_path = backend_dir / "fixtures" / "export" / "01_locations.json"

            if not fixture_path.exists():
                self.stdout.write(self.style.ERROR(f"Fixture not found: {fixture_path}"))
                return

            self.stdout.write(f"Using fixture: {fixture_path}")

            # Read and parse fixture with robust encoding fallbacks
            self.stdout.write("Reading fixture (trying utf-8/utf-8-sig/cp1252/latin-1)...")
            objects = read_fixture_any_encoding(fixture_path)
            if not isinstance(objects, list):
                self.stdout.write(self.style.ERROR("Fixture root is not a list"))
                return

            # Split into model groups
            countries_in = []
            states_in = []
            cities_in = []
            for obj in objects:
                try:
                    model = obj.get("model")
                    pk = obj.get("pk")
                    fields = obj.get("fields", {})
                    if model == "locations.country":
                        countries_in.append((pk, fields))
                    elif model == "locations.state":
                        states_in.append((pk, fields))
                    elif model == "locations.city":
                        cities_in.append((pk, fields))
                except Exception:
                    continue

            self.stdout.write(
                f"Parsed fixture: countries={len(countries_in)}, states={len(states_in)}, cities={len(cities_in)}"
            )

            # Clear existing rows (FK-safe order)
            self.stdout.write("Clearing existing locations (City, State, Country)...")
            City.objects.all().delete()
            State.objects.all().delete()
            Country.objects.all().delete()

            chunk = int(options.get("chunk") or 5000)

            def _bulk_create(model, objs):
                if not objs:
                    return 0
                total = 0
                for i in range(0, len(objs), chunk):
                    batch = objs[i : i + chunk]
                    model.objects.bulk_create(batch, ignore_conflicts=False)
                    total += len(batch)
                return total

            with transaction.atomic():
                # Countries
                country_objs = [
                    Country(id=pk, name=str(f.get("name", "")), iso2=f.get("iso2", None))
                    for pk, f in countries_in
                ]
                created_c = _bulk_create(Country, country_objs)
                self.stdout.write(self.style.SUCCESS(f"Inserted {created_c} countries"))

                # States (use country_id to avoid fetching)
                state_objs = []
                for pk, f in states_in:
                    try:
                        state_objs.append(
                            State(
                                id=pk,
                                name=str(f.get("name", "")),
                                country_id=int(f.get("country")) if f.get("country") is not None else None,
                            )
                        )
                    except Exception:
                        # skip malformed record
                        continue
                created_s = _bulk_create(State, state_objs)
                self.stdout.write(self.style.SUCCESS(f"Inserted {created_s} states"))

                # Cities (use state_id to avoid fetching)
                city_objs = []
                for pk, f in cities_in:
                    try:
                        city_objs.append(
                            City(
                                id=pk,
                                name=str(f.get("name", "")),
                                state_id=int(f.get("state")) if f.get("state") is not None else None,
                            )
                        )
                    except Exception:
                        continue
                created_ci = _bulk_create(City, city_objs)
                self.stdout.write(self.style.SUCCESS(f"Inserted {created_ci} cities"))

                # Reset sequences after explicit ID inserts
                try:
                    seq_sql = connection.ops.sequence_reset_sql(no_style(), [Country, State, City])
                    with connection.cursor() as cursor:
                        for sql in seq_sql:
                            cursor.execute(sql)
                    self.stdout.write(self.style.SUCCESS("Reset DB sequences for Country, State, City"))
                except Exception as seq_err:
                    self.stdout.write(self.style.WARNING(f"Sequence reset skipped: {seq_err}"))

            # Report counts
            counts = {
                "countries": Country.objects.count(),
                "states": State.objects.count(),
                "cities": City.objects.count(),
            }
            self.stdout.write(self.style.SUCCESS(f"Loaded counts: {json.dumps(counts)}"))

        except Exception as e:
            self.stdout.write(self.style.ERROR(f"Error: {str(e)}"))

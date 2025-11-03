import json
from pathlib import Path
from django.core.management.base import BaseCommand
from locations.models import Country, State, City
from django.db import transaction
from django.db import connection
from django.core.management.color import no_style

class Command(BaseCommand):
    help = "Load countries, states, and cities from JSON files"

    def handle(self, *args, **options):
        try:
            # Load JSON data
            data_dir = Path(__file__).resolve().parents[2] / "data"
            with open(data_dir / "countries.json", encoding="utf-8") as f:
                countries_data = json.load(f)
            with open(data_dir / "states+cities.json", encoding="utf-8") as f:
                states_data = json.load(f)

            self.stdout.write("Loading countries...")
            Country.objects.all().delete()
            for c in countries_data:
                Country.objects.create(
                    id=c.get("id"),
                    name=c.get("name"),
                    iso2=c.get("iso2"),
                )
            self.stdout.write(self.style.SUCCESS(f"Loaded {len(countries_data)} countries"))

            self.stdout.write("Loading states and cities...")
            State.objects.all().delete()
            City.objects.all().delete()

            state_count = 0
            city_count = 0
            total_states = len(states_data) if isinstance(states_data, list) else 0
            missing_country = 0

            with transaction.atomic():
                for s in states_data:
                    country_id = s.get("country_id")
                    country = Country.objects.filter(id=country_id).first()
                    if not country:
                        missing_country += 1
                        continue

                    # Create state
                    state_obj = State.objects.create(
                        id=s.get("id"),
                        name=s.get("name"),
                        country=country
                    )
                    state_count += 1

                    # Create cities
                    for city in s.get("cities", []):
                        City.objects.create(
                            id=city.get("id"),
                            name=city.get("name"),
                            state=state_obj
                        )
                        city_count += 1

            self.stdout.write(self.style.SUCCESS(f"Loaded {state_count} states and {city_count} cities"))
            self.stdout.write(self.style.WARNING(f"States in JSON: {total_states}; skipped (missing country): {missing_country}"))

            # Reset Postgres sequences after explicit ID inserts to avoid duplicate key errors
            try:
                seq_sql = connection.ops.sequence_reset_sql(no_style(), [Country, State, City])
                with connection.cursor() as cursor:
                    for sql in seq_sql:
                        cursor.execute(sql)
                self.stdout.write(self.style.SUCCESS("Reset DB sequences for Country, State, City"))
            except Exception as seq_err:
                self.stdout.write(self.style.WARNING(f"Sequence reset skipped: {seq_err}"))

        except Exception as e:
            self.stdout.write(self.style.ERROR(f"Error: {str(e)}"))

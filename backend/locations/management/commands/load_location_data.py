import json
from pathlib import Path
from django.core.management.base import BaseCommand
from locations.models import Country, State, City
from django.db import transaction

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

            with transaction.atomic():
                for s in states_data:
                    country_id = s.get("country_id")
                    country = Country.objects.filter(id=country_id).first()
                    if not country:
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

        except Exception as e:
            self.stdout.write(self.style.ERROR(f"Error: {str(e)}"))

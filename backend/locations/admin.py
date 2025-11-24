from django.contrib import admin
from django.conf import settings
from .models import Country, State, City

# Hide Locations (Country/State/City) from Django Admin by default
# Set HIDE_LOCATIONS_IN_ADMIN = False in settings.py to re-enable.
HIDE_LOCATIONS_IN_ADMIN = getattr(settings, "HIDE_LOCATIONS_IN_ADMIN", True)

if not HIDE_LOCATIONS_IN_ADMIN:

    @admin.register(Country)
    class CountryAdmin(admin.ModelAdmin):
        list_display = ("name",)  # only show 'name' since there's no iso_code


    @admin.register(State)
    class StateAdmin(admin.ModelAdmin):
        list_display = ("name", "country")
        list_filter = ("country",)


    @admin.register(City)
    class CityAdmin(admin.ModelAdmin):
        list_display = ("name", "state")
        list_filter = ("state",)

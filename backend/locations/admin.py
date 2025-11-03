from django.contrib import admin
from .models import Country, State, City


@admin.register(Country)
class CountryAdmin(admin.ModelAdmin):
    list_display = ('name',)  # ✅ only show 'name' since there's no iso_code


@admin.register(State)
class StateAdmin(admin.ModelAdmin):
    list_display = ('name', 'country')
    list_filter = ('country',)


@admin.register(City)
class CityAdmin(admin.ModelAdmin):
    list_display = ('name', 'state')
    list_filter = ('state',)

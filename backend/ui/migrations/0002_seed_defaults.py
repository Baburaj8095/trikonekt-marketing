from django.db import migrations


def seed_defaults(apps, schema_editor):
    UIPageConfig = apps.get_model("ui", "UIPageConfig")

    # Default ecommerce_home config
    home_config = {
        "sections": [
            {
                "id": "hero",
                "type": "hero_banner",
                "title": "",
                "data_source": {"endpoint": "/api/uploads/hero-banners/"},
                "enabled": True,
            },
            {
                "id": "promotions",
                "type": "promotion_strip",
                "title": "Offers for you",
                "data_source": {"endpoint": "/api/uploads/promotions/"},
                "enabled": True,
            },
            {
                "id": "categories",
                "type": "category_grid",
                "title": "Shop by Category",
                "data_source": {"endpoint": "/api/business/tri/apps/"},
                "enabled": True,
            },
            {
                "id": "nearby_shops",
                "type": "nearby_shops",
                "title": "Nearby Shops",
                "data_source": {"endpoint": "/api/shops/nearby/", "params": {"radius_km": 5, "limit": 20}},
                "enabled": True,
            },
        ]
    }

    UIPageConfig.objects.get_or_create(
        key="ecommerce_home",
        defaults={
            "title": "",
            "is_active": True,
            "version": 1,
            "config": home_config,
        },
    )

    # Default category page config
    category_default_config = {
        "sections": [
            {
                "id": "products",
                "type": "product_grid",
                "title": "",
                "data_source": {"endpoint": "/api/products", "params": {}},
                "enabled": True,
            }
        ]
    }

    UIPageConfig.objects.get_or_create(
        key="category_default",
        defaults={
            "title": "",
            "is_active": True,
            "version": 1,
            "config": category_default_config,
        },
    )


def unseed_defaults(apps, schema_editor):
    UIPageConfig = apps.get_model("ui", "UIPageConfig")
    UIPageConfig.objects.filter(key__in=["ecommerce_home", "category_default"]).delete()


class Migration(migrations.Migration):

    dependencies = [
        ("ui", "0001_initial"),
    ]

    operations = [
        migrations.RunPython(seed_defaults, unseed_defaults),
    ]

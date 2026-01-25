from django.db import models
from django.core.exceptions import ValidationError


class UIPageConfig(models.Model):
    """
    Config-driven UI page definition.
    key examples:
      - "ecommerce_home"
      - "category_default"
      - "category:<slug>" (e.g., "category:electronics")
    config JSON shape:
      {
        "sections": [
          {
            "id": "hero",
            "type": "hero_banner",
            "title": "",
            "data_source": {
              "endpoint": "/api/uploads/hero-banners/",
              "params": { ... }   # optional
            },
            "enabled": true       # optional (default true)
          },
          ...
        ]
      }
    """
    key = models.CharField(max_length=150, unique=True, db_index=True)
    title = models.CharField(max_length=200, blank=True, default="")
    is_active = models.BooleanField(default=True, db_index=True)
    version = models.IntegerField(default=1)
    config = models.JSONField(default=dict)
    created_at = models.DateTimeField(auto_now_add=True, db_index=True)
    updated_at = models.DateTimeField(auto_now=True)

    class Meta:
        ordering = ["-updated_at", "-id"]
        verbose_name = "UI Page Config"
        verbose_name_plural = "UI Page Configs"

    def __str__(self):
        return f"{self.key} (v{self.version})"

    def clean(self):
        """
        Validation rules:
        - config must be dict
        - config["sections"] must be list
        - each section must have:
          - id (string)
          - type (string)
          - title (optional string)
          - data_source.endpoint (string)
          - data_source.params (optional dict)
          - enabled (optional bool, default true)
        """
        cfg = self.config
        if not isinstance(cfg, dict):
            raise ValidationError({"config": "config must be a dict"})
        sections = cfg.get("sections")
        if sections is None or not isinstance(sections, list):
            raise ValidationError({"config": "config.sections must be a list"})
        for idx, sec in enumerate(sections):
            if not isinstance(sec, dict):
                raise ValidationError({"config": f"sections[{idx}] must be an object"})
            sid = sec.get("id")
            stype = sec.get("type")
            if not isinstance(sid, str) or not sid.strip():
                raise ValidationError({"config": f'sections[{idx}].id must be a non-empty string'})
            if not isinstance(stype, str) or not stype.strip():
                raise ValidationError({"config": f'sections[{idx}].type must be a non-empty string'})
            if "title" in sec and not (sec["title"] is None or isinstance(sec["title"], str)):
                raise ValidationError({"config": f'sections[{idx}].title must be a string'})
            ds = sec.get("data_source")
            if not isinstance(ds, dict):
                raise ValidationError({"config": f'sections[{idx}].data_source must be an object'})
            ep = ds.get("endpoint")
            if not isinstance(ep, str) or not ep.strip():
                raise ValidationError({"config": f'sections[{idx}].data_source.endpoint must be a non-empty string'})
            if "params" in ds and not (ds["params"] is None or isinstance(ds["params"], dict)):
                raise ValidationError({"config": f'sections[{idx}].data_source.params must be a dict when provided'})
            if "enabled" in sec and not isinstance(sec.get("enabled"), bool):
                raise ValidationError({"config": f'sections[{idx}].enabled must be a boolean when provided'})

    def save(self, *args, **kwargs):
        self.full_clean()
        return super().save(*args, **kwargs)

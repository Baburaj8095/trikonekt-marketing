from django.contrib import admin
from rest_framework import serializers, viewsets, permissions, routers, filters
from rest_framework.decorators import action, api_view, permission_classes
from rest_framework.response import Response
from rest_framework.permissions import IsAuthenticated
from django_filters.rest_framework import DjangoFilterBackend
from .permissions import IsAdminOrStaff
from django.core.cache import cache


def build_serializer(model):
    """
    Create a basic ModelSerializer for the given model with a 'repr' field for __str__.
    """
    class DynamicSerializer(serializers.ModelSerializer):
        repr = serializers.SerializerMethodField()

        def get_repr(self, obj):
            try:
                return str(obj)
            except Exception:
                return f"{model.__name__}({getattr(obj, 'pk', None)})"

        class Meta:
            model = model
            fields = "__all__"

    return DynamicSerializer


def _normalize_list_filter(list_filter_value):
    """
    Convert Django ModelAdmin.list_filter into a list of strings that DRF filter backend can consume.
    Supports:
      - field name strings
      - Simple spec objects/classes that expose `parameter_name`
    Skips complex unsupported filters silently.
    """
    out = []
    for item in (list_filter_value or []):
        if isinstance(item, str):
            out.append(item)
        else:
            # try attribute 'parameter_name' (used by some filter specs)
            param = getattr(item, "parameter_name", None)
            if isinstance(param, str):
                out.append(param)
            # else ignore complex items
    return out


def build_viewset(model, modeladmin):
    Serializer = build_serializer(model)

    class DynamicViewSet(viewsets.ModelViewSet):
        queryset = model.objects.all().order_by("-pk")
        serializer_class = Serializer
        permission_classes = [permissions.DjangoModelPermissions]
        filter_backends = [filters.SearchFilter, filters.OrderingFilter, DjangoFilterBackend]

        # Mirror ModelAdmin configuration for search/ordering/filters where possible
        search_fields = list(getattr(modeladmin, "search_fields", []))
        ordering_fields = "__all__"
        filterset_fields = _normalize_list_filter(getattr(modeladmin, "list_filter", []))

        # Lightweight page/page_size pagination so frontend can use server-side DataGrid
        def list(self, request, *args, **kwargs):
            qs = self.filter_queryset(self.get_queryset())
            try:
                page = int(request.query_params.get("page") or 1)
            except Exception:
                page = 1
            try:
                page_size = int(request.query_params.get("page_size") or 25)
            except Exception:
                page_size = 25
            page = max(1, page)
            page_size = max(1, min(page_size, 200))  # cap to avoid huge pages

            total = qs.count()
            start = (page - 1) * page_size
            end = start + page_size
            serializer = self.get_serializer(qs[start:end], many=True)
            return Response({"count": total, "results": serializer.data})

        @action(detail=False, methods=["post"])
        def bulk_action(self, request):
            """
            Basic bulk actions support. Payload:
              { "action": "bulk_delete", "ids": [1,2,3] }
            Extend this as needed to map custom ModelAdmin actions.
            """
            action_name = (request.data or {}).get("action")
            ids = (request.data or {}).get("ids") or []
            try:
                ids = [int(i) for i in ids]
            except Exception:
                ids = []

            qs = self.get_queryset().filter(pk__in=ids)

            # bulk delete
            if action_name == "bulk_delete":
                perm = f"{model._meta.app_label}.delete_{model._meta.model_name}"
                if not request.user.has_perm(perm):
                    return Response({"detail": "Permission denied"}, status=403)
                deleted = qs.delete()
                return Response({"deleted": deleted[0]})

            return Response({"detail": "Unsupported action"}, status=400)

    return DynamicViewSet


# Build a router under /api/admin/dynamic/<app>/<model>/
router = routers.DefaultRouter()
for model, modeladmin in admin.site._registry.items():
    prefix = f"dynamic/{model._meta.app_label}/{model._meta.model_name}"
    router.register(prefix, build_viewset(model, modeladmin), basename=f"{model._meta.app_label}-{model._meta.model_name}")


def field_meta_from_serializer(serializer_class):
    """
    Introspect serializer fields to produce UI metadata.

    Performance notes:
    - Avoid enumerating choices for relation fields (PrimaryKeyRelatedField/SlugRelatedField),
      as accessing `.choices` triggers a queryset evaluation over entire table.
    - Only include choices for small, explicit ChoiceField-like fields.
    """
    s = serializer_class()
    meta = []
    for name, field in s.fields.items():
        f = {
            "name": name,
            "type": field.__class__.__name__,
            "read_only": getattr(field, "read_only", False),
            "required": getattr(field, "required", False),
            "label": getattr(field, "label", name),
        }

        # Include help_text when available
        try:
            ht = getattr(field, "help_text", "")
            if ht:
                f["help_text"] = str(ht)
        except Exception:
            pass

        # choices (skip for relation fields to prevent heavy DB scans)
        try:
            is_relation = hasattr(field, "queryset") or f["type"] in ("PrimaryKeyRelatedField", "SlugRelatedField")
            if not is_relation:
                choices = getattr(field, "choices", None)
                if choices:
                    # Attempt to materialize small static choices only
                    # Many ChoiceFields expose dict-like `.choices`
                    try:
                        items = list(choices.items())
                        # If it's unreasonably large, skip to avoid UI bloat
                        if len(items) <= 200:
                            f["choices"] = items
                    except Exception:
                        try:
                            items = [(k, v) for k, v in choices]
                            if len(items) <= 200:
                                f["choices"] = items
                        except Exception:
                            pass
        except Exception:
            pass

        meta.append(f)
    return meta


def _build_admin_meta_static():
    payload = []
    for model, modeladmin in admin.site._registry.items():
        ser = build_serializer(model)

        # Gather action names safely from explicit actions (callables or strings)
        try:
            explicit_actions = getattr(modeladmin, "actions", None) or []
            explicit_names = []
            for a in explicit_actions:
                if isinstance(a, str):
                    explicit_names.append(a)
                else:
                    explicit_names.append(getattr(a, "__name__", str(a)))
        except Exception:
            explicit_names = []

        # Discovered actions; request-independent to keep this static segment cacheable
        try:
            get_actions_dict = modeladmin.get_actions(None)
            discovered_names = list((get_actions_dict or {}).keys())
        except Exception:
            discovered_names = []

        actions = sorted(set(explicit_names + discovered_names + ["bulk_delete"]))

        payload.append({
            "app_label": model._meta.app_label,
            "model": model._meta.model_name,
            "verbose_name": getattr(model._meta, "verbose_name_plural", model.__name__),
            "verbose_name_singular": getattr(model._meta, "verbose_name", model.__name__),
            "route": f"admin/dynamic/{model._meta.app_label}/{model._meta.model_name}/",
            "list_display": list(getattr(modeladmin, "list_display", ["__str__"])),
            "search_fields": list(getattr(modeladmin, "search_fields", [])),
            "list_filter": _normalize_list_filter(getattr(modeladmin, "list_filter", [])),
            "actions": actions,
            # Static field metadata (can be heavy): safe to cache
            "fields": field_meta_from_serializer(ser),
        })
    return payload


ADMIN_META_CACHE_KEY = "admin_meta_static_v1"
ADMIN_META_TTL = 300  # seconds

@api_view(["GET"])
@permission_classes([IsAdminOrStaff])
def admin_meta(request):
    """
    Return metadata for all admin-registered models:
      - app_label, model, verbose names
      - API route (to the dynamic viewset)
      - list_display, search_fields, list_filter, actions
      - static field metadata (cached)
      - per-request permissions merged into cached static payload
    """
    static = cache.get(ADMIN_META_CACHE_KEY)
    if static is None:
        static = _build_admin_meta_static()
        cache.set(ADMIN_META_CACHE_KEY, static, ADMIN_META_TTL)

    # Merge per-user permissions quickly
    user = getattr(request, "user", None)
    models = []
    for m in static:
        try:
            app_label = m["app_label"]
            model_name = m["model"]
            perm_view = user.has_perm(f"{app_label}.view_{model_name}")
            perm_add = user.has_perm(f"{app_label}.add_{model_name}")
            perm_change = user.has_perm(f"{app_label}.change_{model_name}")
            perm_delete = user.has_perm(f"{app_label}.delete_{model_name}")
        except Exception:
            perm_view = perm_add = perm_change = perm_delete = False
        mm = dict(m)
        mm["permissions"] = {
            "view": perm_view,
            "add": perm_add,
            "change": perm_change,
            "delete": perm_delete,
        }
        models.append(mm)

    return Response({"models": models})

# Lightweight summary (no fields) to make first call fast
def _build_admin_meta_summary():
    payload = []
    for model, modeladmin in admin.site._registry.items():
        # Gather action names safely from explicit actions (callables or strings)
        try:
            explicit_actions = getattr(modeladmin, "actions", None) or []
            explicit_names = []
            for a in explicit_actions:
                if isinstance(a, str):
                    explicit_names.append(a)
                else:
                    explicit_names.append(getattr(a, "__name__", str(a)))
        except Exception:
            explicit_names = []

        # Discovered actions; request-independent to keep summary cacheable
        try:
            get_actions_dict = modeladmin.get_actions(None)
            discovered_names = list((get_actions_dict or {}).keys())
        except Exception:
            discovered_names = []

        actions = sorted(set(explicit_names + discovered_names + ["bulk_delete"]))

        payload.append({
            "app_label": model._meta.app_label,
            "model": model._meta.model_name,
            "verbose_name": getattr(model._meta, "verbose_name_plural", model.__name__),
            "verbose_name_singular": getattr(model._meta, "verbose_name", model.__name__),
            "route": f"admin/dynamic/{model._meta.app_label}/{model._meta.model_name}/",
            "list_display": list(getattr(modeladmin, "list_display", ["__str__"])),
            "search_fields": list(getattr(modeladmin, "search_fields", [])),
            "list_filter": _normalize_list_filter(getattr(modeladmin, "list_filter", [])),
            "actions": actions,
        })
    return payload


ADMIN_META_SUMMARY_CACHE_KEY = "admin_meta_summary_v1"
ADMIN_META_FIELDS_CACHE_KEY_PREFIX = "admin_meta_fields_v1"
ADMIN_META_SUMMARY_TTL = 300  # 5 minutes
ADMIN_META_FIELDS_TTL = 600   # 10 minutes

@api_view(["GET"])
@permission_classes([IsAdminOrStaff])
def admin_meta_summary(request):
    """
    Fast summary for admin models without heavy 'fields' metadata.
    Per-user permissions merged per request.
    """
    summary = cache.get(ADMIN_META_SUMMARY_CACHE_KEY)
    if summary is None:
        summary = _build_admin_meta_summary()
        cache.set(ADMIN_META_SUMMARY_CACHE_KEY, summary, ADMIN_META_SUMMARY_TTL)

    user = getattr(request, "user", None)
    models = []
    for m in summary:
        try:
            app_label = m["app_label"]
            model_name = m["model"]
            perm_view = user.has_perm(f"{app_label}.view_{model_name}")
            perm_add = user.has_perm(f"{app_label}.add_{model_name}")
            perm_change = user.has_perm(f"{app_label}.change_{model_name}")
            perm_delete = user.has_perm(f"{app_label}.delete_{model_name}")
        except Exception:
            perm_view = perm_add = perm_change = perm_delete = False
        mm = dict(m)
        mm["permissions"] = {
            "view": perm_view,
            "add": perm_add,
            "change": perm_change,
            "delete": perm_delete,
        }
        models.append(mm)
    return Response({"models": models})


@api_view(["GET"])
@permission_classes([IsAdminOrStaff])
def admin_meta_fields(request, app_label: str, model_name: str):
    """
    Return field metadata for a single model (cached).
    """
    # find model from registry
    target_model = None
    for model, _admin in admin.site._registry.items():
        if model._meta.app_label == app_label and model._meta.model_name == model_name:
            target_model = model
            break
    if target_model is None:
        return Response({"detail": "Model not found"}, status=404)

    cache_key = f"{ADMIN_META_FIELDS_CACHE_KEY_PREFIX}:{app_label}.{model_name}"
    fields = cache.get(cache_key)
    if fields is None:
        ser = build_serializer(target_model)
        fields = field_meta_from_serializer(ser)
        cache.set(cache_key, fields, ADMIN_META_FIELDS_TTL)
    return Response({"app_label": app_label, "model": model_name, "fields": fields})

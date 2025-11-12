from django.contrib import admin
from rest_framework import serializers, viewsets, permissions, routers, filters
from rest_framework.decorators import action, api_view, permission_classes
from rest_framework.response import Response
from rest_framework.permissions import IsAuthenticated
from django_filters.rest_framework import DjangoFilterBackend


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
        # choices
        choices = getattr(field, "choices", None)
        if choices:
            try:
                f["choices"] = list(choices.items())
            except Exception:
                # choices can be a dict-like
                try:
                    f["choices"] = [(k, v) for k, v in choices]
                except Exception:
                    pass
        meta.append(f)
    return meta


@api_view(["GET"])
@permission_classes([IsAuthenticated])
def admin_meta(request):
    """
    Return metadata for all admin-registered models:
      - app_label, model, verbose names
      - API route (to the dynamic viewset)
      - list_display, search_fields, list_filter, actions
      - serializer field metadata (for form generation)
    """
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

        # Plus discovered actions from get_actions (returns dict: name -> (func, name, desc))
        try:
            get_actions_dict = modeladmin.get_actions(request)
            discovered_names = list((get_actions_dict or {}).keys())
        except Exception:
            discovered_names = []

        actions = sorted(set(explicit_names + discovered_names + ["bulk_delete"]))
        # Compute DjangoModelPermissions for current user to drive frontend UI
        try:
            app_label = model._meta.app_label
            model_name = model._meta.model_name
            perm_view = request.user.has_perm(f"{app_label}.view_{model_name}")
            perm_add = request.user.has_perm(f"{app_label}.add_{model_name}")
            perm_change = request.user.has_perm(f"{app_label}.change_{model_name}")
            perm_delete = request.user.has_perm(f"{app_label}.delete_{model_name}")
        except Exception:
            perm_view = perm_add = perm_change = perm_delete = False

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
            "fields": field_meta_from_serializer(ser),
            "permissions": {
                "view": perm_view,
                "add": perm_add,
                "change": perm_change,
                "delete": perm_delete,
            },
        })
    return Response({"models": payload})

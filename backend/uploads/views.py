from rest_framework import generics, permissions, status
from rest_framework.response import Response
from rest_framework.exceptions import PermissionDenied, ValidationError
from rest_framework.views import APIView
from django.db.models import Q, Sum
from accounts.models import CustomUser
from .models import FileUpload, DashboardCard, LuckyDrawSubmission, JobApplication, HomeCard, LuckyCouponAssignment, AgencyCouponQuota
from .serializers import (
    FileUploadSerializer,
    DashboardCardSerializer,
    LuckyDrawSubmissionSerializer,
    JobApplicationSerializer,
    HomeCardSerializer,
    LuckyCouponAssignmentSerializer,
)
from coupons.models import CouponSubmission as RedeemSubmission, Coupon
from django.utils import timezone
import os
from django.conf import settings
from django.core.files.base import File, ContentFile
from urllib.request import urlopen
import io
try:
    from cloudinary_storage.storage import MediaCloudinaryStorage
except Exception:
    MediaCloudinaryStorage = None

def _normalize_media_relpath(name: str) -> str:
    """
    Normalize a stored file 'name' or URL path segment by removing any leading slashes
    and stripping a leading 'media/' or 'media\' prefix to avoid double-joining with MEDIA_ROOT.
    """
    p = str(name or "").lstrip("/\\")
    if p.startswith("media/"):
        return p[6:]
    if p.startswith("media\\"):
        return p[6:]
    return p

class StorageInfoView(APIView):
    permission_classes = [permissions.AllowAny]

    def get(self, request):
        default_storage = getattr(settings, "DEFAULT_FILE_STORAGE", None)
        cloudinary_url_set = bool(os.environ.get("CLOUDINARY_URL"))
        media_url = getattr(settings, "MEDIA_URL", None)
        return Response({
            "default_file_storage": default_storage,
            "cloudinary_url_set": cloudinary_url_set,
            "media_url": media_url,
            "using_cloudinary": ("cloudinary" in (default_storage or "")),
        })
        
        
class DebugReuploadHomeCardView(APIView):
    permission_classes = [permissions.AllowAny]

    def post(self, request, pk):
        # Restrict to local/dev usage only
        if not getattr(settings, "DEBUG", False):
            return Response({"detail": "Not available in production."}, status=status.HTTP_403_FORBIDDEN)
        try:
            obj = HomeCard.objects.get(pk=pk)
        except HomeCard.DoesNotExist:
            return Response({"detail": "Not found."}, status=status.HTTP_404_NOT_FOUND)

        try:
            old_url = getattr(obj.image, "url", "")
        except Exception:
            old_url = ""

        name = getattr(obj.image, "name", None)
        if not name:
            return Response({"detail": "No image set on this record."}, status=status.HTTP_400_BAD_REQUEST)

        # If already Cloudinary, skip
        if "res.cloudinary.com" in (old_url or "") or "cloudinary" in (old_url or ""):
            return Response({"status": "already_cloudinary", "url": old_url})

        # Try filesystem first; fallback to storage open
        file_handle = None
        rel = _normalize_media_relpath(name)
        fs_path = name if os.path.isabs(name) else os.path.join(settings.MEDIA_ROOT, rel)
        try:
            file_handle = open(fs_path, "rb")
        except Exception:
            try:
                file_handle = obj.image.open("rb")
            except Exception as e:
                # Fallback: fetch the current media URL over HTTP and re-save to Cloudinary
                try:
                    rel_for_url = _normalize_media_relpath(name or old_url or "")
                    full_url = old_url if (old_url and str(old_url).startswith("http")) else request.build_absolute_uri(f"/media/{rel_for_url}")
                    data = urlopen(full_url).read()
                    file_handle = io.BytesIO(data)
                except Exception as http_err:
                    return Response(
                        {
                            "status": "not_found",
                            "detail": str(e),
                            "http_error": str(http_err),
                            "name": name,
                            "fs_path": fs_path,
                            "old_url": old_url,
                        },
                        status=status.HTTP_404_NOT_FOUND,
                    )

        try:
            # Save under a new name to ensure Cloudinary creates a fresh asset
            base, ext = os.path.splitext(name or "homecard")
            ext = ext or ".png"
            new_name = f"uploads/homecard/reuploaded_{obj.pk}{ext}"
            if MediaCloudinaryStorage:
                storage = MediaCloudinaryStorage()
                saved_name = storage.save(new_name, File(file_handle))
                obj.image.name = saved_name
                obj.save(update_fields=["image"])
            else:
                obj.image.save(new_name, File(file_handle), save=True)
            try:
                file_handle.close()
            except Exception:
                pass
            try:
                if MediaCloudinaryStorage and saved_name:
                    try:
                        new_url = MediaCloudinaryStorage().url(saved_name)
                    except Exception:
                        new_url = getattr(obj.image, "url", "")
                else:
                    new_url = getattr(obj.image, "url", "")
            except Exception:
                new_url = ""
            return Response({"status": "uploaded", "old_url": old_url, "new_url": new_url, "name": new_name, "forced_storage": bool(MediaCloudinaryStorage)})
        except Exception as e:
            try:
                if file_handle:
                    file_handle.close()
            except Exception:
                pass
            return Response({"status": "error", "detail": str(e)}, status=status.HTTP_500_INTERNAL_SERVER_ERROR)


class DebugReuploadAllHomeCardsView(APIView):
    permission_classes = [permissions.AllowAny]

    def post(self, request):
        if not getattr(settings, "DEBUG", False):
            return Response({"detail": "Not available in production."}, status=status.HTTP_403_FORBIDDEN)

        results = []
        qs = HomeCard.objects.all().order_by("id")
        for obj in qs:
            try:
                old_url = getattr(obj.image, "url", "")
            except Exception:
                old_url = ""
            name = getattr(obj.image, "name", None)

            if not name:
                results.append({"id": obj.pk, "status": "missing", "detail": "No image set"})
                continue

            # Skip if already Cloudinary
            if ("res.cloudinary.com" in (old_url or "")) or ("cloudinary" in (old_url or "")):
                results.append({"id": obj.pk, "status": "already_cloudinary", "url": old_url})
                continue

            file_handle = None
            rel = _normalize_media_relpath(name)
            fs_path = name if os.path.isabs(name) else os.path.join(settings.MEDIA_ROOT, rel)
            try:
                file_handle = open(fs_path, "rb")
            except Exception:
                try:
                    file_handle = obj.image.open("rb")
                except Exception as e:
                    # Fallback: fetch via HTTP from current media URL
                    try:
                        rel_for_url = _normalize_media_relpath(name or old_url or "")
                        full_url = old_url if (old_url and str(old_url).startswith("http")) else request.build_absolute_uri(f"/media/{rel_for_url}")
                        data = urlopen(full_url).read()
                        file_handle = io.BytesIO(data)
                    except Exception as http_err:
                        results.append({
                            "id": obj.pk,
                            "status": "not_found",
                            "detail": str(e),
                            "http_error": str(http_err),
                            "name": name,
                            "fs_path": fs_path,
                            "old_url": old_url,
                        })
                        continue

            try:
                base, ext = os.path.splitext(name or "homecard")
                ext = ext or ".png"
                new_name = f"uploads/homecard/reuploaded_{obj.pk}{ext}"
                if MediaCloudinaryStorage:
                    storage = MediaCloudinaryStorage()
                    saved_name = storage.save(new_name, File(file_handle))
                    obj.image.name = saved_name
                    obj.save(update_fields=["image"])
                else:
                    obj.image.save(new_name, File(file_handle), save=True)
                try:
                    file_handle.close()
                except Exception:
                    pass
                try:
                    if MediaCloudinaryStorage and saved_name:
                        try:
                            new_url = MediaCloudinaryStorage().url(saved_name)
                        except Exception:
                            new_url = getattr(obj.image, "url", "")
                    else:
                        new_url = getattr(obj.image, "url", "")
                except Exception:
                    new_url = ""
                results.append({"id": obj.pk, "status": "uploaded", "old_url": old_url, "new_url": new_url, "name": new_name, "forced_storage": bool(MediaCloudinaryStorage)})
            except Exception as e:
                try:
                    if file_handle:
                        file_handle.close()
                except Exception:
                    pass
                results.append({"id": obj.pk, "status": "error", "detail": str(e)})
                continue

        return Response({"count": len(results), "results": results})


class FileUploadView(generics.ListCreateAPIView):
    serializer_class = FileUploadSerializer
    permission_classes = [permissions.AllowAny]

    def get_queryset(self):
        user = self.request.user
        if getattr(user, "is_authenticated", False):
            # Staff can see all
            if getattr(user, "is_staff", False):
                return FileUpload.objects.all()
            role = getattr(user, "role", None)
            # Agency: limited to uploads by users within agency's pincode
            if role == "agency":
                pc = (getattr(user, "pincode", "") or "").strip()
                if pc:
                    return FileUpload.objects.filter(user__pincode__iexact=pc)
                return FileUpload.objects.none()
            # Employees and others: only their own uploads
            return FileUpload.objects.filter(user=user)
        # Unauthenticated: no listing
        return FileUpload.objects.none()

    def perform_create(self, serializer):
        user = self.request.user
        if getattr(user, "is_authenticated", False):
            serializer.save(user=user)
        else:
            # Allow uploads without authentication in development
            serializer.save(user=None)


class LuckyDrawHistoryTREView(generics.ListAPIView):
    serializer_class = LuckyDrawSubmissionSerializer
    permission_classes = [permissions.IsAuthenticated]

    def get_queryset(self):
        user = self.request.user
        if getattr(user, "role", None) != "employee":
            return LuckyDrawSubmission.objects.none()
        username = (getattr(user, "username", "") or "")
        uid = (getattr(user, "unique_id", "") or "")
        sid = (getattr(user, "sponsor_id", "") or "")
        return LuckyDrawSubmission.objects.filter(
            Q(assigned_tre=user) |
            Q(tre_reviewer=user) |
            Q(tr_emp_id__iexact=username) |
            Q(tr_emp_id__iexact=uid) |
            Q(tr_emp_id__iexact=sid)
        ).order_by("-created_at")


class LuckyCouponAssignmentView(generics.ListCreateAPIView):
    serializer_class = LuckyCouponAssignmentSerializer
    permission_classes = [permissions.IsAuthenticated]

    def get_queryset(self):
        user = self.request.user
        if getattr(user, "is_staff", False):
            return LuckyCouponAssignment.objects.all().order_by("-created_at")
        role = getattr(user, "role", None)
        category = getattr(user, "category", "") or ""
        is_agency_actor = (role == "agency") or category.startswith("agency_")
        if is_agency_actor:
            return LuckyCouponAssignment.objects.filter(
                Q(agency=user) | Q(created_by=user)
            ).order_by("-created_at")
        if role == "employee":
            return LuckyCouponAssignment.objects.filter(employee=user).order_by("-created_at")
        return LuckyCouponAssignment.objects.none()

    def perform_create(self, serializer):
        user = self.request.user
        role = getattr(user, "role", None)
        category = getattr(user, "category", "") or ""
        is_agency_actor = (role == "agency") or category.startswith("agency_")
        if not is_agency_actor:
            raise PermissionDenied("Only agency users can assign coupons.")

        try:
            emp_id = int(self.request.data.get("employee"))
        except Exception:
            raise ValidationError({"employee": ["Employee is required."]})

        # Accept employees registered by this agency OR within the agency's pincode; require employee role/category
        agency_pin = (getattr(user, "pincode", "") or "").strip()
        employee = (
            CustomUser.objects
            .filter(id=emp_id)
            .filter(Q(role="employee") | Q(category="employee"))
            .filter(Q(registered_by=user) | (Q(pincode__iexact=agency_pin) if agency_pin else Q(pk__in=[])))
            .first()
        )
        if not employee:
            raise ValidationError({"employee": ["Invalid employee. Ensure the employee is in your pincode or registered under your agency."]})

        quantity = self.request.data.get("quantity")
        try:
            qty = int(quantity)
        except Exception:
            raise ValidationError({"quantity": ["Quantity must be an integer."]})
        if qty <= 0:
            raise ValidationError({"quantity": ["Quantity must be greater than zero."]})

        # Enforce agency quota
        quota_obj = AgencyCouponQuota.objects.filter(agency=user).first()
        if quota_obj is None:
            raise ValidationError({"detail": "No quota assigned to your agency. Please contact admin."})
        already_assigned = LuckyCouponAssignment.objects.filter(agency=user).aggregate(total=Sum("quantity")).get("total") or 0
        remaining = int(quota_obj.quota) - int(already_assigned)
        if remaining < 0:
            remaining = 0
        if qty > remaining:
            raise ValidationError({"quantity": [f"Exceeds remaining quota. Remaining: {remaining}, requested: {qty}."]})

        serializer.save(
            agency=user,
            created_by=user,
            employee=employee,
            quantity=qty,
            note=self.request.data.get("note", "") or "",
            channel="physical",
        )


class LuckyCouponAssignmentDetailView(generics.RetrieveUpdateAPIView):
    serializer_class = LuckyCouponAssignmentSerializer
    permission_classes = [permissions.IsAuthenticated]
    queryset = LuckyCouponAssignment.objects.select_related("employee", "agency", "created_by")

    def get_object(self):
        obj = super().get_object()
        user = self.request.user
        if getattr(user, "is_staff", False):
            return obj
        role = getattr(user, "role", None)
        category = getattr(user, "category", "") or ""
        is_agency_actor = (role == "agency") or category.startswith("agency_")
        if role == "employee" and obj.employee_id == getattr(user, "id", None):
            return obj
        if is_agency_actor and (obj.agency_id == getattr(user, "id", None) or obj.created_by_id == getattr(user, "id", None)):
            return obj
        raise PermissionDenied("Not permitted.")

    def update(self, request, *args, **kwargs):
        partial = kwargs.pop("partial", True)
        instance = self.get_object()
        data = request.data or {}
        # Only allow sold_count updates
        allowed_fields = {"sold_count"}
        payload = {k: v for k, v in data.items() if k in allowed_fields}
        if "sold_count" not in payload:
            return Response({"detail": "Only sold_count can be updated."}, status=status.HTTP_400_BAD_REQUEST)
        try:
            sold = int(payload["sold_count"])
        except Exception:
            raise ValidationError({"sold_count": ["Must be an integer."]})
        if sold < 0:
            raise ValidationError({"sold_count": ["Must be >= 0."]})
        qty = int(getattr(instance, "quantity", 0) or 0)
        if sold > qty:
            raise ValidationError({"sold_count": [f"Cannot exceed assigned quantity ({qty})."]})
        instance.sold_count = sold
        instance.save(update_fields=["sold_count"])
        serializer = self.get_serializer(instance)
        return Response(serializer.data)

class DashboardCardList(generics.ListAPIView):
    serializer_class = DashboardCardSerializer
    permission_classes = [permissions.AllowAny]

    def get_queryset(self):
        qs = DashboardCard.objects.filter(is_active=True).order_by("-updated_at", "-created_at")
        # Prefer role from authenticated user; fallback to ?role= param (useful in dev)
        role = getattr(getattr(self.request, "user", None), "role", None) or self.request.query_params.get("role")
        if role:
            qs = qs.filter(Q(role__iexact=role) | Q(role__isnull=True) | Q(role=""))
        return qs


class HomeCardList(generics.ListAPIView):
    serializer_class = HomeCardSerializer
    permission_classes = [permissions.AllowAny]

    def get_queryset(self):
        return HomeCard.objects.filter(is_active=True).order_by("order", "-created_at")


class LuckyDrawSubmissionView(generics.ListCreateAPIView):
    serializer_class = LuckyDrawSubmissionSerializer
    permission_classes = [permissions.AllowAny]

    def get_queryset(self):
        user = self.request.user
        if getattr(user, "is_authenticated", False):
            # Staff can see all
            if getattr(user, "is_staff", False):
                return LuckyDrawSubmission.objects.all().order_by("-created_at")
            role = getattr(user, "role", None)
            category = getattr(user, "category", "") or ""
            # Agency and agency_* categories: restricted to their registered pincode
            is_agency_actor = (role == "agency") or category.startswith("agency_")
            if is_agency_actor:
                pc = (getattr(user, "pincode", "") or "").strip()
                if pc:
                    return LuckyDrawSubmission.objects.filter(pincode__iexact=pc).order_by("-created_at")
                return LuckyDrawSubmission.objects.none()
            # Employees: only their own
            if role == "employee":
                return LuckyDrawSubmission.objects.filter(user=user).order_by("-created_at")
            # Default: only their own
            return LuckyDrawSubmission.objects.filter(user=user).order_by("-created_at")
        return LuckyDrawSubmission.objects.none()

    def perform_create(self, serializer):
        # Admin-controlled toggle: require active DashboardCard 'lucky_draw'
        enabled = DashboardCard.objects.filter(is_active=True).filter(
            Q(key__iexact="lucky_draw") | Q(key__iexact="lucky-draw")
        ).exists()
        if not enabled:
            raise PermissionDenied("Lucky draw participation is currently disabled by admin.")

        # Resolve TRE assignee using provided tr_emp_id (match username/unique_id/sponsor_id)
        emp_identifier = (self.request.data.get("tr_emp_id") or "").strip()
        tre_user = None
        if emp_identifier:
            tre_user = (
                CustomUser.objects.filter(role="employee")
                .filter(Q(username__iexact=emp_identifier) | Q(unique_id=emp_identifier) | Q(sponsor_id__iexact=emp_identifier))
                .first()
            )
        if emp_identifier and tre_user is None:
            raise ValidationError({"tr_emp_id": ["Invalid TRE identifier."]})

        user = self.request.user
        if getattr(user, "is_authenticated", False):
            serializer.save(
                user=user,
                username=getattr(user, "username", "") or "",
                role=getattr(user, "role", "") or "",
                phone=getattr(user, "phone", "") or "",
                assigned_tre=tre_user,
            )
        else:
            # Dev: capture snapshots from payload when unauthenticated
            username = self.request.data.get("username", "")
            role = self.request.data.get("role", "")
            phone = self.request.data.get("phone", "")
            serializer.save(user=None, username=username, role=role, phone=phone, assigned_tre=tre_user)


class LuckyDrawPendingTREView(generics.ListAPIView):
    serializer_class = LuckyDrawSubmissionSerializer
    permission_classes = [permissions.IsAuthenticated]

    def get_queryset(self):
        user = self.request.user
        if getattr(user, "role", None) != "employee":
            return LuckyDrawSubmission.objects.none()
        username = (getattr(user, "username", "") or "")
        uid = (getattr(user, "unique_id", "") or "")
        sid = (getattr(user, "sponsor_id", "") or "")
        return LuckyDrawSubmission.objects.filter(
            Q(status="SUBMITTED") &
            (
                Q(assigned_tre=user) |
                Q(tr_emp_id__iexact=username) |
                Q(tr_emp_id__iexact=uid) |
                Q(tr_emp_id__iexact=sid)
            )
        ).order_by("-created_at")


class LuckyDrawTREApproveView(generics.GenericAPIView):
    serializer_class = LuckyDrawSubmissionSerializer
    permission_classes = [permissions.IsAuthenticated]

    def post(self, request, pk):
        try:
            obj = LuckyDrawSubmission.objects.get(pk=pk)
        except LuckyDrawSubmission.DoesNotExist:
            return Response({"detail": "Not found."}, status=status.HTTP_404_NOT_FOUND)

        user = request.user
        username = (getattr(user, "username", "") or "")
        uid = (getattr(user, "unique_id", "") or "")
        sid = (getattr(user, "sponsor_id", "") or "")
        is_assigned = (obj.assigned_tre_id == user.id) if obj.assigned_tre_id else False
        matches_id = (obj.tr_emp_id or "").lower() in {username.lower(), uid.lower(), sid.lower()}
        if getattr(user, "role", None) != "employee" or not (is_assigned or matches_id):
            return Response({"detail": "Not permitted."}, status=status.HTTP_403_FORBIDDEN)
        if obj.status != "SUBMITTED":
            return Response({"detail": f"Invalid state {obj.status}."}, status=status.HTTP_400_BAD_REQUEST)

        comment = request.data.get("comment", "")
        obj.mark_tre_review(user, approved=True, comment=comment)
        obj.save(update_fields=["tre_reviewer", "tre_reviewed_at", "tre_comment", "status"])
        return Response(self.get_serializer(obj).data)


class LuckyDrawTRERejectView(generics.GenericAPIView):
    serializer_class = LuckyDrawSubmissionSerializer
    permission_classes = [permissions.IsAuthenticated]

    def post(self, request, pk):
        try:
            obj = LuckyDrawSubmission.objects.get(pk=pk)
        except LuckyDrawSubmission.DoesNotExist:
            return Response({"detail": "Not found."}, status=status.HTTP_404_NOT_FOUND)

        user = request.user
        username = (getattr(user, "username", "") or "")
        uid = (getattr(user, "unique_id", "") or "")
        sid = (getattr(user, "sponsor_id", "") or "")
        is_assigned = (obj.assigned_tre_id == user.id) if obj.assigned_tre_id else False
        matches_id = (obj.tr_emp_id or "").lower() in {username.lower(), uid.lower(), sid.lower()}
        if getattr(user, "role", None) != "employee" or not (is_assigned or matches_id):
            return Response({"detail": "Not permitted."}, status=status.HTTP_403_FORBIDDEN)
        if obj.status != "SUBMITTED":
            return Response({"detail": f"Invalid state {obj.status}."}, status=status.HTTP_400_BAD_REQUEST)

        comment = request.data.get("comment", "")
        obj.mark_tre_review(user, approved=False, comment=comment)
        obj.save(update_fields=["tre_reviewer", "tre_reviewed_at", "tre_comment", "status"])
        return Response(self.get_serializer(obj).data)


class LuckyDrawPendingAgencyView(generics.ListAPIView):
    serializer_class = LuckyDrawSubmissionSerializer
    permission_classes = [permissions.IsAuthenticated]

    def get_queryset(self):
        user = self.request.user
        role = getattr(user, "role", None)
        category = getattr(user, "category", "") or ""
        is_agency_actor = (role == "agency") or category.startswith("agency_")
        if not is_agency_actor:
            return LuckyDrawSubmission.objects.none()
        pc = (getattr(user, "pincode", "") or "").strip()
        if not pc:
            return LuckyDrawSubmission.objects.none()
        return LuckyDrawSubmission.objects.filter(status="TRE_APPROVED", pincode__iexact=pc).order_by("-created_at")


class LuckyDrawAgencyApproveView(generics.GenericAPIView):
    serializer_class = LuckyDrawSubmissionSerializer
    permission_classes = [permissions.IsAuthenticated]

    def post(self, request, pk):
        try:
            obj = LuckyDrawSubmission.objects.get(pk=pk)
        except LuckyDrawSubmission.DoesNotExist:
            return Response({"detail": "Not found."}, status=status.HTTP_404_NOT_FOUND)

        user = request.user
        role = getattr(user, "role", None)
        category = getattr(user, "category", "") or ""
        is_agency_actor = (role == "agency") or category.startswith("agency_")
        pc = (getattr(user, "pincode", "") or "").strip()
        obj_pin = (getattr(obj, "pincode", "") or "").strip()
        if not is_agency_actor or not pc or obj_pin.lower() != pc.lower():
            return Response({"detail": "Not permitted."}, status=status.HTTP_403_FORBIDDEN)
        if obj.status != "TRE_APPROVED":
            return Response({"detail": f"Invalid state {obj.status}."}, status=status.HTTP_400_BAD_REQUEST)

        comment = request.data.get("comment", "")
        obj.mark_agency_review(user, approved=True, comment=comment)
        obj.save(update_fields=["agency_reviewer", "agency_reviewed_at", "agency_comment", "status"])

        # Mirror into coupons submission system for commissions (₹15 agency + ₹15 employee)
        try:
            consumer = obj.user
            if consumer:
                # Find an active Coupon to attach submissions to; fallback create a default "Lucky Draw" coupon
                coupon = Coupon.objects.filter(is_active=True).first()
                if coupon is None:
                    coupon = Coupon.objects.create(
                        code="LUCKYDRAW",
                        title="Lucky Draw",
                        description="Auto-generated for Lucky Draw submissions",
                        campaign="LuckyDraw",
                        issuer=user,
                        is_active=True,
                    )

                emp_reviewer = obj.tre_reviewer or obj.assigned_tre

                # Create as AGENCY_APPROVED so commissions can be earned on post-save
                cs = RedeemSubmission.objects.create(
                    consumer=consumer,
                    coupon=coupon,
                    coupon_code=str(obj.sl_number or obj.ledger_number or f"LD-{obj.id}"),
                    code_ref=None,
                    pincode=obj.pincode,
                    notes=f"Mirrored from LuckyDrawSubmission #{obj.id}",
                    file=obj.image,
                    status="AGENCY_APPROVED",
                    employee_reviewer=emp_reviewer,
                    employee_reviewed_at=timezone.now() if emp_reviewer else None,
                    employee_comment=obj.tre_comment or "",
                    agency_reviewer=user,
                    agency_reviewed_at=timezone.now(),
                    agency_comment=obj.agency_comment or "",
                )
                # Trigger commission signal with a non-created save
                cs.save()
        except Exception:
            # Do not fail the approval if mirroring/commission fails
            pass

        return Response(self.get_serializer(obj).data)


class LuckyDrawAgencyRejectView(generics.GenericAPIView):
    serializer_class = LuckyDrawSubmissionSerializer
    permission_classes = [permissions.IsAuthenticated]

    def post(self, request, pk):
        try:
            obj = LuckyDrawSubmission.objects.get(pk=pk)
        except LuckyDrawSubmission.DoesNotExist:
            return Response({"detail": "Not found."}, status=status.HTTP_404_NOT_FOUND)

        user = request.user
        role = getattr(user, "role", None)
        category = getattr(user, "category", "") or ""
        is_agency_actor = (role == "agency") or category.startswith("agency_")
        pc = (getattr(user, "pincode", "") or "").strip()
        obj_pin = (getattr(obj, "pincode", "") or "").strip()
        if not is_agency_actor or not pc or obj_pin.lower() != pc.lower():
            return Response({"detail": "Not permitted."}, status=status.HTTP_403_FORBIDDEN)
        if obj.status != "TRE_APPROVED":
            return Response({"detail": f"Invalid state {obj.status}."}, status=status.HTTP_400_BAD_REQUEST)

        comment = request.data.get("comment", "")
        obj.mark_agency_review(user, approved=False, comment=comment)
        obj.save(update_fields=["agency_reviewer", "agency_reviewed_at", "agency_comment", "status"])
        return Response(self.get_serializer(obj).data)


class AgencyQuotaView(APIView):
    permission_classes = [permissions.IsAuthenticated]

    def get(self, request):
        user = request.user
        role = getattr(user, "role", None)
        category = getattr(user, "category", "") or ""
        is_agency_actor = (role == "agency") or category.startswith("agency_")
        if not is_agency_actor and not getattr(user, "is_staff", False):
            return Response({"detail": "Not permitted."}, status=status.HTTP_403_FORBIDDEN)

        target_user = user
        # Optional: staff can query any agency via ?agency_id=
        if getattr(user, "is_staff", False):
            try:
                agency_id = int(request.query_params.get("agency_id")) if request.query_params.get("agency_id") else None
            except Exception:
                agency_id = None
            if agency_id:
                target = CustomUser.objects.filter(id=agency_id, role="agency").first()
                if target:
                    target_user = target

        quota_obj = AgencyCouponQuota.objects.filter(agency=target_user).first()
        assigned = LuckyCouponAssignment.objects.filter(agency=target_user).aggregate(total=Sum("quantity")).get("total") or 0
        quota = int(getattr(quota_obj, "quota", 0) or 0)
        remaining = quota - int(assigned)
        if remaining < 0:
            remaining = 0

        return Response({
            "agency_id": target_user.id,
            "quota": quota,
            "assigned": int(assigned),
            "remaining": remaining,
            "updated_at": getattr(quota_obj, "updated_at", None),
        })


class JobApplicationView(generics.ListCreateAPIView):
    serializer_class = JobApplicationSerializer
    permission_classes = [permissions.AllowAny]

    def get_queryset(self):
        user = self.request.user
        if not getattr(user, "is_authenticated", False):
            return JobApplication.objects.none()
        # Staff can see all
        if getattr(user, "is_staff", False):
            return JobApplication.objects.all().order_by("-created_at")
        role = getattr(user, "role", None)
        # Agency: limited to applications in their registered pincode
        if role == "agency":
            pc = getattr(user, "pincode", "") or ""
            if pc:
                return JobApplication.objects.filter(pincode=pc).order_by("-created_at")
            return JobApplication.objects.none()
        # Employees: only their own
        if role == "employee":
            return JobApplication.objects.filter(user=user).order_by("-created_at")
        # Default: only their own
        return JobApplication.objects.filter(user=user).order_by("-created_at")

    def perform_create(self, serializer):
        user = self.request.user
        if getattr(user, "is_authenticated", False):
            serializer.save(user=user)
        else:
            # Allow unauthenticated submissions in development; user will be null
            serializer.save(user=None)

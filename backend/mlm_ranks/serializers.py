from __future__ import annotations

from rest_framework import serializers
from django.db.models import Sum
from .models import Rank, RankUpgrade, UpgradeCommission, CommissionHold, RankUpgradePayment
from .services.eligibility import EligibilityResult


class RankSerializer(serializers.ModelSerializer):
    class Meta:
        model = Rank
        fields = ("id", "rank_name", "level_number", "team_size_required", "upgrade_amount", "created_at")


class EligibilitySerializer(serializers.Serializer):
    eligible = serializers.BooleanField()
    next_rank = serializers.CharField(allow_null=True)
    upgrade_amount = serializers.DecimalField(max_digits=12, decimal_places=2, allow_null=True)
    level_number = serializers.IntegerField(allow_null=True)
    team_size_required = serializers.IntegerField()
    current_team_size = serializers.IntegerField()
    direct_count = serializers.IntegerField()
    reason = serializers.CharField(allow_blank=True, allow_null=True)

    @classmethod
    def from_result(cls, res: EligibilityResult) -> "EligibilitySerializer":
        return cls(
            {
                "eligible": bool(res.eligible),
                "next_rank": res.next_rank_name,
                "upgrade_amount": res.upgrade_amount,
                "level_number": res.level_number,
                "team_size_required": int(res.team_size_required or 0),
                "current_team_size": int(res.current_team_size or 0),
                "direct_count": int(res.direct_count or 0),
                "reason": res.reason or "",
            }
        )


class RankUpgradeSerializer(serializers.ModelSerializer):
    user_id = serializers.IntegerField(source="user.id", read_only=True)
    user_username = serializers.CharField(source="user.username", read_only=True)
    from_rank_name = serializers.CharField(source="from_rank.rank_name", read_only=True)
    to_rank_name = serializers.CharField(source="to_rank.rank_name", read_only=True)

    # Commission summary (computed)
    sponsor_id = serializers.SerializerMethodField()
    sponsor_username = serializers.SerializerMethodField()
    sponsor_released = serializers.SerializerMethodField()
    sponsor_held = serializers.SerializerMethodField()
    sponsor_total = serializers.SerializerMethodField()

    level_index = serializers.SerializerMethodField()
    level_owner_id = serializers.SerializerMethodField()
    level_owner_username = serializers.SerializerMethodField()
    level_released = serializers.SerializerMethodField()
    level_held = serializers.SerializerMethodField()
    level_total = serializers.SerializerMethodField()

    class Meta:
        model = RankUpgrade
        fields = (
            "id",
            "user_id",
            "user_username",
            "from_rank",
            "from_rank_name",
            "to_rank",
            "to_rank_name",
            "upgrade_amount",
            "gst_amount",
            "net_amount",
            "payment_status",
            "upgraded_at",
            "created_at",
            # Commission summary
            "sponsor_id",
            "sponsor_username",
            "sponsor_released",
            "sponsor_held",
            "sponsor_total",
            "level_index",
            "level_owner_id",
            "level_owner_username",
            "level_released",
            "level_held",
            "level_total",
        )
        read_only_fields = ("payment_status", "upgraded_at", "created_at", "gst_amount", "net_amount", "upgrade_amount")

    # ----- Helpers for commission summary -----
    def _sum_amount(self, qs):
        agg = qs.aggregate(s=Sum("commission_amount"))
        return agg.get("s") or 0

    def get_sponsor_id(self, obj):
        row = (
            UpgradeCommission.objects
            .filter(upgrade_id=obj.id, commission_type=UpgradeCommission.TYPE_DIRECT)
            .order_by("-id")
            .select_related("to_user")
            .first()
        )
        return getattr(getattr(row, "to_user", None), "id", None)

    def get_sponsor_username(self, obj):
        row = (
            UpgradeCommission.objects
            .filter(upgrade_id=obj.id, commission_type=UpgradeCommission.TYPE_DIRECT)
            .order_by("-id")
            .select_related("to_user")
            .first()
        )
        return getattr(getattr(row, "to_user", None), "username", None)

    def get_sponsor_released(self, obj):
        qs = UpgradeCommission.objects.filter(
            upgrade_id=obj.id,
            commission_type=UpgradeCommission.TYPE_DIRECT,
            status=UpgradeCommission.STATUS_CREDITED,
        )
        return self._sum_amount(qs)

    def get_sponsor_held(self, obj):
        qs = UpgradeCommission.objects.filter(
            upgrade_id=obj.id,
            commission_type=UpgradeCommission.TYPE_DIRECT,
            status=UpgradeCommission.STATUS_HELD,
        )
        return self._sum_amount(qs)

    def get_sponsor_total(self, obj):
        qs = UpgradeCommission.objects.filter(
            upgrade_id=obj.id,
            commission_type=UpgradeCommission.TYPE_DIRECT,
        )
        return self._sum_amount(qs)

    def get_level_index(self, obj):
        try:
            return int(getattr(getattr(obj, "to_rank", None), "level_number", 0) or 0)
        except Exception:
            return 0

    def get_level_owner_id(self, obj):
        level_idx = self.get_level_index(obj)
        row = (
            UpgradeCommission.objects
            .filter(upgrade_id=obj.id, commission_type=UpgradeCommission.TYPE_LEVEL, level=level_idx)
            .order_by("-id")
            .select_related("to_user")
            .first()
        )
        return getattr(getattr(row, "to_user", None), "id", None)

    def get_level_owner_username(self, obj):
        level_idx = self.get_level_index(obj)
        row = (
            UpgradeCommission.objects
            .filter(upgrade_id=obj.id, commission_type=UpgradeCommission.TYPE_LEVEL, level=level_idx)
            .order_by("-id")
            .select_related("to_user")
            .first()
        )
        return getattr(getattr(row, "to_user", None), "username", None)

    def get_level_released(self, obj):
        level_idx = self.get_level_index(obj)
        qs = UpgradeCommission.objects.filter(
            upgrade_id=obj.id,
            commission_type=UpgradeCommission.TYPE_LEVEL,
            level=level_idx,
            status=UpgradeCommission.STATUS_CREDITED,
        )
        return self._sum_amount(qs)

    def get_level_held(self, obj):
        level_idx = self.get_level_index(obj)
        qs = UpgradeCommission.objects.filter(
            upgrade_id=obj.id,
            commission_type=UpgradeCommission.TYPE_LEVEL,
            level=level_idx,
            status=UpgradeCommission.STATUS_HELD,
        )
        return self._sum_amount(qs)

    def get_level_total(self, obj):
        level_idx = self.get_level_index(obj)
        qs = UpgradeCommission.objects.filter(
            upgrade_id=obj.id,
            commission_type=UpgradeCommission.TYPE_LEVEL,
            level=level_idx,
        )
        return self._sum_amount(qs)


class UpgradeCommissionSerializer(serializers.ModelSerializer):
    upgrade_id = serializers.IntegerField(source="upgrade.id", read_only=True)
    from_user_id = serializers.IntegerField(source="from_user.id", read_only=True)
    from_user_username = serializers.CharField(source="from_user.username", read_only=True)
    to_user_username = serializers.CharField(source="to_user.username", read_only=True)

    class Meta:
        model = UpgradeCommission
        fields = (
            "id",
            "upgrade_id",
            "from_user_id",
            "from_user_username",
            "to_user",
            "to_user_username",
            "level",
            "commission_amount",
            "commission_type",
            "status",
            "created_at",
        )


class CommissionHoldSerializer(serializers.ModelSerializer):
    commission_id = serializers.IntegerField(source="commission.id", read_only=True)
    to_user = serializers.IntegerField(source="commission.to_user.id", read_only=True)
    to_user_username = serializers.CharField(source="commission.to_user.username", read_only=True)

    class Meta:
        model = CommissionHold
        fields = (
            "id",
            "commission_id",
            "to_user",
            "to_user_username",
            "hold_amount",
            "release_date",
            "status",
            "created_at",
            "updated_at",
        )


class RankUpgradePaymentSerializer(serializers.ModelSerializer):
    upgrade_id = serializers.IntegerField(source="upgrade.id", read_only=True)

    class Meta:
        model = RankUpgradePayment
        fields = (
            "id",
            "upgrade_id",
            "utr",
            "remarks",
            "payment_proof",
            "created_at",
        )

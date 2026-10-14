import subprocess

cmd = (
    "sudo -u trikonekt /srv/trikonekt/staging/backend/.venv/bin/python /srv/trikonekt/staging/backend/manage.py shell -c "
    "\"from accounts.models import CustomUser; from adminapi.serializers import AdminUserNodeSerializer; "
    "qs = CustomUser.objects.filter(category='consumer', account_active=True).order_by('first_purchase_activated_at'); "
    "for u in qs[:10]:\n"
    "    rp = getattr(u, 'rank_profile', None)\n"
    "    rp_rank = getattr(rp, 'current_rank', None) or getattr(rp, 'rank', None) if rp else None\n"
    "    upgrades = list(u.rank_upgrades.values_list('target_rank', flat=True))\n"
    "    ser = AdminUserNodeSerializer(u).data\n"
    "    print(u.id, u.username, ser.get('package_buy_date'), 'rank_profile:', rp, 'rp_rank:', rp_rank, 'upgrades:', upgrades)\n"
    "\""
)

out = subprocess.check_output([
    "ssh", "-i", r"C:\Users\babur\Downloads\TRI_MARKETING.pem",
    "-o", "StrictHostKeyChecking=no",
    "ubuntu@65.0.40.184",
    cmd
]).decode()
print(out)

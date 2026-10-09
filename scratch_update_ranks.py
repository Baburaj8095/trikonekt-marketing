import os, sys, django
from decimal import Decimal as D

sys.path.append('/srv/trikonekt/staging/backend')
if os.path.exists('/etc/trikonekt/staging-backend.env'):
    with open('/etc/trikonekt/staging-backend.env') as f:
        for line in f:
            line = line.strip()
            if line and not line.startswith('#') and '=' in line:
                k, v = line.split('=', 1)
                os.environ[k.strip()] = v.strip().strip('"').strip("'")
os.environ.setdefault('DJANGO_SETTINGS_MODULE', 'core.settings')
django.setup()

from mlm_ranks.models import Rank
from business.models import CommissionConfig

ranks_spec = [
    (1, "Layer 1", 5, D("250.00")),
    (2, "Layer 2", 25, D("500.00")),
    (3, "Layer 3", 125, D("1000.00")),
    (4, "Layer 4", 625, D("1250.00")),
    (5, "Layer 5", 3125, D("1500.00")),
    (6, "Layer 6", 15625, D("1750.00")),
    (7, "Layer 7", 78125, D("2000.00")),
    (8, "Layer 8", 390625, D("5000.00")),
    (9, "Layer 9", 1953125, D("10000.00")),
    (10, "Layer 10", 9765625, D("25000.00")),
]

print('=== UPDATING RANKS TABLE TO MATCH EXACT ADMIN SPEC ===')
for lvl, name, team, amt in ranks_spec:
    r, _ = Rank.objects.update_or_create(
        level_number=lvl,
        defaults={
            "rank_name": f"L{lvl} {name}",
            "team_size_required": team,
            "upgrade_amount": amt,
        }
    )
    print(f'Rank L{lvl}: Name={r.rank_name}, UpgradeAmount=₹{r.upgrade_amount}')

# Also ensure CommissionConfig rank_upgrade_config matches
cfg = CommissionConfig.get_solo()
master = dict(cfg.master_commission_json or {})
ruc = dict(master.get('rank_upgrade_config', {}) or {})
ruc_levels = ruc.get('levels', [])
for item in ruc_levels:
    lvl = int(item.get('level', 0))
    for spec_lvl, spec_name, spec_team, spec_amt in ranks_spec:
        if lvl == spec_lvl:
            item['upgrade_amount'] = float(spec_amt)
ruc['levels'] = ruc_levels
master['rank_upgrade_config'] = ruc
cfg.master_commission_json = master
cfg.tax_percent = D("18.00")
cfg.save(update_fields=['master_commission_json', 'tax_percent', 'updated_at'])
print('Updated CommissionConfig rank_upgrade_config and tax_percent=18.00%')

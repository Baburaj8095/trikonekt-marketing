import os, sys, django, json
sys.path.insert(0, '/srv/trikonekt/staging/backend')
os.environ.setdefault('DJANGO_SETTINGS_MODULE', 'core.settings')
django.setup()

from business.models import CommissionConfig
cfg = CommissionConfig.get_solo()
master = cfg.master_commission_json or {}
out = {
    'direct_bonus': master.get('direct_bonus', {}),
    'products': master.get('products', {}),
    'geo_mode': master.get('geo_mode', {}),
    'geo_fixed': master.get('geo_fixed', {}),
    'consumer_matrix_5': master.get('consumer_matrix_5', {}),
    'consumer_matrix_3': master.get('consumer_matrix_3', {}),
    'rank_upgrade_config': master.get('rank_upgrade_config', {}),
    'tax': master.get('tax', {}),
}
print(json.dumps(out, indent=2))

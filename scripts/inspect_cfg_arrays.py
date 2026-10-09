import os, sys, django
sys.path.insert(0, '/srv/trikonekt/staging/backend')
os.environ.setdefault('DJANGO_SETTINGS_MODULE', 'core.settings')
django.setup()

from business.models import CommissionConfig
cfg = CommissionConfig.get_solo()
print("three_matrix_amounts_json:", getattr(cfg, "three_matrix_amounts_json", None))
print("three_matrix_percents_json:", getattr(cfg, "three_matrix_percents_json", None))
print("five_matrix_amounts_json:", getattr(cfg, "five_matrix_amounts_json", None))
print("five_matrix_percents_json:", getattr(cfg, "five_matrix_percents_json", None))
print("master_commission_json keys:", list((cfg.master_commission_json or {}).keys()))

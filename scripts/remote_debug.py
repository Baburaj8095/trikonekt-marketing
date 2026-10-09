
import os, sys, django
os.environ.setdefault('DJANGO_SETTINGS_MODULE', 'core.settings')
env_file = '/etc/trikonekt/staging-backend.env'
if os.path.exists(env_file):
    with open(env_file) as f:
        for line in f:
            line = line.strip()
            if line and not line.startswith('#') and '=' in line:
                k, v = line.split('=', 1)
                os.environ[k] = v.strip('"\'')
sys.path.insert(0, '/srv/trikonekt/staging/backend')
django.setup()

from business.models import CommissionConfig
from business.services.monthly import _monthly_open_mode, _load_monthly_759_runtime_cfg

cfg = CommissionConfig.get_solo()
print("CommissionConfig monthly open mode:", _monthly_open_mode(cfg))
runtime = _load_monthly_759_runtime_cfg(cfg)
print("Runtime keys:", list(runtime.keys()))
print("Runtime box_config:", runtime.get('box_config'))
print("Runtime spp_config:", runtime.get('spp_config'))

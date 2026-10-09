import os, sys
from decimal import Decimal

sys.path.append("/srv/trikonekt/staging/backend")
if os.path.exists("/etc/trikonekt/staging-backend.env"):
    with open("/etc/trikonekt/staging-backend.env") as f:
        for line in f:
            line = line.strip()
            if line and not line.startswith("#") and "=" in line:
                k, v = line.split("=", 1)
                os.environ[k.strip()] = v.strip().strip('"').strip("'")
os.environ.setdefault("DJANGO_SETTINGS_MODULE", "core.settings")

import django
django.setup()

from business.models import CommissionConfig

def q2(x):
    return float(Decimal(str(x)).quantize(Decimal("0.01")))

cfg = CommissionConfig.get_solo()
master = dict(cfg.master_commission_json or {})

# 1. products table for 750 / 1000
products = dict(master.get("products", {}) or {})
for key in ["750", "1000"]:
    row = dict(products.get(key, {}) or {})
    row["base_amount"] = 1000.0
    row["activation_open_count"] = 1
    row["matrix_open_mode"] = "FIRST_TIME_ONLY"
    row["matrix_open_count"] = 1
    products[key] = row
master["products"] = products

# 2. direct_bonus for 750 / 1000
db = dict(master.get("direct_bonus", {}) or {})
for key in ["750", "1000"]:
    db[key] = {"sponsor": 400.0, "self": 0.0}
master["direct_bonus"] = db

# 3. geo_mode & geo_fixed for 750 / 1000
gm = dict(master.get("geo_mode", {}) or {})
gf = dict(master.get("geo_fixed", {}) or {})
geo_1k = {
    "sub_franchise": 25.0,
    "pincode": 15.0,
    "pincode_coord": 10.0,
    "district": 10.0,
    "district_coord": 10.0,
    "state": 10.0,
    "state_coord": 10.0,
    "employee": 5.0,
    "royalty": 5.0,
}
for key in ["750", "1000"]:
    gm[key] = "fixed"
    gf[key] = geo_1k
master["geo_mode"] = gm
master["geo_fixed"] = gf

# 4. consumer_matrix_5 for 750 / 1000
# 10 layers totaling ₹80
m5_amounts = [15.0, 12.0, 10.0, 8.0, 7.0, 6.0, 6.0, 6.0, 5.0, 5.0]
m5_percents = [1.5, 1.2, 1.0, 0.8, 0.7, 0.6, 0.6, 0.6, 0.5, 0.5]
cm5 = dict(master.get("consumer_matrix_5", {}) or {})
for key in ["750", "1000"]:
    cm5[key] = {
        "levels": 10,
        "fixed_amounts": m5_amounts,
        "percents": m5_percents,
    }
master["consumer_matrix_5"] = cm5

# 5. consumer_matrix_3 for 750 / 1000
# 15 layers totaling ₹27.50
m3_amounts = [2.5, 2.5, 2.5, 2.5, 2.5, 1.5, 1.5, 1.5, 1.5, 1.5, 1.5, 1.5, 1.5, 1.5, 2.5]
m3_percents = [0.25, 0.25, 0.25, 0.25, 0.25, 0.15, 0.15, 0.15, 0.15, 0.15, 0.15, 0.15, 0.15, 0.15, 0.25]
cm3 = dict(master.get("consumer_matrix_3", {}) or {})
for key in ["750", "1000"]:
    cm3[key] = {
        "levels": 15,
        "fixed_amounts": m3_amounts,
        "percents": m3_percents,
    }
master["consumer_matrix_3"] = cm3

# 6. Also sync typed fields on CommissionConfig
cfg.five_matrix_levels = 10
cfg.five_matrix_amounts_json = m5_amounts
cfg.five_matrix_percents_json = m5_percents
cfg.three_matrix_levels = 15
cfg.three_matrix_amounts_json = m3_amounts
cfg.three_matrix_percents_json = m3_percents
cfg.tax_percent = Decimal("18.00")
cfg.master_commission_json = master
cfg.save()

print("SUCCESS: 1K (750 & 1000) Master Commission & Matrix Configured Successfully!")

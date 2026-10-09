import os, sys, json
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

from django.contrib.auth import get_user_model
from rest_framework_simplejwt.tokens import RefreshToken
import urllib.request

User = get_user_model()
admin = User.objects.filter(username="admin").first()
token = str(RefreshToken.for_user(admin).access_token)

# 1. Master Commission for 750
master_url = "http://127.0.0.1:8001/api/admin/commission/master/?product=750"
m_req = urllib.request.Request(master_url, headers={'Authorization': f'Bearer {token}'})
with urllib.request.urlopen(m_req) as m_resp:
    m_res = json.loads(m_resp.read().decode('utf-8'))
    print("MASTER COMMISSION (750):")
    print("product_base_amount:", m_res.get("product_base_amount"))
    print("tax:", m_res.get("tax"))
    print("direct_bonus:", m_res.get("direct_bonus"))
    print("geo_fixed:", m_res.get("geo_fixed"))

# 2. Matrix Commission for 750
mx_url = "http://127.0.0.1:8001/api/admin/commission/matrix/?product=750"
mx_req = urllib.request.Request(mx_url, headers={'Authorization': f'Bearer {token}'})
with urllib.request.urlopen(mx_req) as mx_resp:
    mx_res = json.loads(mx_resp.read().decode('utf-8'))
    print("\nMATRIX COMMISSION (750):")
    print("five_matrix_levels:", mx_res.get("five_matrix_levels"))
    print("five_matrix_amounts_json:", mx_res.get("five_matrix_amounts_json"))
    print("three_matrix_levels:", mx_res.get("three_matrix_levels"))
    print("three_matrix_amounts_json:", mx_res.get("three_matrix_amounts_json"))

import os
import django

os.environ.setdefault('DJANGO_SETTINGS_MODULE', 'core.settings')
django.setup()

from business.models import CommissionConfig

cfg = CommissionConfig.objects.first()
if cfg:
    master = dict(cfg.master_commission_json or {})
    
    # 1. Update direct_bonus
    direct = dict(master.get("direct_bonus", {}) or {})
    direct["759"] = {"sponsor": 150.0, "self": 50.0}
    direct["1000"] = {"sponsor": 150.0, "self": 50.0}
    master["direct_bonus"] = direct
    
    # 2. Update monthly_759
    m759 = dict(master.get("monthly_759", {}) or {})
    m759["direct_first_month"] = 150.0
    m759["direct_monthly"] = 50.0
    master["monthly_759"] = m759
    
    # 3. Update commissions monthly_759 first_box
    comm = dict(master.get("commissions", {}) or {})
    comm_m759 = dict(comm.get("monthly_759", {}) or {})
    first_box = dict(comm_m759.get("first_box", {}) or {})
    first_box["direct"] = {"sponsor": 150.0, "self": 50.0}
    comm_m759["first_box"] = first_box
    comm["monthly_759"] = comm_m759
    master["commissions"] = comm
    
    cfg.master_commission_json = master
    cfg.save()
    print("SUCCESSFULLY UPDATED COMMISSION CONFIG FOR SPP 1000:")
    print("  direct_bonus['759']:", master["direct_bonus"].get("759"))
    print("  monthly_759['direct_first_month']:", master["monthly_759"].get("direct_first_month"))
    print("  commissions['monthly_759']['first_box']['direct']:", master["commissions"]["monthly_759"]["first_box"]["direct"])

import sys, os
sys.path.insert(0, '/srv/trikonekt/staging/backend')
if os.path.exists('/etc/trikonekt/staging-backend.env'):
    with open('/etc/trikonekt/staging-backend.env') as f:
        for line in f:
            line = line.strip()
            if '=' in line and not line.startswith('#'):
                k, v = line.split('=', 1)
                os.environ[k] = v

os.environ.setdefault('DJANGO_SETTINGS_MODULE', 'core.settings')
import django
django.setup()

from django.apps import apps
from accounts.models import CustomUser, Wallet

u = CustomUser.objects.get(id=64)
print(f"USER: id={u.id}, username={u.username}, phone={u.phone}, created={u.date_joined}")

w = Wallet.objects.get(user=u)
print(f"WALLET: balance={w.balance}, main_balance={w.main_balance}, self={w.self_account_balance}, withdrawable={w.withdrawable_balance}")

print("\n--- ALL MODELS WITH user_id=64 ---")
for model in apps.get_models():
    # Check if model has a user field
    has_user = any(f.name == 'user' for f in model._meta.fields)
    if has_user:
        try:
            count = model.objects.filter(user=u).count()
            if count > 0:
                print(f"Model {model.__name__} has {count} records:")
                for obj in model.objects.filter(user=u):
                    d = {k: v for k, v in obj.__dict__.items() if not k.startswith('_')}
                    print("  ", d)
        except Exception as e:
            pass

print("\n--- ALL MODELS WITH redeemed_by=64 or assigned_to=64 ---")
for model in apps.get_models():
    for f in ['assigned_to', 'redeemed_by', 'created_by', 'receiver', 'sender']:
        if any(field.name == f for field in model._meta.fields):
            try:
                count = model.objects.filter(**{f: u}).count()
                if count > 0:
                    print(f"Model {model.__name__} ({f}=64) has {count} records:")
                    for obj in model.objects.filter(**{f: u}):
                        d = {k: v for k, v in obj.__dict__.items() if not k.startswith('_')}
                        print("  ", d)
            except Exception:
                pass

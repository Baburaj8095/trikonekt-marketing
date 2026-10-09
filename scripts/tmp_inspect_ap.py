
from business.models import AutoPoolAccount
from accounts.models import CustomUser

u = CustomUser.objects.filter(username='8095918105').first()
if u:
    aps = AutoPoolAccount.objects.filter(owner=u)
    print("AUTOPOOL ACCOUNTS FOR USER:", list(aps.values('id', 'pool_type', 'owner_id', 'parent_account_id')))

    all_aps = AutoPoolAccount.objects.all()
    print("TOTAL AUTOPOOL ACCOUNTS:", all_aps.count())
    for a in all_aps:
        print(a.id, a.pool_type, a.owner_id, a.parent_account_id)

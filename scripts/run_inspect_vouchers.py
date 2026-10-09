import os
import django

os.environ.setdefault('DJANGO_SETTINGS_MODULE', 'core.settings')
django.setup()

from accounts.models import CustomUser, ConsumerVoucher
from business.models import SPPGiftCard

u = CustomUser.objects.filter(phone='9999999999').first() or CustomUser.objects.filter(username='9999999999').first()
print('USER:', u.id, u.username, u.phone)

cvs = list(ConsumerVoucher.objects.filter(assigned_to=u))
print('CONSUMER_VOUCHERS (assigned_to):', len(cvs))
for c in cvs:
    print('  CV:', c.code, c.amount, c.status, c.voucher_type, c.description, c.created_at)

cvs2 = list(ConsumerVoucher.objects.filter(creator=u))
print('CONSUMER_VOUCHERS (creator):', len(cvs2))
for c in cvs2:
    print('  CV_creator:', c.code, c.amount, c.status, c.voucher_type, c.description)

spps = list(SPPGiftCard.objects.filter(user=u))
print('SPP_GIFT_CARDS:', len(spps))
for s in spps:
    print('  SPP:', s.code, s.season_number, s.box_number, s.status, s.amount, s.created_at)

all_spp = list(SPPGiftCard.objects.all())
print('TOTAL SPP IN DB:', len(all_spp))
for s in all_spp[:5]:
    print('  ANY_SPP:', s.user.username, s.code, s.box_number, s.status)

import os
import subprocess

ssh_key = r"C:\Users\babur\Downloads\TRI_MARKETING.pem"
ec2_ip = "65.0.40.184"

remote_cmd = (
    "cd /srv/trikonekt/staging/backend && sudo env $(cat /etc/trikonekt/staging-backend.env | xargs) PYTHONPATH=/srv/trikonekt/staging/backend /srv/trikonekt/staging/backend/.venv/bin/python "
    "-c \"import os, django; os.environ.setdefault('DJANGO_SETTINGS_MODULE', 'core.settings'); django.setup(); "
    "from accounts.models import CustomUser, ConsumerVoucher; "
    "from business.models import SPPGiftCard; "
    "u = CustomUser.objects.filter(phone_number='9999999999').first(); "
    "print('USER:', u.id, u.username, u.phone_number); "
    "cvs = list(ConsumerVoucher.objects.filter(assigned_to=u)); "
    "print('CONSUMER_VOUCHERS (assigned_to):', len(cvs)); "
    "for c in cvs: print('  CV:', c.code, c.amount, c.status, c.voucher_type, c.description); "
    "cvs2 = list(ConsumerVoucher.objects.filter(creator=u)); "
    "print('CONSUMER_VOUCHERS (creator):', len(cvs2)); "
    "for c in cvs2: print('  CV_creator:', c.code, c.amount, c.status, c.voucher_type, c.description); "
    "spps = list(SPPGiftCard.objects.filter(user=u)); "
    "print('SPP_GIFT_CARDS:', len(spps)); "
    "for s in spps: print('  SPP:', s.code, s.season_number, s.box_number, s.status, s.amount); "
    "all_spp = list(SPPGiftCard.objects.all()); "
    "print('TOTAL SPP IN DB:', len(all_spp)); "
    "for s in all_spp[:5]: print('  ANY_SPP:', s.user.username, s.code, s.box_number, s.status); "
    "\""
)

cmd = ["ssh", "-i", ssh_key, "-o", "StrictHostKeyChecking=no", f"ubuntu@{ec2_ip}", remote_cmd]
res = subprocess.run(cmd, capture_output=True, text=True)
print("STDOUT:", res.stdout)
print("STDERR:", res.stderr)

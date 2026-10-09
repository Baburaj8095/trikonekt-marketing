import os
import sys
import django

sys.path.insert(0, '/srv/trikonekt/staging/backend')
os.environ.setdefault('DJANGO_SETTINGS_MODULE', 'core.settings')
django.setup()

from django.contrib.auth import get_user_model
from mlm_ranks.models import RankMatrixNode, RankUpgrade

User = get_user_model()
u1 = User.objects.filter(phone='9999999999').first()
u2 = User.objects.filter(phone='8095918105').first()

print("RankMatrixNode count:", RankMatrixNode.objects.count())
if u1:
    rnodes1 = list(RankMatrixNode.objects.filter(root_user_id=u1.id).values())
    print(f"Nodes for 9999999999 (root_id={u1.id}): {len(rnodes1)}")
    for r in rnodes1:
        print(r)

if u2:
    rnodes2 = list(RankMatrixNode.objects.filter(root_user_id=u2.id).values())
    print(f"Nodes for 8095918105 (root_id={u2.id}): {len(rnodes2)}")
    for r in rnodes2:
        print(r)

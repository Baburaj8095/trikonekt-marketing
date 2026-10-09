from accounts.models import CustomUser
from business.models import PromoPurchase
from mlm_ranks.models import RankUpgrade, UserRank, Rank

u = CustomUser.objects.filter(phone='8095918105').first()
print('User:', u)
if u:
    print('is_active:', u.is_active)
    pps = PromoPurchase.objects.filter(user=u)
    print('PromoPurchase count:', pps.count())
    for p in pps:
        print('  PP:', p.id, p.package.type if p.package else None, p.package.name if p.package else None, p.status)

    urs = UserRank.objects.filter(user=u)
    print('UserRank count:', urs.count())
    for ur in urs:
        print('  UserRank:', ur.id, ur.current_rank.level_number if ur.current_rank else None, ur.current_rank.rank_name if ur.current_rank else None, ur.achieved_at)

    upgs = RankUpgrade.objects.filter(user=u)
    print('RankUpgrade count:', upgs.count())
    for up in upgs:
        print('  RankUpgrade:', up.id, up.from_rank, up.to_rank, up.payment_status, up.upgraded_at)

import os
import sys

def patch_files():
    # 1. Patch wallet.py
    wallet_path = '/srv/trikonekt/staging/backend/mlm_ranks/services/wallet.py'
    if os.path.exists(wallet_path):
        with open(wallet_path, 'r') as f:
            w_src = f.read()

        w_src = w_src.replace(
            'def credit_direct(cls, user, amount: Decimal, *, from_user_id: int, upgrade_id: int) -> WalletPostResult:\n        meta = {"from_user_id": from_user_id, "upgrade_id": upgrade_id, "kind": "RANK_UPGRADE_DIRECT"}',
            'def credit_direct(cls, user, amount: Decimal, *, from_user_id: int, upgrade_id: int, from_user: str = "") -> WalletPostResult:\n        meta = {"from_user_id": from_user_id, "from_user": from_user, "upgrade_id": upgrade_id, "kind": "RANK_UPGRADE_DIRECT"}'
        )
        w_src = w_src.replace(
            'def credit_level(cls, user, amount: Decimal, *, from_user_id: int, upgrade_id: int, level: int) -> WalletPostResult:\n        meta = {"from_user_id": from_user_id, "upgrade_id": upgrade_id, "level": level, "kind": "RANK_UPGRADE_LEVEL"}',
            'def credit_level(cls, user, amount: Decimal, *, from_user_id: int, upgrade_id: int, level: int, from_user: str = "") -> WalletPostResult:\n        meta = {"from_user_id": from_user_id, "from_user": from_user, "upgrade_id": upgrade_id, "level": level, "kind": "RANK_UPGRADE_LEVEL"}'
        )
        with open(wallet_path, 'w') as f:
            f.write(w_src)
        print('1. wallet.py patched successfully')

    # 2. Patch five_matrix.py
    fm_path = '/srv/trikonekt/staging/backend/mlm_ranks/services/five_matrix.py'
    if os.path.exists(fm_path):
        with open(fm_path, 'r') as f:
            fm_src = f.read()

        fm_src = fm_src.replace(
            'WalletPoster.credit_direct(sponsor, direct_amt, from_user_id=getattr(payer, "id", None) or 0, upgrade_id=upgrade.id)',
            'WalletPoster.credit_direct(sponsor, direct_amt, from_user_id=getattr(payer, "id", None) or 0, from_user=getattr(payer, "username", "") or "", upgrade_id=upgrade.id)'
        )
        fm_src = fm_src.replace(
            'WalletPoster.credit_level(parent_for_level, release_amt, from_user_id=getattr(payer, "id", None) or 0, upgrade_id=upgrade.id, level=1)',
            'WalletPoster.credit_level(parent_for_level, release_amt, from_user_id=getattr(payer, "id", None) or 0, from_user=getattr(payer, "username", "") or "", upgrade_id=upgrade.id, level=1)'
        )
        with open(fm_path, 'w') as f:
            f.write(fm_src)
        print('2. five_matrix.py patched successfully')

    # 3. Patch commission.py
    comm_path = '/srv/trikonekt/staging/backend/mlm_ranks/services/commission.py'
    if os.path.exists(comm_path):
        with open(comm_path, 'r') as f:
            comm_src = f.read()

        comm_src = comm_src.replace(
            'WalletPoster.credit_direct(to_user, release_amt, from_user_id=getattr(from_user, "id", None) or 0, upgrade_id=upgrade.id)',
            'WalletPoster.credit_direct(to_user, release_amt, from_user_id=getattr(from_user, "id", None) or 0, from_user=getattr(from_user, "username", "") or "", upgrade_id=upgrade.id)'
        )
        comm_src = comm_src.replace(
            'WalletPoster.credit_direct(to_user, amt, from_user_id=getattr(from_user, "id", None) or 0, upgrade_id=upgrade.id)',
            'WalletPoster.credit_direct(to_user, amt, from_user_id=getattr(from_user, "id", None) or 0, from_user=getattr(from_user, "username", "") or "", upgrade_id=upgrade.id)'
        )
        comm_src = comm_src.replace(
            'WalletPoster.credit_level(to_user, release_amt, from_user_id=getattr(from_user, "id", None) or 0, upgrade_id=upgrade.id, level=level)',
            'WalletPoster.credit_level(to_user, release_amt, from_user_id=getattr(from_user, "id", None) or 0, from_user=getattr(from_user, "username", "") or "", upgrade_id=upgrade.id, level=level)'
        )
        comm_src = comm_src.replace(
            'WalletPoster.credit_level(to_user, amt, from_user_id=getattr(from_user, "id", None) or 0, upgrade_id=upgrade.id, level=level)',
            'WalletPoster.credit_level(to_user, amt, from_user_id=getattr(from_user, "id", None) or 0, from_user=getattr(from_user, "username", "") or "", upgrade_id=upgrade.id, level=level)'
        )
        with open(comm_path, 'w') as f:
            f.write(comm_src)
        print('3. commission.py patched successfully')

if __name__ == '__main__':
    patch_files()

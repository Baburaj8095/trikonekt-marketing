path = '/srv/trikonekt/staging/backend/business/models.py'
with open(path, 'r') as f:
    lines = f.readlines()

new_lines = []
in_func = False
for line in lines:
    if 'def _sponsor_start_entry_id_for(cls, user, pool_type: str):' in line:
        in_func = True
        new_lines.append(line)
        new_lines.append('''        """
        Resolve sponsor-scoped BFS start entry for placement:
        - Return sponsor's PRIMARY entry (entry_idx=1) in this pool_type
          so placement spreads consistently under sponsor's main account
        - If sponsor doesn't have entry_idx=1, fall back to global root
        """
        try:
            sponsor = (
                getattr(user, "registered_by", None)
                or getattr(user, "sponsor", None)
                or getattr(user, "referred_by", None)
            )
            if not sponsor or not getattr(sponsor, "id", None):
                return None
            try:
                if cls._is_virtual_root_user(sponsor):
                    return None
            except Exception:
                pass
            acc = (
                cls.objects.filter(
                    owner=sponsor,
                    pool_type=pool_type,
                    user_entry_index=1,
                    status="ACTIVE",
                ).first()
                or cls.objects.filter(
                    owner=sponsor,
                    pool_type=pool_type,
                    status="ACTIVE",
                ).order_by("id").first()
            )
            return int(acc.id) if acc else None
        except Exception:
            return None
''')
    elif in_func:
        if line.startswith('    @classmethod') or line.startswith('    def '):
            in_func = False
            new_lines.append(line)
    else:
        new_lines.append(line)

with open(path, 'w') as f:
    f.writelines(new_lines)

print('SUCCESSFULLY PATCHED business/models.py!')

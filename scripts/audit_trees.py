import os, django
os.environ.setdefault('DJANGO_SETTINGS_MODULE', 'core.settings')
django.setup()
from django.contrib.auth import get_user_model
from accounts.models import AutopoolAccount

print("=== ALL AUTOPOOL ACCOUNTS (5-MATRIX & 3-MATRIX) ===")
for acc in AutopoolAccount.objects.all().order_by('id'):
    print(f"ID #{acc.id:3d} | User: {acc.user.username} (ID {acc.user_id}) | Matrix: {acc.matrix_type:12s} | Parent: {acc.parent_id} | Pos: {acc.position} | Layer/Level: {acc.layer_index if hasattr(acc, 'layer_index') else getattr(acc, 'level', '-')} | Created: {acc.created_at}")

print("\n=== 3-MATRIX TREE HIERARCHY ===")
three_accs = AutopoolAccount.objects.filter(matrix_type='THREE_MATRIX').order_by('id')
for acc in three_accs:
    children = AutopoolAccount.objects.filter(parent_id=acc.id, matrix_type='THREE_MATRIX').order_by('position')
    child_str = ", ".join([f"ID #{c.id} ({c.user.username} pos={c.position})" for c in children])
    print(f"Account ID #{acc.id} (User {acc.user.username}) -> Children count: {children.count()} [{child_str}]")

print("\n=== 5-MATRIX TREE HIERARCHY ===")
five_accs = AutopoolAccount.objects.filter(matrix_type='FIVE_MATRIX').order_by('id')
for acc in five_accs:
    children = AutopoolAccount.objects.filter(parent_id=acc.id, matrix_type='FIVE_MATRIX').order_by('position')
    child_str = ", ".join([f"ID #{c.id} ({c.user.username} pos={c.position})" for c in children])
    print(f"Account ID #{acc.id} (User {acc.user.username}) -> Children count: {children.count()} [{child_str}]")

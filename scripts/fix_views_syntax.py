path = "/srv/trikonekt/staging/backend/adminapi/views.py"
with open(path, "r", encoding="utf-8") as f:
    content = f.read()

# Replace the unindented lines with proper indentation
content = content.replace(
    'if dry_run:\noutput_lines.append("\\n[PREVIEW MODE - No database changes executed]")',
    'if dry_run:\n            output_lines.append("\\n[PREVIEW MODE - No database changes executed]")'
)
content = content.replace(
    '"dry_run": True,\n"output": "\\n".join(output_lines)',
    '"dry_run": True,\n                "output": "\\n".join(output_lines)'
)
content = content.replace(
    'distribute_pot(t2_users, t2_pot, "ROYALTY_T2_POOL")\n\noutput_lines.append',
    'distribute_pot(t2_users, t2_pot, "ROYALTY_T2_POOL")\n\n        output_lines.append'
)
content = content.replace(
    '"dry_run": False,\n"output": "\\n".join(output_lines)',
    '"dry_run": False,\n                "output": "\\n".join(output_lines)'
)

with open(path, "w", encoding="utf-8") as f:
    f.write(content)

print("Checking compilation...")
import py_compile
py_compile.compile(path, doraise=True)
print("SUCCESS: adminapi/views.py compiled cleanly with zero errors!")

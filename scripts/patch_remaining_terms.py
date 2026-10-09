import os
import sys

sys.stdout.reconfigure(encoding='utf-8')

replacements = [
    ("frontend/src/pages/admin/AdminAdminUsers.jsx", [
        ('<Field label="Access Level">', '<Field label="Access Tier">'),
    ]),
    ("frontend/src/pages/admin/AdminCommissionDistribute.jsx", [
        ("Enable 5‑Matrix (₹150)", "Enable 5‑Block (₹150)"),
        ("Enable 3‑Matrix (₹150)", "Enable 3‑Block (₹150)"),
        ("Enable 5-Matrix (₹150)", "Enable 5-Block (₹150)"),
        ("Enable 3-Matrix (₹150)", "Enable 3-Block (₹150)"),
        ("Matrix Pools", "Block Pools"),
        ("Block Commission (5 & 3 Matrix)", "Block Commission (5 & 3 Blocks)"),
    ]),
    ("frontend/src/pages/admin/AdminDailySalesReport.jsx", [
        ('label="1. Daily Sales Matrix"', 'label="1. Daily Sales Blocks Summary"'),
        ('label="9. SPP Retention & Cadence Matrix"', 'label="9. SPP Retention & Cadence Report"'),
        ("Cadence Matrix Table", "Cadence Report Table"),
    ]),
    ("frontend/src/pages/admin/AdminFranchiseUsers.jsx", [
        ('headerName: "Franchise Level"', 'headerName: "Franchise Layer"'),
        ('["Franchise Level",', '["Franchise Layer",'),
    ]),
    ("frontend/src/pages/admin/AdminKYC.jsx", [
        ('headerName: "Franchise Level"', 'headerName: "Franchise Layer"'),
        ('label="Franchise Level"', 'label="Franchise Layer"'),
    ]),
    ("frontend/src/pages/admin/AdminLedgerStatement.jsx", [
        ('<TableCell sx={{ fontWeight: 900, backgroundColor: "#f8fafc" }}>Level/Trigger</TableCell>', '<TableCell sx={{ fontWeight: 900, backgroundColor: "#f8fafc" }}>Layer/Trigger</TableCell>'),
    ]),
    ("frontend/src/pages/admin/AdminRankUpgrades.jsx", [
        ('<Box sx={{ textAlign: "right" }}>Level Owner</Box>', '<Box sx={{ textAlign: "right" }}>Layer Owner</Box>'),
        ('label={`Level Owner', 'label={`Layer Owner'),
    ]),
]

for fp, pairs in replacements:
    if os.path.exists(fp):
        with open(fp, "r", encoding="utf-8") as f:
            content = f.read()
        orig = content
        for o, n in pairs:
            content = content.replace(o, n)
        if content != orig:
            with open(fp, "w", encoding="utf-8") as f:
                f.write(content)
            print(f"Patched {fp}")
        else:
            print(f"No changes in {fp}")

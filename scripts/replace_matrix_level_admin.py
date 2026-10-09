import os
import re

replacements_map = {
    "frontend/src/pages/admin/AdminLogin.jsx": [
        ("5/3 Matrix AutoPools", "5/3 Blocks AutoPools"),
        ("5/3 Matrix", "5/3 Blocks"),
        ("Matrix AutoPools", "Block AutoPools"),
    ],
    "frontend/src/pages/admin/AdminDashboard.jsx": [
        ("Matrix Explorer", "Blocks Explorer"),
        ("5-Matrix Royalty Network", "5-Block Royalty Network"),
        ("5-Matrix Multi-Tier Pool", "5-Block Multi-Tier Pool"),
        ("3-Matrix AutoPool Accounts", "3-Block AutoPool Accounts"),
        ("3-Matrix", "3-Block"),
        ("5-Matrix", "5-Block"),
        ("Matrix Tree", "Block Tree"),
        ("Matrix Accounts", "Block Accounts"),
        ("Matrix Pool", "Block Pool"),
    ],
    "frontend/src/pages/admin/AdminDashboardCards.jsx": [
        ("Matrix Accounts", "Block Accounts"),
        ("5-Matrix", "5-Block"),
        ("3-Matrix", "3-Block"),
        ("Matrix", "Blocks"),
        ("Level", "Layer"),
    ],
    "frontend/src/pages/admin/AdminCommissionDistribute.jsx": [
        ("Matrix Open Mode", "Block Open Mode"),
        ("Matrix Open Count", "Block Open Count"),
        ("Matrix Commission", "Block Commission"),
        ("Level Commission", "Layer Commission"),
        ("5/3 matrix accounts", "5/3 block accounts"),
        ("5-Block Matrix", "5-Block Pool"),
        ("3-Block Matrix", "3-Block Pool"),
        ("Matrix overrides", "Block overrides"),
        ("Matrix repetition", "Block repetition"),
        ("Matrix Open Mode", "Block Open Mode"),
        ("Fixed Level Commission", "Fixed Layer Commission"),
        ("5-Matrix", "5-Block"),
        ("3-Matrix", "3-Block"),
        ("Per-Level", "Per-Layer"),
        ("Level-wise", "Layer-wise"),
    ],
    "frontend/src/pages/admin/AdminMatrixFive.jsx": [
        ("5-Matrix Multi-Tier Engine", "5-Block Multi-Tier Engine"),
        ("5-Matrix", "5-Block"),
        ("Matrix Tree Explorer", "5-Block Tree Explorer"),
        ("Matrix Accounts", "5-Block Accounts"),
        ("Matrix Progress", "5-Block Progress"),
        ("which level", "which layer"),
        ("Level desc", "Layer desc"),
        ("Level asc", "Layer asc"),
        ("Per-Level Counts", "Per-Layer Counts"),
        ("Per-Level Earned", "Per-Layer Earned"),
        ("Level-wise Commission Stats", "Layer-wise Commission Stats"),
        ("level-wise and total commission", "layer-wise and total commission"),
        ("<div>Level</div>", "<div>Layer</div>"),
    ],
    "frontend/src/pages/admin/AdminMatrixThree.jsx": [
        ("3-Matrix Multi-Tier Engine", "3-Block Multi-Tier Engine"),
        ("3-Matrix", "3-Block"),
        ("Matrix Tree Explorer", "3-Block Tree Explorer"),
        ("Matrix Accounts", "3-Block Accounts"),
        ("Matrix Progress", "3-Block Progress"),
        ("which level", "which layer"),
        ("Level desc", "Layer desc"),
        ("Level asc", "Layer asc"),
        ("Per-Level Counts", "Per-Layer Counts"),
        ("Per-Level Earned", "Per-Layer Earned"),
        ("Level-wise Commission Stats", "Layer-wise Commission Stats"),
        ("level-wise and total commission", "layer-wise and total commission"),
        ("<div>Level</div>", "<div>Layer</div>"),
    ],
    "frontend/src/pages/admin/AdminMatrixCommission.jsx": [
        ("Matrix Commission", "Block Commission"),
        ("5-Matrix", "5-Block"),
        ("3-Matrix", "3-Block"),
        ("Level", "Layer"),
        ("Levels", "Layers"),
    ],
    "frontend/src/pages/admin/AdminLevelCommission.jsx": [
        ("Level Commission", "Layer Commission"),
        ("Level", "Layer"),
        ("Levels", "Layers"),
        ("Level-wise", "Layer-wise"),
    ],
    "frontend/src/pages/admin/AdminOverheadIncome.jsx": [
        ("Matrix / Level", "Blocks / Layer"),
        ("5-Matrix", "5-Block"),
        ("3-Matrix", "3-Block"),
        ("Level Pool", "Layer Pool"),
        ("Unclaimed Level", "Unclaimed Layer"),
    ],
    "frontend/src/pages/admin/AdminUserTree.jsx": [
        ("5-Matrix", "5-Block"),
        ("3-Matrix", "3-Block"),
        ("Matrix Re-anchor", "Block Re-anchor"),
        ("Matrix Tree", "Block Tree"),
        ("Re-anchor Matrix Node", "Re-anchor Block Node"),
        ("Matrix parent", "Block parent"),
        ("Matrix position", "Block position"),
        ("Select Matrix", "Select Block Pool"),
    ],
    "frontend/src/pages/admin/AdminRewardDistribution.jsx": [
        ("5-Matrix", "5-Block"),
        ("3-Matrix", "3-Block"),
        ("Level", "Layer"),
    ],
    "frontend/src/pages/admin/AdminTeamWalletDashboard.jsx": [
        ("5-Matrix", "5-Block"),
        ("3-Matrix", "3-Block"),
        ("Matrix", "Blocks"),
        ("Level", "Layer"),
    ],
    "frontend/src/components/layouts/AdminShell.jsx": [
        ("5-Matrix", "5-Block"),
        ("3-Matrix", "3-Block"),
        ("Matrix", "Blocks"),
        ("Level", "Layer"),
    ],
}

total_changes = 0
for filepath, pairs in replacements_map.items():
    if not os.path.exists(filepath):
        print(f"File not found: {filepath}")
        continue
    with open(filepath, "r", encoding="utf-8") as f:
        content = f.read()

    orig = content
    for old_str, new_str in pairs:
        content = content.replace(old_str, new_str)

    if content != orig:
        with open(filepath, "w", encoding="utf-8") as f:
            f.write(content)
        total_changes += 1
        print(f"Updated {filepath}")
    else:
        print(f"No changes in {filepath}")

print(f"\nCompleted replacements in {total_changes} files.")

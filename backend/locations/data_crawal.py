import json
import re
from rapidfuzz import process, fuzz

# -----------------------------
# FILE PATHS
# -----------------------------
STATES_FILE = "data/states+cities.json"
PINCODE_FILE = "data/pincodes_offline.json"

OUTPUT_REPORT = "postal_district_reconciliation.json"


# -----------------------------
# NORMALIZATION
# -----------------------------
def normalize(text):
    text = text.lower()
    text = text.replace("&", "and")
    text = re.sub(r"[^a-z0-9 ]", "", text)
    text = re.sub(r"\s+", " ", text)
    return text.strip()


# -----------------------------
# LOAD STATE DISTRICTS
# -----------------------------
with open(STATES_FILE, "r", encoding="utf-8") as f:
    states_data = json.load(f)

master_districts = set()

for state in states_data:
    master_districts.add(state["name"])

# Normalize map
norm_master_map = {
    normalize(d): d for d in master_districts
}

master_norm_list = list(norm_master_map.keys())


# -----------------------------
# LOAD POSTAL DISTRICTS
# -----------------------------
with open(PINCODE_FILE, "r", encoding="utf-8") as f:
    pincode_data = json.load(f)

postal_records = pincode_data["records"]

postal_districts = set()

for rec in postal_records:
    postal_districts.add(rec["district"])

norm_postal_map = {
    normalize(d): d for d in postal_districts
}


# -----------------------------
# RECONCILIATION
# -----------------------------
report = []

for norm_name, original_name in norm_postal_map.items():

    if norm_name not in norm_master_map:

        # Fuzzy match
        match, score, _ = process.extractOne(
            norm_name,
            master_norm_list,
            scorer=fuzz.ratio
        )

        report.append({
            "postal_district": original_name,
            "issue": "Missing in master dataset",
            "closest_master_match":
                norm_master_map.get(match) if score >= 80 else None,
            "confidence_score": score
        })


# -----------------------------
# SAVE REPORT
# -----------------------------
with open(OUTPUT_REPORT, "w", encoding="utf-8") as f:
    json.dump(report, f, indent=2, ensure_ascii=False)


print("\n✅ Reconciliation completed")
print(f"Total mismatches found: {len(report)}")

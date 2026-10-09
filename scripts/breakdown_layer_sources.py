from accounts.models import CustomUser, WalletTransaction

u = CustomUser.objects.filter(phone='9999999999').first()

def classifyTransaction(tx):
    type_ = str(tx.type or "").upper()
    meta = tx.meta or {}
    src = str(meta.get("source", "")).upper()
    st = str(tx.source_type or "").upper()
    ot = str(meta.get("orig_type", "")).upper()
    trig = str(meta.get("trigger", "")).upper()

    if (
        type_.startswith("SELF_ACCOUNT")
        or meta.get("ledger") == "SELF_ACCOUNT"
        or type_ == "SELF_ACCOUNT_CREDIT"
        or type_ == "SELF_ACCOUNT_DEBIT"
    ):
        return "SELF_ACCOUNT"

    if (
        type_ == "LEVEL_BONUS"
        or type_ == "AUTOPOOL_BONUS_FIVE"
        or type_ == "AUTOPOOL_BONUS_THREE"
        or (st == "RANK_UPGRADE" and ("LEVEL" in ot or "LEVEL" in type_ or "LEVEL" in str(meta.get("kind", "")).upper()))
        or type_ in ["PRIME_150_SELF", "PRIME_750_SELF", "PRIME_759_SELF"]
        or src.startswith("THREE_MATRIX")
        or src.startswith("FIVE_MATRIX")
        or (type_ == "INCOME_CREDIT_75" and (
            "LEVEL" in ot
            or "AUTOPOOL" in ot
            or "MATRIX" in src
            or trig in ["PRIME_150", "PRIME_750", "PRIME_759"]
        ))
    ):
        return "LAYER"

    return "OTHER"

sources = {}
for tx in WalletTransaction.objects.filter(user=u, amount__gt=0):
    if classifyTransaction(tx) == "LAYER":
        meta = tx.meta or {}
        src = str(meta.get("source", "")).upper()
        ot = str(meta.get("orig_type", "")).upper()
        st = str(tx.source_type or "").upper()
        kind = str(meta.get("kind", "")).upper()
        
        # Categorize
        if "FIVE" in src or ot == "AUTOPOOL_BONUS_FIVE" or "FIVE" in st:
            bucket = "5 Blocks (5-Matrix)"
        elif "THREE" in src or ot == "AUTOPOOL_BONUS_THREE" or "THREE" in st:
            bucket = "3 Blocks (3-Matrix)"
        elif st == "RANK_UPGRADE" or "RANK" in kind or "LEVEL" in kind:
            bucket = "e-Edu Matrix Slabs"
        else:
            bucket = f"Other ({src or st or ot})"
            
        sources[bucket] = sources.get(bucket, 0) + float(tx.amount)

print("BREAKDOWN OF LAYER SOURCES:")
for k, v in sources.items():
    print(f"  {k}: {v:.2f}")
print(f"  Total: {sum(sources.values()):.2f}")

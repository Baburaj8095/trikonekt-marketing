from accounts.models import CustomUser, WalletTransaction
from django.db.models import Sum

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

    if (
        type_ == "DIRECT_REF_BONUS"
        or type_ == "MONTHLY_759_DIRECT"
        or "REFERRAL" in src
        or "REFERRAL" in st
        or (st == "RANK_UPGRADE" and ("DIRECT" in ot or "DIRECT" in type_))
        or (type_ == "INCOME_CREDIT_75" and (
            "DIRECT" in ot
            or "DIRECT" in src
            or trig in ["PACKAGE_DIRECT", "JOIN_REFERRAL"]
        ))
    ):
        return "DIRECT"

    return "OTHER"

layer_txs = []
for tx in WalletTransaction.objects.filter(user=u, amount__gt=0):
    cat = classifyTransaction(tx)
    if cat == "LAYER":
        layer_txs.append(tx)

print(f"Layer TXs count: {len(layer_txs)}")
print(f"Layer TXs sum: {sum(t.amount for t in layer_txs)}")
for t in layer_txs[:10]:
    print(f"  tx id={t.id}, amt={t.amount}, type={t.type}, st={t.source_type}, meta={t.meta}")

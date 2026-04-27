# Smart SSP dropdown missing in Genealogy (Generic Fix)

## Symptom
Some users (example: **7204872928**) purchased **Smart SSP (Monthly 1000/759)** but their newly opened matrix ID did **not** appear inside the Smart SSP dropdown in:

`frontend/src/pages/team/Genealogy5.jsx` → `FiveMatrixTab` / `ThreeMatrixTab`.

## Root cause
The dropdown is built from `team/summary` response field `my_positions`.

On the frontend we further group those positions into:

- `SUBSCRIPTION_750`
- `SMART_SSP`
- `SELF_REBIRTH`

using a **classifier based on**:

- `position.inferred_category` (backend hint)
- `position.source_type` (backend tag)

For some historical/legacy/backfilled rows, the backend may send a position where:

- `source_type` is empty/ambiguous (e.g. `""`, `RECOVERY`, `RESTORATION`, etc.)
- `inferred_category` is missing or an unexpected value

In that case the position was being classified as `OTHER` and the UI didn’t have an `OTHER` category button → effectively **the ID disappeared from the category selector**.

## Fix implemented
### 1) Make category classification more robust (FiveMatrixTab + ThreeMatrixTab)
Files:

- `frontend/src/components/genealogy/FiveMatrixTab.jsx`
- `frontend/src/components/genealogy/ThreeMatrixTab.jsx`

Changes:

- Added a safe `OTHER`/Legacy category so unknown rows never vanish.
- Expanded Smart SSP matching to include legacy tags like `ECOUPON_759` / `ECOUPON_1000`.
- Added a heuristic fallback: if `source_id` looks like Smart SSP (`purchaseId:season[:box]`), classify it as `SMART_SSP` even when `source_type` is missing.
- Only trust `inferred_category` if it matches one of the known category IDs.

### 2) Reduce team summary cache TTL
File:

- `frontend/src/pages/team/Genealogy5.jsx`

Change:

- Reduced `/accounts/team/summary/` `cacheTTL` from **10s → 2s** to prevent “just purchased but not visible yet” issues caused by frontend GET caching.

## Notes / Future
- If backend adds new source tags for Monthly/Smart SSP, update the Smart SSP `match()` list.
- If possible long-term, prefer the backend to always send a stable `inferred_category` for every `my_positions` row.

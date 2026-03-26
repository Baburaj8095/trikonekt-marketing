# Admin-Configurable Withdrawals Window

This project supports **admin configuration** of when users are allowed to create withdrawal requests.

## What was changed

1. **Backend enforcement** (source of truth)
   - `backend/accounts/serializers.py` → `WithdrawalRequestSerializer.create()`
   - Withdrawal requests are allowed only when current time falls inside the configured window.

2. **Admin API**
   - Uses existing endpoint: `PATCH /api/business/admin/commission/master/`
   - Reads/writes a new payload key: `withdrawals_window`

3. **Admin UI**
   - `frontend/src/pages/admin/AdminWithdrawals.jsx`
   - New section "Withdrawals Window" with:
     - Enabled/Disabled
     - Weekday (Mon..Sun)
     - Start time (HH:MM)
     - End time (HH:MM)
     - Save button

4. **User UI** (best-effort)
   - `frontend/src/pages/Wallet.jsx` now shows generic "Withdrawals are not allowed right now" when closed.
   - Backend remains the authority; UI is only a convenience.

## Configuration fields

Stored on `business.CommissionConfig`:

- `withdrawals_enabled` (boolean)
- `withdrawals_weekday` (int, **Python weekday**: `0=Mon .. 6=Sun`)
- `withdrawals_start_time` (time, `HH:MM`)
- `withdrawals_end_time` (time, `HH:MM`)

Notes:

- Window is interpreted in **IST (Asia/Kolkata)** on the backend.
- If `end_time` is less than or equal to `start_time`, the window is treated as **crossing midnight**.
  Example: `18:00 -> 02:00` means from 6 PM to 2 AM next day.

## API payload

### GET

`GET /api/business/admin/commission/master/`

Response includes:

```json
{
  "withdrawals_window": {
    "enabled": true,
    "weekday": 2,
    "start_time": "00:00",
    "end_time": "23:59"
  }
}
```

### PATCH

`PATCH /api/business/admin/commission/master/`

Example:

```json
{
  "withdrawals_window": {
    "enabled": true,
    "weekday": 3,
    "start_time": "00:00",
    "end_time": "23:59"
  }
}
```

## Quick manual test

1. Login as admin
2. Go to **Admin → Withdrawals**
3. Set a window (example: Thursday 00:00 to 23:59) and click **Save**
4. Login as a normal user
5. Go to **Wallet → Request Withdrawal**
6. Try submitting:
   - Outside the window → backend returns error `WITHDRAWALS_WINDOW_CLOSED`
   - Inside the window → request is accepted

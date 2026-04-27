# Backend API Requirements for Dual-Role Authentication

**Date:** April 24, 2026  
**Scope:** Backend validation and requirements for supporting consumer + team dual login

---

## Overview

The dual-role authentication system is primarily a **frontend feature** - users register once and login differently to access different dashboards. However, the backend must ensure:

1. **Team features are accessible** to any authenticated consumer
2. **Data isolation** - team endpoints only return network data
3. **Validation** - team endpoints validate user has team membership

---

## Current API Status

### ✅ Already Implemented

#### Registration Endpoint
```
POST /accounts/register/
├─ Currently accepts: "user", "agency", "business", "employee"
├─ For dual-role: Only "user" role from frontend
└─ No changes needed - already works
```

#### Login Endpoint
```
POST /accounts/login/
├─ Input: username, password, role
├─ Output: access token, refresh token
├─ No changes needed for dual-role
└─ Already respects role in token
```

#### Team Genealogy Endpoint
```
GET /accounts/team/summary/
├─ Returns: network summary, positions, direct team
├─ Auth: Requires valid JWT token
├─ Already available to all authenticated users
└─ No changes needed
```

#### Team Tree Endpoint
```
GET /team/genealogy/5m/counts/
├─ Returns: genealogy tree structure
├─ Auth: Requires valid JWT token
├─ Already available to all authenticated users
└─ No changes needed
```

---

## Required Backend Enhancements

### Enhancement 1: Team Membership Validation

**Objective:** Prevent non-team users from accessing team features

**Current Behavior:** Any authenticated user can access team endpoints

**Recommended Change:**
```python
# Backend middleware or decorator
@check_team_access
def team_genealogy_view(request):
    user = request.user
    # 1. Check if user has team registration
    # 2. Check if user has network members
    # 3. Return error if neither
    
# Pseudo-code:
def has_team_access(user):
    # Method 1: Check if user has any network position
    has_position = Position.objects.filter(
        user=user, 
        pool_type__in=['FIVE_150', 'THREE_150']
    ).exists()
    
    # Method 2: Check if user has network members
    has_downline = User.objects.filter(
        registered_by=user
    ).exists()
    
    # Method 3: Check for explicit team role
    has_team_role = user.roles.filter(role_type='TEAM').exists()
    
    return has_position or has_downline or has_team_role
```

### Enhancement 2: Error Handling for Team-Less Users

**Objective:** Clear error message when team features unavailable

**Response Format:**
```json
{
  "error": "Team features not available",
  "detail": "You don't have active network positions or team members",
  "code": "NO_TEAM_ACCESS",
  "next_step": "Upgrade to join team features"
}
```

### Enhancement 3: Optional - Team Access Flag in Response

**Objective:** Frontend to know if team features are available

**Modified Login Response:**
```json
{
  "access": "eyJ...",
  "refresh": "eyJ...",
  "user": {
    "id": 123,
    "username": "user@example.com",
    "full_name": "Test User",
    "roles": ["user"],
    "has_team_access": true,
    "team_positions": [
      {
        "id": "POS_001",
        "pool_type": "FIVE_150",
        "status": "ACTIVE"
      }
    ]
  }
}
```

---

## API Endpoint Validation

### GET /accounts/team/summary/
**Status:** ✅ Ready  
**Headers Required:**
```
Authorization: Bearer <access_token>
```

**Response:**
```json
{
  "direct_team": [...],
  "direct_team_counts": {...},
  "my_positions": [...],
  "downline": {...},
  "matrix_progress": [...],
  "totals": {...}
}
```

**Validation Needed:**
- Verify user has valid token
- Return empty arrays if user has no team data
- No special team_access check needed (everyone can query)

---

### GET /accounts/genealogy/5m/counts/
**Status:** ✅ Ready  
**Query Parameters:**
```
?root_id=<position_id>
&depth=<levels>
&pool=FIVE_150
```

**Response:**
```json
{
  "root_id": "POS_001",
  "total_members": 100,
  "levels": [
    {"level": 1, "team_count": 5},
    {"level": 2, "team_count": 20}
  ]
}
```

**Validation Needed:**
- Verify root_id belongs to authenticated user
- Return 403 if user tries to access other user's position

---

### GET /accounts/genealogy/5m/tree/
**Status:** ✅ Ready (if exists)  
**Query Parameters:**
```
?root_id=<position_id>
&depth=<levels>
```

**Response:** Network tree structure

---

### GET /rank-matrix/tree/
**Status:** ✅ Ready  
**Response:** Rank/earning matrix data

---

## Important: Team Position Assignment

**Question:** How are team positions assigned?

**Current Assumption:**
- Positions created when user joins MLM network
- Positions tracked in `Position` or `NetworkPosition` model
- Frontend uses `my_positions` from `/accounts/team/summary/` to display available roots

**Requirement for Dual-Role to Work:**
- When consumer registers, they can CHOOSE to activate team features later
- OR team features activate when first network member joins them
- OR admin assigns positions on demand

**Recommendation:**
```python
# Allow team access as soon as first network member joins
@receiver(post_save, sender=User)
def auto_enable_team_on_first_referral(sender, instance, created, **kwargs):
    if not created:
        return
    # instance is newly registered user
    # Don't create positions yet
    pass

@receiver(post_save, sender=Position)
def auto_enable_team_on_first_position(sender, instance, created, **kwargs):
    if not created:
        return
    # When first position created for user, team features unlock
    user = instance.user
    user.has_team_role = True  # If tracking separately
    user.save()
```

---

## Discussion Points

### 1. When Should Team Features Activate?
**Options:**
- A) Immediately on registration (recommended per requirements)
- B) When first network member joins
- C) When first position is assigned
- D) Manual admin approval

**Current Code:** Team endpoints available to anyone authenticated

**Decision:** Keep current behavior - team features available to all consumers (Option A)

---

### 2. Should Backend Validate team_access?
**Currently:** Any authenticated consumer can access team endpoints
  
**Recommendation:** 
- Keep current behavior for backward compatibility
- Add optional validation for future security
- Return empty data instead of error if no team

---

### 3. Multi-Device Login
**Question:** Can user be logged in as consumer on phone AND team on desktop?

**Current:** Same token used for both
**Answer:** Yes, as long as both logins have same token, technically possible

**Recommendation:** Document this behavior

---

## Testing Requirements for Backend

### Test T1: Team Endpoints Accessible
```bash
# After login as consumer:
curl -H "Authorization: Bearer $TOKEN" \
  https://api.example.com/accounts/team/summary/

# Expected: 200 OK with team data
```

### Test T2: Empty Team Data Handling
```bash
# New consumer with no team/positions:
curl -H "Authorization: Bearer $TOKEN" \
  https://api.example.com/accounts/team/summary/

# Expected: 200 OK with empty arrays
# {
#   "my_positions": [],
#   "direct_team": [],
#   "downline": { "direct": 0 }
# }
```

### Test T3: No Cross-User Data Leakage
```bash
# Try to access another user's position:
curl -H "Authorization: Bearer $TOKEN1" \
  https://api.example.com/accounts/genealogy/5m/counts/?root_id=OTHER_USER_POS_ID

# Expected: 403 Forbidden or 404 Not Found
```

---

## Summary of Changes

| Component | Change | Priority | Status |
|-----------|--------|----------|--------|
| Registration | Accept "user" only | Medium | ✅ Frontend |
| Login | Return same token for both | Low | ✅ Already works |
| Team Endpoints | Validate user has access | Medium | ⏳ Optional |
| Error Handling | Clear error if no team | Low | ⏳ Enhancement |
| Response Data | Include team_access flag | Low | ⏳ Enhancement |

---

## Backward Compatibility

**Will these changes break existing functionality?**

**Answer:** NO

- ✅ Existing consumers can still login and use team features
- ✅ Existing team members are unaffected
- ✅ API responses stay the same
- ✅ No database schema changes required

---

## Frontend Assumptions About Backend

The frontend assumes:

1. **POST /accounts/register/** exists and works
2. **POST /accounts/login/** returns JWT with role claim
3. **GET /accounts/team/summary/** returns `my_positions` array
4. **GET /accounts/genealogy/5m/counts/** returns genealogy counts
5. **GET /team/genealogy/5m/tree/** returns tree structure (if used)
6. **User authenticated via Bearer token** in Authorization header

**All these are already implemented** ✅

---

## Security Checklist

For backend teams to review:

- [ ] Team endpoints validate request token
- [ ] Team endpoints verify user ownership of positions
- [ ] Cross-user genealogy access is prevented
- [ ] No sensitive data in error messages
- [ ] Rate limiting on team API calls (prevent scraping)
- [ ] Audit logging for team access
- [ ] JWT expiration respected

---

## Go-Live Checklist

Backend team:

- [ ] Verify all team endpoints return proper error codes (400, 403, 404)
- [ ] Test team endpoints with expired tokens (should get 401)
- [ ] Test with no team data (should return empty, not error)
- [ ] Monitor error rates in production
- [ ] Have rollback plan ready

Frontend team:

- [ ] Deploy LoginV2 with dual tabs ✅
- [ ] Deploy RegisterV2 with consumer only ✅
- [ ] Deploy navigation guards
- [ ] Deploy useLoginContext hook
- [ ] Test in staging environment

---

## Contact & Support

For questions about this implementation:

1. **Frontend Architecture:** See `DUAL_ROLE_AUTH_IMPLEMENTATION.md`
2. **Testing Guide:** See `DUAL_ROLE_AUTH_TESTING.md`
3. **Current Architecture:** See `REGISTRATION_DUAL_ROLE_ANALYSIS.md`

---

**Document Version:** 1.0  
**Status:** Review Ready  
**Last Updated:** April 24, 2026

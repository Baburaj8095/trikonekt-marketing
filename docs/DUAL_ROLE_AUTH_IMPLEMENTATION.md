# Dual-Role Authentication Implementation Guide

**Status:** In Progress (LoginV2 & RegisterV2 Updated)  
**Date:** April 24, 2026

---

## Executive Summary

This document outlines the complete implementation of a **unified login system** where users:
1. **Register once** as a consumer
2. **Login twice** - either as "Consumer" or "Team"  
3. **Use same credentials** for both roles
4. **Access different dashboards** based on login choice

---

## Changes Made So Far

### ✅ 1. LoginV2.jsx - Consumer & Team Login Tabs

**File:** `frontend/src/pages/v2/Auth/LoginV2.jsx`

**Changes:**
- Added role tabs UI showing "Consumer Login" and "Team Login" buttons
- Modified `handleSubmit()` to:
  - Map `team_user` UI state back to `user` role for backend authentication
  - Store `login_context_${ns}` in localStorage as "consumer" or "team"
  - Route to `/team/genealogy` when team login selected
  - Route to `/user/dashboard2` when consumer login selected

**Code locations updated:**
- Lines: Title section → Added tab UI after title
- Lines: handleSubmit() function → Added login context tracking
- Lines: Role initialization → Set default to "user" (consumer)

**New localStorage keys:**
```javascript
localStorage.setItem(`login_context_${ns}`, "consumer" | "team")
// Example: login_context_user = "team"
```

---

### ✅ 2. RegisterV2.jsx - Consumer-Only Registration

**File:** `frontend/src/pages/v2/Auth/RegisterV2.jsx`

**Changes:**
- Modified `Step0()` (role selection) to show **ONLY Consumer option**
- Updated helper message to indicate team features available after registration
- Removed Agency, Business, and Employee role options

**Code locations updated:**
- Lines 1296-1298: Role selection array now contains only `user` role

---

## Changes Still Needed

### 3. Navigation & Dashboard Routing

**Objective:** Ensure users are routed to correct dashboard based on login context

**Files to update:**
- `frontend/src/pages/user/Dashboard.jsx` (or dashboard2)
- `frontend/src/pages/team/Genealogy5.jsx` (already has role detection)
- Create middleware/hook for role-context validation

**Implementation:**
```javascript
// Hook: useLoginContext.js
export const useLoginContext = () => {
  const ns = localStorage.getItem("role_user") === "user" ? "user" : "user";
  const loginContext = localStorage.getItem(`login_context_${ns}`) || "consumer";
  const role = localStorage.getItem(`role_${ns}`);
  
  return { loginContext, role };
};

// Usage in Dashboard component:
const { loginContext } = useLoginContext();

if (loginContext === "team") {
  return <Redirect to="/team/genealogy" />;
}
```

---

### 4. Header/Navigation Updates

**Objective:** Show current login mode and allow role switching

**Files to update:**
- `frontend/src/components/Header.jsx` or navigation component
- `frontend/src/pages/user/Dashboard.jsx`
- `frontend/src/pages/team/Genealogy5.jsx`

**Implementation:**
```jsx
// Role switch button in header
<button onClick={() => {
  // Clear login context
  localStorage.removeItem('login_context_user');
  // Redirect to login
  navigate('/v2/login/user');
}}>
  Switch to {loginContext === 'consumer' ? 'Team' : 'Consumer'} View
</button>
```

**Display current mode:**
```jsx
<Box sx={{ fontSize: 12, fontWeight: 600, color: primaryColor }}>
  Mode: {loginContext === 'team' ? 'Team' : 'Consumer'}
</Box>
```

---

### 5. Backend Validation (Optional Enhancement)

**Objective:** Validate team role access on backend

**Consideration:** Backend should verify user has team membership before granting access to team endpoints.

**Implementation Note:**
```
POST /accounts/login/
{
  "username": "...",
  "password": "...",
  "role": "user",
  "team_access": true  // Optional: hint to backend to check team eligibility
}
```

Response includes:
```json
{
  "access": "...",
  "user_has_team_role": true,
  "team_membership": {...}
}
```

---

## Architecture Diagram

```
┌─────────────────────────────────────────────────────────┐
│                   REGISTRATION                          │
│  ┌───────────────────────────────────────────────────┐  │
│  │  Step 0: Select Account Type                      │  │
│  │  [ Consumer ] (ONLY this option)                  │  │
│  └───────────────────────────────────────────────────┘  │
│  ┌───────────────────────────────────────────────────┐  │
│  │  Step 1: Basic Info + Sponsor                     │  │
│  │  ├─ Email, Phone, Name                           │  │
│  │  ├─ Sponsor Username                             │  │
│  │  └─ Password Setup                               │  │
│  └───────────────────────────────────────────────────┘  │
│  ┌───────────────────────────────────────────────────┐  │
│  │  Step 2: Location & Address                       │  │
│  └───────────────────────────────────────────────────┘  │
│  ┌───────────────────────────────────────────────────┐  │
│  │  Step 3: Submit & Verify                          │  │
│  └───────────────────────────────────────────────────┘  │
└──────────────────────┬────────────────────────────────┘
                       │
                       ▼
        ┌──────────────────────────┐
        │  USER REGISTERED         │
        │  - Account active        │
        │  - Email verified        │
        │  - Ready for login       │
        └──────────────┬───────────┘
                       │
                       ▼
        ┌──────────────────────────────────────────┐
        │        LOGIN PAGE                        │
        │  ┌────────────────────────────────────┐  │
        │  │ [Consumer Login] [Team Login]      │  │
        │  │  (Tab buttons)                     │  │
        │  │                                    │  │
        │  │ Email: _________________           │  │
        │  │ Password: _________________        │  │
        │  │ [Sign In]                          │  │
        │  └────────────────────────────────────┘  │
        └────────┬────────────────────────────┬───┘
                 │                             │
          (Consumer selected)          (Team selected)
                 │                             │
                 ▼                             ▼
        ┌─────────────────────┐     ┌──────────────────────┐
        │ CONSUMER DASHBOARD  │     │ TEAM DASHBOARD       │
        │                     │     │                      │
        │ Features:           │     │ Features:            │
        │ • Dashboard         │     │ • Genealogy          │
        │ • Profile           │     │ • Tree               │
        │ • Refer & Earn      │     │ • Team Wallet        │
        │ • Join Prime        │     │ • History            │
        │ • Support           │     │ • Support            │
        │ • Cart              │     │                      │
        │                     │     │ login_context:       │
        │ login_context:      │     │ "team"               │
        │ "consumer"          │     │                      │
        └─────────────────────┘     └──────────────────────┘
```

---

## Database/Storage

### localStorage Keys

After login, the following keys are set:

```javascript
// Token storage (namespaced by role)
localStorage.setItem('token_user', '<JWT_TOKEN>');
localStorage.setItem('refresh_user', '<REFRESH_TOKEN>');
localStorage.setItem('role_user', 'user');
localStorage.setItem('user_user', JSON.stringify({...userData}));

// NEW: Login context indicator
localStorage.setItem('login_context_user', 'consumer' | 'team');

// Remember username (optional)
localStorage.setItem('remember_username', 'user@example.com');
```

---

## API Endpoints (No Changes)

All endpoints remain the same. The distinction is purely frontend-based:

```
POST /accounts/register/
├─ Only accepts role="user"

POST /accounts/login/
├─ Accepts username + password + role="user"
├─ Response is same regardless of login context
└─ Frontend determines destination based on localStorage.login_context

GET /team/genealogy/ (existing)
├─ Requires valid auth token
├─ Used when login_context="team"

GET /user/dashboard/ (existing)
├─ Requires valid auth token
├─ Used when login_context="consumer"
```

---

## Security Considerations

### 1. Token Reuse
- **Current:** Same JWT token used for both consumer and team views
- **Impact:** User can switch contexts by clearing login_context and reloading
- **Recommendation:** Accept this OR add field-level access control

### 2. Credential Sharing
- **Current:** Same login credentials work for both roles
- **Mitigation:** 
  - Track login attempts per role/context
  - Implement optional 2FA per context
  - Log role switches in activity audit

### 3. Data Isolation
- **Current:** Ensure team endpoints validate user is team member
- **Recommendation:** Add backend check for team membership in genealogy endpoints

---

## Testing Checklist

### Registration Flow
- [ ] Register with consumer role only
- [ ] Verify no other role options visible
- [ ] Verify message about team features shows
- [ ] Confirm registration success page displays
- [ ] Verify redirect to login page after registration

### Login Flow - Consumer
- [ ] Click "Consumer Login" tab
- [ ] Submit credentials
- [ ] Verify redirect to `/user/dashboard2`
- [ ] Check localStorage has `login_context_user` = "consumer"
- [ ] Verify consumer features visible (cart, prime, profile, etc.)

### Login Flow - Team
- [ ] Click "Team Login" tab
- [ ] Submit same credentials
- [ ] Verify redirect to `/team/genealogy`
- [ ] Check localStorage has `login_context_user` = "team"
- [ ] Verify team features visible (tree, genealogy, wallet, etc.)

### Role Switching
- [ ] Both features work with same credentials
- [ ] Logout clears login_context
- [ ] Login again can choose different role

### Navigation Guards
- [ ] Consumer can't directly access `/team/genealogy` without team login
- [ ] Team user can't directly access `/user/dashboard2` without consumer login context
- [ ] Middleware redirects appropriately

---

## Frontend Files to Review/Update

### High Priority (Backend logic)
- [ ] `frontend/src/pages/v2/Auth/LoginV2.jsx` ✅ DONE
- [ ] `frontend/src/pages/v2/Auth/RegisterV2.jsx` ✅ DONE
- [ ] `frontend/src/api/api.js` - Verify login endpoint

### Medium Priority (Navigation & Context)
- [ ] Create `frontend/src/hooks/useLoginContext.js` - NEW
- [ ] `frontend/src/App.jsx` - Add route guards
- [ ] `frontend/src/components/Header.jsx` - Show current mode
- [ ] `frontend/src/pages/user/Dashboard.jsx` - Consumer dashboard
- [ ] `frontend/src/pages/team/Genealogy5.jsx` - Already reads role, verify context handling

### Low Priority (Polish)
- [ ] Update global navigation menus per login_context
- [ ] Add logout prompt confirming logout (will lose context)
- [ ] Style role indicator in header
- [ ] Add help text in both dashboards about switching roles

---

## Deployment Plan

### Phase 1: Core Authentication (Current)
1. Deploy LoginV2 + RegisterV2 changes ✅
2. Test registration & login flows
3. Monitor error rates

### Phase 2: Navigation & Contexts
1. Deploy useLoginContext hook
2. Deploy dashboard routing guards
3. Update header/nav components
4. Test switching between roles

### Phase 3: Polish & Monitor
1. Add analytics for role usage
2. Monitor team feature adoption
3. Gather user feedback
4. Iterate if needed

### Phase 4: Full Rollout
1. Announce to all users
2. Monitor for issues
3. Provide help documentation

---

## Support & Documentation

### For Users
Create guide: "How to Access Team Features"
1. Register as consumer
2. Go to login page
3. Click "Team Login" tab
4. Use same email/password
5. Access tree, genealogy, wallet

### For Support Team
Add to troubleshooting:
- "User can't access team features" → Check login_context in localStorage
- "Wrong dashboard showing" → Verify login context matches intended mode

---

## Rollback Plan

If issues arise:

1. **Minor UI Issues:**
   - Deploy new RegisterV2.jsx/LoginV2.jsx with fixes
   - No data loss

2. **Authentication Issues:**
   - Keep old login flow available at `/login` (fallback URL)
   - Maintain backward compatibility

3. **Full Rollback:**
   - Revert LoginV2 + RegisterV2 to previous version
   - Existing users unaffected (login_context unused)
   - New users can't register (show maintenance message)

---

## Next Steps

1. ✅ **COMPLETED:** LoginV2 + RegisterV2 basic implementation
2. **TODO:** Create useLoginContext hook
3. **TODO:** Update dashboard routing
4. **TODO:** Update header/navigation UI
5. **TODO:** Update Genealogy5.jsx (verify login_context)
6. **TODO:** Create test plan
7. **TODO:** Deploy to staging
8. **TODO:** User testing & feedback
9. **TODO:** Deploy to production

---

## Questions & Decisions

**Q1:** Should admin users have access to both consumer and team? **A:** Admins bypass this system entirely.

**Q2:** Can user change login_context without re-login? **A:** Not recommended - current design requires re-login to switch roles.

**Q3:** What if user has no team membership? **A:** Team endpoints return "no data" or message about not being a network member.

**Q4:** How long does login_context persist? **A:** Until logout OR until browser cache cleared.

---

## References

- [Current Auth Architecture](../REGISTRATION_DUAL_ROLE_ANALYSIS.md)
- [Genealogy5.jsx Role Detection](../../frontend/src/pages/team/Genealogy5.jsx#L120)
- [LoginV2.jsx Implementation](../../frontend/src/pages/v2/Auth/LoginV2.jsx)
- [RegisterV2.jsx Implementation](../../frontend/src/pages/v2/Auth/RegisterV2.jsx)

---

**Last Updated:** April 24, 2026  
**Author:** Architecture Team  
**Status:** In Progress - Awaiting Phase 2 Implementation

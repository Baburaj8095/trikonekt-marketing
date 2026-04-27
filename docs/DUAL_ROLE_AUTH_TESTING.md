# Dual-Role Authentication Testing Guide

**Version:** 1.0  
**Date:** April 24, 2026  
**Scope:** Testing registration, login, and dual-role dashboard access

---

## Overview

This document provides comprehensive test cases for the newly implemented dual-role authentication system where:
- Users register as **consumer only**
- Users can login as **consumer** or **team** with same credentials
- Different dashboards load based on login choice

---

## Test Environment Setup

### Prerequisites
1. **Browser:** Chrome/Firefox (latest)
2. **Test Account:** Create fresh test accounts
3. **Tools:** Browser DevTools (for localStorage inspection)
4. **URLs:**
   - Registration: `http://localhost:3000/v2/register/user`
   - Login: `http://localhost:3000/v2/login/user`
   - Consumer Dashboard: `http://localhost:3000/user/dashboard2`
   - Team Dashboard: `http://localhost:3000/team/genealogy`

### Cleanup Between Tests
```javascript
// Run in browser console to clear all auth data:
const keys = Object.keys(localStorage);
keys.forEach(key => {
  if (key.includes('token_') || key.includes('user_') || key.includes('role_') || key.includes('login_context_')) {
    localStorage.removeItem(key);
  }
});
```

---

## Registration Page Tests

### Test R1: Consumer Registration Form Display
**Objective:** Verify only consumer registration is shown

**Steps:**
1. Navigate to `/v2/register/user`
2. Look at role selection (Step 0)
3. Check visible options

**Expected Result:**
- ✅ Only "Consumer" card is visible
- ✅ No Agency, Business, or Employee options shown
- ✅ Text says "Shop, earn rewards, and enjoy benefits"
- ✅ Continue button is visible

**Pass/Fail:** ___

---

### Test R2: Registration Form Submission (Consumer)
**Objective:** Successfully register a new consumer account

**Steps:**
1. Click "Consumer" card (if not auto-selected)
2. Click "Continue" button
3. Fill in Step 1:
   - Full Name: "Test Consumer"
   - Email: "consumer_test_20260424@test.com"
   - Phone: "9876543210"
   - Sponsor: "ADMIN" (or valid sponsor)
4. Click "Continue"
5. Fill in Step 2:
   - State: "Select state"
   - City: "Select city"
   - Postal Code: "123456"
6. Click "Continue"
7. Fill in Step 3:
   - Password: "Test@123456"
   - Confirm Password: "Test@123456"
8. Click "Register" button

**Expected Result:**
- ✅ All steps complete without errors
- ✅ Success message shows
- ✅ Automatic redirect to login page
- ✅ URL changes to `/v2/login/user`

**Pass/Fail:** ___

---

### Test R3: Registration Helper Text
**Objective:** Verify message about team features shows

**Steps:**
1. Navigate to registration page
2. Look at text under the Consumer card

**Expected Result:**
- ✅ Text mentions "You can access Team features after registration"
- ✅ Text indicates "same credentials"

**Pass/Fail:** ___

---

## Login Page Tests

### Test L1: Login Page Tab Display
**Objective:** Verify both Consumer and Team login tabs are visible

**Steps:**
1. Navigate to `/v2/login/user`
2. Observe the login form

**Expected Result:**
- ✅ Two tabs/buttons visible: "Consumer Login" and "Team Login"
- ✅ "Consumer Login" is highlighted by default (orange background)
- ✅ "Team Login" is unselected (gray background)
- ✅ Username and password fields visible in both

**Pass/Fail:** ___

---

### Test L2: Login As Consumer
**Objective:** Login with consumer credentials and access consumer dashboard

**Steps:**
1. Navigate to `/v2/login/user`
2. Ensure "Consumer Login" tab is selected
3. Enter registered credentials:
   - Username: "consumer_test_20260424@test.com" (or registration email)
   - Password: "Test@123456"
4. Click "Sign In" button
5. Wait for redirect and page load

**Expected Result:**
- ✅ Redirect to `/user/dashboard2`
- ✅ Consumer dashboard loads successfully
- ✅ Check browser console: `localStorage.getItem('login_context_user')` returns `"consumer"`
- ✅ Consumer menu visible: Dashboard, Profile, Refer & Earn, Join Prime, Support, Cart

**Pass/Fail:** ___

**localStorage Check:**
```javascript
// Run in browser console:
console.log('Token:', localStorage.getItem('token_user') ? 'Present' : 'Missing');
console.log('Role:', localStorage.getItem('role_user'));
console.log('Login Context:', localStorage.getItem('login_context_user'));
// Expected output:
// Token: Present
// Role: user
// Login Context: consumer
```

---

### Test L3: Login As Team
**Objective:** Login with same credentials but as team and access team dashboard

**Steps:**
1. Clear localStorage (see Cleanup section above)
2. Navigate to `/v2/login/user`
3. Click "Team Login" tab (should turn orange)
4. Enter same credentials:
   - Username: "consumer_test_20260424@test.com"
   - Password: "Test@123456"
5. Click "Sign In" button
6. Wait for redirect and page load

**Expected Result:**
- ✅ Redirect to `/team/genealogy`
- ✅ Team genealogy page loads successfully
- ✅ Check browser console: `localStorage.getItem('login_context_user')` returns `"team"`
- ✅ Team menu visible: Direct, 5 Matrix, 3 Matrix, Earnings, Support

**Pass/Fail:** ___

**localStorage Check:**
```javascript
// Run in browser console:
console.log('Token:', localStorage.getItem('token_user') ? 'Present' : 'Missing');
console.log('Role:', localStorage.getItem('role_user'));
console.log('Login Context:', localStorage.getItem('login_context_user'));
// Expected output:
// Token: Present
// Role: user
// Login Context: team
```

---

### Test L4: Tab Switching During Login
**Objective:** Verify user can switch tabs before submitting

**Steps:**
1. Navigate to `/v2/login/user`
2. "Consumer Login" tab is active
3. Click "Team Login" tab
4. Verify "Team Login" is now active
5. Click "Consumer Login" tab
6. Verify "Consumer Login" is now active

**Expected Result:**
- ✅ Tabs switch color (active = orange, inactive = gray)
- ✅ Labels update correctly
- ✅ Form fields remain populated across tab switches

**Pass/Fail:** ___

---

### Test L5: Login with Invalid Credentials
**Objective:** Verify error handling for wrong password

**Steps:**
1. Navigate to `/v2/login/user`
2. Select "Consumer Login" tab
3. Enter valid username and wrong password
4. Click "Sign In"

**Expected Result:**
- ✅ Error message displays: "Invalid credentials" or similar
- ✅ User stays on login page
- ✅ Form fields not cleared (for user convenience)
- ✅ Username and password still visible

**Pass/Fail:** ___

---

## Dashboard Access Tests

### Test D1: Consumer Dashboard Features
**Objective:** Verify consumer dashboard shows all expected features

**Steps:**
1. Login as consumer (Test L2)
2. Observe the dashboard layout
3. Check navigation menu/sidebar

**Expected Features Should Include:**
- ✅ Dashboard/Home section
- ✅ Profile link
- ✅ Refer & Earn section
- ✅ Join Prime link
- ✅ Support link
- ✅ Shopping Cart icon
- ✅ Current user info/avatar

**Missing Features (should NOT be visible):**
- ✅ Genealogy
- ✅ Tree view
- ✅ Team Wallet
- ✅ Network/Team History

**Pass/Fail:** ___

---

### Test D2: Team Dashboard Features
**Objective:** Verify team dashboard shows all expected features

**Steps:**
1. Logout from consumer session
2. Login as team (Test L3)
3. Observe the genealogy page layout
4. Check navigation tabs

**Expected Features Should Include:**
- ✅ Genealogy tab
- ✅ Tree visualization
- ✅ Team Wallet section
- ✅ Network History/Activity
- ✅ Support link
- ✅ Rank Up/Earnings section

**Missing Features (should NOT be visible):**
- ✅ Shopping Cart
- ✅ Prime Membership section
- ✅ Personal referral earnings (only team commissions)

**Pass/Fail:** ___

---

### Test D3: Mode Indicator in Header
**Objective:** Verify current mode is clearly visible in header

**Steps:**
1. Login as consumer
2. Look at header/top bar
3. Search for mode indicator
4. Return to login and login as team
5. Check header again

**Expected Result:**
- ✅ Consumer view shows "Consumer" or "👤" badge
- ✅ Team view shows "Team" or "🌳" badge
- ✅ Badge color matches theme (orange/primary)
- ✅ Badge changes when switching roles

**Pass/Fail:** ___

---

## Cross-Role Access Tests

### Test C1: Prevent Direct Team Access from Consumer
**Objective:** Verify consumer can't bypass and access team features

**Steps:**
1. Login as consumer
2. Try to manually navigate to `/team/genealogy`
3. Observe result

**Expected Result:**
- ✅ Redirect to `/team/genealogy` OR
- ✅ "Access Denied" message shows
- ✅ Button to "Switch to Team Login" provided
- ✅ OR automatic redirect to consumer dashboard

**Pass/Fail:** ___

---

### Test C2: Prevent Direct Consumer Access from Team
**Objective:** Verify team user can't bypass and access consumer features

**Steps:**
1. Login as team
2. Try to manually navigate to `/user/dashboard2`
3. Observe result

**Expected Result:**
- ✅ Redirect to `/user/dashboard2` OR
- ✅ "Access Denied" message shows
- ✅ Button to "Switch to Consumer Login" provided
- ✅ OR automatic redirect to team dashboard

**Pass/Fail:** ___

---

## Role Switching Tests

### Test S1: Switch from Consumer to Team
**Objective:** Verify user can switch roles

**Steps:**
1. Login as consumer (Test L2)
2. Look for "Switch to Team" button/option
3. Click it
4. Observe redirect

**Expected Result:**
- ✅ Redirect to login page OR
- ✅ Automatic redirect to `/team/genealogy` with new login_context
- ✅ Token remains valid
- ✅ localStorage `login_context_user` changes to "team"

**Pass/Fail:** ___

---

### Test S2: Switch from Team to Consumer
**Objective:** Verify user can switch back to consumer

**Steps:**
1. Login as team (Test L3)
2. Look for "Switch to Consumer" button/option
3. Click it
4. Observe redirect

**Expected Result:**
- ✅ Redirect to login page OR
- ✅ Automatic redirect to `/user/dashboard2` with new login_context
- ✅ Token remains valid
- ✅ localStorage `login_context_user` changes to "consumer"

**Pass/Fail:** ___

---

## Session Management Tests

### Test M1: Remember Me Functionality
**Objective:** Verify "Remember me" saves username

**Steps:**
1. Navigate to login page
2. Check "Remember me" checkbox
3. Enter username and password
4. Login
5. Logout
6. Return to login page
7. Check if username is pre-filled

**Expected Result:**
- ✅ Checkbox is checked
- ✅ After logout, username is pre-filled on next visit
- ✅ Password is NOT pre-filled (security)

**Pass/Fail:** ___

---

### Test M2: Logout Clears Login Context
**Objective:** Verify logout clears authentication and context

**Steps:**
1. Login as consumer
2. Click logout button
3. Verify redirect to login page
4. Check localStorage in console

**Expected Result:**
- ✅ Redirect to `/v2/login/user`
- ✅ localStorage tokens are cleared
- ✅ `login_context_user` is cleared
- ✅ Cannot go back to dashboard using back button

**Console Check:**
```javascript
// After logout:
console.log('Token:', localStorage.getItem('token_user')); // Should be null
console.log('Login Context:', localStorage.getItem('login_context_user')); // Should be null
```

**Pass/Fail:** ___

---

### Test M3: Session Persistence
**Objective:** Verify session persists across page reloads

**Steps:**
1. Login as consumer
2. Verify dashboard loads
3. Press F5 to reload page
4. Check if still logged in

**Expected Result:**
- ✅ Page reloads and stays on dashboard
- ✅ User data still visible
- ✅ No redirect to login
- ✅ localStorage still has token and login_context

**Pass/Fail:** ___

---

## Error Handling Tests

### Test E1: Invalid Token Handling
**Objective:** Verify system handles invalid/expired tokens

**Steps:**
1. Login as consumer
2. Open DevTools
3. Manually corrupt token in localStorage:
   ```javascript
   localStorage.setItem('token_user', 'invalid.token.here');
   ```
4. Reload page
5. Observe result

**Expected Result:**
- ✅ System detects invalid token
- ✅ Redirect to login page
- ✅ Error message about session
- ✅ Can login again normally

**Pass/Fail:** ___

---

### Test E2: Missing login_context
**Objective:** Verify fallback when login_context is missing

**Steps:**
1. Login as consumer
2. Open DevTools
3. Clear login_context manually:
   ```javascript
   localStorage.removeItem('login_context_user');
   ```
4. Reload page
5. Observe result

**Expected Result:**
- ✅ Default to consumer mode
- ✅ Consumer dashboard loads
- ✅ No error message
- ✅ login_context regenerated as "consumer"

**Pass/Fail:** ___

---

## Browser Compatibility Tests

### Test B1: Chrome
**Objective:** Test on Chrome browser

**Steps:**
1. Open in Chrome (latest version)
2. Run tests: R1, R2, L1, L2, L3, D1, D2

**Expected Result:**
- ✅ All tests pass
- ✅ No console errors
- ✅ No visual glitches

**Pass/Fail:** ___

---

### Test B2: Firefox
**Objective:** Test on Firefox browser

**Steps:**
1. Open in Firefox (latest version)
2. Run tests: R1, R2, L1, L2, L3, D1, D2

**Expected Result:**
- ✅ All tests pass
- ✅ No console errors
- ✅ No visual glitches

**Pass/Fail:** ___

---

### Test B3: Safari
**Objective:** Test on Safari browser (if applicable)

**Steps:**
1. Open in Safari (latest version)
2. Run tests: R1, R2, L1, L2, L3, D1, D2

**Expected Result:**
- ✅ All tests pass
- ✅ No console errors
- ✅ localStorage persists correctly

**Pass/Fail:** ___

---

## Performance Tests

### Test P1: Login Response Time
**Objective:** Verify login completes within reasonable time

**Steps:**
1. Open Network tab in DevTools
2. Perform login
3. Measure time to successful redirect

**Expected Result:**
- ✅ API response < 3 seconds
- ✅ Dashboard loads < 5 seconds total
- ✅ No timeout errors

**Actual Time:** ___ seconds

**Pass/Fail:** ___

---

### Test P2: Dashboard Load Time
**Objective:** Verify dashboard loads efficiently

**Steps:**
1. Open Performance tab in DevTools
2. Hard refresh dashboard page
3. Check load metrics

**Expected Result:**
- ✅ First Contentful Paint (FCP) < 2 seconds
- ✅ Largest Contentful Paint (LCP) < 4 seconds
- ✅ No excessive reflows/repaints

**Actual Metrics:** 
- FCP: ___ seconds
- LCP: ___ seconds

**Pass/Fail:** ___

---

## Accessibility Tests

### Test A1: Keyboard Navigation
**Objective:** Verify all features accessible via keyboard

**Steps:**
1. Login page: Tab through form fields
2. Tab to "Consumer Login" and "Team Login" tabs
3. Use arrow keys to switch tabs
4. Press Enter to submit form

**Expected Result:**
- ✅ All interactive elements reachable with Tab
- ✅ Focus indicators visible
- ✅ Enter key submits form

**Pass/Fail:** ___

---

### Test A2: Screen Reader Support
**Objective:** Verify screen reader users can navigate

**Steps:**
1. Use browser's built-in screen reader (or NVDA/JAWS)
2. Navigate login page
3. Check if tabs are announced correctly
4. Verify form labels read properly

**Expected Result:**
- ✅ Login form labels announced
- ✅ Tab names announced correctly
- ✅ Buttons are announced as buttons
- ✅ No missing labels

**Pass/Fail:** ___

---

## Regression Tests

### Test Regression 1: Original Login Still Works
**Objective:** Verify existing single-role login still functions

**Steps:**
1. Test login with URL-based role: `/v2/login/agency`
2. Verify agency login still works (if not disabled)

**Expected Result:**
- ✅ Existing role-based login still functions
- ✅ Backward compatibility maintained

**Pass/Fail:** ___

---

### Test Regression 2: Consumer Features Intact
**Objective:** Verify consumer shopping features work

**Steps:**
1. Login as consumer
2. Navigate to cart
3. Add item to cart
4. Proceed through checkout mockup

**Expected Result:**
- ✅ Cart functionality works
- ✅ Shopping features accessible
- ✅ No broken links

**Pass/Fail:** ___

---

## Test Summary

Total Tests: **42**

| Category | Count | Passed | Failed | Notes |
|----------|-------|--------|--------|-------|
| Registration | 3 | ___ | ___ | |
| Login | 5 | ___ | ___ | |
| Dashboard | 3 | ___ | ___ | |
| Cross-Role | 2 | ___ | ___ | |
| Role Switching | 2 | ___ | ___ | |
| Session Management | 3 | ___ | ___ | |
| Error Handling | 2 | ___ | ___ | |
| Browser Compatibility | 3 | ___ | ___ | |
| Performance | 2 | ___ | ___ | |
| Accessibility | 2 | ___ | ___ | |
| Regression | 2 | ___ | ___ | |
| **TOTAL** | **42** | ___ | ___ | |

---

## Known Issues & Workarounds

| Issue | Severity | Status | Workaround |
|-------|----------|--------|-----------|
| ... | ... | ... | ... |

---

## Sign-Off

| Role | Name | Date | Signature |
|------|------|------|-----------|
| QA Lead | ___________ | _______ | __________ |
| Dev Lead | ___________ | _______ | __________ |
| Product Owner | ___________ | _______ | __________ |

---

## Appendix: Useful Commands

### Clear All Auth Data
```javascript
// Browser console:
const keys = Object.keys(localStorage);
keys.filter(k => k.includes('token_') || k.includes('login_context_')).forEach(k => {
  localStorage.removeItem(k);
  console.log('Cleared:', k);
});
```

### Check Current Auth State
```javascript
// Browser console:
console.log({
  token: localStorage.getItem('token_user') ? 'Present' : 'Missing',
  role: localStorage.getItem('role_user'),
  loginContext: localStorage.getItem('login_context_user'),
  user: JSON.parse(localStorage.getItem('user_user') || '{}'),
});
```

### Test All Tabs
```javascript
// Navigate consumer login:
window.location.href = '/v2/login/user';

// Then consumer dashboard:
window.location.href = '/user/dashboard2';

// Then team dashboard:
window.location.href = '/team/genealogy';
```

---

**Document Version:** 1.0  
**Last Updated:** April 24, 2026

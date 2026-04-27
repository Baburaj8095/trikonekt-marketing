# Dual-Role Authentication - Visual Implementation Guide

---

## Registration Page Changes

### BEFORE
```
┌─────────────────────────────────────────┐
│   Choose how you want to use TRIKONEKT  │
├─────────────────────────────────────────┤
│                                         │
│  ┌────────────────────────────────────┐ │
│  │ Consumer                           │ │
│  │ Shop, earn rewards, and benefits   │ │
│  └────────────────────────────────────┘ │
│                                         │
│  ┌────────────────────────────────────┐ │
│  │ Agency                             │ │
│  │ Build a network and earn...        │ │
│  └────────────────────────────────────┘ │
│                                         │
│  ┌────────────────────────────────────┐ │
│  │ Business/Merchant                  │ │
│  │ Promote, sell, and grow...         │ │
│  └────────────────────────────────────┘ │
│                                         │
│  ┌────────────────────────────────────┐ │
│  │ Employee                           │ │
│  │ Marketing, training...             │ │
│  └────────────────────────────────────┘ │
│                                         │
│  [Continue]                             │
└─────────────────────────────────────────┘
```

### AFTER ✅
```
┌─────────────────────────────────────────┐
│   Choose how you want to use TRIKONEKT  │
├─────────────────────────────────────────┤
│                                         │
│  ┌────────────────────────────────────┐ │
│  │ Consumer                           │ │
│  │ Shop, earn rewards, and benefits   │ │
│  └────────────────────────────────────┘ │
│                                         │
│  You can access Team features after    │
│  registration with the same credentials│
│                                         │
│  [Continue]                             │
└─────────────────────────────────────────┘
```

**Key Changes:**
- Only Consumer option visible
- Helper text about team features
- Simpler, faster onboarding

---

## Login Page Changes

### BEFORE
```
┌────────────────────────────────────┐
│         LOGIN                      │
│   Secure access to your account    │
├────────────────────────────────────┤
│                                    │
│  Email: [________________]         │
│  Password: [________________]      │
│  [ ] Remember me                   │
│                                    │
│              [Sign In]             │
│                                    │
│  Don't have account? [Register]    │
└────────────────────────────────────┘
```

### AFTER ✅
```
┌──────────────────────────────────────────┐
│           LOGIN                          │
│     Secure access to your account        │
├──────────────────────────────────────────┤
│                                          │
│  [Consumer Login] [Team Login]           │
│   (tabs/buttons - click to switch)       │
│                                          │
│  Email: [________________]               │
│  Password: [________________]            │
│  [ ] Remember me                         │
│                                          │
│    [Sign In]                             │
│                                          │
│  Don't have account? [Register]          │
└──────────────────────────────────────────┘
```

**Key Changes:**
- Two prominent tabs: Consumer & Team
- Same email/password works for both
- User chooses which dashboard after login
- Visual feedback on which tab is selected

---

## User Journey - Complete Flow

### Path 1: Consumer Mode

```
┌────────────────┐
│  REGISTRATION  │  Registration page shows ONLY Consumer
│  (Consumer)    │  - Register with email, phone, password
└────────┬───────┘
         │
         ▼
┌────────────────────────────┐
│  LOGIN PAGE                │
│  [Consumer] [Team]         │  Click "Consumer Login" tab
├────────────────────────────┤
│ Email: test@example.com    │
│ Password: ••••••••         │
│ [Sign In]                  │
└────────┬───────────────────┘
         │
         │ Submit with login_context = "consumer"
         │
         ▼
┌────────────────────────────┐
│  localStorage updated:     │
│  - token_user: JWT        │
│  - role_user: "user"      │
│  - login_context_user: "consumer" ◄─ KEY
└────────┬───────────────────┘
         │
         │ Redirect to /user/dashboard2
         │
         ▼
┌────────────────────────────┐
│  CONSUMER DASHBOARD        │
│  • Dashboard               │
│  • Profile                 │
│  • Refer & Earn            │
│  • Join Prime              │
│  • Support                 │
│  • Shopping Cart           │
│  • [Mode: Consumer]        │
└────────────────────────────┘
```

### Path 2: Team Mode (Same User!)

```
┌────────────────┐
│  REGISTRATION  │  Same registration as Path 1
│  (Consumer)    │  (User is still a consumer)
└────────┬───────┘
         │
         ▼
┌────────────────────────────┐
│  LOGIN PAGE                │
│  [Consumer] [Team]         │  Click "Team Login" tab ◄─ DIFFERENT!
├────────────────────────────┤
│ Email: test@example.com    │  SAME EMAIL
│ Password: ••••••••         │  SAME PASSWORD
│ [Sign In]                  │
└────────┬───────────────────┘
         │
         │ Submit with login_context = "team"
         │
         ▼
┌────────────────────────────┐
│  localStorage updated:     │
│  - token_user: JWT        │
│  - role_user: "user"      │
│  - login_context_user: "team" ◄─ DIFFERENT KEY VALUE
└────────┬───────────────────┘
         │
         │ Redirect to /team/genealogy
         │
         ▼
┌────────────────────────────┐
│  TEAM DASHBOARD            │
│  • Genealogy               │
│  • Tree                    │
│  • Team Wallet             │
│  • History                 │
│  • Support                 │
│  • [Mode: Team]            │
└────────────────────────────┘
```

---

## localStorage Comparison

### After Consumer Login
```javascript
{
  "token_user": "eyJhbGc...",
  "refresh_user": "eyJhbGc...",
  "role_user": "user",
  "user_user": "{\"id\":123,\"email\":\"...\"}",
  "login_context_user": "consumer",        // ◄─ KEY INDICATOR
  "remember_username": "test@example.com"
}
```

### After Team Login (SAME USER!)
```javascript
{
  "token_user": "eyJhbGc...",            // SAME TOKEN
  "refresh_user": "eyJhbGc...",
  "role_user": "user",                    // SAME ROLE
  "user_user": "{\"id\":123,\"email\":\"...\"}",  // SAME USER
  "login_context_user": "team",           // ◄─ DIFFERENT!
  "remember_username": "test@example.com"
}
```

**Critical Point:** Only `login_context_user` changes! Everything else stays the same!

---

## Module Architecture

```
┌─────────────────────────────────────────────────────────┐
│                      USER BROWSER                       │
├─────────────────────────────────────────────────────────┤
│                                                         │
│  ┌──────────────────────────────────────────────────┐  │
│  │  LoginV2.jsx (UPDATED)                           │  │
│  │  - Dual-role tab UI                              │  │
│  │  - handleSubmit() stores login_context           │  │
│  │  - Routes to /consumer or /team dashboard        │  │
│  └──────────────────────────────────────────────────┘  │
│                          ▲                               │
│                          │                               │
│  ┌──────────────────────────────────────────────────┐  │
│  │  RegisterV2.jsx (UPDATED)                        │  │
│  │  - Shows Consumer only                           │  │
│  │  - No role selection dropdown                    │  │
│  └──────────────────────────────────────────────────┘  │
│                                                         │
│  ┌──────────────────────────────────────────────────┐  │
│  │  useLoginContext.js (NEW)                        │  │
│  │  - Reads login_context from localStorage         │  │
│  │  - Provides: isTeamMode, isConsumerMode          │  │
│  │  - Provides: switchToTeam(), switchToConsumer()  │  │
│  └──────────────────────────────────────────────────┘  │
│              ▲                                           │
│              │ Used by:                                 │
│          ┌───┴──────────────────────────────────────┐   │
│          │                                          │   │
│  ┌───────┴────────┐                  ┌─────────────┴──┐ │
│  │ Dashboard.jsx  │                  │Genealogy5.jsx  │ │
│  │(Consumer)      │                  │(Team)         │ │
│  └────────────────┘                  └────────────────┘ │
│                                                         │
│  ┌──────────────────────────────────────────────────┐  │
│  │  LoginContextHeader.jsx (NEW - Optional)         │  │
│  │  - Shows mode indicator badge                    │  │
│  │  - Provides "Switch Role" button                 │  │
│  │  - User logout menu                              │  │
│  └──────────────────────────────────────────────────┘  │
│                                                         │
└─────────────────────────────────────────────────────────┘
                         ▲
                         │ API calls (no change)
                         │
                    ┌────┴─────┐
                    │ Backend   │
                    │ (Unchanged)
                    └───────────┘
```

---

## Login Context Flow Diagram

```
┌──────────────────────────────────────────────────────────┐
│                   User Clicks Login                      │
└────────────────────┬─────────────────────────────────────┘
                     │
         ┌───────────┴───────────┐
         │                       │
         ▼                       ▼
    ┌─────────────┐         ┌──────────────┐
    │ Consumer    │         │ Team         │
    │ Login Tab   │         │ Login Tab    │
    │ (orange)    │         │ (gray)       │
    └────┬────────┘         └────┬─────────┘
         │ setRole("user")       │ setRole("team_user")
         │                       │
         ├───────────┬───────────┤
         │           │           │
         │         Submit Form   │
         │           │           │
         │ ┌─────────▼─────────┐ │
         │ │ handleSubmit()    │ │
         │ │ loginContext =    │ │
         │ │ role === "team_user" ? "team" : "consumer"
         │ └────────┬──────────┘ │
         │          │            │
         ├──────────┴────────────┤
         │
         ▼
    ┌──────────────────┐
    │ Backend Login    │
    │ /accounts/login/ │
    │ (Same endpoint)  │
    └────┬─────────────┘
         │ Returns JWT token
         │
    ┌────▼─────────────────────┐
    │ Parse JWT & Store         │
    │ - token_user: JWT         │
    │ - role_user: "user"       │
    │ - login_context_user:     │
    │   "consumer" | "team" ◄─ KEY!
    └────┬──────────────────────┘
         │
    ┌────▼──────────────────────┐
    │ Conditional Navigate       │
    ├────────────────────────────┤
    │ if loginContext == "team"  │
    │   → /team/genealogy        │
    │ else                       │
    │   → /user/dashboard2       │
    └────────────────────────────┘
```

---

## Key Implementation Points

### 1. Tab UI in LoginV2.jsx
```jsx
<button
  onClick={() => setRole("user")}      // Consumer
  style={{
    backgroundColor: role === "user" ? "#FF7B00" : "transparent",
    color: role === "user" ? "#FFFFFF" : "#6B7280",
  }}
>
  Consumer Login
</button>

<button
  onClick={() => setRole("team_user")}  // Team (mapped to "user" at submit)
  style={{
    backgroundColor: role === "team_user" ? "#FF7B00" : "transparent",
    color: role === "team_user" ? "#FFFFFF" : "#6B7280",
  }}
>
  Team Login
</button>
```

### 2. Role Mapping in handleSubmit()
```jsx
const handleSubmit = async (e) => {
  // Map UI choice to backend role
  const submitRole = role === "team_user" ? "user" : role;  // Both map to "user"!
  const loginContext = role === "team_user" ? "team" : "consumer";  // But track intent
  
  // ... authentication ...
  
  // Store the context
  localStorage.setItem(`login_context_${ns}`, loginContext);
  
  // Route based on context
  if (loginContext === "team") {
    navigate("/team/genealogy", { replace: true });
  } else {
    navigate("/user/dashboard2", { replace: true });
  }
};
```

### 3. Hook Usage in Components
```jsx
import useLoginContext from '../hooks/useLoginContext';

function MyComponent() {
  const { loginContext, isTeamMode, isConsumerMode } = useLoginContext();
  
  return (
    <div>
      Current Mode: {isTeamMode ? "Team" : "Consumer"}
      {isTeamMode && <TeamFeatures />}
      {isConsumerMode && <ConsumerFeatures />}
    </div>
  );
}
```

---

## Summary of Changes

| File | Change | Impact |
|------|--------|--------|
| RegisterV2.jsx | Show consumer only | Simpler onboarding |
| LoginV2.jsx | Add dual tabs | Users choose mode at login |
| useLoginContext.js | NEW hook | Manage context throughout app |
| LoginContextHeader.jsx | NEW component | Show & switch modes |

**Backend:** No changes needed! ✅

**Database:** No changes needed! ✅

**API:** No changes needed! ✅

---

## Testing the Implementation

### Quick Test: Consumer Login
```
1. Go to http://localhost:3000/v2/login/user
2. Click "Consumer Login" tab (should be orange)
3. Enter credentials
4. Click "Sign In"
5. Should redirect to /user/dashboard2
6. Check: localStorage.getItem('login_context_user') === "consumer"
```

### Quick Test: Team Login
```
1. Clear all localStorage (see docs)
2. Go to http://localhost:3000/v2/login/user
3. Click "Team Login" tab (should turn orange)
4. Enter SAME credentials as before
5. Click "Sign In"
6. Should redirect to /team/genealogy
7. Check: localStorage.getItem('login_context_user') === "team"
```

### Verification
```javascript
// Both should show:
localStorage.getItem('token_user');      // JWT present
localStorage.getItem('role_user');       // "user"

// DIFFERENT:
localStorage.getItem('login_context_user');  // "consumer" vs "team"
```

---

**Version:** 1.0  
**Created:** April 24, 2026  
**Status:** Complete

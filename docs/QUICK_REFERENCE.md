# Dual-Role Auth - Quick Reference Card

**Print this or bookmark for quick access!**

---

## 🎯 One-Liner
Users register as consumer, login as consumer OR team, access different dashboards with same credentials.

---

## 📁 Key Files

| File | Purpose | Status |
|------|---------|--------|
| `LoginV2.jsx` | Login with Consumer/Team tabs | ✅ DONE |
| `RegisterV2.jsx` | Consumer-only registration | ✅ DONE |
| `useLoginContext.js` | Hook for mode management | ✅ DONE |
| `LoginContextHeader.jsx` | Mode indicator + switch button | ✅ DONE |

---

## 🔑 Key Concept

```
SAME USER → SAME EMAIL/PASSWORD → DIFFERENT TAB → DIFFERENT DASHBOARD
                                   ↓
                            Different localStorage value
                            login_context_user = "consumer" or "team"
                            ↓
                     Router sends to different page
                     /user/dashboard2 or /team/genealogy
```

---

## 💾 localStorage Keys

After ANY successful login:
```javascript
token_user              // JWT (same for both modes)
role_user              // "user" (same for both modes)
login_context_user     // "consumer" or "team" (DIFFERENT!)
user_user              // User object (same for both modes)
```

---

## ✅ What Already Works

- [x] Registration shows consumer only
- [x] Login has two tabs
- [x] Both tabs authenticate user
- [x] Correct dashboard loads
- [x] Context stored in localStorage
- [x] Custom hook for context management
- [x] Header component with mode indicator

---

## 🚧 What's Not Done

- [ ] Route guards (prevent cross-mode access)
- [ ] Header integration (show mode indicator)
- [ ] Dashboard routing fixes
- [ ] Full test suite
- [ ] Production deployment

---

## 🧪 Quick Testing

### Test Consumer Login
```
1. /v2/login/user
2. Click "Consumer Login"
3. Login → /user/dashboard2
4. Check: localStorage.getItem('login_context_user') === "consumer"
```

### Test Team Login
```
1. Clear localStorage
2. /v2/login/user
3. Click "Team Login"
4. Login → /team/genealogy
5. Check: localStorage.getItem('login_context_user') === "team"
```

---

## 🎨 UI Components

### useLoginContext Hook
```javascript
const { 
  loginContext,      // "consumer" or "team"
  isTeamMode,        // boolean
  isConsumerMode,    // boolean
  switchToTeam(),    
  switchToConsumer(),
  clearLoginContext()
} = useLoginContext();
```

### LoginContextHeader Component
```jsx
<LoginContextHeader />
// Shows: [Mode Badge] [Switch Button] [User Menu]

// Or just the badge:
<ModeIndicator />  // Shows "👤 Consumer" or "🌳 Team"

// Or just the switch button:
<SwitchRoleButton />  // "Go to Team →" or "← Back to Consumer"
```

---

## 🔗 Code Locations

### Login Tab UI
`LoginV2.jsx` lines 298-344 (Role tabs)

### Login Submission with Context
`LoginV2.jsx` lines 95-172 (handleSubmit function)

### Hook Logic
`useLoginContext.js` lines 1-80 (Full implementation)

### Component Examples
`LoginContextHeader.jsx` lines 1-100 (All components)

---

## 📊 User Journey

```
Register   → Login    → Context    → Dashboard
(Consumer)   (Choose    (Stored)    (Shown)
only)        mode)
             ↙    ↘
        Consumer  Team
        Login     Login
        ↓         ↓
      dash2    genealogy
```

---

## 🛡️ Security Notes

- ✅ Same token for both (by design - simplicity)
- ⚠️ Consider 2FA per role (future enhancement)
- ⚠️ Monitor cross-role suspicious activity (future)
- ✅ Backend validates team membership as enhancement

---

## 🐛 Common Issues & Fixes

| Issue | Check | Fix |
|-------|-------|-----|
| Register shows other roles | RegisterV2.jsx lines 1296-1298 | roles array should have only "user" |
| No login tabs | LoginV2.jsx lines 298-344 | Role buttons UI missing? |
| Wrong dashboard loads | LoginV2.jsx handleSubmit() | Check routing logic for loginContext |
| login_context not stored | LoginV2.jsx line ~127 | localStorage.setItem() call missing? |
| Context not persisting | Browser privacy settings | Check localStorage is enabled |

---

## 📚 Documentation Map

**Need to understand the feature?**
→ [REGISTRATION_DUAL_ROLE_ANALYSIS.md](REGISTRATION_DUAL_ROLE_ANALYSIS.md)

**Need technical implementation details?**
→ [DUAL_ROLE_AUTH_IMPLEMENTATION.md](DUAL_ROLE_AUTH_IMPLEMENTATION.md)

**Need to test it?**
→ [DUAL_ROLE_AUTH_TESTING.md](DUAL_ROLE_AUTH_TESTING.md) (42 test cases)

**Need backend requirements?**
→ [BACKEND_REQUIREMENTS_DUAL_ROLE.md](BACKEND_REQUIREMENTS_DUAL_ROLE.md)

**Need visual guide?**
→ [VISUAL_IMPLEMENTATION_GUIDE.md](VISUAL_IMPLEMENTATION_GUIDE.md)

**Project summary?**
→ [DUAL_ROLE_AUTH_SUMMARY.md](DUAL_ROLE_AUTH_SUMMARY.md)

---

## 🚀 Next Development Steps

### Phase 2: Route Guards
```javascript
// Create ProtectedRoute component:
<ProtectedRoute 
  requiredMode="team" 
  fallback="/team/genealogy"
  element={<YourComponent />}
/>

// Use in App.jsx routing:
<Route path="/team/*" element={<ProtectedRoute requiredMode="team" ... />} />
<Route path="/user/*" element={<ProtectedRoute requiredMode="consumer" ... />} />
```

### Phase 3: Header Integration
```jsx
// In main layout component:
import { LoginContextHeader } from './components/LoginContextHeader';

function Layout() {
  return (
    <>
      <LoginContextHeader />
      <Routes>...</Routes>
    </>
  );
}
```

### Phase 4: Testing (42 tests in docs)
```bash
npm test
# Run test suite from DUAL_ROLE_AUTH_TESTING.md
```

---

## 💡 Key Insights

1. **Backend unchanged** - API doesn't know about consumer vs team distinction
2. **Frontend decides** - UI tabs → localStorage context → routing
3. **Same token** - Simplifies implementation, allows context switching
4. **Future-proof** - Can add backend validation later without breaking changes
5. **Mobile-ready** - localStorage works on all devices

---

## ⚡ Code Snippets

### Check current mode anywhere
```javascript
const loginContext = localStorage.getItem('login_context_user') || 'consumer';
if (loginContext === 'team') {
  // Show team UI
}
```

### Switch to team mode programmatically
```javascript
localStorage.setItem('login_context_user', 'team');
window.location.href = '/team/genealogy';
```

### Use the hook (recommended)
```javascript
const { switchToTeam } = useLoginContext();
<button onClick={switchToTeam}>Go to Team</button>
```

---

## 📞 Support

**Can't find something?** Check the docs in this order:
1. REGISTRATION_DUAL_ROLE_ANALYSIS.md (What & Why)
2. DUAL_ROLE_AUTH_IMPLEMENTATION.md (How)
3. VISUAL_IMPLEMENTATION_GUIDE.md (Diagrams)
4. DUAL_ROLE_AUTH_TESTING.md (Test cases)
5. This card (Quick reference)

---

## ✨ Success Checklist

- [ ] loginV2.jsx has dual tabs
- [ ] RegisterV2.jsx shows consumer only
- [ ] Can login as consumer → /user/dashboard2
- [ ] Can login as team → /team/genealogy
- [ ] login_context_user stored in localStorage
- [ ] useLoginContext hook works in components
- [ ] No console errors
- [ ] All 42 tests pass (from testing guide)

---

**Quick Reference v1.0** | Apr 24, 2026 | Bookmark this!

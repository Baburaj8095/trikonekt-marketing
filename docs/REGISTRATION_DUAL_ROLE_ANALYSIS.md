# Registration & Dual-Role Authentication Flow Analysis

**Date:** April 24, 2026  
**Feature:** Consumer Registration + Dual Login (Consumer & Team Role)

---

## 1. Overview

This system introduces a **unified registration process** where a single user account can operate in **two distinct roles**:
- **Consumer Role:** Shopping, personal benefits, referrals
- **Team Role:** Network management, MLM operations

Both roles share the **same credentials** but present entirely different feature sets and dashboards.

---

## 2. Flow Diagram

```
┌─────────────────────────────────────────────────────────────────────┐
│                    REGISTRATION PAGE                                │
│  - Show ONLY Consumer Registration                                  │
│  - Collect: Email, Phone, Password, etc.                            │
│  - Create single user account in system                             │
└────────────────────┬────────────────────────────────────────────────┘
                     │
                     ▼
        ┌────────────────────────┐
        │   SAVE USER & REDIRECT │
        │   TO LOGIN PAGE        │
        └────────────┬───────────┘
                     │
                     ▼
┌─────────────────────────────────────────────────────────────────────┐
│                      LOGIN PAGE                                      │
│  ┌───────────────────────────────────────────────────────────────┐  │
│  │  [ CONSUMER LOGIN ]        [ TEAM LOGIN ]                    │  │
│  │  (Toggle/Tab between)                                        │  │
│  │                                                              │  │
│  │  Email: __________________                                  │  │
│  │  Password: __________________                               │  │
│  │  [ Login ]                                                  │  │
│  └───────────────────────────────────────────────────────────────┘  │
│                                                                      │
│  Same credentials work for BOTH roles                               │
└────────────────────┬─────────────────────────────────┬──────────────┘
                     │                                 │
         (Consumer Login)                   (Team Login)
                     │                                 │
        ▼                                        ▼
┌──────────────────────────────┐    ┌──────────────────────────────┐
│  CONSUMER DASHBOARD          │    │  TEAM DASHBOARD              │
│                              │    │                              │
│  Navigation Items:           │    │  Navigation Items:           │
│  • Dashboard                 │    │  • Genealogy                 │
│  • Profile                   │    │  • Tree                      │
│  • Refer & Earn              │    │  • Team Wallet               │
│  • Join Prime                │    │  • History                   │
│  • Support                   │    │  • Support                   │
│  • Cart                      │    │                              │
│                              │    │  (MLM/Network features)      │
└──────────────────────────────┘    └──────────────────────────────┘
```

---

## 3. Registration Page Analysis

### 3.1 Current State
- **Only Consumer Registration Form** is shown
- No team setup during registration
- Single unified account creation

### 3.2 Fields & Validation
*(Typical consumer registration form)*

| Field | Type | Validation | Notes |
|-------|------|-----------|-------|
| Email | Email | Required, unique, valid format | Primary account identifier |
| Phone | Text | Required, unique | Verification likely needed |
| Password | Password | Required, strength rules | Min 8 chars, mixed case, numbers |
| Name | Text | Required | Consumer name |
| Address | Text | Optional/Required | Shipping address for cart |
| Other | - | - | Referral code, preferences, etc. |

### 3.3 Key Design Decisions

✅ **Advantage:** Simplified onboarding - no confusing role selection upfront  
✅ **Advantage:** Single account to manage - same credentials everywhere  

⚠️ **Consideration:** Team features activate separately (possibly after activation or KYC)  
⚠️ **Consideration:** Need clear messaging: "More features unlock after registration"

---

## 4. Login Page Analysis

### 4.1 Architecture
Two **distinct login contexts** using same credentials:

#### Consumer Login
- Routes to consumer dashboard
- Shows e-commerce features
- Personal account scope

#### Team Login
- Routes to team/network dashboard
- Shows MLM/genealogy features  
- Network referral scope

### 4.2 Authentication Logic

```
User Input: email + password
         │
         ▼
   AUTHENTICATE (verify email/password)
         │
         ├─ INVALID → "Login Failed"
         │
         └─ VALID → Check Login Type
                   ├─ CONSUMER → Load consumer dashboard data
                   └─ TEAM → Load team/genealogy data
```

### 4.3 Implementation Considerations

**Option A: Separate Login Endpoints**
```
POST /auth/login/consumer
POST /auth/login/team
```

**Option B: Single Endpoint with Role Parameter**
```
POST /auth/login
{
  "email": "user@example.com",
  "password": "****",
  "role": "consumer" | "team"
}
```

**Option C: Unified Endpoint, Role in Session/JWT**
```
POST /auth/login
{
  "email": "user@example.com",
  "password": "****"
}
# Returns JWT with both role options, frontend selects on next page
```

**Recommendation:** Option B or C with additional role selection UI layer

---

## 5. Consumer Dashboard

### 5.1 Features & Purpose

| Feature | Purpose | Typical Components |
|---------|---------|------------------|
| **Dashboard** | Home/Overview | Stats, recent orders, promotions |
| **Profile** | Account management | Edit name, email, address, password |
| **Refer & Earn** | Referral program | Referral link, earnings, history |
| **Join Prime** | Premium subscription | Prime membership tier, benefits |
| **Support** | Help & support | Tickets, FAQs, chat, contact |
| **Cart** | Shopping cart | Products, checkout, wishlist |

### 5.2 Access Scope
- Personal user data only
- Own order history
- Own referral earnings
- Own profile settings

### 5.3 Session Management
```
Consumer Login Token
├─ User ID
├─ Email
├─ Role: "CONSUMER"
├─ Permissions: [view_profile, manage_cart, refer, view_support]
└─ TTL: 24 hours (configurable)
```

---

## 6. Team Dashboard (Same User)

### 6.1 Features & Purpose

| Feature | Purpose | Typical Components |
|---------|---------|------------------|
| **Genealogy** | Tree structure view | Network hierarchy, downline |
| **Tree** | Visual representation | Network diagram, member levels |
| **Team Wallet** | Network earnings | Commission, bonuses, withdrawals |
| **History** | Network activity log | Transactions, member joins, payouts |
| **Support** | Team-specific help | Team guide, issues, training |

### 6.2 Access Scope
- **Network-level data:**
  - Downline members (genealogy)
  - Team wallet & commissions
  - Network transactions
- **Restricted from team view:**
  - Not consumer shopping features
  - Not Prime membership (consumer-only)
  - Not personal cart

### 6.3 Session Management
```
Team Login Token
├─ User ID
├─ Email
├─ Role: "TEAM"
├─ Permissions: [view_genealogy, view_team_wallet, manage_team]
└─ TTL: 24 hours (configurable)
```

---

## 7. Technical Architecture

### 7.1 Database Schema Implications

```sql
-- Single unified user table
CREATE TABLE users (
  id INT PRIMARY KEY,
  email VARCHAR UNIQUE NOT NULL,
  phone VARCHAR UNIQUE NOT NULL,
  password_hash VARCHAR NOT NULL,
  name VARCHAR NOT NULL,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  is_active BOOLEAN DEFAULT TRUE
);

-- Role activation per user (both roles possible)
CREATE TABLE user_roles (
  id INT PRIMARY KEY,
  user_id INT FOREIGN KEY,
  role ENUM('CONSUMER', 'TEAM') NOT NULL,
  is_active BOOLEAN DEFAULT TRUE,
  activated_at TIMESTAMP,
  UNIQUE(user_id, role)
);

-- Team/Network specific data
CREATE TABLE team_members (
  id INT PRIMARY KEY,
  user_id INT FOREIGN KEY,
  sponsor_id INT FOREIGN KEY,      -- Upline
  genealogy_level INT,
  created_at TIMESTAMP
);

-- Consumer profile data
CREATE TABLE consumer_profiles (
  id INT PRIMARY KEY,
  user_id INT FOREIGN KEY UNIQUE,
  address VARCHAR,
  city VARCHAR,
  state VARCHAR,
  postal_code VARCHAR
);
```

### 7.2 Frontend Navigation Structure

**Consumer Routes:**
```
/dashboard
/profile
/refer-earn
/join-prime
/support
/cart
/checkout
```

**Team Routes:**
```
/team/genealogy
/team/tree
/team/wallet
/team/history
/team/support
```

**Shared/Auth Routes:**
```
/register
/login
/logout
```

### 7.3 Session/Token Management

**Dual-Session Approach:**
- User logs in with role selection → Gets role-specific JWT token
- Token contains role claim → Middleware validates access
- Switching roles = Re-login or dual-token mechanism

**Headers Example:**
```
Authorization: Bearer <role-specific-jwt>
X-User-Role: CONSUMER | TEAM
```

---

## 8. User Flow Sequences

### 8.1 First-Time User Journey

```
1. REGISTRATION
   └─ Register as consumer only
   
2. LOGIN CHOICE (First time)
   └─ Can choose Consumer OR Team role
   
3. FIRST ACCESS
   Consumer Role:
   └─ Lands on consumer dashboard
   
   Team Role:
   └─ May need team activation/KYC first
   └─ Or direct access to genealogy if already sponsored
```

### 8.2 Returning User Journey

```
1. LOGIN PAGE
   ├─ [ CONSUMER LOGIN ] selected
   │  └─ Email: user@example.com
   │  └─ Password: ****
   │  └─ [Login] → Consumer Dashboard
   │
   └─ [ TEAM LOGIN ] selected
      └─ Email: user@example.com
      └─ Password: ****
      └─ [Login] → Team Dashboard
```

### 8.3 Switching Roles

**Option A: Re-login**
1. User in Consumer Dashboard
2. Clicks "Switch to Team"
3. Redirected to Login page
4. Click "Team Login" tab
5. Login with same credentials
6. Team Dashboard loads

**Option B: Direct Switch (requires dual-token UI)**
1. User in Consumer Dashboard
2. Clicks "Switch to Team"
3. Token swapped in background
4. Dashboard refreshed → Team view

---

## 9. Key Considerations & Risks

### 9.1 Data Isolation ✅
**Requirement:** Ensure consumer data never leaks to team view
- Implement **role-based access control (RBAC)** at API level
- Middleware must validate token role before returning data
- Use **database views** segregating consumer vs. team data

### 9.2 Credential Sharing ⚠️
**Risk:** Same email/password for two roles
- **Mitigation:** Track login attempts per role
- **Mitigation:** Optional 2FA per role
- **Mitigation:** IP/device-based anomaly detection

### 9.3 Session Conflict ⚠️
**Risk:** User logged in both roles simultaneously
- **Decision needed:** Allow or disallow concurrent logins?
- **If allowed:** Ensure proper token/session isolation
- **If disallowed:** Login to new role invalidates old session

### 9.4 Team Feature Activation
**Question:** When does user get access to Team role?
- Option A: Immediately after registration
- Option B: After KYC/verification
- Option C: When first sponsored/add as network member
- **Recommendation:** Option B or C for security

### 9.5 Navigation & UI State
**Requirement:** Clear indication of current role
- Display active role in header/sidebar
- Prevent accidental data operations in wrong role
- Show role-specific help & support links

---

## 10. Implementation Checklist

### 10.1 Backend Requirements
- [ ] Modify `POST /register` → Consumer registration only
- [ ] Modify `POST /auth/login` → Accept `role` parameter
- [ ] Add role validation middleware
- [ ] Create `GET /consumer/dashboard` endpoint
- [ ] Create `GET /team/genealogy` endpoint
- [ ] Separate data access layers per role
- [ ] Implement role-based API filtering
- [ ] Add JWT role claim validation

### 10.2 Frontend Requirements
- [ ] Update registration form UI (consumer only)
- [ ] Split login page → Consumer & Team tabs
- [ ] Create consumer dashboard layouts
- [ ] Create team dashboard layouts  
- [ ] Implement role-specific routing
- [ ] Add role indicator in header
- [ ] Create role-switch UI (if direct switch supported)
- [ ] Update nav menus per role

### 10.3 Database Requirements
- [ ] Add `user_roles` table
- [ ] Add role activation timestamp
- [ ] Create role-segregated data views
- [ ] Add audit logging per role
- [ ] Backup/migration plan for existing users

### 10.4 Testing Requirements
- [ ] Test registration → consumer account creation
- [ ] Test both login paths (consumer & team)
- [ ] Test data isolation between roles
- [ ] Test feature access per role
- [ ] Test credential validity for both roles
- [ ] Test session management & switching
- [ ] Test unauthorized access attempts
- [ ] Test concurrent/multi-device logins

---

## 11. Feature Comparison Matrix

| Feature | Consumer Dashboard | Team Dashboard | Notes |
|---------|-------------------|-----------------|-------|
| Dashboard/Overview | ✅ | ✅ | Different content |
| Profile Management | ✅ | ❌ | Consumer only |
| Shopping/Cart | ✅ | ❌ | Consumer only |
| Referral Earnings | ✅ (personal) | ❌ | Team has "Commission" |
| Genealogy | ❌ | ✅ | Team network view |
| Tree View | ✅ (optional) | ✅ | Different tree structures |
| Team Wallet | ❌ | ✅ | Network earnings only |
| History | ✅ (orders) | ✅ (transactions) | Role-specific history |
| Support | ✅ | ✅ | Different help docs |
| Prime Membership | ✅ | ❌ | Consumer benefit |

---

## 12. Success Metrics

- ✅ Registration completion rate
- ✅ First-time login success rate (both roles)
- ✅ Feature discovery rate (team features)
- ✅ Role switching frequency
- ✅ Data access error rate (< 0.1%)
- ✅ Session timeout/logout consistency
- ✅ Support ticket volume post-launch

---

## 13. Open Questions

1. **Team Role Activation:** When exactly should team features become available?
2. **Concurrent Sessions:** Allow user logged in as both roles simultaneously?
3. **Profile Sharing:** Should name/email in consumer and team roles be same/editable separately?
4. **Password Reset:** Single reset flow or role-specific?
5. **Audit Trail:** Should we log role switches and feature access?
6. **Mobile App:** Different app experiences per role, or single app?

---

## 14. Migration Path (If Existing Users)

For systems already in production with single-role users:

```
1. Add user_roles table (no data initially)
2. Database migration:
   - For each user, create entry in user_roles (CONSUMER)
   - Determine if they should have TEAM role (by sponsorship/history)
3. Update auth logic to check user_roles
4. Communicate to users: "New team login now available"
5. Monitor for login issues
6. Gradual role activation
```

---

## Next Steps

1. Clarify team role activation timing
2. Design role-switch UX
3. Define session management strategy
4. Create detailed API specifications
5. Design database migration plan
6. Begin frontend/backend implementation

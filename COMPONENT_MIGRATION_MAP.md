# Component Migration Map & Boundary Reference
**Application**: Trikonekt (asiyapp.com)  
**Safety Commitment**: 100% Logic Preservation | Strict Presentation-Only Refactoring

---

## 1. Global App Shell & Navigation
```
EXISTING COMPONENT: src/components/common/AppShell.jsx
ROUTE: All user routes (/user/*)
PROPS & STATE: title, user, isTeam, rootPaths, onLogout
BUSINESS LOGIC BOUNDARY: Auth storage clearance, navigation history popping
REDESIGN TARGET:
  - Add glossy backdrop blur and responsive mobile dock container padding
  - Retain all token clearing and navigation callbacks verbatim

EXISTING COMPONENT: src/components/common/AppHeader.jsx
PROPS & STATE: title, user, isRootScreen, onToggleDrawer, onBack, cartPath
BUSINESS LOGIC BOUNDARY: Cart count from centralized Zustand store (`useCartStore`)
REDESIGN TARGET:
  - Frosted glass navbar (blur: 16px) with user avatar initials
  - High-contrast badge counter on shopping cart and notification bell

EXISTING COMPONENT: src/components/common/BottomNav.jsx
PROPS & STATE: onToggleDrawer, isTeam
BUSINESS LOGIC BOUNDARY: Route active checking (`currentPath`)
REDESIGN TARGET:
  - 5-Pillar glossy dock (Home, Community, Packages, Wallet, Menu)
  - Curved active indicator with smooth spring micro-interaction
  - Safe-area bottom inset accommodation
```

---

## 2. Community Consumer Home
```
EXISTING COMPONENT: src/pages/team/TeamDashboard.jsx (and src/pages/UserDashboard.jsx)
ROUTES: /user/team-dashboard, /user/dashboard, /v4/home
DATA HOOKS & APIS:
  - API.get("/business/team-consumer/wishing-banners/")
  - API.get("/business/team-consumer/top-achievers/")
  - API.get("/business/spp/cadence/")
  - API.get("/accounts/wallet/vouchers/")
  - API.get("/business/tri/apps/tri-holidays/")
  - getWalletMe()
BUSINESS LOGIC BOUNDARY:
  - 12-Month cadence calculations (boxes_completed, days_remaining, status)
  - Unclaimed P2P Gift voucher matching against current username
  - ID card print and modal open logic
  - Document fetching for PDF / Certificate
REDESIGN TARGET:
  - Editorial Hero Banner: High-resolution landscape artwork, ambient blur backdrop, pagination dots
  - Greeting Bar: User avatar with status badge, greeting message ("Hello, Baburaj 👋 | Community Consumer")
  - Quick Search Bar: Sleek rounded search field with filter button
  - Category Pills: Quick filter icons with vibrant pastel backgrounds
  - Cadence & Voucher Widgets: High-contrast gradient cards with animated progress meters
  - Achievers Scroller: Elevated cards with gold crown badge and glossy border
```

---

## 3. Wallet & Earnings
```
EXISTING COMPONENT: src/screens/TeamWallet.jsx & src/pages/Wallet.jsx
ROUTES: /user/team-wallet, /user/wallet, /user/wallet-dashboard
DATA HOOKS & APIS:
  - API.get("/accounts/wallet/me/")
  - API.get("/accounts/wallet/me/history/")
  - API.get("/mlm/ranks/eligibility/")
  - API.post("/accounts/wallet/transfer/request-otp/")
  - API.post("/accounts/wallet/transfer/confirm-otp/")
BUSINESS LOGIC BOUNDARY:
  - OTP transfer request and confirmation flow
  - 10% TDS deduction calculation on wallet transfer
  - Python vs JS weekday window logic for withdrawal eligibility
  - Tier upgrade limits (RANK_TIERS 1 to 10)
  - Today & yesterday earnings accumulation
REDESIGN TARGET:
  - Signature Financial Card: Deep cobalt-blue gradient card with ₹50.25 prominent balance
  - Action Trio: Move to Pockets (Emerald), E-Edu Academy (Cobalt), Withdraw (Orange)
  - Earnings Mini-Cards: Today's Earnings (with +100% green pill) and Yesterday's Earnings
  - Sub-Wallet Tiles: Withdrawable Pocket (₹0.00) and Self Account Balance (₹16.75)
  - Earnings Breakdown Grid: Package Direct and 5 & 3 Blocks summary tiles
  - Recent Transactions Snippet: Top 5 transactions embedded directly in wallet view
```

---

## 4. Transaction History
```
EXISTING COMPONENT: src/pages/History.jsx
ROUTES: /user/history, /user/team-history
DATA HOOKS & APIS:
  - API.get("/accounts/wallet/me/history/")
  - API.get("/accounts/wallet/vouchers/")
BUSINESS LOGIC BOUNDARY:
  - maskUsernameMid (e.g. 8095918105 -> 8095****105)
  - classifyTransaction (8 distinct categories: SELF_ACCOUNT, LAYER, DIRECT, P2P, ROYALTY, MERCHANT, WITHDRAWAL, REDEEM)
  - extractPrimeTier & describeSource
  - Positive (+) vs negative (-) amount calculations
REDESIGN TARGET:
  - Category Filter Pills: All, Main Wallet, Self Account, Packages
  - 2-Second Scan Transaction Row:
      - Direction indicator circle (Credit green up-arrow, Debit red down-arrow)
      - Bold item title ("5 Blocks - Layer 1", "SPP Personal Cashback")
      - Sub-label with wallet name & ratio ("75% Withdrawable Main Wallet • 12:16")
      - Bold monetary value ("+ ₹9.00", "+ ₹12.50", "- ₹500.00")
  - Date Divider: Pill chips ("Today • 04 Oct 2026", "03 Oct 2026")
```

---

## 5. Side Navigation Drawer
```
EXISTING COMPONENT: src/components/common/AppDrawer.jsx
TRIGGER: Custom event "trikonekt:open-consumer-sidebar" or menu button
DATA HOOKS & APIS:
  - localStorage.getItem("user_user")
BUSINESS LOGIC BOUNDARY:
  - External link vs React Router Link routing
  - Token and session clearance on logout
REDESIGN TARGET:
  - Luxury Dark Header: Slate/Navy gradient with user avatar, name, and phone/ID
  - Status Tag: Green verified chip ("✓ Agent")
  - Menu Groups: PACKAGES, NETWORK & FINANCE, SETTINGS
  - Active Route Pill: Frosted highlight with brand icon color
  - Bottom Sticky Logout: Red glossy gradient button
```

---

## 6. Travel & Holiday Packages
```
EXISTING COMPONENT: src/components/travel/IxigoHolidaySection.jsx
ROUTES: /user/tri/tri-holidays, embedded on Home
DATA HOOKS & APIS:
  - API.get("/business/tri/apps/tri-holidays/")
  - CURATED_PACKAGES fallback list
BUSINESS LOGIC BOUNDARY:
  - ₹250 booking token badge
  - WhatsApp enquiry link generation
  - Category filter state management
REDESIGN TARGET:
  - Ixigo-Style Travel Cards: High-contrast photography, rounded corners (18px)
  - Overlay Badges: "GIFT FOR PARENTS", "SACRED JOURNEY", "2N / 3D"
  - Amenity Strip: Cab, Hotel, Meals, Sightseeing icons
  - Pricing & Rating Bar: "₹6,990 onwards", "★ 4.8 (120+)", circular arrow CTA button
```

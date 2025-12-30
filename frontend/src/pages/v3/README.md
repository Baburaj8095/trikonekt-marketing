# v3 User Dashboard (Dark + Gold UX)

This folder contains an all-new UX for the User Dashboard inspired by the provided reference. It does not modify any existing files or content logic. All data, labels, and flows mirror v2; only layout and styling are changed.

## Structure

- V3Theme.css — Scoped theme (v3- prefixed classes only)
- UserDashboard3Shell.jsx — Shell with top bar and bottom tabs, hosts nested routes
- screens/
  - Home3.jsx — Mirrors src/pages/v2/Dashboard2Home.jsx (same apps/cards data)
  - Wallet3.jsx — Renders existing Wallet page
  - History3.jsx — Renders existing History page
  - Orders3.jsx — Renders existing MyOrdersAll page
  - Profile3.jsx — Mirrors v2 Dashboard2Profile groupings and uses V2WrapperFactory for sub‑screens
- index.js — Re-exports for simpler imports

## Mounting the v3 routes (no changes elsewhere)

Paste the following inside your App.js router (do not remove your existing routes). This creates an isolated /v3 area to preview the new UX.

```jsx
// App.js (snippet)
import { Routes, Route } from "react-router-dom";
import {
  UserDashboard3Shell,
  Home3,
  Wallet3,
  History3,
  Orders3,
  Profile3,
} from "./pages/v3";

// ...inside your <Routes> tree:
<Route path="/v3/*" element={<UserDashboard3Shell />}>
  <Route index element={<Home3 />} />
  <Route path="wallet" element={<Wallet3 />} />
  <Route path="history" element={<History3 />} />
  <Route path="orders" element={<Orders3 />} />
  <Route path="profile" element={<Profile3 />} />
</Route>
```

Then visit:
- /v3 → Dashboard home
- /v3/wallet → Wallet
- /v3/history → History
- /v3/orders → Orders
- /v3/profile → Profile
- /v3/profile?screen=profile2 (or any v2 screen key) → Renders that sub-screen via V2WrapperFactory

## Notes

- All content/data are reused from existing pages. No copy or logic was changed; only the UI shell and components were restyled.
- Styles are fully scoped via v3- prefixed classes to avoid collisions with existing CSS.
- Bottom tabs are simple, accessible buttons (no library dependency).

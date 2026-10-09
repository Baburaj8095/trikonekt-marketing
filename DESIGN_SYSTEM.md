# Trikonekt Glossy Consumer Design System
**Version**: 2.0.0 (Premium Consumer Fintech + Luxury Travel)  
**Philosophy**: Modern, vibrant, trustworthy, glossy without being gaudy. Color is used with strict intent.

---

## 1. Color Palette & Tokens

### Core Brand & Atmosphere
| Token | Value | Semantic Role |
|---|---|---|
| `bgPrimary` | `#F4F7FC` | Clean, subtle cool-tinted canvas |
| `surfaceWhite` | `#FFFFFF` | Base card surface |
| `surfaceElevated` | `rgba(255, 255, 255, 0.88)` | Translucent frosted glass card with blur |
| `surfaceDarkHero` | `linear-gradient(135deg, #091E3A 0%, #103766 50%, #1A4D8C 100%)` | Premium dark hero & card headers |
| `brandCobalt` | `#0256B4` | Primary brand accent |
| `brandCyan` | `#00C2CB` | Vibrancy & accent highlight |
| `brandIndigo` | `#4F46E5` | Secondary depth & categories |
| `goldCrown` | `linear-gradient(135deg, #F59E0B 0%, #D97706 100%)` | Achievers, Prime membership & VIP status |

### Semantic Financial Colors
| Token | Value | Background / Tint | Role |
|---|---|---|---|
| `creditSuccess` | `#059669` | `#ECFDF5` | Income credited, positive earnings |
| `debitExpense` | `#DC2626` | `#FEF2F2` | Withdrawal, fee deductions |
| `pendingWarning`| `#D97706` | `#FFFBEB` | Due renewal, pending approvals |
| `infoAccent` | `#0284C7` | `#F0F9FF` | Informational cards, guides |

### Surface Gradients (Glossy & Layered)
- **Financial Hero Card**: `linear-gradient(135deg, #033B76 0%, #0066CC 60%, #0099FF 100%)`
- **Wallet Action Move**: `linear-gradient(135deg, #059669 0%, #10B981 100%)`
- **Wallet Action Academy**: `linear-gradient(135deg, #2563EB 0%, #3B82F6 100%)`
- **Wallet Action Withdraw**: `linear-gradient(135deg, #EA580C 0%, #F97316 100%)`
- **Logout Gradient**: `linear-gradient(135deg, #DC2626 0%, #EF4444 100%)`

---

## 2. Typography Hierarchy

Using modern sans fonts (`'Inter', 'Poppins', -apple-system, sans-serif`):

| Level | Size | Weight | Line Height | Usage |
|---|---|---|---|---|
| **Display Hero** | 24px – 28px | 800 | 1.15 | Hero banner headline, major balance figures |
| **Section H1** | 18px – 20px | 800 | 1.25 | Main page & dialog headings |
| **Card H2** | 15px – 16px | 700 | 1.30 | Card titles, package titles |
| **Financial Value** | 22px – 26px | 900 | 1.10 | Currency balances (₹ 50.25) |
| **Body Primary** | 13px – 14px | 600 | 1.40 | Standard descriptions, names |
| **Body Muted** | 11.5px – 12px| 500 | 1.35 | Secondary notes, timestamps, subtitles |
| **Badge / Pill** | 10.5px – 11px| 800 | 1.00 | Status chips, category indicators |

---

## 3. Elevation & Layered Shadows

1. **Subtle Elevation (`shadowSubtle`)**:  
   `0 2px 8px -2px rgba(15, 23, 42, 0.05), 0 1px 3px rgba(15, 23, 42, 0.03)`
2. **Card Elevation (`shadowCard`)**:  
   `0 8px 24px -4px rgba(15, 23, 42, 0.07), 0 2px 6px -1px rgba(15, 23, 42, 0.04)`
3. **Glossy Glow (`shadowGlowBlue`)**:  
   `0 10px 28px -4px rgba(2, 86, 180, 0.35)`
4. **Bottom Dock Float (`shadowDock`)**:  
   `0 -4px 20px 0 rgba(15, 23, 42, 0.08), 0 -1px 3px rgba(15, 23, 42, 0.02)`

---

## 4. Radius Hierarchy

- **Pill / Badges**: `999px` (Status badges, category filter chips)
- **Buttons**: `12px` (Touch targets)
- **Standard Cards**: `16px` – `18px` (Financial cards, transaction rows)
- **Hero Containers**: `20px` – `24px` (Daily wishing banner, Ixigo showcase card)
- **Bottom Navigation**: `0px` with frosted glass backdrop blur (`16px`)

---

## 5. Reusable Component Standards

### A. Glossy Financial Card
- High contrast, dark or vibrant gradient backdrop.
- Embedded ambient glow backdrop icon or subtle watermark.
- Clear two-tone numeric layout: Large integer + distinct fractional unit.
- Semantic badge indicating wallet tier or withdrawable state.

### B. Transaction Item Row
- Immediate 2-second readability.
- Left-aligned status circle: Green arrow-up for credit, Red arrow-down for debit.
- Two-line description:
  - Line 1: Primary action / counterparty (`5 Blocks - Layer 1` / `SPP Personal Cashback`).
  - Line 2: Wallet destination & ratio (`75% Withdrawable Main Wallet • From 8095****105`).
- Right-aligned amount badge with clean `+ ₹9.00` or `- ₹500.00` typography.
- Sub-timestamp at bottom-right (`04 Oct 2026 • 12:16`).

### C. Travel & Holiday Package Card
- Aspect ratio: `16 / 9` high-res photography with subtle dark vignette.
- Top-left badge: Orange pill (`GIFT FOR PARENTS` or `SACRED JOURNEY`).
- Top-right badge: Duration pill (`2N / 3D`) + Heart/Wishlist icon.
- Destination marker with pin icon (`Munnar, Kerala`).
- Package Title (`Enchanting Munnar Hills & Tea Trails`).
- Amenity icons strip (`Cab • Hotel • Meals • Sightseeing`).
- Pricing footer: `₹6,990 onwards` with rating `★ 4.8 (120+)` and circular action button `→`.

### D. Side Navigation Drawer
- Dark glossy gradient header (`#091E3A` to `#103766`) with user initials avatar.
- User ID and phone number with green verified chip (`✓ Agent`).
- Categorized sections: `PACKAGES`, `NETWORK & FINANCE`, `SETTINGS`.
- Frosted active state with smooth pill glow.
- Red gradient `Logout` button anchored cleanly at bottom.

# Copilot Instructions for Sofra Al-Bayt Web App

## Project Overview

**Sofra Al-Bayt** (سفرة البيت) is a React + Firebase restaurant management web application supporting multiple user roles: customers, couriers, restaurant owners, admins, and developers. Built with TypeScript, Vite, TailwindCSS, and RTL Arabic support.

- **Tech Stack**: React 18, Vite, TypeScript, Firebase (Auth/Firestore/Storage), TailwindCSS, React Router v6
- **Commands**: `npm run dev` (local), `npm run build` (production), `npm run preview` (preview build)
- **App Name**: Display as "سفرة البيت" (Sofra Al-Bayt) - see [Header.tsx](../src/components/Header.tsx#L40)

## Architecture & Data Flows

### Authentication & Role System
- **Location**: [../src/auth.tsx](../src/auth.tsx), [../src/routes/RoleGate.tsx](../src/routes/RoleGate.tsx)
- **Pattern**: `AuthContext` provides `user`, `role`, `loading`. All components use `useAuth()` hook
- **Roles**: `'owner' | 'courier' | 'customer' | 'admin' | 'developer'` (see [RoleGate.tsx](../src/routes/RoleGate.tsx#L8))
- **Key Point**: User registration creates `users/{uid}` doc with role. Owners auto-create `restaurants/{uid}` doc on first auth load (see [auth.tsx](../src/auth.tsx#L30-L45))
- **Protection**: `<ProtectedRoute>` checks auth, `<RoleGate allow={['customer']}>` checks role authorization

### Firestore Collections & Security
- **Collections**: `users/{uid}`, `restaurants/{uid}`, `menuItems/{id}`, `orders/{id}`, `settings/{doc}`, `wallets/{adminId}`
- **Rules**: [../firestore.rules](../firestore.rules) enforces role-based access
  - Customers: read all menu items and settings; create orders tied to their UID
  - Owners: create/update/delete menu items and their restaurant doc; read/update all orders
  - Couriers: read orders marked `ready` or `out_for_delivery`, or assigned to them via `courierId` field
  - Admin/Developer: full access to all collections for management and debugging

### Cart & Checkout Flow
- **Location**: [../src/hooks/useCart.ts](../src/hooks/useCart.ts), [../src/pages/CheckoutPage.tsx](../src/pages/CheckoutPage.tsx)
- **Pattern**: Cart state via `useCart()` hook (localStorage-based, persists across refreshes)
- **Migration Note**: [CartContext.tsx](../src/context/CartContext.tsx) is deprecated - use `useCart()` hook instead
- **Item Structure**: `{ id, name, price, qty, ownerId? }` - includes optional `ownerId` for multi-restaurant support
- **Checkout**: Creates `orders` doc with `{ customerId, restaurantId, restaurantName, items, subtotal, deliveryFee, total, status: 'pending', address, location: {lat, lng}, paymentMethod: 'cod' }`
- **Geolocation**: CheckoutPage uses `navigator.geolocation` to capture customer location; displays embedded Google Maps iframe
- **Delivery Fee**: Currently hardcoded as 7 (see [CheckoutPage.tsx](../src/pages/CheckoutPage.tsx#L17)); consider storing in `settings/general`

### Order Status Flow
Sequential state: `pending → accepted → preparing → ready → out_for_delivery → delivered` + `cancelled` anytime

### Menu Item Ownership
- Menu items stored under `menuItems/{id}` with `ownerId` field linking to owner's UID
- MenuPage enriches items by joining with `restaurants/{ownerId}` to display restaurant name/logo
- Owner (via ManageMenu) can only edit/create items with their own UID

## Key File Patterns & Conventions

### Component Structure
- **Pages** ([../src/pages/](../src/pages/)): Full page components, handle data fetching
- **Components** ([../src/components/](../src/components/)): Reusable UI (Header, Footer, TopBar, Button, Toast)
- **Routes** ([../src/routes/](../src/routes/)): Protection & authorization wrappers
- **Hooks** ([../src/hooks/useCart.ts](../src/hooks/useCart.ts)): Custom hooks (currently just cart; auth is context)

### Naming & RTL Considerations
- **All UI text in Arabic** comments and variables (e.g., "جارِ التحميل" = "Loading")
- **RTL-first CSS**: TailwindCSS with RTL directives; custom colors defined in [../tailwind.config.js](../tailwind.config.js)
- **Color Scheme**: `primary: #0EA5E9` (sky blue), `secondary: #F0F9FF` (light sky), `accent: #38BDF8` (bright sky), `dark: #0C4A6E` (deep blue)
- **Extended Palette**: Full `sky` color scale (50-900) + custom shadows (`luxury`, `glow`, `card`) and gradients (`gradient-luxury`, `gradient-white`)
- **Font**: Cairo and Tajawal for Arabic text (fallback to system-ui)

### Firestore Query Patterns
```tsx
// Common pattern: fetch + enrich with foreign doc
const snap = await getDocs(query(collection(db, 'menuItems'), where('available', '==', true)))
const items = snap.docs.map(d => ({ id: d.id, ...d.data() }))
// Then enrich each with owner's restaurant doc (see MenuPage.tsx line ~37)
```

### Error Handling & Async
- Use try-catch around Firestore operations; log non-critical errors to console (e.g., missing restaurant doc)
- Pages use `loading` state during data fetches; display "جارِ التحميل..." placeholder
- Toast notifications via global `useToast()` hook (see [Toast.tsx](../src/components/ui/Toast.tsx)) for success/error feedback
- **Global Toast**: App wrapped in `<ToastProvider>` in [main.tsx](../src/main.tsx); use `const toast = useToast()` then `toast.success()`, `toast.error()`, etc.
- **Local Toast**: ManageMenu uses local toast state for backward compatibility; prefer global `useToast()` for new features

## Developer Workflows

### Local Development
1. Copy `.env.example` → `.env.local` and populate Firebase credentials
2. `npm run dev` starts Vite dev server on `http://localhost:5173`
3. Rebuild TypeScript: `tsc -b` (run before `npm run build`)

### Firebase Setup
- Create project in Firebase Console
- Enable: Email/Password Auth, Firestore, Storage
- Deploy Firestore rules: `firebase deploy --only firestore:rules`
- No payment integration yet; built for "cash on delivery" model

### Building & Deployment
- `npm run build` → compiles TS, bundles with Vite → `/dist/`
- Preview: `npm run preview` (serve from dist locally)
- Deploy via Firebase Hosting or static host

## Important Project Quirks & Considerations

### Multi-Restaurant Support (In Progress)
- Code is **restaurant-aware** but UI/routes assume single restaurant
- Menu items store `ownerId` to support future multi-restaurant UI
- Future: add restaurant selector/filter in MenuPage and cart flow

### Order Assignment (Partial)
- `orders` docs have optional `courierId` field
- Couriers can only see assigned orders or those in `ready`/`out_for_delivery` status (Firestore rule)
- Admin/owner sees all orders
- Assignment logic: check OrdersAdmin or CourierRequests pages for current approach

### State & Persistence
- **Cart**: localStorage-based via `useCart()` hook (persists across page refreshes)
- **Auth**: persisted via Firebase Auth SDK (survives refresh)
- No Redux/global state beyond auth, cart, and toast

### Toast/Notifications
- **Global System**: `<ToastProvider>` in [main.tsx](../src/main.tsx) provides app-wide `useToast()` hook
- **Usage Pattern**: `const toast = useToast(); toast.success('message')` or `toast.error('message', { duration: 5000 })`
- **Types**: `success`, `error`, `info`, `warning` with auto-dismiss (default 3s) and manual close
- **Example**: See [MenuPage.tsx](../src/pages/MenuPage.tsx), [EditRestaurant.tsx](../src/pages/EditRestaurant.tsx), [AdminOrders.tsx](../src/pages/AdminOrders.tsx)

## When Adding Features

1. **New User Role**: Update [RoleGate.tsx](../src/routes/RoleGate.tsx) `Role` type, add route in [App.tsx](../src/App.tsx)
2. **New Firestore Collection**: Add rules in [firestore.rules](../firestore.rules), then query in pages
3. **New Cart Feature**: Extend `CartItem` type in [useCart.ts](../src/hooks/useCart.ts) (not CartContext - that's deprecated)
4. **UI Components**: Use Tailwind classes + custom colors; mirror Arabic text patterns from existing pages
5. **Database Migration**: Test rules locally with `firebase emulator:start`; deploy rules before shipping code
6. **Toast Notifications**: Use global `useToast()` hook for user feedback; avoid local toast state unless component-specific needs

## File Reference Quick Links

- **App routing**: [../src/App.tsx](../src/App.tsx)
- **Auth flow**: [../src/auth.tsx](../src/auth.tsx)
- **Firebase config**: [../src/firebase.ts](../src/firebase.ts)
- **Security rules**: [../firestore.rules](../firestore.rules)
- **Design tokens**: [../tailwind.config.js](../tailwind.config.js)
- **Main pages**: [../src/pages/](../src/pages/) (MenuPage, CheckoutPage, OwnerDashboard, CourierApp, etc.)

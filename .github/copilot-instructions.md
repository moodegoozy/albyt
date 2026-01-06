# Copilot Instructions for Sofra Al-Bayt (سفرة البيت)

## Quick Reference
- **Stack**: React 18 + Vite + TypeScript + Firebase (Auth/Firestore/Storage) + TailwindCSS
- **Commands**: `npm run dev` | `npm run build` | `npm run preview`
- **Language**: All UI in Arabic RTL. Loading text: `"جارِ التحميل..."`
- **Imports**: Always use `@/` path alias (maps to `src/`)

## Architecture

### Role-Based Access (5 Roles)
Defined in `src/types/index.ts`: `customer | courier | owner | admin | developer`

| Role | Capabilities |
|------|-------------|
| `developer` | Full system access - users, restaurants, orders, settings |
| `admin` | Add restaurants (earns commission), monitor referred restaurants |
| `owner` | Manage own menu, process orders for their restaurant |
| `courier` | Claim ready orders, update delivery status |
| `customer` | Browse, order, track deliveries |

```tsx
// Auth hook - ALWAYS use for auth state
const { user, role, loading, logout } = useAuth()  // from @/auth

// Route protection pattern
<ProtectedRoute>                          {/* → /login if !auth */}
  <RoleGate allow={['owner', 'admin']}>   {/* → / if role mismatch */}
    <YourPage />
  </RoleGate>
</ProtectedRoute>
```

### Firestore Data Model
| Collection | Doc ID | Key Fields |
|------------|--------|------------|
| `users` | `{uid}` | `role`, `name`, `email` |
| `restaurants` | `{ownerId}` | Doc ID = owner's UID, `referredBy` for commission |
| `menuItems` | auto | `ownerId` links to restaurant |
| `orders` | auto | Status flow: `pending→accepted→preparing→ready→out_for_delivery→delivered` |
| `wallets` | `{adminId}` | `balance`, `totalEarnings`, `transactions[]` |

⚠️ **Security First**: Update `firestore.rules` BEFORE adding collections. Use helper functions: `isOwner()`, `isAdmin()`, `isDeveloper()`, `isCourier()`, `isCustomer()`

### Commission System
```tsx
// In CheckoutPage.tsx
const PLATFORM_FEE_PER_ITEM = 1.0      // 1 ر.س → platform
const ADMIN_COMMISSION_PER_ITEM = 0.75 // 0.75 ر.س → admin (if referredBy exists)
```

## Critical Patterns

### Cart (localStorage-based)
```tsx
import { useCart } from '@/hooks/useCart'
const { items, add, remove, changeQty, clear, subtotal } = useCart()
// ❌ src/context/CartContext.tsx is DEPRECATED
```

### UI Feedback
```tsx
import { useToast } from '@/components/ui/Toast'
import { useDialog } from '@/components/ui/ConfirmDialog'

toast.success('تم!')  // success | error | info | warning (auto-dismiss 3s)
const ok = await dialog.confirm('متأكد؟')  // returns Promise<boolean>
await dialog.error('خطأ')  // confirm | alert | success | error | warning | info
```

### Real-time Data
```tsx
useEffect(() => {
  const unsub = onSnapshot(collection(db, 'orders'), snap => { /* ... */ })
  return () => unsub()
}, [])
```

## Styling
- **Theme**: `primary` (#0EA5E9), `sky-*` palette, Arabic fonts (Cairo, Tajawal)
- **Custom shadows**: `shadow-luxury`, `shadow-glow`, `shadow-card`
- **Order badges**: `{ pending: '⏳ قيد المراجعة', accepted: '✅ تم القبول', ... }`

## Adding Features
1. **New Page**: Create in `src/pages/`, add route in `src/App.tsx` with guards
2. **New Collection**: Update `firestore.rules` first with role-based rules  
3. **New Type**: Add to `src/types/index.ts`

## Key Files
| Purpose | Location |
|---------|----------|
| Types | `src/types/index.ts` - MenuItem, Order, Restaurant, User, Wallet, UserRole |
| Auth | `src/auth.tsx` - AuthProvider, useAuth hook |
| Routes | `src/App.tsx`, `src/routes/` - ProtectedRoute, RoleGate |
| Firebase | `src/firebase.ts` - `app`, `auth`, `db`, `storage` exports |
| Security | `firestore.rules` - role helper functions |
| Cart | `src/hooks/useCart.ts` - localStorage cart with `ownerId` |
| UI Feedback | `src/components/ui/` - Toast, ConfirmDialog providers |

# Copilot Instructions for Sofra Al-Bayt (سفرة البيت)

## Quick Reference
- **Stack**: React 18 + Vite + TypeScript + Firebase (Auth/Firestore/Storage) + TailwindCSS
- **Commands**: `npm run dev` | `npm run build` | `npm run preview`
- **Language**: All UI in Arabic RTL. Loading text: "جارِ التحميل..."
- **Imports**: Always use `@/` path alias (maps to `src/` via vite.config.ts)

## Architecture

### Role-Based Access System
5 roles defined in [src/types/index.ts](src/types/index.ts): `customer | courier | owner | admin | developer`

```tsx
// Auth hook - ALWAYS use this for auth state
const { user, role, loading, logout } = useAuth()  // from @/auth

// Route protection pattern (see App.tsx)
<ProtectedRoute>                          {/* Redirects to /login if not authenticated */}
  <RoleGate allow={['owner', 'admin']}>   {/* Redirects to / if role not allowed */}
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
| `wallets` | `{adminId}` | Commission tracking for admins |
| `tasks` | auto | Admin task assignments |

⚠️ **Security First**: Update [firestore.rules](firestore.rules) BEFORE adding new collections. Use helper functions: `isOwner()`, `isAdmin()`, `isDeveloper()`, `isCourier()`, `isCustomer()`

### Commission System
Defined in [CheckoutPage.tsx](src/pages/CheckoutPage.tsx):
- Platform fee: **1.0 ر.س/item** | Admin commission: **0.75 ر.س/item** (when `referredBy` exists)

## Critical Patterns

### Cart Management
```tsx
import { useCart } from '@/hooks/useCart'  // ✅ localStorage-based, auto-persists
const { items, add, remove, changeQty, clear, subtotal } = useCart()
// ❌ CartContext.tsx exists but is DEPRECATED - do not use
```

### UI Feedback System
```tsx
import { useToast } from '@/components/ui/Toast'
import { useDialog } from '@/components/ui/ConfirmDialog'

// Toast notifications (auto-dismiss)
toast.success('تمت العملية')  // success | error | info | warning

// Dialogs (returns Promise)
const confirmed = await dialog.confirm('هل أنت متأكد؟')  // returns boolean
await dialog.error('حدث خطأ')  // confirm | alert | success | error | warning | info
```

### Real-time Updates
Use `onSnapshot` for live data - see [OrdersAdmin.tsx](src/pages/OrdersAdmin.tsx) and [CourierApp.tsx](src/pages/CourierApp.tsx):
```tsx
useEffect(() => {
  const unsub = onSnapshot(collection(db, 'orders'), (snap) => {
    // handle updates
  })
  return () => unsub()
}, [])
```

### Image Uploads
Follow [ManageMenu.tsx](src/pages/ManageMenu.tsx) pattern: compress with `compressImage()` before upload to Firebase Storage.

## Styling Conventions

### TailwindCSS Theme
Colors in [tailwind.config.js](tailwind.config.js):
- Primary: `primary` (#0EA5E9), `accent` (#38BDF8), `dark` (#0C4A6E)
- Full `sky-50` to `sky-900` palette
- Custom shadows: `shadow-luxury`, `shadow-glow`, `shadow-card`
- Fonts: Cairo, Tajawal (Arabic-optimized)

### Status Badge Pattern
```tsx
const badge = (status: string) => ({
  pending: '⏳ قيد المراجعة',
  accepted: '✅ تم القبول',
  preparing: '👨‍🍳 قيد التحضير',
  ready: '📦 جاهز',
  delivered: '🎉 تم التسليم',
}[status])
```

## Adding Features

1. **New Page**: Create in `src/pages/`, add route in [App.tsx](src/App.tsx) with `ProtectedRoute`+`RoleGate`
2. **New Firestore Collection**: Update [firestore.rules](firestore.rules) first with role-based rules
3. **New Type**: Add to [src/types/index.ts](src/types/index.ts) for consistency

## Key Files Reference
| Purpose | File |
|---------|------|
| Types | [src/types/index.ts](src/types/index.ts) - MenuItem, Order, Restaurant, User, Wallet, UserRole |
| Auth | [src/auth.tsx](src/auth.tsx) - AuthProvider, useAuth hook |
| Routing | [src/App.tsx](src/App.tsx) - all routes, [src/routes/](src/routes/) - guards |
| Firebase | [src/firebase.ts](src/firebase.ts) - exports `app`, `auth`, `db`, `storage` |
| Security | [firestore.rules](firestore.rules) - role helper functions |
| Cart | [src/hooks/useCart.ts](src/hooks/useCart.ts) - localStorage-based cart |
| UI | [src/components/ui/](src/components/ui/) - Toast, ConfirmDialog |

# Copilot Instructions for سُفرة البيت (Sofra Al-Bayt)

## Stack & Commands
- **Stack**: React 18 + Vite + TypeScript + Firebase (Auth/Firestore/Storage) + TailwindCSS
- **Commands**: `npm run dev` | `npm run build` | `npm run preview`
- **Language**: All UI in Arabic RTL. Loading text: `"جارِ التحميل..."`
- **Imports**: Always use `@/` alias (maps to `src/` via vite.config.ts)

## Architecture
```
src/
├── auth.tsx          # AuthContext: user, role, location, refreshUserData()
├── firebase.ts       # Firebase init: exports { app, auth, db, storage }
├── App.tsx           # Routes with ProtectedRoute + RoleGate wrappers
├── pages/            # One component per route
├── components/ui/    # Toast, ConfirmDialog (context-based providers)
├── hooks/useCart.ts  # localStorage cart (⚠️ context/CartContext.tsx is DEPRECATED)
├── routes/           # ProtectedRoute, RoleGate components
└── types/index.ts    # Centralized TypeScript interfaces
```

## Role-Based Access
Roles: `customer | courier | owner | admin | developer`
- `developer`: Full access, delete ops, user management
- `admin`: Add restaurants (earns commission), can order like customer
- `owner`: Manage menu, process orders, hire couriers
- `courier`: Claim ready orders, update delivery status
- `customer`: Browse, order, track

## Route Protection Pattern
```tsx
<ProtectedRoute>                          {/* → /login if !auth */}
  <RoleGate allow={['owner', 'admin']}>   {/* → / if role mismatch */}
    <YourPage />
  </RoleGate>
</ProtectedRoute>
```

## Firestore Collections
| Collection | Doc ID | Notes |
|------------|--------|-------|
| `users` | `{uid}` | Role, location, profile |
| `restaurants` | `{ownerId}` | **⚠️ Doc ID = owner's UID** → use `doc()` NOT `where()` |
| `menuItems` | auto | `ownerId` links to restaurant |
| `orders` | auto | Status: `pending→accepted→preparing→ready→out_for_delivery→delivered` |
| `orders/{id}/messages` | auto | Chat subcollection |
| `wallets` | `{adminId}` | Commission tracking |
| `settings` | `{doc}` | Global config |

**⚠️ Update firestore.rules FIRST when adding collections.** Use helpers: `isOwner()`, `isAdmin()`, `isDeveloper()`, `isCourier()`, `isCustomer()`

## Key Patterns

### Cart (localStorage)
```tsx
import { useCart } from '@/hooks/useCart'
const { items, add, remove, changeQty, clear, subtotal } = useCart()
```

### UI Feedback
```tsx
import { useToast } from '@/components/ui/Toast'
import { useDialog } from '@/components/ui/ConfirmDialog'

toast.success('تم!')  // .success | .error | .info | .warning
const confirmed = await dialog.confirm('متأكد؟')  // Promise<boolean>
```

### Realtime Subscriptions
```tsx
useEffect(() => {
  const unsub = onSnapshot(query(collection(db, 'orders'), where(...)), snap => {...})
  return () => unsub()  // ← ALWAYS cleanup
}, [deps])
```

### Firebase Imports
```tsx
import { db, auth, storage } from '@/firebase'
import { collection, doc, getDoc, setDoc, updateDoc, onSnapshot, query, where, orderBy, serverTimestamp } from 'firebase/firestore'
```

## Adding Features
1. **New Page**: Create in `src/pages/`, add route in App.tsx with protection wrappers
2. **New Collection**: Update firestore.rules FIRST, add types to types/index.ts
3. **Icons**: Use `lucide-react` exclusively

## Critical Gotchas
- `restaurants/{uid}` uses owner UID → `doc(db, 'restaurants', ownerId)` NOT `where()`
- `admin` role can order like `customer` → both allowed in checkout routes
- Owner restaurant doc auto-created on first login (auth.tsx lines 89-100)
- Customer location required each session: `sessionStorage.getItem('broast_session_location')`
- Use `serverTimestamp()` for `updatedAt` fields

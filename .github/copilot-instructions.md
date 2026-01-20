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
├── types/index.ts    # Centralized TypeScript interfaces
└── utils/            # Helpers: cities.ts, distance.ts, config.ts
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
// App.tsx pattern - nest ProtectedRoute > RoleGate
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
| `hiringRequests` | auto | Courier job applications |
| `notifications` | auto | System notifications |
| `promotions` | auto | Paid ads for restaurants |
| `tasks` | auto | Admin task assignments |
| `settings` | `{doc}` | Global config (deliveryFee, platformFee) |

**⚠️ Update `firestore.rules` FIRST when adding collections.** Use rule helpers: `isOwner()`, `isAdmin()`, `isDeveloper()`, `isCourier()`, `isCustomer()`

## Key Patterns

### Cart (localStorage hook)
```tsx
import { useCart } from '@/hooks/useCart'
const { items, add, remove, changeQty, clear, subtotal } = useCart()
// ⚠️ Do NOT use context/CartContext.tsx - it's deprecated
// Cart items include ownerId for multi-restaurant support
```

### UI Feedback (Context-based)
```tsx
import { useToast } from '@/components/ui/Toast'
import { useDialog } from '@/components/ui/ConfirmDialog'

const toast = useToast()
toast.success('تم!')  // .success | .error | .info | .warning

const dialog = useDialog()
const confirmed = await dialog.confirm('متأكد؟')  // Promise<boolean>
```

### Realtime Subscriptions (always cleanup!)
```tsx
useEffect(() => {
  const unsub = onSnapshot(query(collection(db, 'orders'), where(...)), snap => {...})
  return () => unsub()  // ← ALWAYS cleanup
}, [deps])
```

### Firebase Imports
```tsx
import { db, auth, storage } from '@/firebase'
import { collection, doc, getDoc, setDoc, updateDoc, addDoc, deleteDoc, onSnapshot, query, where, orderBy, serverTimestamp } from 'firebase/firestore'
```

### Timestamps
Always use `serverTimestamp()` for date fields:
```tsx
await addDoc(collection(db, 'orders'), {
  ...orderData,
  createdAt: serverTimestamp(),
  updatedAt: serverTimestamp(),
})
```

## Adding Features Checklist
1. **New Page**: Create in `src/pages/`, add route in [App.tsx](src/App.tsx) with ProtectedRoute/RoleGate
2. **New Collection**: Update [firestore.rules](firestore.rules) FIRST, add types to [types/index.ts](src/types/index.ts)
3. **New Type**: Add to `src/types/index.ts` - keep all interfaces centralized
4. **Icons**: Use `lucide-react` exclusively

## Critical Gotchas
- `restaurants/{uid}` uses owner UID → `doc(db, 'restaurants', ownerId)` NOT `where('ownerId', '==', ...)`
- `admin` role can order like `customer` → include both in checkout RoleGate: `allow={['customer', 'admin']}`
- Owner restaurant doc auto-created on first login ([auth.tsx#L103-L114](src/auth.tsx#L103-L114))
- Customer location uses `sessionStorage` key: `broast_session_location`
- Cart data stored in `localStorage` key: `broast_cart`
- `LocationRequired` component blocks UI until location is set for customer/owner/courier roles
- Auth uses IndexedDB persistence (mobile-friendly) - see [firebase.ts](src/firebase.ts)

## Order Flow & Status
```
pending → accepted → preparing → ready → out_for_delivery → delivered
                                    ↓
                              (or cancelled)
```
- `pending`: عند إنشاء الطلب - ينتظر موافقة المطعم
- `accepted`: المطعم قبل الطلب
- `preparing`: المطعم يحضر الطلب
- `ready`: الطلب جاهز للتوصيل/الاستلام
- `out_for_delivery`: المندوب في الطريق
- `delivered`: تم التوصيل بنجاح

## Commission System
- `platformFee`: 1.5 ريال لكل طلب (رسوم التطبيق)
- `adminCommission`: 0.5 ريال (إذا المطعم مسجل عن طريق admin)
- `wallets/{adminId}` tracks commission for admins who referred restaurants

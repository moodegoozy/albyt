# Copilot Instructions for سُفرة البيت (Sofra Al-Bayt)

## Stack & Commands
- **Stack**: React 18 + Vite + TypeScript + Firebase (Auth/Firestore/Storage) + TailwindCSS
- **Commands**: `npm run dev` | `npm run build` | `npm run preview`
- **Language**: All UI in Arabic RTL. Loading text: `"جارِ التحميل..."`
- **Imports**: Always use `@/` alias (maps to `src/` via vite.config.ts)

## Architecture
```
src/
├── auth.tsx          # AuthContext: user, role, userLocation, locationRequired, refreshUserData()
├── firebase.ts       # Firebase init: exports { app, auth, db, storage }
├── App.tsx           # Routes with ProtectedRoute + RoleGate wrappers
├── pages/            # One component per route (30+ pages)
├── components/ui/    # Toast, ConfirmDialog (context-based providers)
├── hooks/useCart.ts  # localStorage cart with ownerId tracking
├── routes/           # ProtectedRoute, RoleGate components
└── types/index.ts    # Centralized TypeScript interfaces (MenuItem, Restaurant, Order, etc.)
```
> ⚠️ `context/CartContext.tsx` is DEPRECATED — use `hooks/useCart.ts`

## Role-Based Access
Roles: `customer | courier | owner | admin | developer`
| Role | Capabilities |
|------|--------------|
| `developer` | Full access, delete ops, user management, system config |
| `admin` | Add restaurants (earns 0.5 SAR commission), can order like customer |
| `owner` | Manage menu, process orders, restaurant settings, hire couriers |
| `courier` | Claim ready orders, update delivery status, chat with customers |
| `customer` | Browse, order, track, chat |

## Route Protection Pattern
```tsx
<ProtectedRoute>                          {/* → /login if !auth */}
  <RoleGate allow={['owner', 'admin']}>   {/* → / if role mismatch */}
    <YourPage />
  </RoleGate>
</ProtectedRoute>
```

## Firestore Collections & Rules
| Collection | Doc ID | Key Fields |
|------------|--------|------------|
| `users` | `{uid}` | `role`, `location`, `savedLocation` (customer) |
| `restaurants` | `{ownerId}` | **⚠️ Doc ID = owner's UID** → `doc(db, 'restaurants', ownerId)` |
| `menuItems` | auto | `ownerId` links to restaurant, `available`, `price` |
| `orders` | auto | `status`, `customerId`, `courierId?`, `restaurantId` |
| `orders/{id}/messages` | auto | Chat subcollection |
| `wallets` | `{adminId}` | Commission tracking for admins |
| `settings` | `{doc}` | Global config (delivery fees, hours) |
| `hiringRequests` | auto | Courier hiring: `courierId`, `restaurantId`, `status` |
| `notifications` | auto | System notifications: `recipientId`, `read` |
| `promotions` | auto | Restaurant ads: `ownerId`, `viewsCount` |
| `packageRequests` | auto | Package subscription requests |
| `restaurantStats` | `{restaurantId}` | Visit tracking: `totalProfileViews`, `dailyViews`, `whatsappShareCount` |
| `visitLogs` | auto | Visit records: `restaurantId`, `source`, `visitorType` |
| `customerRegistrations` | auto | Referral registrations: `restaurantId`, `customerId` |

**⚠️ Update `firestore.rules` FIRST when adding collections.** Helper functions in rules: `isOwner()`, `isAdmin()`, `isDeveloper()`, `isCourier()`, `isCustomer()`

## Order Status Flow
`pending → accepted → preparing → ready → out_for_delivery → delivered`
(can also be `cancelled`)

## Key Patterns

### Visit Tracking (Premium Analytics)
```tsx
// Track visits when customer opens restaurant page
await addDoc(collection(db, 'visitLogs'), {
  restaurantId, visitorId: userId || null,
  source: 'whatsapp' | 'direct' | 'social', page: 'menu',
  createdAt: serverTimestamp()
})
// Update restaurant stats
await updateDoc(doc(db, 'restaurantStats', restaurantId), {
  totalProfileViews: increment(1)
})
```

### WhatsApp Share with Tracking
```tsx
const link = `${origin}/menu?restaurant=${uid}&ref=whatsapp`
const text = encodeURIComponent(`🍽️ تفضل بزيارة ${name}!\n\n${link}`)
window.open(`https://wa.me/?text=${text}`, '_blank')
// Update whatsappShareCount in restaurantStats
```

### Cart (localStorage with ownerId)
```tsx
import { useCart } from '@/hooks/useCart'
const { items, add, remove, changeQty, clear, subtotal } = useCart()
// CartItem: { id, name, price, qty, ownerId }
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

### Realtime Subscriptions (Always cleanup!)
```tsx
useEffect(() => {
  const unsub = onSnapshot(query(collection(db, 'orders'), where(...)), snap => {...})
  return () => unsub()
}, [deps])
```

### Firebase Imports
```tsx
import { db, auth, storage } from '@/firebase'
import { collection, doc, getDoc, setDoc, updateDoc, onSnapshot, query, where, orderBy, serverTimestamp, increment } from 'firebase/firestore'
```

## Adding Features Checklist
1. **New Page**: Create in `src/pages/`, add route in `App.tsx` with `ProtectedRoute`/`RoleGate`
2. **New Collection**: Update `firestore.rules` FIRST, add types to `types/index.ts`
3. **New Types**: Add to `src/types/index.ts` for consistency
4. **Icons**: Use `lucide-react` exclusively

## Critical Gotchas
- **Restaurant lookup**: `doc(db, 'restaurants', ownerId)` NOT `where('ownerId', '==', ...)`
- **Admin ordering**: `admin` can order like `customer` → include both in checkout `RoleGate`
- **Auto-create restaurant**: Owner's restaurant doc created on first login in `auth.tsx` (lines 106-117)
- **Location session**: Customer location stored in `sessionStorage` key `broast_session_location`
- **Location required**: App shows `LocationRequired` component if `locationRequired` is true in auth context
- **Timestamps**: Use `serverTimestamp()` for `createdAt`/`updatedAt` fields
- **Commission system**: Platform fee 1.5 SAR/order + 0.5 SAR admin referral commission
- **Package system**: Restaurants have `packageType: 'free' | 'premium'` with subscription dates
- **Seller tiers**: `bronze | silver | gold` based on ratings and delivery performance

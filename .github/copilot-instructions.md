# Copilot Instructions for سُفرة البيت (Sofra Al-Bayt)

## Stack & Commands
- **Stack**: React 18 + Vite + TypeScript + Firebase (Auth/Firestore/Storage) + TailwindCSS
- **Commands**: `npm run dev` (port 5173) | `npm run build` (runs tsc first) | `npm run preview`
- **Language**: All UI in Arabic RTL. Loading text: `"جارِ التحميل..."`
- **Imports**: Always use `@/` alias (maps to `src/` via vite.config.ts)
- **Firebase Project**: `albayt-sofra` (config in `src/firebase.ts`)

## Architecture
| Path | Purpose |
|------|---------|
| `src/auth.tsx` | AuthContext: `user`, `role`, `userLocation`, `locationRequired`, `refreshUserData()` |
| `src/firebase.ts` | Firebase exports: `{ app, auth, db, storage }`. Auth uses IndexedDB persistence for mobile. |
| `src/App.tsx` | All routes with `ProtectedRoute` + `RoleGate` wrappers |
| `src/pages/` | One component per route (30+ pages) |
| `src/hooks/useCart.ts` | localStorage cart (key: `broast_cart`). **⚠️ NOT** `context/CartContext.tsx` (deprecated) |
| `src/types/index.ts` | All TypeScript interfaces (MenuItem, Restaurant, Order, User, Wallet, etc.) |
| `src/components/ui/` | `ToastProvider` (useToast), `ConfirmDialog` - context-based feedback |
| `src/routes/` | `ProtectedRoute.tsx` (auth check), `RoleGate.tsx` (role-based access) |
| `firestore.rules` | Security rules with helper functions: `myRole()`, `isOwner()`, `isCourier()`, etc. |

## Roles: `customer | courier | owner | admin | developer`
- `developer`: Full access, delete ops, user/system management
- `admin`: Add restaurants (earns 0.75 SAR commission per item), can order like `customer`
- `owner`: Manage menu, orders, hire couriers, restaurant settings
- `courier`: Accept `ready` orders, delivery workflow (pays 3.75 SAR platform fee)
- `customer`: Browse, order, track deliveries

## Critical Firestore Patterns
```tsx
// ⚠️ RESTAURANT DOC ID = OWNER UID (not auto-generated!)
doc(db, 'restaurants', ownerId)          // ✅ Correct
where('ownerId', '==', ownerId)          // ❌ Wrong for restaurant lookup

// Menu items link to restaurant via ownerId
where('ownerId', '==', restaurantId)     // ✅ For menuItems queries

// Order status flow
'pending' → 'accepted' → 'preparing' → 'ready' → 'out_for_delivery' → 'delivered' | 'cancelled'
```

**Collections**: `users/{uid}`, `restaurants/{ownerId}`, `restaurants/{ownerId}/private/bankInfo`, `menuItems/{auto}`, `orders/{auto}`, `orders/{orderId}/messages/{auto}`, `wallets/{adminId}`, `settings/{doc}`, `packageRequests/{auto}`, `tasks/{auto}`, `restaurantStats/{restaurantId}`, `promotions/{auto}`

## Route Protection Pattern
```tsx
<ProtectedRoute>                          {/* → /login if !auth */}
  <RoleGate allow={['owner', 'admin']}>   {/* → / if role mismatch */}
    <YourPage />
  </RoleGate>
</ProtectedRoute>
```

## Key Code Patterns
```tsx
// Firebase imports - always use @/ alias
import { db, auth, storage } from '@/firebase'
import { collection, doc, getDoc, onSnapshot, serverTimestamp } from 'firebase/firestore'
import { useAuth } from '@/auth'

// Cart hook (localStorage-based, with useCallback/useMemo optimization)
const { items, add, remove, changeQty, clear, subtotal } = useCart()

// Toast feedback (must be inside ToastProvider tree in main.tsx)
const toast = useToast()
toast.success('تم!')
toast.error('حدث خطأ')

// ⚠️ ALWAYS cleanup Firestore subscriptions
useEffect(() => {
  const unsub = onSnapshot(query(collection(db, 'orders'), where(...)), snap => {...})
  return () => unsub()
}, [deps])
```

## Adding Features Checklist
1. **New page**: Create in `src/pages/`, add route in `App.tsx` with `ProtectedRoute` + `RoleGate`
2. **New collection**: Update `firestore.rules` FIRST (add helper functions if needed), then add types to `types/index.ts`
3. **Icons**: Use `lucide-react` exclusively
4. **Timestamps**: Always use `serverTimestamp()` for `createdAt`/`updatedAt`
5. **Real-time data**: Prefer `onSnapshot()` with cleanup over `getDocs()` for live updates

## Gotchas & Conventions
- `admin` can order like `customer` → include both in checkout/orders `RoleGate` allow lists
- Owner restaurant doc auto-created on first login via `auth.tsx` (see `onAuthStateChanged` handler)
- Customer location handling:
  - Stored in `sessionStorage` key: `broast_session_location`
  - Persisted to `users/{uid}.savedLocation` (for customers) or `users/{uid}.location` (for others)
  - Customer/admin uses `savedLocation`, owner/courier uses `location`
  - Auto geolocation attempted first, then `LocationRequired` modal triggered by `locationRequired`
- Commission system (per item):
  - Platform fee: 1.0 SAR per item (`PLATFORM_FEE_PER_ITEM` in CheckoutPage.tsx)
  - Admin referral: 0.75 SAR per item if restaurant was added by admin (`ADMIN_COMMISSION_PER_ITEM`)
  - Courier platform fee: 3.75 SAR per delivery order (`COURIER_PLATFORM_FEE`)
  - Service fee shown to customer = 1.75 SAR/item (platform + admin combined)
- Restaurant packages: `free | premium` with `packageExpiresAt`, subscription requests via `PackageSubscriptionRequest` collection
- Bank info: Stored in subcollection `restaurants/{ownerId}/private/bankInfo` for security
- Delivery types: `'delivery' | 'pickup'` on `Order.deliveryType`
- Seller tiers: `'bronze' | 'silver' | 'gold'` based on `averageRating`, `onTimeDeliveryRate`, `complaintsCount`
- Multi-restaurant cart: CartItem includes `ownerId` to support multiple restaurants in one cart (future feature)

## 🔒 Privacy: Phone Number Visibility Rules
**أرقام جوال الأسر المنتجة مخفية عن العملاء بالكامل!**

```tsx
// ✅ إظهار رقم الجوال فقط للإدارة وصاحبة الحساب
{(role === 'admin' || role === 'developer' || (role === 'owner' && user?.uid === restaurantId)) && restaurant.phone && (
  <PhoneDisplay phone={restaurant.phone} />
)}

// ❌ لا يوجد زر تواصل بديل في صفحة المنتجات
// المحادثة متاحة فقط أثناء الطلب النشط (من إنشاء الطلب حتى استلامه)
```

**القاعدة تنطبق على:**
- `restaurant.phone` (رقم الأسرة الأساسي)
- `restaurant.hiringContact` (رقم التوظيف)
- أي حقل يحتوي على رقم جوال للمطعم/الأسرة

**نظام المحادثة:**
- المحادثة تفتح فقط عند وجود طلب نشط (`ChatPage` مع `orderId`)
- Messages stored in subcollection: `orders/{orderId}/messages/{auto}`
- تغلق تلقائياً عند استلام الطلب (`status === 'delivered'`)

**الهدف:** جميع التعاملات تتم داخل المنصة عبر نظام المحادثة أثناء الطلبات فقط

## Analytics & Tracking
- **RestaurantStats**: Track profile/menu/item views, shares (WhatsApp), registered customers, followers
- **VisitLog**: Record visitor activity (anonymous, customer, or registered via referral link)
- **Promotions**: Paid ads system for restaurants (text/image/video), 24h duration default, track `viewsCount`

## Fixed Header Layout Pattern
```tsx
// App.tsx structure:
<div className="fixed top-0 left-0 right-0 z-50">
  <BetaBanner />
  <TopBar />
  <Header />
</div>
<div className="h-[130px] sm:h-[150px]" /> {/* Spacer matching header height */}
<main className="flex-1 max-w-6xl mx-auto w-full px-4 py-8">
  {/* Routes here */}
</main>
```

## Authentication & Session Management
- Firebase Auth persistence: `indexedDBLocalPersistence` → `browserLocalPersistence` fallback
- Session tracking via `onAuthStateChanged` in `auth.tsx`
- User role loaded from `users/{uid}` on auth state change
- Location flow: sessionStorage → Firestore `savedLocation` (customers) or `location` (others)
- Auto geolocation: If no saved location, app tries `navigator.geolocation` before prompting user

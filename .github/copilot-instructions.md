# Copilot Instructions - سفرة البيت (Albyt)

## Overview
Arabic RTL food delivery PWA connecting home-based restaurants ("أسرة منتجة") with customers/couriers. Stack: **React 18 + TypeScript + Vite + TailwindCSS + Firebase**.

## Architecture

### Role-Based Access (5 roles in [src/types/index.ts](src/types/index.ts))
| Role | Access | Key Pages |
|------|--------|-----------|
| `customer` | Order, track, profile | `/checkout`, `/orders` |
| `courier` | Deliver orders | `/courier` |
| `owner` | Manage restaurant/menu | `/owner/*` |
| `admin` | Oversee referred restaurants | `/admin/*` |
| `developer` | Full superuser access | All routes |

**Route protection pattern** (always include `developer` in allowed roles):
```tsx
<ProtectedRoute>
  <RoleGate allow={['owner', 'developer']}>
    <Component />
  </RoleGate>
</ProtectedRoute>
```

### Firebase Data Model
| Collection | Doc ID Pattern | Key Relationships |
|------------|----------------|-------------------|
| `users/{uid}` | Firebase Auth UID | `role` field determines access |
| `restaurants/{ownerId}` | Owner's UID | `referredBy` → admin UID |
| `menuItems/{id}` | Auto-generated | `ownerId` → restaurant |
| `orders/{id}` | Auto-generated | `customerId`, `courierId`, `restaurantId` |
| `settings/general` | Fixed ID | Global app config |

**Firestore rules** use helper functions: `isOwner()`, `isCourier()`, `isCustomer()`, `isAdmin()`, `isDeveloper()` in [firestore.rules](firestore.rules).

### Order Status Flow
`pending` → `accepted` → `preparing` → `ready` → `out_for_delivery` → `delivered` (or `cancelled`)

## Key Conventions

### Imports - Use `@/` alias exclusively
```tsx
import { useAuth } from '@/auth'
import { db, storage } from '@/firebase'
import { MenuItem, Order } from '@/types'
import { useCart } from '@/hooks/useCart'
```

### State Management
- **Auth**: `useAuth()` hook → `{ user, role, loading, logout, userLocation, locationRequired }`
- **Cart**: `useCart()` hook (localStorage, NOT Context) → `{ items, add, remove, clear, subtotal }`
- **Settings**: Fetch from `settings/general` via `getAppSettings()` in [src/utils/config.ts](src/utils/config.ts)

### Styling Patterns
- **Colors**: Sky palette (`sky-50` to `sky-900`), gradients like `bg-gradient-to-b from-sky-50 via-white to-sky-50`
- **Icons**: `lucide-react` only
- **RTL**: Layout is right-to-left by default
- **Responsive**: Mobile-first with `sm:` breakpoints

### Arabic Code Comments
Codebase uses Arabic comments extensively. Maintain bilingual readability when adding new code.

## Development

```bash
npm run dev      # Vite dev server on port 5173
npm run build    # TypeScript check + production build
```

## Common Tasks

### Adding a new page
1. Create in `src/pages/NewPage.tsx`
2. Add route in [src/App.tsx](src/App.tsx) with `ProtectedRoute`/`RoleGate`
3. Add nav link in [src/components/Header.tsx](src/components/Header.tsx)

### Adding new types
Add to [src/types/index.ts](src/types/index.ts) - never define inline

### Modifying Firestore rules
Edit [firestore.rules](firestore.rules) - use existing helper functions, `isDeveloper()` for admin-only ops

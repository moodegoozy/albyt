import React from 'react'
import { Routes, Route, Navigate } from 'react-router-dom'
import { Header } from './components/Header'
import { Footer } from './components/Footer'
import { TopBar } from './components/TopBar'

// صفحات المستخدم
import { Landing } from './pages/Landing'
import { RestaurantsPage } from './pages/RestaurantsPage'
import { MenuPage } from './pages/MenuPage'
import { CartPage } from './pages/CartPage'
import { Login } from './pages/Login'
import { Register } from './pages/Register'
import PrivacyPolicy from './pages/PrivacyPolicy'
import AccountDeleted from './pages/AccountDeleted'

// صفحات العميل
import { CheckoutPage } from './pages/CheckoutPage'
import { TrackOrders } from './pages/TrackOrders'

// صفحات صاحب المطعم
import { OwnerDashboard } from './pages/OwnerDashboard'
import { ManageMenu } from './pages/ManageMenu'
import { OrdersAdmin } from './pages/OrdersAdmin'
import { EditRestaurant } from './pages/EditRestaurant'
import { CourierRequests } from './pages/CourierRequests'

// صفحات المندوب
import { CourierApp } from './pages/CourierApp'
import { CourierHiring } from './pages/CourierHiring'

// صفحات المطور
import { Developer } from './pages/Developer'

// مسارات محمية
import { ProtectedRoute } from './routes/ProtectedRoute'
import { RoleGate } from './routes/RoleGate'

// صفحة تصحيح الطلبات
import { DebugOrders } from './pages/DebugOrders'

export default function App() {
  return (
    <div className="min-h-screen flex flex-col bg-secondary text-dark">
      {/* الشريط العلوي */}
      <TopBar />
      {/* رأس الصفحة */}
      <Header />

      {/* المحتوى الرئيسي */}
      <main className="flex-1 max-w-6xl mx-auto px-4 py-8 bg-gradient-to-br from-secondary via-[#FCEBCB] to-[#F7DDA6] rounded-xl shadow-inner">
        <Routes>
          {/* الصفحة الرئيسية */}
          <Route path="/" element={<Landing />} />

          {/* صفحات المطاعم */}
          <Route path="/restaurants" element={<RestaurantsPage />} />
          <Route path="/menu" element={<MenuPage />} />
          <Route path="/cart" element={<CartPage />} />
          <Route path="/login" element={<Login />} />
          <Route path="/register" element={<Register />} />
          <Route path="/privacy-policy" element={<PrivacyPolicy />} />
          <Route path="/account-deleted" element={<AccountDeleted />} />

          {/* صفحات العميل */}
          <Route
            path="/checkout"
            element={
              <ProtectedRoute>
                <RoleGate allow={['customer']}>
                  <CheckoutPage />
                </RoleGate>
              </ProtectedRoute>
            }
          />
          <Route
            path="/orders"
            element={
              <ProtectedRoute>
                <RoleGate allow={['customer']}>
                  <TrackOrders />
                </RoleGate>
              </ProtectedRoute>
            }
          />

          {/* صفحات صاحب المطعم */}
          <Route
            path="/owner"
            element={
              <ProtectedRoute>
                <RoleGate allow={['owner']}>
                  <OwnerDashboard />
                </RoleGate>
              </ProtectedRoute>
            }
          />
          <Route
            path="/owner/menu"
            element={
              <ProtectedRoute>
                <RoleGate allow={['owner']}>
                  <ManageMenu />
                </RoleGate>
              </ProtectedRoute>
            }
          />
          <Route
            path="/owner/orders"
            element={
              <ProtectedRoute>
                <RoleGate allow={['owner']}>
                  <OrdersAdmin />
                </RoleGate>
              </ProtectedRoute>
            }
          />
          <Route
            path="/owner/edit"
            element={
              <ProtectedRoute>
                <RoleGate allow={['owner']}>
                  <EditRestaurant />
                </RoleGate>
              </ProtectedRoute>
            }
          />
          <Route
            path="/owner/courier-requests"
            element={
              <ProtectedRoute>
                <RoleGate allow={['owner']}>
                  <CourierRequests />
                </RoleGate>
              </ProtectedRoute>
            }
          />

          {/* صفحات المندوب */}
          <Route
            path="/courier"
            element={
              <ProtectedRoute>
                <RoleGate allow={['courier']}>
                  <CourierApp />
                </RoleGate>
              </ProtectedRoute>
            }
          />
          <Route
            path="/courier/hiring"
            element={
              <ProtectedRoute>
                <RoleGate allow={['courier']}>
                  <CourierHiring />
                </RoleGate>
              </ProtectedRoute>
            }
          />

          {/* صفحة المطور */}
          <Route
            path="/developer"
            element={
              <ProtectedRoute>
                <RoleGate allow={['developer', 'admin']}>
                  <Developer />
                </RoleGate>
              </ProtectedRoute>
            }
          />

          {/* صفحة تصحيح الطلبات */}
          <Route path="/__debug_orders" element={<DebugOrders />} />

          {/* صفحة 404 */}
          <Route path="*" element={<Navigate to="/" replace />} />
        </Routes>
      </main>

      {/* الفوتر */}
      <Footer />
    </div>
  )
}

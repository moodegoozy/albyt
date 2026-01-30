import React from 'react'
import { Routes, Route, Navigate } from 'react-router-dom'
import { Header } from './components/Header'
import { Footer } from './components/Footer'
import { TopBar } from './components/TopBar'
import { BetaBanner } from './components/BetaBanner'
import { LocationRequired } from './components/LocationRequired'
import { useAuth } from './auth'

// صفحات المستخدم
import { Landing } from './pages/Landing'
import { RestaurantsPage } from './pages/RestaurantsPage'
import { MenuPage } from './pages/MenuPage'
import { CartPage } from './pages/CartPage'
import { Login } from './pages/Login'
import { Register } from './pages/Register'
import { CustomerLogin } from './pages/CustomerLogin'
import PrivacyPolicy from './pages/PrivacyPolicy'
import AccountDeleted from './pages/AccountDeleted'

// صفحات العميل
import { CheckoutPage } from './pages/CheckoutPage'
import { TrackOrders } from './pages/TrackOrders'
import { ProfileEdit } from './pages/ProfileEdit'

// صفحات صاحب المطعم
import { OwnerDashboard } from './pages/OwnerDashboard'
import { ManageMenu } from './pages/ManageMenu'
import { OrdersAdmin } from './pages/OrdersAdmin'
import { EditRestaurant } from './pages/EditRestaurant'
import { CourierRequests } from './pages/CourierRequests'
import { PackagesPage } from './pages/PackagesPage'
import { PromotionPage } from './pages/PromotionPage'

// صفحات المندوب
import { CourierApp } from './pages/CourierApp'
import { CourierHiring } from './pages/CourierHiring'
import { ChatPage } from './pages/ChatPage'

// صفحة الإشعارات
import { NotificationsPage } from './pages/NotificationsPage'

// صفحات الإدمن والمطور
import { AdminDashboard } from './pages/AdminDashboard'
import { AdminRestaurants } from './pages/AdminRestaurants'
import { AdminOrders } from './pages/AdminOrders'
import { Developer } from './pages/Developer'
import { SetupDeveloper } from './pages/SetupDeveloper'

// مسارات محمية
import { ProtectedRoute } from './routes/ProtectedRoute'
import { RoleGate } from './routes/RoleGate'

// صفحة تصحيح الطلبات
import { DebugOrders } from './pages/DebugOrders'

export default function App() {
  const { locationRequired, refreshUserData, loading } = useAuth()

  // إذا كان الموقع مطلوب، نعرض صفحة تحديد الموقع
  if (!loading && locationRequired) {
    return <LocationRequired onLocationSaved={refreshUserData} />
  }

  return (
    <div className="min-h-screen flex flex-col bg-gradient-to-b from-sky-50 via-white to-sky-50 text-sky-900">
      {/* الشريط العلوي + رأس الصفحة - ثابتين في أعلى الشاشة تماماً */}
      <div className="fixed top-0 left-0 right-0 z-50">
        <BetaBanner />
        <TopBar />
        <Header />
      </div>

      {/* مسافة فارغة بحجم الهيدر */}
      <div className="h-[130px] sm:h-[150px]" />

      {/* المحتوى الرئيسي */}
      <main className="flex-1 max-w-6xl mx-auto w-full px-4 py-8">
        <Routes>
          {/* الصفحة الرئيسية */}
          <Route path="/" element={<Landing />} />

          {/* صفحات المطاعم */}
          <Route path="/restaurants" element={<RestaurantsPage />} />
          <Route path="/menu" element={<MenuPage />} />
          <Route path="/cart" element={<CartPage />} />
          <Route path="/login" element={<Login />} />
          <Route path="/customer-login" element={<CustomerLogin />} />
          <Route path="/register" element={<Register />} />
          <Route path="/privacy-policy" element={<PrivacyPolicy />} />
          <Route path="/account-deleted" element={<AccountDeleted />} />
          <Route path="/setup-dev" element={<SetupDeveloper />} />

          {/* صفحة المحادثة */}
          <Route
            path="/chat"
            element={
              <ProtectedRoute>
                <RoleGate allow={['customer', 'courier', 'owner', 'admin', 'developer']}>
                  <ChatPage />
                </RoleGate>
              </ProtectedRoute>
            }
          />

          {/* صفحة الإشعارات */}
          <Route
            path="/notifications"
            element={
              <ProtectedRoute>
                <RoleGate allow={['customer', 'courier', 'owner', 'admin', 'developer']}>
                  <NotificationsPage />
                </RoleGate>
              </ProtectedRoute>
            }
          />

          {/* صفحات العميل */}
          <Route
            path="/checkout"
            element={
              <ProtectedRoute>
                <RoleGate allow={['customer', 'admin', 'developer']}>
                  <CheckoutPage />
                </RoleGate>
              </ProtectedRoute>
            }
          />
          <Route
            path="/orders"
            element={
              <ProtectedRoute>
                <RoleGate allow={['customer', 'admin', 'developer']}>
                  <TrackOrders />
                </RoleGate>
              </ProtectedRoute>
            }
          />
          <Route
            path="/profile"
            element={
              <ProtectedRoute>
                <RoleGate allow={['customer', 'courier', 'owner', 'admin', 'developer']}>
                  <ProfileEdit />
                </RoleGate>
              </ProtectedRoute>
            }
          />

          {/* صفحات صاحب المطعم */}
          <Route
            path="/owner"
            element={
              <ProtectedRoute>
                <RoleGate allow={['owner', 'developer']}>
                  <OwnerDashboard />
                </RoleGate>
              </ProtectedRoute>
            }
          />
          <Route
            path="/owner/menu"
            element={
              <ProtectedRoute>
                <RoleGate allow={['owner', 'developer']}>
                  <ManageMenu />
                </RoleGate>
              </ProtectedRoute>
            }
          />
          <Route
            path="/owner/orders"
            element={
              <ProtectedRoute>
                <RoleGate allow={['owner', 'developer']}>
                  <OrdersAdmin />
                </RoleGate>
              </ProtectedRoute>
            }
          />
          <Route
            path="/owner/edit"
            element={
              <ProtectedRoute>
                <RoleGate allow={['owner', 'developer']}>
                  <EditRestaurant />
                </RoleGate>
              </ProtectedRoute>
            }
          />
          <Route
            path="/owner/courier-requests"
            element={
              <ProtectedRoute>
                <RoleGate allow={['owner', 'developer']}>
                  <CourierRequests />
                </RoleGate>
              </ProtectedRoute>
            }
          />
          <Route
            path="/owner/packages"
            element={
              <ProtectedRoute>
                <RoleGate allow={['owner', 'developer']}>
                  <PackagesPage />
                </RoleGate>
              </ProtectedRoute>
            }
          />
          <Route
            path="/owner/promotion"
            element={
              <ProtectedRoute>
                <RoleGate allow={['owner', 'developer']}>
                  <PromotionPage />
                </RoleGate>
              </ProtectedRoute>
            }
          />

          {/* صفحات المندوب */}
          <Route
            path="/courier"
            element={
              <ProtectedRoute>
                <RoleGate allow={['courier', 'developer']}>
                  <CourierApp />
                </RoleGate>
              </ProtectedRoute>
            }
          />
          <Route
            path="/courier/hiring"
            element={
              <ProtectedRoute>
                <RoleGate allow={['courier', 'developer']}>
                  <CourierHiring />
                </RoleGate>
              </ProtectedRoute>
            }
          />

          {/* صفحات الإدمن (المشرف) */}
          <Route
            path="/admin"
            element={
              <ProtectedRoute>
                <RoleGate allow={['admin', 'developer']}>
                  <AdminDashboard />
                </RoleGate>
              </ProtectedRoute>
            }
          />
          <Route
            path="/admin/restaurants"
            element={
              <ProtectedRoute>
                <RoleGate allow={['admin', 'developer']}>
                  <AdminRestaurants />
                </RoleGate>
              </ProtectedRoute>
            }
          />
          <Route
            path="/admin/orders"
            element={
              <ProtectedRoute>
                <RoleGate allow={['admin', 'developer']}>
                  <AdminOrders />
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

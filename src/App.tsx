import React, { Suspense, lazy } from 'react'
import { Routes, Route, Navigate } from 'react-router-dom'
import { Header } from './components/Header'
import { Footer } from './components/Footer'
import { TopBar } from './components/TopBar'
import { BetaBanner } from './components/BetaBanner'
import { LocationRequired } from './components/LocationRequired'
import { useAuth } from './auth'

// 🚀 Lazy-loaded pages - كل صفحة تُحمّل عند الحاجة فقط
const Landing = lazy(() => import('./pages/Landing').then(m => ({ default: m.Landing })))
const RestaurantsPage = lazy(() => import('./pages/RestaurantsPage').then(m => ({ default: m.RestaurantsPage })))
const MenuPage = lazy(() => import('./pages/MenuPage').then(m => ({ default: m.MenuPage })))
const CartPage = lazy(() => import('./pages/CartPage').then(m => ({ default: m.CartPage })))
const Login = lazy(() => import('./pages/Login').then(m => ({ default: m.Login })))
const Register = lazy(() => import('./pages/Register').then(m => ({ default: m.Register })))
const RegisterChoice = lazy(() => import('./pages/RegisterChoice').then(m => ({ default: m.RegisterChoice })))
const OwnerRegister = lazy(() => import('./pages/OwnerRegister').then(m => ({ default: m.OwnerRegister })))
const CustomerLogin = lazy(() => import('./pages/CustomerLogin').then(m => ({ default: m.CustomerLogin })))
const PrivacyPolicy = lazy(() => import('./pages/PrivacyPolicy'))
const TermsPage = lazy(() => import('./pages/TermsPage'))
const AccountDeleted = lazy(() => import('./pages/AccountDeleted'))

// صفحات العميل
const CheckoutPage = lazy(() => import('./pages/CheckoutPage').then(m => ({ default: m.CheckoutPage })))
const TrackOrders = lazy(() => import('./pages/TrackOrders').then(m => ({ default: m.TrackOrders })))
const ProfileEdit = lazy(() => import('./pages/ProfileEdit').then(m => ({ default: m.ProfileEdit })))

// صفحات صاحب المطعم
const OwnerDashboard = lazy(() => import('./pages/OwnerDashboard').then(m => ({ default: m.OwnerDashboard })))
const ManageMenu = lazy(() => import('./pages/ManageMenu').then(m => ({ default: m.ManageMenu })))
const OrdersAdmin = lazy(() => import('./pages/OrdersAdmin').then(m => ({ default: m.OrdersAdmin })))
const EditRestaurant = lazy(() => import('./pages/EditRestaurant').then(m => ({ default: m.EditRestaurant })))
const CourierRequests = lazy(() => import('./pages/CourierRequests').then(m => ({ default: m.CourierRequests })))
const PackagesPage = lazy(() => import('./pages/PackagesPage').then(m => ({ default: m.PackagesPage })))
const PromotionPage = lazy(() => import('./pages/PromotionPage').then(m => ({ default: m.PromotionPage })))
const OffersPage = lazy(() => import('./pages/OffersPage').then(m => ({ default: m.OffersPage })))
const StoriesPage = lazy(() => import('./pages/StoriesPage').then(m => ({ default: m.StoriesPage })))

// صفحات المندوب
const CourierApp = lazy(() => import('./pages/CourierApp').then(m => ({ default: m.CourierApp })))
const CourierHiring = lazy(() => import('./pages/CourierHiring').then(m => ({ default: m.CourierHiring })))
const ChatPage = lazy(() => import('./pages/ChatPage').then(m => ({ default: m.ChatPage })))

// صفحات عامة
const NotificationsPage = lazy(() => import('./pages/NotificationsPage').then(m => ({ default: m.NotificationsPage })))
const LiveSupportPage = lazy(() => import('./pages/LiveSupportPage').then(m => ({ default: m.LiveSupportPage })))

// صفحات الإدمن والمطور
const AdminDashboard = lazy(() => import('./pages/AdminDashboard').then(m => ({ default: m.AdminDashboard })))
const AdminRestaurants = lazy(() => import('./pages/AdminRestaurants').then(m => ({ default: m.AdminRestaurants })))
const AdminOrders = lazy(() => import('./pages/AdminOrders').then(m => ({ default: m.AdminOrders })))
const Developer = lazy(() => import('./pages/Developer').then(m => ({ default: m.Developer })))
const SetupDeveloper = lazy(() => import('./pages/SetupDeveloper').then(m => ({ default: m.SetupDeveloper })))
const SupportAdmin = lazy(() => import('./pages/SupportAdmin').then(m => ({ default: m.SupportAdmin })))
const ProblemsAdmin = lazy(() => import('./pages/ProblemsAdmin').then(m => ({ default: m.ProblemsAdmin })))
const ReportProblem = lazy(() => import('./pages/ReportProblem').then(m => ({ default: m.ReportProblem })))
const ReportsAdmin = lazy(() => import('./pages/ReportsAdmin').then(m => ({ default: m.ReportsAdmin })))

// صفحات المحاسبة والمحافظ
const AccountingDashboard = lazy(() => import('./pages/AccountingDashboard').then(m => ({ default: m.AccountingDashboard })))
const OwnerWalletPage = lazy(() => import('./pages/OwnerWalletPage').then(m => ({ default: m.OwnerWalletPage })))
const CourierWalletPage = lazy(() => import('./pages/CourierWalletPage').then(m => ({ default: m.CourierWalletPage })))

// مسارات محمية
import { ProtectedRoute } from './routes/ProtectedRoute'
import { RoleGate } from './routes/RoleGate'

// صفحة تصحيح الطلبات
const DebugOrders = lazy(() => import('./pages/DebugOrders').then(m => ({ default: m.DebugOrders })))

// 🎯 مكونات تجربة الطلب البسيطة
import { FloatingCartButton } from './components/SimpleOrderFlow'

// مؤشر التحميل
const PageLoader = () => (
  <div className="flex items-center justify-center min-h-[50vh]">
    <div className="flex flex-col items-center gap-4">
      <div className="w-12 h-12 border-4 border-sky-200 border-t-sky-500 rounded-full animate-spin" />
      <p className="text-sky-500 text-sm font-medium">جارِ التحميل...</p>
    </div>
  </div>
)

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

      {/* 🛒 زر السلة العائم - يظهر دائماً عند وجود عناصر */}
      <FloatingCartButton />

      {/* المحتوى الرئيسي */}
      <main className="flex-1 max-w-6xl mx-auto w-full px-4 py-8">
        <Suspense fallback={<PageLoader />}>
        <Routes>
          {/* الصفحة الرئيسية */}
          <Route path="/" element={<Landing />} />

          {/* صفحات المطاعم */}
          <Route path="/restaurants" element={<RestaurantsPage />} />
          <Route path="/menu" element={<MenuPage />} />
          <Route path="/cart" element={<CartPage />} />
          <Route path="/login" element={<Login />} />
          <Route path="/customer-login" element={<CustomerLogin />} />
          <Route path="/register" element={<RegisterChoice />} />
          <Route path="/register/form" element={<Register />} />
          <Route path="/register-owner" element={<OwnerRegister />} />
          <Route path="/privacy-policy" element={<PrivacyPolicy />} />
          <Route path="/terms" element={<TermsPage />} />
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

          {/* صفحة الدعم الفني المباشر */}
          <Route
            path="/support"
            element={
              <ProtectedRoute>
                <RoleGate allow={['customer', 'courier', 'owner', 'admin', 'developer']}>
                  <LiveSupportPage />
                </RoleGate>
              </ProtectedRoute>
            }
          />

          {/* صفحة الإبلاغ عن مشكلة - للعملاء والأسر والمندوبين */}
          <Route
            path="/report-problem"
            element={
              <ProtectedRoute>
                <RoleGate allow={['customer', 'courier', 'owner', 'developer']}>
                  <ReportProblem />
                </RoleGate>
              </ProtectedRoute>
            }
          />

          {/* صفحات العميل */}
          <Route path="/checkout" element={<CheckoutPage />} />
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
            path="/owner/offers"
            element={
              <ProtectedRoute>
                <RoleGate allow={['owner', 'developer']}>
                  <OffersPage />
                </RoleGate>
              </ProtectedRoute>
            }
          />
          <Route
            path="/owner/stories"
            element={
              <ProtectedRoute>
                <RoleGate allow={['owner', 'developer']}>
                  <StoriesPage />
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

          {/* إدارة الدعم الفني */}
          <Route
            path="/support-admin"
            element={
              <ProtectedRoute>
                <RoleGate allow={['developer']}>
                  <SupportAdmin />
                </RoleGate>
              </ProtectedRoute>
            }
          />

          {/* مركز مراقبة المشاكل */}
          <Route
            path="/problems-admin"
            element={
              <ProtectedRoute>
                <RoleGate allow={['developer']}>
                  <ProblemsAdmin />
                </RoleGate>
              </ProtectedRoute>
            }
          />

          {/* لوحة المحاسبة - للمطور فقط */}
          <Route
            path="/accounting"
            element={
              <ProtectedRoute>
                <RoleGate allow={['developer']}>
                  <AccountingDashboard />
                </RoleGate>
              </ProtectedRoute>
            }
          />

          {/* لوحة إدارة البلاغات - للمطور والمشرف */}
          <Route
            path="/reports-admin"
            element={
              <ProtectedRoute>
                <RoleGate allow={['admin', 'developer']}>
                  <ReportsAdmin />
                </RoleGate>
              </ProtectedRoute>
            }
          />

          {/* محفظة الأسرة المنتجة */}
          <Route
            path="/owner/wallet"
            element={
              <ProtectedRoute>
                <RoleGate allow={['owner', 'developer']}>
                  <OwnerWalletPage />
                </RoleGate>
              </ProtectedRoute>
            }
          />

          {/* محفظة المندوب */}
          <Route
            path="/courier/wallet"
            element={
              <ProtectedRoute>
                <RoleGate allow={['courier', 'developer']}>
                  <CourierWalletPage />
                </RoleGate>
              </ProtectedRoute>
            }
          />

          {/* صفحة تصحيح الطلبات */}
          <Route path="/__debug_orders" element={<DebugOrders />} />

          {/* صفحة 404 */}
          <Route path="*" element={<Navigate to="/" replace />} />
        </Routes>
        </Suspense>
      </main>

      {/* الفوتر */}
      <Footer />
    </div>
  )
}

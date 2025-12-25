import React, { useEffect, useState } from 'react'
import { Link } from 'react-router-dom'
import { Building2, ShoppingCart, Wallet, BarChart3 } from 'lucide-react'
import { useAuth } from '@/auth'
import { RoleGate } from '@/routes/RoleGate'
import { collection, getDocs, doc, getDoc } from 'firebase/firestore'
import { db } from '@/firebase'
import { Order, Restaurant } from '@/types'

type AdminStats = {
  totalRestaurants: number
  totalOrders: number
  totalEarnings: number
  pendingOrders: number
}

export const AdminDashboard: React.FC = () => {
  const { user } = useAuth()
  const [stats, setStats] = useState<AdminStats>({
    totalRestaurants: 0,
    totalOrders: 0,
    totalEarnings: 0,
    pendingOrders: 0,
  })
  const [walletBalance, setWalletBalance] = useState(0)
  const [loading, setLoading] = useState(true)

  // تحميل الإحصائيات
  useEffect(() => {
    if (!user) return

    (async () => {
      try {
        // جلب عدد المطاعم
        const restaurantsSnap = await getDocs(collection(db, 'restaurants'))
        const totalRestaurants = restaurantsSnap.size

        // جلب الطلبات
        const ordersSnap = await getDocs(collection(db, 'orders'))
        const orders = ordersSnap.docs.map(d => ({ id: d.id, ...d.data() } as Order))
        const totalOrders = orders.length
        const pendingOrders = orders.filter(o => o.status === 'pending').length
        const totalEarnings = orders.reduce((sum, o) => sum + (o.deliveryFee || 0), 0)

        // جلب محفظة الإدمن
        try {
          const walletSnap = await getDoc(doc(db, 'wallets', user.uid))
          const walletData = walletSnap.data()
          setWalletBalance(walletData?.balance || 0)
        } catch {
          setWalletBalance(0)
        }

        setStats({
          totalRestaurants,
          totalOrders,
          totalEarnings,
          pendingOrders,
        })
      } catch (err) {
        console.error('خطأ في تحميل الإحصائيات:', err)
      } finally {
        setLoading(false)
      }
    })()
  }, [user])

  if (loading) {
    return (
      <RoleGate allow={['admin']}>
        <div className="flex items-center justify-center h-96 text-lg">
          جارِ التحميل...
        </div>
      </RoleGate>
    )
  }

  return (
    <RoleGate allow={['admin']}>
      <div className="space-y-8">
        {/* رأس الصفحة */}
        <div className="text-center mb-8">
          <h1 className="text-4xl font-extrabold text-primary">لوحة تحكم الإدارة</h1>
          <p className="text-gray-600 mt-2">أهلاً بك يا مشرف! 👋</p>
        </div>

        {/* المحفظة */}
        <div className="bg-gradient-to-r from-primary to-sky-700 rounded-2xl shadow-lg p-6 text-white">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm opacity-90">رصيد المحفظة</p>
              <h2 className="text-3xl font-bold">{walletBalance.toFixed(2)} ر.س</h2>
              <p className="text-sm opacity-75 mt-2">💰 تحصل على 50 هللة من كل طلب للمطاعم التي أضفتها</p>
            </div>
            <Wallet className="w-16 h-16 opacity-80" />
          </div>
        </div>

        {/* الإحصائيات */}
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
          {/* المطاعم */}
          <div className="bg-white rounded-2xl shadow p-6 hover:shadow-lg transition">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-gray-600 text-sm">المطاعم المضافة</p>
                <h3 className="text-3xl font-bold text-primary mt-2">{stats.totalRestaurants}</h3>
              </div>
              <Building2 className="w-12 h-12 text-primary opacity-30" />
            </div>
          </div>

          {/* الطلبات الكلية */}
          <div className="bg-white rounded-2xl shadow p-6 hover:shadow-lg transition">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-gray-600 text-sm">إجمالي الطلبات</p>
                <h3 className="text-3xl font-bold text-blue-600 mt-2">{stats.totalOrders}</h3>
              </div>
              <ShoppingCart className="w-12 h-12 text-blue-600 opacity-30" />
            </div>
          </div>

          {/* الطلبات المعلقة */}
          <div className="bg-white rounded-2xl shadow p-6 hover:shadow-lg transition">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-gray-600 text-sm">طلبات معلقة</p>
                <h3 className="text-3xl font-bold text-yellow-600 mt-2">{stats.pendingOrders}</h3>
              </div>
              <BarChart3 className="w-12 h-12 text-yellow-600 opacity-30" />
            </div>
          </div>

          {/* الأرباح */}
          <div className="bg-white rounded-2xl shadow p-6 hover:shadow-lg transition">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-gray-600 text-sm">إجمالي الأرباح</p>
                <h3 className="text-3xl font-bold text-green-600 mt-2">{stats.totalEarnings.toFixed(2)}</h3>
              </div>
              <BarChart3 className="w-12 h-12 text-green-600 opacity-30" />
            </div>
          </div>
        </div>

        {/* القوائم السريعة */}
        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
          {/* إدارة المطاعم */}
          <div className="bg-white rounded-2xl shadow p-6 hover:shadow-lg transition">
            <h3 className="text-xl font-bold text-primary mb-4">إدارة المطاعم</h3>
            <p className="text-gray-600 text-sm mb-4">
              أضف مطاعم جديدة وأدر بيانات المطاعم المسجلة
            </p>
            <div className="space-y-2">
              <Link
                to="/admin/add-restaurant"
                className="block w-full bg-primary hover:bg-red-900 text-white rounded-xl p-3 text-center font-semibold transition"
              >
                ➕ إضافة مطعم جديد
              </Link>
              <Link
                to="/admin/restaurants"
                className="block w-full bg-gray-100 hover:bg-gray-200 text-gray-800 rounded-xl p-3 text-center font-semibold transition"
              >
                📋 عرض المطاعم
              </Link>
            </div>
          </div>

          {/* مراقبة الطلبات */}
          <div className="bg-white rounded-2xl shadow p-6 hover:shadow-lg transition">
            <h3 className="text-xl font-bold text-primary mb-4">مراقبة الطلبات</h3>
            <p className="text-gray-600 text-sm mb-4">
              راقب الطلبات للمطاعم المضافة وتابع حالتها
            </p>
            <div className="space-y-2">
              <Link
                to="/admin/orders"
                className="block w-full bg-blue-600 hover:bg-blue-700 text-white rounded-xl p-3 text-center font-semibold transition"
              >
                📊 جميع الطلبات
              </Link>
              <Link
                to="/admin/orders?status=pending"
                className="block w-full bg-yellow-500 hover:bg-yellow-600 text-white rounded-xl p-3 text-center font-semibold transition"
              >
                ⏳ الطلبات المعلقة
              </Link>
            </div>
          </div>

          {/* العميل */}
          <div className="bg-white rounded-2xl shadow p-6 hover:shadow-lg transition">
            <h3 className="text-xl font-bold text-primary mb-4">كعميل</h3>
            <p className="text-gray-600 text-sm mb-4">
              استعرض القائمة وأنشئ طلبات جديدة مثل أي عميل
            </p>
            <div className="space-y-2">
              <Link
                to="/menu"
                className="block w-full bg-green-600 hover:bg-green-700 text-white rounded-xl p-3 text-center font-semibold transition"
              >
                🍗 استعرض القائمة
              </Link>
              <Link
                to="/orders"
                className="block w-full bg-gray-100 hover:bg-gray-200 text-gray-800 rounded-xl p-3 text-center font-semibold transition"
              >
                📦 طلباتي
              </Link>
            </div>
          </div>

          {/* المحفظة والمكافآت */}
          <div className="bg-white rounded-2xl shadow p-6 hover:shadow-lg transition">
            <h3 className="text-xl font-bold text-primary mb-4">المحفظة والمكافآت</h3>
            <p className="text-gray-600 text-sm mb-4">
              اعرض رصيدك والعمولات المتحصلة من طلبات مطاعمك
            </p>
            <div className="space-y-2">
              <div className="block w-full bg-gradient-to-r from-primary to-sky-700 text-white rounded-xl p-3 text-center font-semibold">
                💰 رصيدك: {walletBalance.toFixed(2)} ر.س
              </div>
              <Link
                to="/admin/wallet"
                className="block w-full bg-gray-100 hover:bg-gray-200 text-gray-800 rounded-xl p-3 text-center font-semibold transition"
              >
                📋 سجل المحفظة
              </Link>
            </div>
          </div>
        </div>

        {/* تذكير مهم */}
        <div className="bg-sky-50 border-l-4 border-sky-500 p-6 rounded-lg">
          <h4 className="font-bold text-sky-900 mb-2">💰 نظام العمولات:</h4>
          <ul className="text-sky-800 text-sm space-y-1">
            <li>✓ <strong>50 هللة</strong> لك عن كل طلب يتم من المطاعم التي أضفتها</li>
            <li>✓ <strong>1 ريال</strong> للتطبيق من كل طلب (إذا كان المطعم مضاف عن طريقك)</li>
            <li>✓ <strong>1.5 ريال</strong> للتطبيق إذا المطعم مسجل من المطور مباشرة</li>
            <li>✓ العمولات تُضاف تلقائياً لمحفظتك عند كل طلب جديد</li>
          </ul>
        </div>
      </div>
    </RoleGate>
  )
}

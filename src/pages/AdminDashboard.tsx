import React, { useEffect, useState } from 'react'
import { Link } from 'react-router-dom'
import { Building2, ShoppingCart, Wallet, BarChart3, User as UserIcon, ClipboardList, CheckCircle } from 'lucide-react'
import { useAuth } from '@/auth'
import { RoleGate } from '@/routes/RoleGate'
import { collection, getDocs, doc, getDoc, query, where, updateDoc, serverTimestamp } from 'firebase/firestore'
import { db } from '@/firebase'
import { Order, Restaurant, User } from '@/types'
import { useToast } from '@/components/ui/Toast'

type Task = {
  id: string
  title: string
  description?: string
  assignedTo: string
  assignedToName?: string
  status: 'pending' | 'in_progress' | 'completed' | 'cancelled'
  priority: 'low' | 'medium' | 'high'
  dueDate?: string
  createdBy: string
  createdAt: any
  updatedAt: any
  completedAt?: any
  notes?: string
}

type AdminStats = {
  totalRestaurants: number
  totalOrders: number
  totalEarnings: number
  pendingOrders: number
}

type TabType = 'dashboard' | 'profile' | 'tasks'

export const AdminDashboard: React.FC = () => {
  const { user, role } = useAuth()
  const toast = useToast()
  const [activeTab, setActiveTab] = useState<TabType>('dashboard')
  const [stats, setStats] = useState<AdminStats>({
    totalRestaurants: 0,
    totalOrders: 0,
    totalEarnings: 0,
    pendingOrders: 0,
  })
  const [walletBalance, setWalletBalance] = useState(0)
  const [loading, setLoading] = useState(true)
  const [adminData, setAdminData] = useState<User | null>(null)
  const [myTasks, setMyTasks] = useState<Task[]>([])
  const [taskFilter, setTaskFilter] = useState<'all' | 'pending' | 'in_progress' | 'completed'>('all')

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

        // جلب المهام المسندة للمشرف
        try {
          const tasksQuery = query(collection(db, 'tasks'), where('assignedTo', '==', user.uid))
          const tasksSnap = await getDocs(tasksQuery)
          const tasksData = tasksSnap.docs.map(d => ({ id: d.id, ...d.data() } as Task))
          setMyTasks(tasksData.sort((a, b) => (b.createdAt?.seconds || 0) - (a.createdAt?.seconds || 0)))
        } catch (err) {
          console.error('خطأ في تحميل المهام:', err)
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

  // تحديث حالة المهمة
  const updateTaskStatus = async (taskId: string, newStatus: Task['status']) => {
    try {
      const updateData: any = {
        status: newStatus,
        updatedAt: serverTimestamp()
      }
      if (newStatus === 'completed') {
        updateData.completedAt = serverTimestamp()
      }
      await updateDoc(doc(db, 'tasks', taskId), updateData)
      setMyTasks(prev => prev.map(t => 
        t.id === taskId ? { ...t, status: newStatus } : t
      ))
      toast.success(
        newStatus === 'in_progress' ? 'تم بدء المهمة' :
        newStatus === 'completed' ? 'تم إكمال المهمة بنجاح! 🎉' :
        'تم تحديث المهمة'
      )
    } catch (err) {
      toast.error('فشل في تحديث المهمة')
    }
  }

  // تحميل بيانات المشرف الحالي
  useEffect(() => {
    if (!user) return

    (async () => {
      try {
        const userSnap = await getDoc(doc(db, 'users', user.uid))
        if (userSnap.exists()) {
          setAdminData({ uid: userSnap.id, ...userSnap.data() } as User)
        }
      } catch (err) {
        console.error('خطأ في تحميل بيانات المشرف:', err)
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

        {/* التبويبات */}
        <div className="flex justify-center gap-4 mb-6">
          <button
            onClick={() => setActiveTab('dashboard')}
            className={`px-6 py-3 rounded-xl font-bold transition flex items-center gap-2 ${
              activeTab === 'dashboard'
                ? 'bg-primary text-white shadow-lg'
                : 'bg-gray-100 text-gray-700 hover:bg-gray-200'
            }`}
          >
            <BarChart3 className="w-5 h-5" />
            لوحة التحكم
          </button>
          <button
            onClick={() => setActiveTab('profile')}
            className={`px-6 py-3 rounded-xl font-bold transition flex items-center gap-2 ${
              activeTab === 'profile'
                ? 'bg-primary text-white shadow-lg'
                : 'bg-gray-100 text-gray-700 hover:bg-gray-200'
            }`}
          >
            <UserIcon className="w-5 h-5" />
            بياناتي
          </button>
          <button
            onClick={() => setActiveTab('tasks')}
            className={`px-6 py-3 rounded-xl font-bold transition flex items-center gap-2 relative ${
              activeTab === 'tasks'
                ? 'bg-primary text-white shadow-lg'
                : 'bg-gray-100 text-gray-700 hover:bg-gray-200'
            }`}
          >
            <ClipboardList className="w-5 h-5" />
            مهامي
            {myTasks.filter(t => t.status === 'pending' || t.status === 'in_progress').length > 0 && (
              <span className="absolute -top-1 -right-1 bg-red-500 text-white text-xs w-5 h-5 rounded-full flex items-center justify-center">
                {myTasks.filter(t => t.status === 'pending' || t.status === 'in_progress').length}
              </span>
            )}
          </button>
        </div>

        {/* محتوى التبويب: بياناتي */}
        {activeTab === 'profile' && (
          <div className="bg-white rounded-2xl shadow-lg p-6">
            <h2 className="text-2xl font-bold text-primary mb-6 flex items-center gap-2">
              <UserIcon className="w-6 h-6" />
              بياناتي
            </h2>
            
            {!adminData ? (
              <div className="text-center py-8 text-gray-600">جارِ التحميل...</div>
            ) : (
              <div className="space-y-6">
                {/* بطاقة البيانات */}
                <div className="bg-gradient-to-r from-sky-50 to-blue-50 rounded-2xl p-6">
                  <div className="flex items-center gap-4 mb-6">
                    <div className="w-20 h-20 bg-primary rounded-full flex items-center justify-center text-white text-3xl font-bold">
                      {adminData.name?.charAt(0) || adminData.email?.charAt(0) || '؟'}
                    </div>
                    <div>
                      <h3 className="text-2xl font-bold text-gray-900">
                        {adminData.name || 'بدون اسم'}
                      </h3>
                      <span className="inline-flex items-center px-3 py-1 rounded-full text-sm font-bold bg-sky-100 text-sky-800 mt-2">
                        👔 مشرف
                      </span>
                    </div>
                  </div>
                  
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    <div className="bg-white rounded-xl p-4 shadow-sm">
                      <p className="text-sm text-gray-500 mb-1">البريد الإلكتروني</p>
                      <p className="font-semibold text-gray-900 font-mono">{adminData.email}</p>
                    </div>
                    <div className="bg-white rounded-xl p-4 shadow-sm">
                      <p className="text-sm text-gray-500 mb-1">الدور</p>
                      <p className="font-semibold text-gray-900">{role === 'admin' ? 'مشرف' : role}</p>
                    </div>
                    <div className="bg-white rounded-xl p-4 shadow-sm">
                      <p className="text-sm text-gray-500 mb-1">معرّف المستخدم</p>
                      <p className="font-semibold text-gray-600 text-xs font-mono break-all">{adminData.uid}</p>
                    </div>
                    <div className="bg-white rounded-xl p-4 shadow-sm">
                      <p className="text-sm text-gray-500 mb-1">رصيد المحفظة</p>
                      <p className="font-bold text-green-600 text-xl">{walletBalance.toFixed(2)} ر.س</p>
                    </div>
                  </div>
                </div>

                {/* رابط تعديل الملف الشخصي */}
                <Link
                  to="/profile"
                  className="block w-full bg-gray-100 hover:bg-gray-200 text-gray-800 rounded-xl p-4 text-center font-semibold transition"
                >
                  ✏️ تعديل الملف الشخصي
                </Link>
              </div>
            )}
          </div>
        )}

        {/* محتوى التبويب: مهامي */}
        {activeTab === 'tasks' && (
          <div className="space-y-6">
            <div className="bg-white rounded-2xl shadow-lg p-6">
              <h2 className="text-2xl font-bold text-primary mb-6 flex items-center gap-2">
                <ClipboardList className="w-6 h-6" />
                مهامي اليومية
              </h2>

              {/* فلترة المهام */}
              <div className="flex flex-wrap gap-2 mb-6">
                {(['all', 'pending', 'in_progress', 'completed'] as const).map(filter => (
                  <button
                    key={filter}
                    onClick={() => setTaskFilter(filter)}
                    className={`px-4 py-2 rounded-xl font-semibold transition ${
                      taskFilter === filter
                        ? 'bg-primary text-white'
                        : 'bg-gray-100 text-gray-700 hover:bg-gray-200'
                    }`}
                  >
                    {filter === 'all' && '📋 الكل'}
                    {filter === 'pending' && '⏳ قيد الانتظار'}
                    {filter === 'in_progress' && '🔄 جاري التنفيذ'}
                    {filter === 'completed' && '✅ مكتملة'}
                  </button>
                ))}
              </div>

              {/* إحصائيات سريعة */}
              <div className="grid grid-cols-3 gap-4 mb-6">
                <div className="bg-yellow-50 rounded-xl p-4 text-center">
                  <p className="text-2xl font-bold text-yellow-600">
                    {myTasks.filter(t => t.status === 'pending').length}
                  </p>
                  <p className="text-sm text-yellow-700">قيد الانتظار</p>
                </div>
                <div className="bg-blue-50 rounded-xl p-4 text-center">
                  <p className="text-2xl font-bold text-blue-600">
                    {myTasks.filter(t => t.status === 'in_progress').length}
                  </p>
                  <p className="text-sm text-blue-700">جاري التنفيذ</p>
                </div>
                <div className="bg-green-50 rounded-xl p-4 text-center">
                  <p className="text-2xl font-bold text-green-600">
                    {myTasks.filter(t => t.status === 'completed').length}
                  </p>
                  <p className="text-sm text-green-700">مكتملة</p>
                </div>
              </div>

              {/* قائمة المهام */}
              {myTasks
                .filter(t => taskFilter === 'all' || t.status === taskFilter)
                .length === 0 ? (
                <div className="text-center py-12 text-gray-500">
                  <p className="text-5xl mb-4">📋</p>
                  <p className="text-lg">لا توجد مهام {taskFilter !== 'all' && 'في هذه الفئة'}</p>
                  <p className="text-sm mt-2">ستظهر هنا المهام التي يسندها لك المطور</p>
                </div>
              ) : (
                <div className="space-y-4">
                  {myTasks
                    .filter(t => taskFilter === 'all' || t.status === taskFilter)
                    .map(task => (
                      <div
                        key={task.id}
                        className={`border-2 rounded-2xl p-4 transition ${
                          task.status === 'completed' ? 'bg-green-50 border-green-200' :
                          task.status === 'in_progress' ? 'bg-blue-50 border-blue-200' :
                          task.priority === 'high' ? 'bg-red-50 border-red-200' :
                          'bg-white border-gray-200'
                        }`}
                      >
                        <div className="flex items-start justify-between gap-4">
                          <div className="flex-1">
                            <div className="flex items-center gap-2 mb-2">
                              <span className={`px-2 py-0.5 rounded text-xs font-semibold ${
                                task.priority === 'high' ? 'bg-red-100 text-red-700' :
                                task.priority === 'medium' ? 'bg-yellow-100 text-yellow-700' :
                                'bg-gray-100 text-gray-700'
                              }`}>
                                {task.priority === 'high' ? '🔴 عالية' : task.priority === 'medium' ? '🟡 متوسطة' : '⚪ منخفضة'}
                              </span>
                              <span className={`px-2 py-0.5 rounded text-xs font-semibold ${
                                task.status === 'pending' ? 'bg-yellow-100 text-yellow-700' :
                                task.status === 'in_progress' ? 'bg-blue-100 text-blue-700' :
                                task.status === 'completed' ? 'bg-green-100 text-green-700' :
                                'bg-red-100 text-red-700'
                              }`}>
                                {task.status === 'pending' && '⏳ قيد الانتظار'}
                                {task.status === 'in_progress' && '🔄 جاري التنفيذ'}
                                {task.status === 'completed' && '✅ مكتملة'}
                                {task.status === 'cancelled' && '❌ ملغاة'}
                              </span>
                            </div>
                            <h3 className="font-bold text-lg text-gray-800">{task.title}</h3>
                            {task.description && (
                              <p className="text-gray-600 mt-1">{task.description}</p>
                            )}
                            <div className="flex flex-wrap gap-3 mt-3 text-sm text-gray-500">
                              {task.dueDate && (
                                <span className={new Date(task.dueDate) < new Date() && task.status !== 'completed' ? 'text-red-600 font-semibold' : ''}>
                                  📅 {new Date(task.dueDate).toLocaleDateString('ar-SA')}
                                  {new Date(task.dueDate) < new Date() && task.status !== 'completed' && ' (متأخرة!)'}
                                </span>
                              )}
                              <span>🕐 {task.createdAt?.toDate?.()?.toLocaleDateString('ar-SA') || 'غير محدد'}</span>
                            </div>
                            {task.notes && (
                              <p className="text-sm text-gray-500 mt-2 bg-gray-100 p-2 rounded">💬 {task.notes}</p>
                            )}
                          </div>
                          
                          {/* أزرار التحكم */}
                          <div className="flex flex-col gap-2">
                            {task.status === 'pending' && (
                              <button
                                onClick={() => updateTaskStatus(task.id, 'in_progress')}
                                className="flex items-center gap-2 bg-blue-600 hover:bg-blue-700 text-white px-4 py-2 rounded-xl font-semibold transition"
                              >
                                ▶️ بدء
                              </button>
                            )}
                            {task.status === 'in_progress' && (
                              <button
                                onClick={() => updateTaskStatus(task.id, 'completed')}
                                className="flex items-center gap-2 bg-green-600 hover:bg-green-700 text-white px-4 py-2 rounded-xl font-semibold transition"
                              >
                                <CheckCircle className="w-4 h-4" />
                                إكمال
                              </button>
                            )}
                            {task.status === 'completed' && (
                              <span className="text-green-600 font-semibold text-center">
                                ✅ تم الإنجاز
                              </span>
                            )}
                          </div>
                        </div>
                      </div>
                    ))}
                </div>
              )}
            </div>
          </div>
        )}

        {/* محتوى التبويب: لوحة التحكم */}
        {activeTab === 'dashboard' && (
          <>
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
          </>
        )}
      </div>
    </RoleGate>
  )
}

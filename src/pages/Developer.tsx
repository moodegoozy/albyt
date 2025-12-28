import React, { useEffect, useState } from 'react'
import { useAuth } from '@/auth'
import { RoleGate } from '@/routes/RoleGate'
import { 
  Trash2, Users, Settings, RefreshCw, Database, Shield, Server, 
  Edit3, Save, X, ChevronDown, ChevronUp, Building2, Wallet, Package, Truck, UserPlus
} from 'lucide-react'
import { useToast } from '@/components/ui/Toast'
import { useDialog } from '@/components/ui/ConfirmDialog'
import { db, app, auth } from '@/firebase'
import { createUserWithEmailAndPassword, signInWithEmailAndPassword } from 'firebase/auth'
import { 
  collection, getDocs, doc, getDoc, setDoc, updateDoc, deleteDoc, 
  serverTimestamp 
} from 'firebase/firestore'
import { ref, uploadBytes, getDownloadURL, getStorage } from 'firebase/storage'

// Firebase config للعرض
const firebaseConfig = {
  projectId: app.options.projectId,
  authDomain: app.options.authDomain,
  storageBucket: app.options.storageBucket,
  messagingSenderId: app.options.messagingSenderId,
  appId: app.options.appId,
}

type Stats = {
  users: number
  restaurants: number
  menuItems: number
  orders: number
  pendingOrders: number
  deliveredOrders: number
  admins: number
  couriers: number
  customers: number
  owners: number
  totalAppEarnings: number
}

type AppSettings = {
  deliveryFee?: number
  minOrderAmount?: number
  maxDeliveryDistance?: number
  workingHours?: { open: string; close: string }
  maintenanceMode?: boolean
  appVersion?: string
  platformFee?: number
  adminCommissionRate?: number
}

type User = {
  uid: string
  email: string
  name?: string
  role: string
  phone?: string
  createdAt?: any
}

type Restaurant = {
  id: string
  name: string
  ownerId: string
  email?: string
  phone?: string
  city?: string
  location?: string
  logoUrl?: string
  referredBy?: string
  referrerType?: string
  createdAt?: any
}

type Order = {
  id: string
  customerId: string
  restaurantId?: string
  restaurantName?: string
  items: any[]
  subtotal: number
  deliveryFee: number
  total: number
  status: string
  address: string
  courierId?: string
  platformFee?: number
  adminCommission?: number
  referredBy?: string
  createdAt?: any
}

type Admin = {
  uid: string
  email: string
  name?: string
  walletBalance: number
  totalEarnings: number
  restaurantsCount: number
  restaurants: Restaurant[]
}

// تبويبات اللوحة
type Tab = 'overview' | 'restaurants' | 'orders' | 'users' | 'couriers' | 'admins' | 'settings'

export const Developer: React.FC = () => {
  const { user } = useAuth()
  const toast = useToast()
  const dialog = useDialog()
  const storage = getStorage(app)
  
  const [activeTab, setActiveTab] = useState<Tab>('overview')
  const [loading, setLoading] = useState(true)
  const [refreshing, setRefreshing] = useState(false)
  
  // البيانات
  const [stats, setStats] = useState<Stats>({
    users: 0, restaurants: 0, menuItems: 0, orders: 0, 
    pendingOrders: 0, deliveredOrders: 0, admins: 0, couriers: 0, 
    customers: 0, owners: 0, totalAppEarnings: 0
  })
  const [settings, setSettings] = useState<AppSettings>({})
  const [users, setUsers] = useState<User[]>([])
  const [restaurants, setRestaurants] = useState<Restaurant[]>([])
  const [orders, setOrders] = useState<Order[]>([])
  const [admins, setAdmins] = useState<Admin[]>([])
  
  // حالات التحرير
  const [editingSettings, setEditingSettings] = useState(false)
  const [settingsForm, setSettingsForm] = useState<AppSettings>({})
  const [editingRestaurant, setEditingRestaurant] = useState<string | null>(null)
  const [restaurantForm, setRestaurantForm] = useState<Partial<Restaurant>>({})
  const [uploadingLogo, setUploadingLogo] = useState(false)
  const [editingUser, setEditingUser] = useState<string | null>(null)
  const [userForm, setUserForm] = useState<Partial<User>>({})
  
  // فلاتر
  const [orderFilter, setOrderFilter] = useState<string>('all')
  const [userFilter, setUserFilter] = useState<string>('all')
  const [expandedAdmin, setExpandedAdmin] = useState<string | null>(null)
  
  // إضافة مشرف جديد
  const [showAddAdmin, setShowAddAdmin] = useState(false)
  const [newAdminEmail, setNewAdminEmail] = useState('')
  const [newAdminName, setNewAdminName] = useState('')
  const [newAdminPassword, setNewAdminPassword] = useState('')
  const [newAdminPhone, setNewAdminPhone] = useState('')
  const [creatingAdmin, setCreatingAdmin] = useState(false)
  
  // حفظ بيانات المطور الحالي لإعادة تسجيل الدخول
  const currentDeveloperEmail = user?.email || ''

  // ===== إنشاء مشرف جديد =====
  const handleCreateNewAdmin = async () => {
    if (!newAdminEmail.trim() || !newAdminPassword.trim()) {
      toast.warning('أدخل البريد الإلكتروني وكلمة المرور')
      return
    }
    if (newAdminPassword.length < 6) {
      toast.warning('كلمة المرور يجب أن تكون 6 أحرف على الأقل')
      return
    }

    const confirmed = await dialog.confirm(
      `سيتم إنشاء حساب مشرف جديد:\n\n📧 ${newAdminEmail}\n👤 ${newAdminName || 'بدون اسم'}\n\nملاحظة: سيتم تسجيل خروجك مؤقتاً، قم بتسجيل الدخول مرة أخرى.`,
      { title: 'إنشاء مشرف جديد' }
    )
    if (!confirmed) return

    setCreatingAdmin(true)
    try {
      // إنشاء المستخدم الجديد في Firebase Auth
      const userCred = await createUserWithEmailAndPassword(auth, newAdminEmail.trim(), newAdminPassword)
      const newUid = userCred.user.uid

      // إنشاء مستند المستخدم في Firestore
      await setDoc(doc(db, 'users', newUid), {
        email: newAdminEmail.trim(),
        name: newAdminName.trim() || 'مشرف جديد',
        phone: newAdminPhone.trim() || '',
        role: 'admin',
        createdAt: serverTimestamp(),
      })

      // إنشاء محفظة للمشرف الجديد
      await setDoc(doc(db, 'wallets', newUid), {
        balance: 0,
        totalEarnings: 0,
        totalWithdrawn: 0,
        transactions: [],
        updatedAt: serverTimestamp(),
      })

      toast.success('تم إنشاء حساب المشرف بنجاح ✅')
      toast.info('⚠️ تم تسجيل خروجك، يرجى تسجيل الدخول مرة أخرى')
      
      // إعادة تعيين النموذج
      setNewAdminEmail('')
      setNewAdminName('')
      setNewAdminPassword('')
      setNewAdminPhone('')
      setShowAddAdmin(false)
      
    } catch (err: any) {
      console.error('خطأ في إنشاء المشرف:', err)
      if (err.code === 'auth/email-already-in-use') {
        toast.error('البريد الإلكتروني مستخدم مسبقاً')
      } else if (err.code === 'auth/invalid-email') {
        toast.error('البريد الإلكتروني غير صالح')
      } else if (err.code === 'auth/weak-password') {
        toast.error('كلمة المرور ضعيفة جداً')
      } else {
        toast.error('فشل إنشاء المشرف: ' + (err.message || 'خطأ غير معروف'))
      }
    } finally {
      setCreatingAdmin(false)
    }
  }

  // ===== تحميل البيانات =====
  const loadData = async () => {
    try {
      // جلب جميع البيانات بالتوازي
      const [usersSnap, restaurantsSnap, menuSnap, ordersSnap, walletsSnap] = await Promise.all([
        getDocs(collection(db, 'users')),
        getDocs(collection(db, 'restaurants')),
        getDocs(collection(db, 'menuItems')),
        getDocs(collection(db, 'orders')),
        getDocs(collection(db, 'wallets')),
      ])

      // المستخدمين
      const usersData = usersSnap.docs.map(d => ({ uid: d.id, ...d.data() } as User))
      setUsers(usersData)
      
      // المطاعم
      const restaurantsData = restaurantsSnap.docs.map(d => ({ id: d.id, ...d.data() } as Restaurant))
      setRestaurants(restaurantsData)
      
      // الطلبات
      const ordersData = ordersSnap.docs.map(d => ({ id: d.id, ...d.data() } as Order))
      setOrders(ordersData)
      
      // المحافظ
      const walletsData: Record<string, any> = {}
      walletsSnap.docs.forEach(d => {
        walletsData[d.id] = d.data()
      })
      
      // أرباح التطبيق
      const appWallet = walletsData['app_earnings'] || { balance: 0, totalEarnings: 0 }
      
      // حساب الإحصائيات
      const adminsData = usersData.filter(u => u.role === 'admin')
      const couriersData = usersData.filter(u => u.role === 'courier')
      const customersData = usersData.filter(u => u.role === 'customer')
      const ownersData = usersData.filter(u => u.role === 'owner')
      
      // بناء بيانات المشرفين مع المطاعم التابعة لهم
      const adminsWithRestaurants: Admin[] = adminsData.map(admin => {
        const adminRestaurants = restaurantsData.filter(r => r.referredBy === admin.uid)
        const wallet = walletsData[admin.uid] || { balance: 0, totalEarnings: 0 }
        return {
          uid: admin.uid,
          email: admin.email,
          name: admin.name,
          walletBalance: wallet.balance || 0,
          totalEarnings: wallet.totalEarnings || 0,
          restaurantsCount: adminRestaurants.length,
          restaurants: adminRestaurants,
        }
      })
      setAdmins(adminsWithRestaurants)
      
      setStats({
        users: usersData.length,
        restaurants: restaurantsData.length,
        menuItems: menuSnap.size,
        orders: ordersData.length,
        pendingOrders: ordersData.filter(o => o.status === 'pending').length,
        deliveredOrders: ordersData.filter(o => o.status === 'delivered').length,
        admins: adminsData.length,
        couriers: couriersData.length,
        customers: customersData.length,
        owners: ownersData.length,
        totalAppEarnings: appWallet.totalEarnings || 0,
      })

      // جلب الإعدادات
      const settingsSnap = await getDoc(doc(db, 'settings', 'general'))
      if (settingsSnap.exists()) {
        const data = settingsSnap.data() as AppSettings
        setSettings(data)
        setSettingsForm(data)
      } else {
        const defaultSettings: AppSettings = {
          deliveryFee: 7,
          minOrderAmount: 20,
          maxDeliveryDistance: 15,
          workingHours: { open: '09:00', close: '23:00' },
          maintenanceMode: false,
          appVersion: '1.0.0',
          platformFee: 1.0, // 1 ريال للتطبيق لكل منتج
          adminCommissionRate: 0.75, // 75 هللة للمشرف لكل منتج
        }
        setSettings(defaultSettings)
        setSettingsForm(defaultSettings)
      }
    } catch (err) {
      console.error('خطأ في تحميل البيانات:', err)
      toast.error('فشل تحميل البيانات')
    } finally {
      setLoading(false)
      setRefreshing(false)
    }
  }

  useEffect(() => {
    loadData()
  }, [])

  const handleRefresh = () => {
    setRefreshing(true)
    loadData()
    toast.info('جاري تحديث البيانات...')
  }

  // ===== حفظ الإعدادات =====
  const handleSaveSettings = async () => {
    try {
      await setDoc(doc(db, 'settings', 'general'), settingsForm, { merge: true })
      setSettings(settingsForm)
      setEditingSettings(false)
      toast.success('تم حفظ الإعدادات بنجاح ✅')
    } catch (err) {
      console.error('خطأ في حفظ الإعدادات:', err)
      toast.error('فشل حفظ الإعدادات')
    }
  }

  // ===== تحديث المطعم =====
  const handleUpdateRestaurant = async (id: string) => {
    try {
      await updateDoc(doc(db, 'restaurants', id), {
        ...restaurantForm,
        updatedAt: serverTimestamp(),
      })
      setEditingRestaurant(null)
      toast.success('تم تحديث المطعم بنجاح ✅')
      loadData()
    } catch (err) {
      console.error('خطأ في تحديث المطعم:', err)
      toast.error('فشل تحديث المطعم')
    }
  }

  // ===== رفع شعار المطعم =====
  const handleUploadLogo = async (id: string, file: File) => {
    try {
      setUploadingLogo(true)
      const path = `restaurants/${id}/logo_${Date.now()}_${file.name}`
      const storageRef = ref(storage, path)
      await uploadBytes(storageRef, file)
      const url = await getDownloadURL(storageRef)
      
      await updateDoc(doc(db, 'restaurants', id), {
        logoUrl: url,
        updatedAt: serverTimestamp(),
      })
      
      toast.success('تم رفع الشعار بنجاح ✅')
      loadData()
    } catch (err) {
      console.error('خطأ في رفع الشعار:', err)
      toast.error('فشل رفع الشعار')
    } finally {
      setUploadingLogo(false)
    }
  }

  // ===== حذف مطعم =====
  const handleDeleteRestaurant = async (id: string) => {
    const confirmed = await dialog.confirm('هل أنت متأكد من حذف هذا المطعم؟ لا يمكن التراجع!', { 
      title: 'حذف المطعم',
      dangerous: true 
    })
    if (!confirmed) return
    try {
      await deleteDoc(doc(db, 'restaurants', id))
      toast.success('تم حذف المطعم بنجاح')
      loadData()
    } catch (err) {
      console.error('خطأ في حذف المطعم:', err)
      toast.error('فشل حذف المطعم')
    }
  }

  // ===== تحديث المستخدم =====
  const handleUpdateUser = async (uid: string) => {
    try {
      await updateDoc(doc(db, 'users', uid), {
        ...userForm,
        updatedAt: serverTimestamp(),
      })
      setEditingUser(null)
      toast.success('تم تحديث المستخدم بنجاح ✅')
      loadData()
    } catch (err) {
      console.error('خطأ في تحديث المستخدم:', err)
      toast.error('فشل تحديث المستخدم')
    }
  }

  // ===== حذف مستخدم =====
  const handleDeleteUser = async (uid: string) => {
    const confirmed = await dialog.confirm('هل أنت متأكد من حذف هذا المستخدم؟ لا يمكن التراجع!', {
      title: 'حذف المستخدم',
      dangerous: true
    })
    if (!confirmed) return
    try {
      await deleteDoc(doc(db, 'users', uid))
      toast.success('تم حذف المستخدم من قاعدة البيانات')
      toast.warning('ملاحظة: يجب حذف المستخدم يدوياً من Firebase Auth')
      loadData()
    } catch (err) {
      console.error('خطأ في حذف المستخدم:', err)
      toast.error('فشل حذف المستخدم')
    }
  }

  // ===== تحديث حالة الطلب =====
  const handleUpdateOrderStatus = async (orderId: string, newStatus: string) => {
    try {
      await updateDoc(doc(db, 'orders', orderId), {
        status: newStatus,
        updatedAt: serverTimestamp(),
      })
      toast.success('تم تحديث حالة الطلب ✅')
      loadData()
    } catch (err) {
      console.error('خطأ في تحديث الطلب:', err)
      toast.error('فشل تحديث الطلب')
    }
  }

  // ===== أسماء الأدوار =====
  const roleLabel = (role: string) => {
    switch (role) {
      case 'customer': return '👤 عميل'
      case 'owner': return '🏪 صاحب مطعم'
      case 'courier': return '🚗 مندوب'
      case 'admin': return '👑 مشرف'
      case 'developer': return '👨‍💻 مطور'
      default: return role
    }
  }

  // ===== أسماء حالات الطلب =====
  const statusLabel = (status: string) => {
    switch (status) {
      case 'pending': return '⏳ قيد المراجعة'
      case 'accepted': return '✅ مقبول'
      case 'preparing': return '👨‍🍳 قيد التحضير'
      case 'ready': return '📦 جاهز'
      case 'out_for_delivery': return '🚗 في الطريق'
      case 'delivered': return '✔️ تم التسليم'
      case 'cancelled': return '❌ ملغي'
      default: return status
    }
  }

  if (loading) {
    return (
      <RoleGate allow={['developer']}>
        <div className="flex items-center justify-center h-96">
          <div className="text-center">
            <RefreshCw className="w-12 h-12 text-primary animate-spin mx-auto mb-4" />
            <p className="text-lg text-gray-600">جاري تحميل لوحة المطور...</p>
          </div>
        </div>
      </RoleGate>
    )
  }

  return (
    <RoleGate allow={['developer']}>
      <div className="space-y-6">
        {/* رأس الصفحة */}
        <div className="flex items-center justify-between flex-wrap gap-4">
          <div>
            <h1 className="text-3xl font-extrabold text-primary">👨‍💻 لوحة المطور الشاملة</h1>
            <p className="text-gray-600 mt-1">إدارة كاملة لجميع بيانات التطبيق</p>
          </div>
          <button
            onClick={handleRefresh}
            disabled={refreshing}
            className="flex items-center gap-2 bg-primary hover:bg-sky-600 text-white px-4 py-2 rounded-xl font-semibold transition disabled:opacity-50"
          >
            <RefreshCw className={`w-5 h-5 ${refreshing ? 'animate-spin' : ''}`} />
            تحديث
          </button>
        </div>

        {/* التبويبات */}
        <div className="flex flex-wrap gap-2 border-b pb-4">
          {[
            { id: 'overview', label: '📊 نظرة عامة' },
            { id: 'restaurants', label: '🏪 المطاعم' },
            { id: 'orders', label: '📦 الطلبات' },
            { id: 'users', label: '👤 المستخدمين' },
            { id: 'couriers', label: '🚗 المناديب' },
            { id: 'admins', label: '👑 المشرفين' },
            { id: 'settings', label: '⚙️ الإعدادات' },
          ].map(tab => (
            <button
              key={tab.id}
              onClick={() => setActiveTab(tab.id as Tab)}
              className={`flex items-center gap-2 px-4 py-2 rounded-xl font-semibold transition ${
                activeTab === tab.id 
                  ? 'bg-primary text-white' 
                  : 'bg-gray-100 text-gray-700 hover:bg-gray-200'
              }`}
            >
              {tab.label}
            </button>
          ))}
        </div>

        {/* ===== نظرة عامة ===== */}
        {activeTab === 'overview' && (
          <div className="space-y-6">
            {/* إحصائيات سريعة */}
            <div className="grid grid-cols-2 md:grid-cols-4 lg:grid-cols-6 gap-4">
              <div className="bg-gradient-to-br from-blue-500 to-blue-600 rounded-2xl p-4 text-white text-center">
                <p className="text-3xl font-bold">{stats.users}</p>
                <p className="text-sm opacity-90">👤 المستخدمين</p>
              </div>
              <div className="bg-gradient-to-br from-green-500 to-green-600 rounded-2xl p-4 text-white text-center">
                <p className="text-3xl font-bold">{stats.restaurants}</p>
                <p className="text-sm opacity-90">🏪 المطاعم</p>
              </div>
              <div className="bg-gradient-to-br from-purple-500 to-purple-600 rounded-2xl p-4 text-white text-center">
                <p className="text-3xl font-bold">{stats.orders}</p>
                <p className="text-sm opacity-90">📦 الطلبات</p>
              </div>
              <div className="bg-gradient-to-br from-amber-500 to-amber-600 rounded-2xl p-4 text-white text-center">
                <p className="text-3xl font-bold">{stats.admins}</p>
                <p className="text-sm opacity-90">👑 المشرفين</p>
              </div>
              <div className="bg-gradient-to-br from-cyan-500 to-cyan-600 rounded-2xl p-4 text-white text-center">
                <p className="text-3xl font-bold">{stats.couriers}</p>
                <p className="text-sm opacity-90">🚗 المناديب</p>
              </div>
              <div className="bg-gradient-to-br from-emerald-500 to-emerald-600 rounded-2xl p-4 text-white text-center">
                <p className="text-3xl font-bold">{stats.totalAppEarnings.toFixed(2)}</p>
                <p className="text-sm opacity-90">💰 أرباح التطبيق</p>
              </div>
            </div>

            {/* إعدادات Firebase */}
            <div className="bg-white rounded-2xl shadow-lg p-6">
              <div className="flex items-center gap-3 mb-4">
                <Server className="w-6 h-6 text-orange-500" />
                <h2 className="text-xl font-bold">إعدادات Firebase</h2>
              </div>
              <div className="grid md:grid-cols-2 gap-4">
                <div className="bg-gray-50 rounded-xl p-3">
                  <p className="text-xs text-gray-500">Project ID</p>
                  <p className="font-mono text-sm">{firebaseConfig.projectId}</p>
                </div>
                <div className="bg-gray-50 rounded-xl p-3">
                  <p className="text-xs text-gray-500">Storage Bucket</p>
                  <p className="font-mono text-sm">{firebaseConfig.storageBucket}</p>
                </div>
              </div>
              <div className="mt-4 flex flex-wrap gap-2">
                <a
                  href={`https://console.firebase.google.com/project/${firebaseConfig.projectId}/overview`}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="text-sm bg-orange-100 hover:bg-orange-200 text-orange-700 px-3 py-1 rounded-lg"
                >
                  🔥 Console
                </a>
                <a
                  href={`https://console.firebase.google.com/project/${firebaseConfig.projectId}/firestore`}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="text-sm bg-blue-100 hover:bg-blue-200 text-blue-700 px-3 py-1 rounded-lg"
                >
                  📊 Firestore
                </a>
                <a
                  href={`https://console.firebase.google.com/project/${firebaseConfig.projectId}/authentication`}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="text-sm bg-green-100 hover:bg-green-200 text-green-700 px-3 py-1 rounded-lg"
                >
                  🔐 Auth
                </a>
                <a
                  href={`https://console.firebase.google.com/project/${firebaseConfig.projectId}/storage`}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="text-sm bg-purple-100 hover:bg-purple-200 text-purple-700 px-3 py-1 rounded-lg"
                >
                  📁 Storage
                </a>
              </div>
            </div>

            {/* توزيع المستخدمين */}
            <div className="bg-white rounded-2xl shadow-lg p-6">
              <h2 className="text-xl font-bold mb-4">📊 توزيع المستخدمين</h2>
              <div className="grid grid-cols-2 md:grid-cols-5 gap-4">
                <div className="text-center p-4 bg-blue-50 rounded-xl">
                  <p className="text-2xl font-bold text-blue-600">{stats.customers}</p>
                  <p className="text-sm text-gray-600">عملاء</p>
                </div>
                <div className="text-center p-4 bg-green-50 rounded-xl">
                  <p className="text-2xl font-bold text-green-600">{stats.owners}</p>
                  <p className="text-sm text-gray-600">أصحاب مطاعم</p>
                </div>
                <div className="text-center p-4 bg-yellow-50 rounded-xl">
                  <p className="text-2xl font-bold text-yellow-600">{stats.couriers}</p>
                  <p className="text-sm text-gray-600">مناديب</p>
                </div>
                <div className="text-center p-4 bg-purple-50 rounded-xl">
                  <p className="text-2xl font-bold text-purple-600">{stats.admins}</p>
                  <p className="text-sm text-gray-600">مشرفين</p>
                </div>
                <div className="text-center p-4 bg-red-50 rounded-xl">
                  <p className="text-2xl font-bold text-red-600">1</p>
                  <p className="text-sm text-gray-600">مطور</p>
                </div>
              </div>
            </div>
          </div>
        )}

        {/* ===== المطاعم ===== */}
        {activeTab === 'restaurants' && (
          <div className="space-y-4">
            <div className="flex items-center justify-between">
              <h2 className="text-xl font-bold">🏪 جميع المطاعم ({restaurants.length})</h2>
            </div>
            
            <div className="space-y-4">
              {restaurants.map(restaurant => (
                <div key={restaurant.id} className="bg-white rounded-2xl shadow p-4">
                  {editingRestaurant === restaurant.id ? (
                    // وضع التحرير
                    <div className="space-y-4">
                      <div className="grid md:grid-cols-2 gap-4">
                        <div>
                          <label className="text-sm text-gray-600">اسم المطعم</label>
                          <input
                            type="text"
                            value={restaurantForm.name || ''}
                            onChange={e => setRestaurantForm({ ...restaurantForm, name: e.target.value })}
                            className="w-full border rounded-xl p-2 mt-1"
                          />
                        </div>
                        <div>
                          <label className="text-sm text-gray-600">رقم الهاتف</label>
                          <input
                            type="text"
                            value={restaurantForm.phone || ''}
                            onChange={e => setRestaurantForm({ ...restaurantForm, phone: e.target.value })}
                            className="w-full border rounded-xl p-2 mt-1"
                          />
                        </div>
                        <div>
                          <label className="text-sm text-gray-600">البريد الإلكتروني</label>
                          <input
                            type="email"
                            value={restaurantForm.email || ''}
                            onChange={e => setRestaurantForm({ ...restaurantForm, email: e.target.value })}
                            className="w-full border rounded-xl p-2 mt-1"
                          />
                        </div>
                        <div>
                          <label className="text-sm text-gray-600">المدينة</label>
                          <input
                            type="text"
                            value={restaurantForm.city || ''}
                            onChange={e => setRestaurantForm({ ...restaurantForm, city: e.target.value })}
                            className="w-full border rounded-xl p-2 mt-1"
                          />
                        </div>
                        <div className="md:col-span-2">
                          <label className="text-sm text-gray-600">العنوان</label>
                          <input
                            type="text"
                            value={restaurantForm.location || ''}
                            onChange={e => setRestaurantForm({ ...restaurantForm, location: e.target.value })}
                            className="w-full border rounded-xl p-2 mt-1"
                          />
                        </div>
                      </div>
                      
                      {/* رفع الشعار */}
                      <div>
                        <label className="text-sm text-gray-600">شعار المطعم</label>
                        <input
                          type="file"
                          accept="image/*"
                          onChange={e => {
                            const file = e.target.files?.[0]
                            if (file) handleUploadLogo(restaurant.id, file)
                          }}
                          className="w-full border rounded-xl p-2 mt-1"
                          disabled={uploadingLogo}
                        />
                        {uploadingLogo && <p className="text-sm text-gray-500 mt-1">جاري الرفع...</p>}
                      </div>
                      
                      <div className="flex gap-2">
                        <button
                          onClick={() => handleUpdateRestaurant(restaurant.id)}
                          className="flex items-center gap-2 bg-green-600 hover:bg-green-700 text-white px-4 py-2 rounded-xl"
                        >
                          <Save className="w-4 h-4" /> حفظ
                        </button>
                        <button
                          onClick={() => setEditingRestaurant(null)}
                          className="flex items-center gap-2 bg-gray-500 hover:bg-gray-600 text-white px-4 py-2 rounded-xl"
                        >
                          <X className="w-4 h-4" /> إلغاء
                        </button>
                      </div>
                    </div>
                  ) : (
                    // وضع العرض
                    <div className="flex items-start gap-4">
                      {/* الشعار */}
                      <div className="w-16 h-16 rounded-xl bg-gray-100 overflow-hidden flex-shrink-0">
                        {restaurant.logoUrl ? (
                          <img src={restaurant.logoUrl} alt={restaurant.name} className="w-full h-full object-cover" />
                        ) : (
                          <div className="w-full h-full flex items-center justify-center text-2xl">🏪</div>
                        )}
                      </div>
                      
                      {/* التفاصيل */}
                      <div className="flex-1">
                        <h3 className="font-bold text-lg">{restaurant.name}</h3>
                        <div className="text-sm text-gray-600 space-y-1 mt-1">
                          {restaurant.phone && <p>📱 {restaurant.phone}</p>}
                          {restaurant.email && <p>📧 {restaurant.email}</p>}
                          {restaurant.city && <p>📍 {restaurant.city}</p>}
                          {restaurant.referredBy && (
                            <p className="text-purple-600">
                              👑 مضاف من: {admins.find(a => a.uid === restaurant.referredBy)?.name || restaurant.referredBy.slice(0, 8)}
                            </p>
                          )}
                        </div>
                      </div>
                      
                      {/* الأزرار */}
                      <div className="flex gap-2">
                        <button
                          onClick={() => {
                            setEditingRestaurant(restaurant.id)
                            setRestaurantForm(restaurant)
                          }}
                          className="p-2 bg-blue-100 hover:bg-blue-200 text-blue-600 rounded-xl"
                        >
                          <Edit3 className="w-5 h-5" />
                        </button>
                        <button
                          onClick={() => handleDeleteRestaurant(restaurant.id)}
                          className="p-2 bg-red-100 hover:bg-red-200 text-red-600 rounded-xl"
                        >
                          <Trash2 className="w-5 h-5" />
                        </button>
                      </div>
                    </div>
                  )}
                </div>
              ))}
            </div>
          </div>
        )}

        {/* ===== الطلبات ===== */}
        {activeTab === 'orders' && (
          <div className="space-y-4">
            <div className="flex items-center justify-between flex-wrap gap-4">
              <h2 className="text-xl font-bold">📦 جميع الطلبات ({orders.length})</h2>
              <select
                value={orderFilter}
                onChange={e => setOrderFilter(e.target.value)}
                className="border rounded-xl p-2"
              >
                <option value="all">جميع الحالات</option>
                <option value="pending">قيد المراجعة</option>
                <option value="accepted">مقبول</option>
                <option value="preparing">قيد التحضير</option>
                <option value="ready">جاهز</option>
                <option value="out_for_delivery">في الطريق</option>
                <option value="delivered">تم التسليم</option>
                <option value="cancelled">ملغي</option>
              </select>
            </div>
            
            <div className="space-y-3">
              {orders
                .filter(o => orderFilter === 'all' || o.status === orderFilter)
                .sort((a, b) => (b.createdAt?.seconds || 0) - (a.createdAt?.seconds || 0))
                .map(order => (
                  <div key={order.id} className="bg-white rounded-2xl shadow p-4">
                    <div className="flex items-start justify-between flex-wrap gap-4">
                      <div>
                        <h3 className="font-bold">طلب #{order.id.slice(-8)}</h3>
                        <p className="text-sm text-gray-600">🏪 {order.restaurantName || 'مطعم'}</p>
                        <p className="text-sm text-gray-600">📍 {order.address}</p>
                        <p className="text-sm text-gray-600">💰 {order.total?.toFixed(2)} ر.س</p>
                        {order.platformFee && (
                          <p className="text-xs text-green-600">
                            رسوم التطبيق: {order.platformFee} ر.س 
                            {order.adminCommission ? ` | عمولة المشرف: ${order.adminCommission} ر.س` : ''}
                          </p>
                        )}
                      </div>
                      
                      <div className="text-left">
                        <span className={`inline-block px-3 py-1 rounded-xl text-sm font-semibold ${
                          order.status === 'delivered' ? 'bg-green-100 text-green-700' :
                          order.status === 'cancelled' ? 'bg-red-100 text-red-700' :
                          order.status === 'pending' ? 'bg-yellow-100 text-yellow-700' :
                          'bg-blue-100 text-blue-700'
                        }`}>
                          {statusLabel(order.status)}
                        </span>
                        
                        {/* تغيير الحالة */}
                        <select
                          value={order.status}
                          onChange={e => handleUpdateOrderStatus(order.id, e.target.value)}
                          className="mt-2 w-full border rounded-lg p-1 text-sm"
                        >
                          <option value="pending">قيد المراجعة</option>
                          <option value="accepted">مقبول</option>
                          <option value="preparing">قيد التحضير</option>
                          <option value="ready">جاهز</option>
                          <option value="out_for_delivery">في الطريق</option>
                          <option value="delivered">تم التسليم</option>
                          <option value="cancelled">ملغي</option>
                        </select>
                      </div>
                    </div>
                    
                    {/* الأصناف */}
                    <div className="mt-3 pt-3 border-t">
                      <p className="text-sm text-gray-500 mb-1">الأصناف:</p>
                      <div className="flex flex-wrap gap-2">
                        {order.items?.map((item, i) => (
                          <span key={i} className="text-xs bg-gray-100 px-2 py-1 rounded">
                            {item.name} × {item.qty}
                          </span>
                        ))}
                      </div>
                    </div>
                  </div>
                ))}
            </div>
          </div>
        )}

        {/* ===== المستخدمين ===== */}
        {activeTab === 'users' && (
          <div className="space-y-4">
            <div className="flex items-center justify-between flex-wrap gap-4">
              <h2 className="text-xl font-bold">👤 جميع المستخدمين ({users.length})</h2>
              <select
                value={userFilter}
                onChange={e => setUserFilter(e.target.value)}
                className="border rounded-xl p-2"
              >
                <option value="all">جميع الأدوار</option>
                <option value="customer">عملاء</option>
                <option value="owner">أصحاب مطاعم</option>
                <option value="courier">مناديب</option>
                <option value="admin">مشرفين</option>
                <option value="developer">مطورين</option>
              </select>
            </div>
            
            <div className="grid md:grid-cols-2 lg:grid-cols-3 gap-4">
              {users
                .filter(u => userFilter === 'all' || u.role === userFilter)
                .map(u => (
                  <div key={u.uid} className="bg-white rounded-2xl shadow p-4">
                    {editingUser === u.uid ? (
                      <div className="space-y-3">
                        <input
                          type="text"
                          placeholder="الاسم"
                          value={userForm.name || ''}
                          onChange={e => setUserForm({ ...userForm, name: e.target.value })}
                          className="w-full border rounded-xl p-2"
                        />
                        <input
                          type="text"
                          placeholder="الهاتف"
                          value={userForm.phone || ''}
                          onChange={e => setUserForm({ ...userForm, phone: e.target.value })}
                          className="w-full border rounded-xl p-2"
                        />
                        <select
                          value={userForm.role || 'customer'}
                          onChange={e => setUserForm({ ...userForm, role: e.target.value })}
                          className="w-full border rounded-xl p-2"
                        >
                          <option value="customer">عميل</option>
                          <option value="owner">صاحب مطعم</option>
                          <option value="courier">مندوب</option>
                          <option value="admin">مشرف</option>
                          <option value="developer">مطور</option>
                        </select>
                        <div className="flex gap-2">
                          <button
                            onClick={() => handleUpdateUser(u.uid)}
                            className="flex-1 bg-green-600 text-white py-2 rounded-xl"
                          >
                            حفظ
                          </button>
                          <button
                            onClick={() => setEditingUser(null)}
                            className="flex-1 bg-gray-500 text-white py-2 rounded-xl"
                          >
                            إلغاء
                          </button>
                        </div>
                      </div>
                    ) : (
                      <>
                        <div className="flex items-start justify-between">
                          <div>
                            <h3 className="font-bold">{u.name || 'بدون اسم'}</h3>
                            <p className="text-sm text-gray-600">{u.email}</p>
                            <p className="text-xs mt-1">{roleLabel(u.role)}</p>
                          </div>
                          <div className="flex gap-1">
                            <button
                              onClick={() => {
                                setEditingUser(u.uid)
                                setUserForm(u)
                              }}
                              className="p-1.5 bg-blue-100 text-blue-600 rounded-lg"
                            >
                              <Edit3 className="w-4 h-4" />
                            </button>
                            <button
                              onClick={() => handleDeleteUser(u.uid)}
                              className="p-1.5 bg-red-100 text-red-600 rounded-lg"
                            >
                              <Trash2 className="w-4 h-4" />
                            </button>
                          </div>
                        </div>
                      </>
                    )}
                  </div>
                ))}
            </div>
          </div>
        )}

        {/* ===== المناديب ===== */}
        {activeTab === 'couriers' && (
          <div className="space-y-4">
            <h2 className="text-xl font-bold">🚗 المناديب ({stats.couriers})</h2>
            
            <div className="grid md:grid-cols-2 lg:grid-cols-3 gap-4">
              {users.filter(u => u.role === 'courier').map(courier => (
                <div key={courier.uid} className="bg-white rounded-2xl shadow p-4">
                  <div className="flex items-center gap-3">
                    <div className="w-12 h-12 bg-cyan-100 rounded-full flex items-center justify-center text-2xl">
                      🚗
                    </div>
                    <div>
                      <h3 className="font-bold">{courier.name || 'بدون اسم'}</h3>
                      <p className="text-sm text-gray-600">{courier.email}</p>
                      {courier.phone && <p className="text-sm text-gray-600">📱 {courier.phone}</p>}
                    </div>
                  </div>
                  
                  {/* إحصائيات المندوب */}
                  <div className="mt-4 pt-3 border-t">
                    <div className="grid grid-cols-2 gap-2 text-center">
                      <div className="bg-green-50 rounded-lg p-2">
                        <p className="text-lg font-bold text-green-600">
                          {orders.filter(o => o.courierId === courier.uid && o.status === 'delivered').length}
                        </p>
                        <p className="text-xs text-gray-600">طلبات مسلمة</p>
                      </div>
                      <div className="bg-blue-50 rounded-lg p-2">
                        <p className="text-lg font-bold text-blue-600">
                          {orders.filter(o => o.courierId === courier.uid && o.status === 'out_for_delivery').length}
                        </p>
                        <p className="text-xs text-gray-600">في الطريق</p>
                      </div>
                    </div>
                  </div>
                </div>
              ))}
              
              {stats.couriers === 0 && (
                <div className="col-span-full text-center py-12 text-gray-500">
                  لا يوجد مناديب مسجلين
                </div>
              )}
            </div>
          </div>
        )}

        {/* ===== المشرفين ===== */}
        {activeTab === 'admins' && (
          <div className="space-y-4">
            <div className="flex items-center justify-between flex-wrap gap-4">
              <h2 className="text-xl font-bold">👑 المشرفين وعمولاتهم ({admins.length})</h2>
              <button
                onClick={() => setShowAddAdmin(!showAddAdmin)}
                className="flex items-center gap-2 bg-purple-600 hover:bg-purple-700 text-white px-4 py-2 rounded-xl font-semibold transition"
              >
                <UserPlus className="w-5 h-5" />
                {showAddAdmin ? 'إلغاء' : 'إضافة مشرف'}
              </button>
            </div>
            
            {/* نموذج إضافة مشرف */}
            {showAddAdmin && (
              <div className="bg-purple-50 rounded-2xl p-6 border-2 border-purple-200">
                <h3 className="text-lg font-bold text-purple-800 mb-4">👑 ترقية مستخدم إلى مشرف</h3>
                <p className="text-sm text-purple-600 mb-4">اختر مستخدم موجود لترقيته إلى دور المشرف، أو أدخل بيانات مستخدم جديد</p>
                
                {/* قائمة المستخدمين الموجودين */}
                <div className="mb-4">
                  <label className="text-sm font-semibold text-gray-700 block mb-2">ترقية مستخدم موجود:</label>
                  <div className="grid gap-2 max-h-48 overflow-y-auto">
                    {users.filter(u => u.role === 'customer').slice(0, 10).map(u => (
                      <div key={u.uid} className="flex items-center justify-between bg-white p-3 rounded-xl">
                        <div>
                          <p className="font-semibold">{u.name || 'بدون اسم'}</p>
                          <p className="text-sm text-gray-500">{u.email}</p>
                        </div>
                        <button
                          onClick={async () => {
                            const confirmed = await dialog.confirm(`هل تريد ترقية ${u.name || u.email} إلى مشرف؟`, {
                              title: 'ترقية إلى مشرف'
                            })
                            if (!confirmed) return
                            try {
                              await updateDoc(doc(db, 'users', u.uid), { role: 'admin' })
                              toast.success('تم ترقية المستخدم إلى مشرف ✅')
                              setShowAddAdmin(false)
                              loadData()
                            } catch (err) {
                              toast.error('فشل ترقية المستخدم')
                            }
                          }}
                          className="bg-purple-600 hover:bg-purple-700 text-white px-3 py-1 rounded-lg text-sm"
                        >
                          ترقية 👑
                        </button>
                      </div>
                    ))}
                    {users.filter(u => u.role === 'customer').length === 0 && (
                      <p className="text-gray-500 text-center py-4">لا يوجد عملاء يمكن ترقيتهم</p>
                    )}
                  </div>
                </div>
                
                {/* نموذج إنشاء مشرف جديد */}
                <div className="border-t pt-4 mt-4">
                  <h4 className="text-md font-bold text-purple-800 mb-3">✨ أو إنشاء حساب مشرف جديد:</h4>
                  <div className="grid md:grid-cols-2 gap-4">
                    <div>
                      <label className="text-sm text-gray-600 block mb-1">البريد الإلكتروني *</label>
                      <input
                        type="email"
                        placeholder="admin@example.com"
                        value={newAdminEmail}
                        onChange={e => setNewAdminEmail(e.target.value)}
                        className="w-full border rounded-xl p-3 text-gray-900"
                      />
                    </div>
                    <div>
                      <label className="text-sm text-gray-600 block mb-1">كلمة المرور *</label>
                      <input
                        type="password"
                        placeholder="كلمة المرور (6 أحرف على الأقل)"
                        value={newAdminPassword}
                        onChange={e => setNewAdminPassword(e.target.value)}
                        className="w-full border rounded-xl p-3 text-gray-900"
                      />
                    </div>
                    <div>
                      <label className="text-sm text-gray-600 block mb-1">الاسم</label>
                      <input
                        type="text"
                        placeholder="اسم المشرف"
                        value={newAdminName}
                        onChange={e => setNewAdminName(e.target.value)}
                        className="w-full border rounded-xl p-3 text-gray-900"
                      />
                    </div>
                    <div>
                      <label className="text-sm text-gray-600 block mb-1">رقم الهاتف</label>
                      <input
                        type="tel"
                        placeholder="05xxxxxxxx"
                        value={newAdminPhone}
                        onChange={e => setNewAdminPhone(e.target.value)}
                        className="w-full border rounded-xl p-3 text-gray-900"
                      />
                    </div>
                  </div>
                  
                  <button
                    onClick={handleCreateNewAdmin}
                    disabled={creatingAdmin || !newAdminEmail.trim() || !newAdminPassword.trim()}
                    className="mt-4 w-full bg-gradient-to-r from-purple-600 to-purple-700 hover:from-purple-700 hover:to-purple-800 text-white py-3 rounded-xl font-bold transition disabled:opacity-50 flex items-center justify-center gap-2"
                  >
                    {creatingAdmin ? (
                      <>
                        <RefreshCw className="w-5 h-5 animate-spin" />
                        جاري الإنشاء...
                      </>
                    ) : (
                      <>
                        <UserPlus className="w-5 h-5" />
                        إنشاء حساب المشرف
                      </>
                    )}
                  </button>
                  
                  <p className="text-xs text-orange-600 mt-2">
                    ⚠️ تنبيه: بعد إنشاء المشرف الجديد، سيتم تسجيل خروجك تلقائياً. يرجى تسجيل الدخول مرة أخرى.
                  </p>
                </div>
                
                <div className="border-t pt-4 mt-4">
                  <p className="text-xs text-gray-500">💡 يمكنك أيضاً تغيير دور أي مستخدم من تبويب "المستخدمين"</p>
                </div>
              </div>
            )}
            
            <div className="space-y-4">
              {admins.map(admin => (
                <div key={admin.uid} className="bg-white rounded-2xl shadow overflow-hidden">
                  {/* رأس المشرف */}
                  <div 
                    className="p-4 cursor-pointer hover:bg-gray-50"
                    onClick={() => setExpandedAdmin(expandedAdmin === admin.uid ? null : admin.uid)}
                  >
                    <div className="flex items-center justify-between">
                      <div className="flex items-center gap-3">
                        <div className="w-12 h-12 bg-purple-100 rounded-full flex items-center justify-center text-2xl">
                          👑
                        </div>
                        <div>
                          <h3 className="font-bold">{admin.name || 'بدون اسم'}</h3>
                          <p className="text-sm text-gray-600">{admin.email}</p>
                        </div>
                      </div>
                      
                      <div className="flex items-center gap-4">
                        {/* الإحصائيات */}
                        <div className="text-left">
                          <div className="flex items-center gap-2">
                            <Wallet className="w-4 h-4 text-green-600" />
                            <span className="font-bold text-green-600">{admin.walletBalance.toFixed(2)} ر.س</span>
                          </div>
                          <p className="text-xs text-gray-500">
                            إجمالي: {admin.totalEarnings.toFixed(2)} ر.س | {admin.restaurantsCount} مطعم
                          </p>
                        </div>
                        
                        {expandedAdmin === admin.uid ? (
                          <ChevronUp className="w-5 h-5 text-gray-400" />
                        ) : (
                          <ChevronDown className="w-5 h-5 text-gray-400" />
                        )}
                      </div>
                    </div>
                  </div>
                  
                  {/* المطاعم التابعة */}
                  {expandedAdmin === admin.uid && (
                    <div className="border-t bg-gray-50 p-4">
                      <h4 className="font-semibold text-sm text-gray-700 mb-3">
                        🏪 المطاعم المضافة بواسطة هذا المشرف ({admin.restaurants.length}):
                      </h4>
                      
                      {admin.restaurants.length > 0 ? (
                        <div className="grid md:grid-cols-2 gap-3">
                          {admin.restaurants.map(r => (
                            <div key={r.id} className="bg-white rounded-xl p-3 flex items-center gap-3">
                              <div className="w-10 h-10 rounded-lg bg-gray-100 overflow-hidden">
                                {r.logoUrl ? (
                                  <img src={r.logoUrl} alt={r.name} className="w-full h-full object-cover" />
                                ) : (
                                  <div className="w-full h-full flex items-center justify-center">🏪</div>
                                )}
                              </div>
                              <div>
                                <p className="font-semibold text-sm">{r.name}</p>
                                <p className="text-xs text-gray-500">{r.city || 'بدون مدينة'}</p>
                              </div>
                            </div>
                          ))}
                        </div>
                      ) : (
                        <p className="text-gray-500 text-sm">لم يضف أي مطاعم بعد</p>
                      )}
                      
                      {/* ملخص العمولات */}
                      <div className="mt-4 pt-3 border-t">
                        <div className="grid grid-cols-3 gap-3 text-center">
                          <div className="bg-green-100 rounded-lg p-2">
                            <p className="font-bold text-green-700">{admin.walletBalance.toFixed(2)}</p>
                            <p className="text-xs text-gray-600">الرصيد الحالي</p>
                          </div>
                          <div className="bg-blue-100 rounded-lg p-2">
                            <p className="font-bold text-blue-700">{admin.totalEarnings.toFixed(2)}</p>
                            <p className="text-xs text-gray-600">إجمالي الأرباح</p>
                          </div>
                          <div className="bg-purple-100 rounded-lg p-2">
                            <p className="font-bold text-purple-700">
                              {orders.filter(o => o.referredBy === admin.uid).length}
                            </p>
                            <p className="text-xs text-gray-600">طلبات من مطاعمه</p>
                          </div>
                        </div>
                      </div>
                    </div>
                  )}
                </div>
              ))}
              
              {admins.length === 0 && (
                <div className="text-center py-12 text-gray-500 bg-white rounded-2xl">
                  لا يوجد مشرفين مسجلين
                </div>
              )}
            </div>
          </div>
        )}

        {/* ===== الإعدادات ===== */}
        {activeTab === 'settings' && (
          <div className="space-y-6">
            <div className="flex items-center justify-between">
              <h2 className="text-xl font-bold">⚙️ إعدادات التطبيق</h2>
              {!editingSettings ? (
                <button
                  onClick={() => setEditingSettings(true)}
                  className="bg-primary hover:bg-sky-600 text-white px-4 py-2 rounded-xl"
                >
                  ✏️ تعديل
                </button>
              ) : (
                <div className="flex gap-2">
                  <button
                    onClick={() => { setEditingSettings(false); setSettingsForm(settings) }}
                    className="bg-gray-500 text-white px-4 py-2 rounded-xl"
                  >
                    إلغاء
                  </button>
                  <button
                    onClick={handleSaveSettings}
                    className="bg-green-600 text-white px-4 py-2 rounded-xl"
                  >
                    💾 حفظ
                  </button>
                </div>
              )}
            </div>
            
            <div className="bg-white rounded-2xl shadow p-6">
              <div className="grid md:grid-cols-2 lg:grid-cols-3 gap-6">
                {/* رسوم التوصيل */}
                <div>
                  <label className="text-sm text-gray-600 block mb-1">💰 رسوم التوصيل (ر.س)</label>
                  {editingSettings ? (
                    <input
                      type="number"
                      value={settingsForm.deliveryFee || 0}
                      onChange={e => setSettingsForm({ ...settingsForm, deliveryFee: Number(e.target.value) })}
                      className="w-full border rounded-xl p-3"
                    />
                  ) : (
                    <p className="text-2xl font-bold">{settings.deliveryFee || 7} ر.س</p>
                  )}
                </div>

                {/* رسوم التطبيق */}
                <div>
                  <label className="text-sm text-gray-600 block mb-1">💵 رسوم التطبيق / منتج (ر.س)</label>
                  {editingSettings ? (
                    <input
                      type="number"
                      step="0.1"
                      value={settingsForm.platformFee || 1.0}
                      onChange={e => setSettingsForm({ ...settingsForm, platformFee: Number(e.target.value) })}
                      className="w-full border rounded-xl p-3"
                    />
                  ) : (
                    <p className="text-2xl font-bold">{settings.platformFee || 1.0} ر.س/منتج</p>
                  )}
                </div>

                {/* عمولة المشرف */}
                <div>
                  <label className="text-sm text-gray-600 block mb-1">👑 عمولة المشرف / منتج (ر.س)</label>
                  {editingSettings ? (
                    <input
                      type="number"
                      step="0.05"
                      value={settingsForm.adminCommissionRate || 0.75}
                      onChange={e => setSettingsForm({ ...settingsForm, adminCommissionRate: Number(e.target.value) })}
                      className="w-full border rounded-xl p-3"
                    />
                  ) : (
                    <p className="text-2xl font-bold">{settings.adminCommissionRate || 0.75} ر.س/منتج</p>
                  )}
                </div>

                {/* الحد الأدنى للطلب */}
                <div>
                  <label className="text-sm text-gray-600 block mb-1">🛒 الحد الأدنى للطلب</label>
                  {editingSettings ? (
                    <input
                      type="number"
                      value={settingsForm.minOrderAmount || 0}
                      onChange={e => setSettingsForm({ ...settingsForm, minOrderAmount: Number(e.target.value) })}
                      className="w-full border rounded-xl p-3"
                    />
                  ) : (
                    <p className="text-2xl font-bold">{settings.minOrderAmount || 20} ر.س</p>
                  )}
                </div>

                {/* ساعات العمل */}
                <div>
                  <label className="text-sm text-gray-600 block mb-1">🕐 ساعات العمل</label>
                  {editingSettings ? (
                    <div className="flex gap-2">
                      <input
                        type="time"
                        value={settingsForm.workingHours?.open || '09:00'}
                        onChange={e => setSettingsForm({ ...settingsForm, workingHours: { ...settingsForm.workingHours!, open: e.target.value } })}
                        className="flex-1 border rounded-xl p-3"
                      />
                      <input
                        type="time"
                        value={settingsForm.workingHours?.close || '23:00'}
                        onChange={e => setSettingsForm({ ...settingsForm, workingHours: { ...settingsForm.workingHours!, close: e.target.value } })}
                        className="flex-1 border rounded-xl p-3"
                      />
                    </div>
                  ) : (
                    <p className="text-2xl font-bold">
                      {settings.workingHours?.open || '09:00'} - {settings.workingHours?.close || '23:00'}
                    </p>
                  )}
                </div>

                {/* وضع الصيانة */}
                <div>
                  <label className="text-sm text-gray-600 block mb-1">🔧 وضع الصيانة</label>
                  {editingSettings ? (
                    <label className="flex items-center gap-2 cursor-pointer">
                      <input
                        type="checkbox"
                        checked={settingsForm.maintenanceMode || false}
                        onChange={e => setSettingsForm({ ...settingsForm, maintenanceMode: e.target.checked })}
                        className="w-6 h-6"
                      />
                      <span className="text-lg">{settingsForm.maintenanceMode ? 'مفعّل' : 'معطّل'}</span>
                    </label>
                  ) : (
                    <p className={`text-2xl font-bold ${settings.maintenanceMode ? 'text-red-600' : 'text-green-600'}`}>
                      {settings.maintenanceMode ? '🔴 مفعّل' : '🟢 معطّل'}
                    </p>
                  )}
                </div>
              </div>
            </div>

            {/* شرح نظام العمولات */}
            <div className="bg-sky-50 border-l-4 border-sky-500 rounded-lg p-6">
              <h3 className="font-bold text-sky-900 mb-3">💰 نظام العمولات (لكل منتج = 1.75 ر.س):</h3>
              <div className="text-sky-800 space-y-2">
                <p>• <strong>رسوم التطبيق:</strong> {settings.platformFee || 1.0} ر.س × عدد المنتجات</p>
                <p>• <strong>عمولة المشرف:</strong> {settings.adminCommissionRate || 0.75} ر.س × عدد المنتجات</p>
                <div className="bg-white rounded-xl p-4 mt-3">
                  <p className="font-bold mb-2">📝 مثال: طلب فيه 5 منتجات</p>
                  <p>• <strong>إذا المطعم مضاف من مشرف:</strong></p>
                  <ul className="mr-6 list-disc text-sm">
                    <li>المشرف يحصل على: 5 × {settings.adminCommissionRate || 0.75} = <strong>{(5 * (settings.adminCommissionRate || 0.75)).toFixed(2)} ر.س</strong></li>
                    <li>التطبيق يحصل على: 5 × {settings.platformFee || 1.0} = <strong>{(5 * (settings.platformFee || 1.0)).toFixed(2)} ر.س</strong></li>
                    <li className="text-green-700">المجموع: <strong>{(5 * 1.75).toFixed(2)} ر.س</strong></li>
                  </ul>
                  <p className="mt-2">• <strong>إذا المطعم مضاف من المطور:</strong></p>
                  <ul className="mr-6 list-disc text-sm">
                    <li>التطبيق يحصل على كل شيء: 5 × 1.75 = <strong>{(5 * 1.75).toFixed(2)} ر.س</strong></li>
                  </ul>
                </div>
              </div>
            </div>
          </div>
        )}

        {/* معلومات النظام */}
        <div className="bg-gray-100 rounded-2xl p-4 text-sm">
          <div className="flex flex-wrap gap-4 text-gray-600">
            <span>📧 {user?.email}</span>
            <span>🆔 {user?.uid.slice(0, 12)}...</span>
            <span>📅 {new Date().toLocaleDateString('ar-SA')}</span>
          </div>
        </div>
      </div>
    </RoleGate>
  )
}

export default Developer


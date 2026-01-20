import React, { useEffect, useState } from 'react'
import { useAuth } from '@/auth'
import { RoleGate } from '@/routes/RoleGate'
import { 
  Trash2, Users, Settings, RefreshCw, Database, Shield, Server, 
  Edit3, Save, X, ChevronDown, ChevronUp, Building2, Wallet, Package, Truck, UserPlus, Plus,
  FileCheck, AlertCircle, CheckCircle, Clock, ExternalLink
} from 'lucide-react'
import { useToast } from '@/components/ui/Toast'
import { useDialog } from '@/components/ui/ConfirmDialog'
import { db, app, auth } from '@/firebase'
import { createUserWithEmailAndPassword, signInWithEmailAndPassword } from 'firebase/auth'
import { 
  collection, getDocs, doc, getDoc, setDoc, updateDoc, deleteDoc, 
  serverTimestamp, addDoc 
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
  packageType?: 'free' | 'premium'
  packageRequest?: 'premium'
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

// نوع المهمة
type Task = {
  id: string
  title: string
  description: string
  assignedTo: string // UID المشرف
  assignedToName?: string
  status: 'pending' | 'in_progress' | 'completed' | 'cancelled'
  priority: 'low' | 'medium' | 'high'
  dueDate?: any
  createdBy: string
  createdAt?: any
  updatedAt?: any
  completedAt?: any
  notes?: string
}

// تبويبات اللوحة
type Tab = 'overview' | 'restaurants' | 'orders' | 'users' | 'couriers' | 'admins' | 'settings' | 'finance' | 'tools' | 'tasks' | 'licenses'


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

  // إضافة مندوب جديد
  const [showAddCourier, setShowAddCourier] = useState(false)
  const [newCourierEmail, setNewCourierEmail] = useState('')
  const [newCourierName, setNewCourierName] = useState('')
  const [newCourierPassword, setNewCourierPassword] = useState('')
  const [newCourierPhone, setNewCourierPhone] = useState('')
  const [creatingCourier, setCreatingCourier] = useState(false)

  // إضافة مطعم جديد
  const [showAddRestaurant, setShowAddRestaurant] = useState(false)
  const [newRestaurantName, setNewRestaurantName] = useState('')
  const [newRestaurantCity, setNewRestaurantCity] = useState('')
  const [newRestaurantPhone, setNewRestaurantPhone] = useState('')
  const [newRestaurantEmail, setNewRestaurantEmail] = useState('')
  const [newRestaurantOwnerEmail, setNewRestaurantOwnerEmail] = useState('')
  const [newRestaurantOwnerPassword, setNewRestaurantOwnerPassword] = useState('')
  const [creatingRestaurant, setCreatingRestaurant] = useState(false)

  // المهام
  const [tasks, setTasks] = useState<Task[]>([])
  const [showAddTask, setShowAddTask] = useState(false)
  const [newTaskTitle, setNewTaskTitle] = useState('')
  const [newTaskDescription, setNewTaskDescription] = useState('')
  const [newTaskAssignedTo, setNewTaskAssignedTo] = useState('')
  const [newTaskPriority, setNewTaskPriority] = useState<'low' | 'medium' | 'high'>('medium')
  const [newTaskDueDate, setNewTaskDueDate] = useState('')
  const [creatingTask, setCreatingTask] = useState(false)
  const [taskFilter, setTaskFilter] = useState<string>('all')

  // الإعلانات
  const [promotions, setPromotions] = useState<any[]>([])
  
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

  // ===== إنشاء مندوب جديد =====
  const handleCreateNewCourier = async () => {
    if (!newCourierEmail.trim() || !newCourierPassword.trim()) {
      toast.warning('أدخل البريد الإلكتروني وكلمة المرور')
      return
    }
    if (newCourierPassword.length < 6) {
      toast.warning('كلمة المرور يجب أن تكون 6 أحرف على الأقل')
      return
    }

    const confirmed = await dialog.confirm(
      `سيتم إنشاء حساب مندوب جديد:\n\n📧 ${newCourierEmail}\n👤 ${newCourierName || 'بدون اسم'}\n📱 ${newCourierPhone || 'بدون رقم'}`,
      { title: 'إنشاء مندوب جديد' }
    )
    if (!confirmed) return

    setCreatingCourier(true)
    try {
      const userCred = await createUserWithEmailAndPassword(auth, newCourierEmail.trim(), newCourierPassword)
      const newUid = userCred.user.uid

      await setDoc(doc(db, 'users', newUid), {
        email: newCourierEmail.trim(),
        name: newCourierName.trim() || 'مندوب جديد',
        phone: newCourierPhone.trim() || '',
        role: 'courier',
        createdAt: serverTimestamp(),
      })

      toast.success('تم إنشاء حساب المندوب بنجاح ✅')
      toast.info('⚠️ تم تسجيل خروجك، يرجى تسجيل الدخول مرة أخرى')
      
      setNewCourierEmail('')
      setNewCourierName('')
      setNewCourierPassword('')
      setNewCourierPhone('')
      setShowAddCourier(false)
      
    } catch (err: any) {
      console.error('خطأ في إنشاء المندوب:', err)
      if (err.code === 'auth/email-already-in-use') {
        toast.error('البريد الإلكتروني مستخدم مسبقاً')
      } else {
        toast.error('فشل إنشاء المندوب: ' + (err.message || 'خطأ غير معروف'))
      }
    } finally {
      setCreatingCourier(false)
    }
  }

  // ===== إنشاء مطعم جديد =====
  const handleCreateNewRestaurant = async () => {
    if (!newRestaurantName.trim()) {
      toast.warning('أدخل اسم المطعم')
      return
    }
    if (!newRestaurantOwnerEmail.trim() || !newRestaurantOwnerPassword.trim()) {
      toast.warning('أدخل بيانات صاحب المطعم')
      return
    }

    const confirmed = await dialog.confirm(
      `سيتم إنشاء مطعم جديد:\n\n🏪 ${newRestaurantName}\n📍 ${newRestaurantCity || 'بدون مدينة'}\n👤 صاحب المطعم: ${newRestaurantOwnerEmail}`,
      { title: 'إنشاء مطعم جديد' }
    )
    if (!confirmed) return

    setCreatingRestaurant(true)
    try {
      // إنشاء حساب صاحب المطعم
      const userCred = await createUserWithEmailAndPassword(auth, newRestaurantOwnerEmail.trim(), newRestaurantOwnerPassword)
      const newOwnerId = userCred.user.uid

      // إنشاء مستند صاحب المطعم
      await setDoc(doc(db, 'users', newOwnerId), {
        email: newRestaurantOwnerEmail.trim(),
        name: newRestaurantName.trim() + ' - مالك',
        role: 'owner',
        createdAt: serverTimestamp(),
      })

      // إنشاء مستند المطعم
      await setDoc(doc(db, 'restaurants', newOwnerId), {
        name: newRestaurantName.trim(),
        ownerId: newOwnerId,
        email: newRestaurantEmail.trim() || newRestaurantOwnerEmail.trim(),
        phone: newRestaurantPhone.trim() || '',
        city: newRestaurantCity.trim() || '',
        referredBy: user?.uid, // المطور هو من أضاف المطعم
        referrerType: 'developer',
        createdAt: serverTimestamp(),
      })

      toast.success('تم إنشاء المطعم وحساب المالك بنجاح ✅')
      toast.info('⚠️ تم تسجيل خروجك، يرجى تسجيل الدخول مرة أخرى')
      
      setNewRestaurantName('')
      setNewRestaurantCity('')
      setNewRestaurantPhone('')
      setNewRestaurantEmail('')
      setNewRestaurantOwnerEmail('')
      setNewRestaurantOwnerPassword('')
      setShowAddRestaurant(false)
      
    } catch (err: any) {
      console.error('خطأ في إنشاء المطعم:', err)
      if (err.code === 'auth/email-already-in-use') {
        toast.error('البريد الإلكتروني مستخدم مسبقاً')
      } else {
        toast.error('فشل إنشاء المطعم: ' + (err.message || 'خطأ غير معروف'))
      }
    } finally {
      setCreatingRestaurant(false)
    }
  }

  // ===== حساب الإحصائيات المالية =====
  const getFinanceStats = () => {
    const now = new Date()
    const today = new Date(now.getFullYear(), now.getMonth(), now.getDate())
    const weekAgo = new Date(today.getTime() - 7 * 24 * 60 * 60 * 1000)
    const monthAgo = new Date(today.getTime() - 30 * 24 * 60 * 60 * 1000)

    const todayOrders = orders.filter(o => {
      const orderDate = o.createdAt?.toDate?.() || new Date(0)
      return orderDate >= today && o.status !== 'cancelled'
    })

    const weekOrders = orders.filter(o => {
      const orderDate = o.createdAt?.toDate?.() || new Date(0)
      return orderDate >= weekAgo && o.status !== 'cancelled'
    })

    const monthOrders = orders.filter(o => {
      const orderDate = o.createdAt?.toDate?.() || new Date(0)
      return orderDate >= monthAgo && o.status !== 'cancelled'
    })

    const deliveredOrders = orders.filter(o => o.status === 'delivered')

    return {
      todayRevenue: todayOrders.reduce((sum, o) => sum + (o.total || 0), 0),
      todayOrders: todayOrders.length,
      todayPlatformFee: todayOrders.reduce((sum, o) => sum + (o.platformFee || 0), 0),
      weekRevenue: weekOrders.reduce((sum, o) => sum + (o.total || 0), 0),
      weekOrders: weekOrders.length,
      weekPlatformFee: weekOrders.reduce((sum, o) => sum + (o.platformFee || 0), 0),
      monthRevenue: monthOrders.reduce((sum, o) => sum + (o.total || 0), 0),
      monthOrders: monthOrders.length,
      monthPlatformFee: monthOrders.reduce((sum, o) => sum + (o.platformFee || 0), 0),
      totalRevenue: deliveredOrders.reduce((sum, o) => sum + (o.total || 0), 0),
      totalPlatformFee: deliveredOrders.reduce((sum, o) => sum + (o.platformFee || 0), 0),
      totalAdminCommission: deliveredOrders.reduce((sum, o) => sum + (o.adminCommission || 0), 0),
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

      // جلب المهام بشكل منفصل (قد لا تكون موجودة)
      let tasksSnap: any = { docs: [] }
      try {
        tasksSnap = await getDocs(collection(db, 'tasks'))
      } catch (err) {
        console.log('لا توجد مهام بعد')
      }

      // جلب الإعلانات
      let promotionsSnap: any = { docs: [] }
      try {
        promotionsSnap = await getDocs(collection(db, 'promotions'))
      } catch (err) {
        console.log('لا توجد إعلانات بعد')
      }
      const promotionsData = promotionsSnap.docs.map((d: any) => ({ id: d.id, ...d.data() }))
      setPromotions(promotionsData)

      // المستخدمين
      const usersData = usersSnap.docs.map(d => ({ uid: d.id, ...d.data() } as User))
      setUsers(usersData)
      
      // المطاعم
      const restaurantsData = restaurantsSnap.docs.map(d => ({ id: d.id, ...d.data() } as Restaurant))
      setRestaurants(restaurantsData)
      
      // الطلبات
      const ordersData = ordersSnap.docs.map(d => ({ id: d.id, ...d.data() } as Order))
      setOrders(ordersData)

      // المهام
      const tasksData: Task[] = tasksSnap.docs.map((d: any) => ({ id: d.id, ...d.data() } as Task))
      setTasks(tasksData.sort((a: Task, b: Task) => (b.createdAt?.seconds || 0) - (a.createdAt?.seconds || 0)))
      
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
      // التحقق من نوع الملف
      if (!file.type.startsWith('image/')) {
        toast.warning('يرجى اختيار صورة فقط')
        return
      }
      if (file.size > 5 * 1024 * 1024) {
        toast.warning('حجم الصورة كبير، يرجى اختيار صورة أقل من 5MB')
        return
      }
      setUploadingLogo(true)
      const cleanName = file.name.replace(/\s+/g, '_')
      const path = `restaurants/${id}/logo_${Date.now()}_${cleanName}`
      const storageRef = ref(storage, path)
      const metadata = {
        contentType: file.type || 'image/jpeg',
        cacheControl: 'public,max-age=31536000,immutable',
      }
      await uploadBytes(storageRef, file, metadata)
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
            { id: 'finance', label: '💰 المالية' },
            { id: 'restaurants', label: '🏪 المطاعم' },
            { id: 'licenses', label: '📄 التراخيص' },
            { id: 'orders', label: '📦 الطلبات' },
            { id: 'users', label: '👤 المستخدمين' },
            { id: 'couriers', label: '🚗 المناديب' },
            { id: 'admins', label: '👑 المشرفين' },
            { id: 'tasks', label: '📋 المهام' },
            { id: 'settings', label: '⚙️ الإعدادات' },
            { id: 'tools', label: '🛠️ الأدوات' },
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

            {/* ملخص أنظمة التطبيق */}
            <div className="bg-white rounded-2xl shadow-lg p-6">
              <h2 className="text-xl font-bold mb-4">🛠️ ملخص أنظمة التطبيق</h2>
              
              {/* نظام الأدوار */}
              <div className="mb-6">
                <h3 className="font-bold text-lg text-sky-600 mb-3">👥 نظام الأدوار والصلاحيات</h3>
                <div className="grid md:grid-cols-2 gap-3 text-sm">
                  <div className="bg-gray-50 rounded-xl p-3">
                    <span className="font-bold text-purple-600">developer:</span> وصول كامل، حذف، إدارة المستخدمين
                  </div>
                  <div className="bg-gray-50 rounded-xl p-3">
                    <span className="font-bold text-amber-600">admin:</span> إضافة مطاعم (يكسب عمولة)، طلب كعميل
                  </div>
                  <div className="bg-gray-50 rounded-xl p-3">
                    <span className="font-bold text-orange-600">owner:</span> إدارة القائمة، معالجة الطلبات، توظيف المناديب
                  </div>
                  <div className="bg-gray-50 rounded-xl p-3">
                    <span className="font-bold text-emerald-600">courier:</span> استلام الطلبات الجاهزة، تحديث حالة التوصيل
                  </div>
                  <div className="bg-gray-50 rounded-xl p-3">
                    <span className="font-bold text-blue-600">customer:</span> تصفح، طلب، تتبع
                  </div>
                </div>
              </div>

              {/* مجموعات Firestore */}
              <div className="mb-6">
                <h3 className="font-bold text-lg text-green-600 mb-3">🗄️ مجموعات Firestore</h3>
                <div className="grid md:grid-cols-3 gap-2 text-sm">
                  <div className="bg-green-50 rounded-lg p-2">📁 users/{'{uid}'}</div>
                  <div className="bg-green-50 rounded-lg p-2">📁 restaurants/{'{ownerId}'}</div>
                  <div className="bg-green-50 rounded-lg p-2">📁 menuItems/{'{auto}'}</div>
                  <div className="bg-green-50 rounded-lg p-2">📁 orders/{'{auto}'}</div>
                  <div className="bg-green-50 rounded-lg p-2">📁 orders/{'{id}'}/messages</div>
                  <div className="bg-green-50 rounded-lg p-2">📁 wallets/{'{adminId}'}</div>
                  <div className="bg-green-50 rounded-lg p-2">📁 hiringRequests/{'{auto}'}</div>
                  <div className="bg-green-50 rounded-lg p-2">📁 notifications/{'{auto}'}</div>
                  <div className="bg-green-50 rounded-lg p-2">📁 promotions/{'{auto}'}</div>
                  <div className="bg-green-50 rounded-lg p-2">📁 tasks/{'{auto}'}</div>
                  <div className="bg-green-50 rounded-lg p-2">📁 settings/{'{doc}'}</div>
                </div>
              </div>

              {/* نظام الرسوم والعمولات */}
              <div className="mb-6">
                <h3 className="font-bold text-lg text-amber-600 mb-3">💰 نظام الرسوم والعمولات</h3>
                <div className="grid md:grid-cols-2 gap-3 text-sm">
                  <div className="bg-amber-50 rounded-xl p-3">
                    <span className="font-bold">رسوم المنصة (platformFee):</span> 1.75 ريال لكل منتج (0.25 للمنتجات ≤2 ريال)
                  </div>
                  <div className="bg-amber-50 rounded-xl p-3">
                    <span className="font-bold">عمولة المشرف (adminCommission):</span> 0.5 ريال (إذا المطعم مسجل عن طريق admin)
                  </div>
                  <div className="bg-amber-50 rounded-xl p-3">
                    <span className="font-bold">رسوم المندوب:</span> 2-3 ريال لكل طلب
                  </div>
                  <div className="bg-amber-50 rounded-xl p-3">
                    <span className="font-bold">محافظ المشرفين:</span> wallets/{'{adminId}'} لتتبع العمولات
                  </div>
                </div>
              </div>

              {/* نظام الطلبات */}
              <div className="mb-6">
                <h3 className="font-bold text-lg text-blue-600 mb-3">📦 نظام الطلبات</h3>
                <div className="bg-blue-50 rounded-xl p-4">
                  <div className="flex flex-wrap gap-2 items-center justify-center text-sm">
                    <span className="bg-gray-200 px-3 py-1 rounded-full">pending</span>
                    <span>→</span>
                    <span className="bg-yellow-200 px-3 py-1 rounded-full">accepted</span>
                    <span>→</span>
                    <span className="bg-orange-200 px-3 py-1 rounded-full">preparing</span>
                    <span>→</span>
                    <span className="bg-cyan-200 px-3 py-1 rounded-full">ready</span>
                    <span>→</span>
                    <span className="bg-purple-200 px-3 py-1 rounded-full">out_for_delivery</span>
                    <span>→</span>
                    <span className="bg-green-200 px-3 py-1 rounded-full">delivered</span>
                  </div>
                  <p className="text-center text-gray-500 mt-2 text-xs">أو cancelled ❌</p>
                </div>
              </div>

              {/* الصفحات والشروط */}
              <div className="mb-6">
                <h3 className="font-bold text-lg text-purple-600 mb-3">📄 الصفحات القانونية</h3>
                <div className="grid md:grid-cols-3 gap-3 text-sm">
                  <a href="/terms" target="_blank" className="bg-purple-50 rounded-xl p-3 hover:bg-purple-100 transition-colors flex items-center gap-2">
                    <ExternalLink className="w-4 h-4" />
                    شروط الأسر المنتجة
                  </a>
                  <a href="/courier-terms" target="_blank" className="bg-purple-50 rounded-xl p-3 hover:bg-purple-100 transition-colors flex items-center gap-2">
                    <ExternalLink className="w-4 h-4" />
                    شروط المندوب
                  </a>
                  <a href="/privacy-policy" target="_blank" className="bg-purple-50 rounded-xl p-3 hover:bg-purple-100 transition-colors flex items-center gap-2">
                    <ExternalLink className="w-4 h-4" />
                    سياسة الخصوصية
                  </a>
                </div>
              </div>

              {/* الميزات الرئيسية */}
              <div>
                <h3 className="font-bold text-lg text-rose-600 mb-3">✨ الميزات الرئيسية</h3>
                <div className="grid md:grid-cols-2 gap-2 text-sm">
                  <div className="flex items-center gap-2 bg-gray-50 rounded-lg p-2">
                    <CheckCircle className="w-4 h-4 text-green-500" /> تسجيل الأسر المنتجة مع موافقة على الشروط
                  </div>
                  <div className="flex items-center gap-2 bg-gray-50 rounded-lg p-2">
                    <CheckCircle className="w-4 h-4 text-green-500" /> تسجيل المناديب مع موافقة على الشروط
                  </div>
                  <div className="flex items-center gap-2 bg-gray-50 rounded-lg p-2">
                    <CheckCircle className="w-4 h-4 text-green-500" /> سلة مشتريات (localStorage)
                  </div>
                  <div className="flex items-center gap-2 bg-gray-50 rounded-lg p-2">
                    <CheckCircle className="w-4 h-4 text-green-500" /> تتبع الطلبات في الوقت الفعلي
                  </div>
                  <div className="flex items-center gap-2 bg-gray-50 rounded-lg p-2">
                    <CheckCircle className="w-4 h-4 text-green-500" /> محادثة بين العميل والمندوب
                  </div>
                  <div className="flex items-center gap-2 bg-gray-50 rounded-lg p-2">
                    <CheckCircle className="w-4 h-4 text-green-500" /> نظام التوظيف (hiringRequests)
                  </div>
                  <div className="flex items-center gap-2 bg-gray-50 rounded-lg p-2">
                    <CheckCircle className="w-4 h-4 text-green-500" /> الإعلانات الممولة (promotions)
                  </div>
                  <div className="flex items-center gap-2 bg-gray-50 rounded-lg p-2">
                    <CheckCircle className="w-4 h-4 text-green-500" /> نظام الإشعارات
                  </div>
                  <div className="flex items-center gap-2 bg-gray-50 rounded-lg p-2">
                    <CheckCircle className="w-4 h-4 text-green-500" /> باقات المطاعم (free/premium)
                  </div>
                  <div className="flex items-center gap-2 bg-gray-50 rounded-lg p-2">
                    <CheckCircle className="w-4 h-4 text-green-500" /> تصنيف البائعين (bronze/silver/gold)
                  </div>
                  <div className="flex items-center gap-2 bg-gray-50 rounded-lg p-2">
                    <CheckCircle className="w-4 h-4 text-green-500" /> مهام المشرفين (tasks)
                  </div>
                  <div className="flex items-center gap-2 bg-gray-50 rounded-lg p-2">
                    <CheckCircle className="w-4 h-4 text-green-500" /> تحديد الموقع عبر GPS
                  </div>
                </div>
              </div>
            </div>

            {/* إحصائيات الباقات والإعلانات */}
            <div className="bg-white rounded-2xl shadow-lg p-6">
              <h2 className="text-xl font-bold mb-4">📊 إحصائيات الباقات والإعلانات</h2>
              
              <div className="grid md:grid-cols-2 gap-6">
                {/* الباقات */}
                <div>
                  <h3 className="font-bold text-lg text-purple-600 mb-3">📦 باقات المطاعم</h3>
                  {(() => {
                    const freeRestaurants = restaurants.filter(r => !r.packageType || r.packageType === 'free')
                    const premiumRestaurants = restaurants.filter(r => r.packageType === 'premium')
                    const pendingUpgrade = restaurants.filter(r => r.packageRequest === 'premium')
                    return (
                      <div className="space-y-3">
                        <div className="flex justify-between items-center bg-gray-50 rounded-xl p-3">
                          <span className="flex items-center gap-2">
                            <Package className="w-5 h-5 text-gray-500" />
                            باقة مجانية (Free)
                          </span>
                          <span className="font-bold text-2xl text-gray-600">{freeRestaurants.length}</span>
                        </div>
                        <div className="flex justify-between items-center bg-gradient-to-r from-amber-50 to-yellow-50 rounded-xl p-3 border border-amber-200">
                          <span className="flex items-center gap-2">
                            <Package className="w-5 h-5 text-amber-500" />
                            باقة مميزة (Premium)
                          </span>
                          <span className="font-bold text-2xl text-amber-600">{premiumRestaurants.length}</span>
                        </div>
                        {pendingUpgrade.length > 0 && (
                          <div className="flex justify-between items-center bg-blue-50 rounded-xl p-3 border border-blue-200">
                            <span className="flex items-center gap-2">
                              <Clock className="w-5 h-5 text-blue-500" />
                              طلبات ترقية معلقة
                            </span>
                            <span className="font-bold text-2xl text-blue-600">{pendingUpgrade.length}</span>
                          </div>
                        )}
                        {/* قائمة المشتركين بالباقة المميزة */}
                        {premiumRestaurants.length > 0 && (
                          <div className="mt-4">
                            <p className="text-sm font-semibold text-amber-700 mb-2">المشتركين في الباقة المميزة:</p>
                            <div className="space-y-2 max-h-40 overflow-y-auto">
                              {premiumRestaurants.map(r => (
                                <div key={r.id} className="text-sm bg-amber-50 rounded-lg p-2 flex justify-between">
                                  <span>{r.name}</span>
                                  <span className="text-gray-500">{r.city || '-'}</span>
                                </div>
                              ))}
                            </div>
                          </div>
                        )}
                      </div>
                    )
                  })()}
                </div>

                {/* الإعلانات */}
                <div>
                  <h3 className="font-bold text-lg text-pink-600 mb-3">📢 الإعلانات الممولة</h3>
                  {(() => {
                    const activePromos = promotions.filter(p => p.isActive)
                    const paidPromos = promotions.filter(p => p.isPaid)
                    const totalPromoRevenue = promotions.reduce((sum, p) => sum + (p.isPaid ? (p.price || 0) : 0), 0)
                    const totalViews = promotions.reduce((sum, p) => sum + (p.viewsCount || 0), 0)
                    return (
                      <div className="space-y-3">
                        <div className="flex justify-between items-center bg-gray-50 rounded-xl p-3">
                          <span>إجمالي الإعلانات</span>
                          <span className="font-bold text-2xl">{promotions.length}</span>
                        </div>
                        <div className="flex justify-between items-center bg-green-50 rounded-xl p-3 border border-green-200">
                          <span className="flex items-center gap-2">
                            <CheckCircle className="w-5 h-5 text-green-500" />
                            إعلانات نشطة
                          </span>
                          <span className="font-bold text-2xl text-green-600">{activePromos.length}</span>
                        </div>
                        <div className="flex justify-between items-center bg-emerald-50 rounded-xl p-3 border border-emerald-200">
                          <span className="flex items-center gap-2">
                            <Wallet className="w-5 h-5 text-emerald-500" />
                            إعلانات مدفوعة
                          </span>
                          <span className="font-bold text-2xl text-emerald-600">{paidPromos.length}</span>
                        </div>
                        <div className="bg-gradient-to-r from-green-500 to-emerald-600 rounded-xl p-4 text-white">
                          <p className="text-sm opacity-90">💰 أرباح الإعلانات</p>
                          <p className="text-3xl font-bold">{totalPromoRevenue.toFixed(2)} ر.س</p>
                        </div>
                        <div className="flex justify-between items-center bg-purple-50 rounded-xl p-3">
                          <span>👁️ إجمالي المشاهدات</span>
                          <span className="font-bold text-xl text-purple-600">{totalViews}</span>
                        </div>
                        {/* قائمة الإعلانات النشطة */}
                        {activePromos.length > 0 && (
                          <div className="mt-4">
                            <p className="text-sm font-semibold text-pink-700 mb-2">الإعلانات النشطة:</p>
                            <div className="space-y-2 max-h-40 overflow-y-auto">
                              {activePromos.map(p => (
                                <div key={p.id} className="text-sm bg-pink-50 rounded-lg p-2">
                                  <div className="flex justify-between">
                                    <span className="font-medium">{p.title || 'إعلان'}</span>
                                    <span className="text-green-600">{p.price || 0} ر.س</span>
                                  </div>
                                  <div className="text-xs text-gray-500 flex justify-between mt-1">
                                    <span>👁️ {p.viewsCount || 0} مشاهدة</span>
                                    <span>{p.isPaid ? '✅ مدفوع' : '⏳ غير مدفوع'}</span>
                                  </div>
                                </div>
                              ))}
                            </div>
                          </div>
                        )}
                      </div>
                    )
                  })()}
                </div>
              </div>
            </div>
          </div>
        )}

        {/* ===== المالية ===== */}
        {activeTab === 'finance' && (
          <div className="space-y-6">
            {(() => {
              const financeStats = getFinanceStats()
              return (
                <>
                  {/* ملخص مالي */}
                  <div className="bg-gradient-to-r from-green-600 to-emerald-700 rounded-2xl shadow-lg p-6 text-white">
                    <h2 className="text-2xl font-bold mb-4">💰 الملخص المالي</h2>
                    <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                      <div className="bg-white/20 rounded-xl p-4 text-center">
                        <p className="text-3xl font-bold">{financeStats.totalRevenue.toFixed(0)}</p>
                        <p className="text-sm opacity-90">إجمالي المبيعات (ر.س)</p>
                      </div>
                      <div className="bg-white/20 rounded-xl p-4 text-center">
                        <p className="text-3xl font-bold">{financeStats.totalPlatformFee.toFixed(2)}</p>
                        <p className="text-sm opacity-90">رسوم التطبيق (ر.س)</p>
                      </div>
                      <div className="bg-white/20 rounded-xl p-4 text-center">
                        <p className="text-3xl font-bold">{financeStats.totalAdminCommission.toFixed(2)}</p>
                        <p className="text-sm opacity-90">عمولات المشرفين (ر.س)</p>
                      </div>
                      <div className="bg-white/20 rounded-xl p-4 text-center">
                        <p className="text-3xl font-bold">{(financeStats.totalPlatformFee + financeStats.totalAdminCommission).toFixed(2)}</p>
                        <p className="text-sm opacity-90">إجمالي الأرباح (ر.س)</p>
                      </div>
                    </div>
                  </div>

                  {/* إحصائيات زمنية */}
                  <div className="grid md:grid-cols-3 gap-6">
                    {/* اليوم */}
                    <div className="bg-white rounded-2xl shadow-lg p-6">
                      <h3 className="text-lg font-bold text-blue-600 mb-4">📅 اليوم</h3>
                      <div className="space-y-3">
                        <div className="flex justify-between">
                          <span className="text-gray-600">الطلبات:</span>
                          <span className="font-bold">{financeStats.todayOrders}</span>
                        </div>
                        <div className="flex justify-between">
                          <span className="text-gray-600">المبيعات:</span>
                          <span className="font-bold">{financeStats.todayRevenue.toFixed(2)} ر.س</span>
                        </div>
                        <div className="flex justify-between">
                          <span className="text-gray-600">رسوم التطبيق:</span>
                          <span className="font-bold text-green-600">{financeStats.todayPlatformFee.toFixed(2)} ر.س</span>
                        </div>
                      </div>
                    </div>

                    {/* الأسبوع */}
                    <div className="bg-white rounded-2xl shadow-lg p-6">
                      <h3 className="text-lg font-bold text-purple-600 mb-4">📅 آخر 7 أيام</h3>
                      <div className="space-y-3">
                        <div className="flex justify-between">
                          <span className="text-gray-600">الطلبات:</span>
                          <span className="font-bold">{financeStats.weekOrders}</span>
                        </div>
                        <div className="flex justify-between">
                          <span className="text-gray-600">المبيعات:</span>
                          <span className="font-bold">{financeStats.weekRevenue.toFixed(2)} ر.س</span>
                        </div>
                        <div className="flex justify-between">
                          <span className="text-gray-600">رسوم التطبيق:</span>
                          <span className="font-bold text-green-600">{financeStats.weekPlatformFee.toFixed(2)} ر.س</span>
                        </div>
                      </div>
                    </div>

                    {/* الشهر */}
                    <div className="bg-white rounded-2xl shadow-lg p-6">
                      <h3 className="text-lg font-bold text-orange-600 mb-4">📅 آخر 30 يوم</h3>
                      <div className="space-y-3">
                        <div className="flex justify-between">
                          <span className="text-gray-600">الطلبات:</span>
                          <span className="font-bold">{financeStats.monthOrders}</span>
                        </div>
                        <div className="flex justify-between">
                          <span className="text-gray-600">المبيعات:</span>
                          <span className="font-bold">{financeStats.monthRevenue.toFixed(2)} ر.س</span>
                        </div>
                        <div className="flex justify-between">
                          <span className="text-gray-600">رسوم التطبيق:</span>
                          <span className="font-bold text-green-600">{financeStats.monthPlatformFee.toFixed(2)} ر.س</span>
                        </div>
                      </div>
                    </div>
                  </div>

                  {/* أعلى المطاعم أداءً */}
                  <div className="bg-white rounded-2xl shadow-lg p-6">
                    <h3 className="text-lg font-bold mb-4">🏆 أعلى المطاعم أداءً</h3>
                    <div className="space-y-3">
                      {restaurants
                        .map(r => ({
                          ...r,
                          ordersCount: orders.filter(o => o.restaurantId === r.id && o.status === 'delivered').length,
                          revenue: orders.filter(o => o.restaurantId === r.id && o.status === 'delivered').reduce((sum, o) => sum + (o.total || 0), 0),
                        }))
                        .sort((a, b) => b.revenue - a.revenue)
                        .slice(0, 5)
                        .map((r, i) => (
                          <div key={r.id} className="flex items-center justify-between bg-gray-50 rounded-xl p-3">
                            <div className="flex items-center gap-3">
                              <span className="text-2xl">{i === 0 ? '🥇' : i === 1 ? '🥈' : i === 2 ? '🥉' : `#${i + 1}`}</span>
                              <div>
                                <p className="font-bold">{r.name}</p>
                                <p className="text-sm text-gray-500">{r.ordersCount} طلب</p>
                              </div>
                            </div>
                            <p className="font-bold text-green-600">{r.revenue.toFixed(2)} ر.س</p>
                          </div>
                        ))}
                    </div>
                  </div>
                </>
              )
            })()}
          </div>
        )}

        {/* ===== المطاعم ===== */}
        {activeTab === 'restaurants' && (
          <div className="space-y-4">
            <div className="flex items-center justify-between flex-wrap gap-4">
              <h2 className="text-xl font-bold">🏪 جميع المطاعم ({restaurants.length})</h2>
              <button
                onClick={() => setShowAddRestaurant(!showAddRestaurant)}
                className="flex items-center gap-2 bg-green-600 hover:bg-green-700 text-white px-4 py-2 rounded-xl font-semibold"
              >
                {showAddRestaurant ? '❌ إلغاء' : '➕ إضافة مطعم'}
              </button>
            </div>

            {/* نموذج إضافة مطعم */}
            {showAddRestaurant && (
              <div className="bg-green-50 rounded-2xl p-6 border-2 border-green-200">
                <h3 className="text-lg font-bold text-green-800 mb-4">🏪 إضافة مطعم جديد</h3>
                <div className="grid md:grid-cols-2 gap-4">
                  <div>
                    <label className="text-sm text-gray-600 block mb-1">اسم المطعم *</label>
                    <input
                      type="text"
                      placeholder="مثال: مطعم الشام"
                      value={newRestaurantName}
                      onChange={e => setNewRestaurantName(e.target.value)}
                      className="w-full border rounded-xl p-3"
                    />
                  </div>
                  <div>
                    <label className="text-sm text-gray-600 block mb-1">المدينة</label>
                    <input
                      type="text"
                      placeholder="مثال: الرياض"
                      value={newRestaurantCity}
                      onChange={e => setNewRestaurantCity(e.target.value)}
                      className="w-full border rounded-xl p-3"
                    />
                  </div>
                  <div>
                    <label className="text-sm text-gray-600 block mb-1">هاتف المطعم</label>
                    <input
                      type="tel"
                      placeholder="05xxxxxxxx"
                      value={newRestaurantPhone}
                      onChange={e => setNewRestaurantPhone(e.target.value)}
                      className="w-full border rounded-xl p-3"
                    />
                  </div>
                  <div>
                    <label className="text-sm text-gray-600 block mb-1">إيميل المطعم</label>
                    <input
                      type="email"
                      placeholder="restaurant@example.com"
                      value={newRestaurantEmail}
                      onChange={e => setNewRestaurantEmail(e.target.value)}
                      className="w-full border rounded-xl p-3"
                    />
                  </div>
                </div>
                
                <div className="border-t mt-4 pt-4">
                  <h4 className="font-bold text-green-800 mb-3">👤 بيانات صاحب المطعم (لتسجيل الدخول)</h4>
                  <div className="grid md:grid-cols-2 gap-4">
                    <div>
                      <label className="text-sm text-gray-600 block mb-1">إيميل صاحب المطعم *</label>
                      <input
                        type="email"
                        placeholder="owner@example.com"
                        value={newRestaurantOwnerEmail}
                        onChange={e => setNewRestaurantOwnerEmail(e.target.value)}
                        className="w-full border rounded-xl p-3"
                      />
                    </div>
                    <div>
                      <label className="text-sm text-gray-600 block mb-1">كلمة المرور *</label>
                      <input
                        type="password"
                        placeholder="6 أحرف على الأقل"
                        value={newRestaurantOwnerPassword}
                        onChange={e => setNewRestaurantOwnerPassword(e.target.value)}
                        className="w-full border rounded-xl p-3"
                      />
                    </div>
                  </div>
                </div>

                <button
                  onClick={handleCreateNewRestaurant}
                  disabled={creatingRestaurant || !newRestaurantName.trim() || !newRestaurantOwnerEmail.trim() || !newRestaurantOwnerPassword.trim()}
                  className="mt-4 w-full bg-green-600 hover:bg-green-700 text-white py-3 rounded-xl font-bold disabled:opacity-50 flex items-center justify-center gap-2"
                >
                  {creatingRestaurant ? (
                    <>
                      <RefreshCw className="w-5 h-5 animate-spin" />
                      جاري الإنشاء...
                    </>
                  ) : (
                    '🏪 إنشاء المطعم'
                  )}
                </button>
              </div>
            )}
            
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
                        <div className="md:col-span-2">
                          <label className="text-sm text-gray-600">ربط بمشرف (للعمولة)</label>
                          <select
                            value={restaurantForm.referredBy || ''}
                            onChange={e => setRestaurantForm({ ...restaurantForm, referredBy: e.target.value })}
                            className="w-full border rounded-xl p-2 mt-1"
                          >
                            <option value="">-- بدون مشرف (المطور فقط) --</option>
                            {users
                              .filter(u => u.role === 'admin')
                              .map(admin => (
                                <option key={admin.uid} value={admin.uid}>
                                  👑 {admin.name || admin.email}
                                </option>
                              ))}
                          </select>
                          <p className="text-xs text-gray-500 mt-1">
                            المشرف المرتبط يحصل على عمولة من طلبات هذا المطعم
                          </p>
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
                      <div className="flex flex-col gap-2">
                        <div className="flex gap-2">
                          <button
                            onClick={() => {
                              setEditingRestaurant(restaurant.id)
                              setRestaurantForm(restaurant)
                            }}
                            className="p-2 bg-blue-100 hover:bg-blue-200 text-blue-600 rounded-xl"
                            title="تحرير"
                          >
                            <Edit3 className="w-5 h-5" />
                          </button>
                          <button
                            onClick={() => handleDeleteRestaurant(restaurant.id)}
                            className="p-2 bg-red-100 hover:bg-red-200 text-red-600 rounded-xl"
                            title="حذف"
                          >
                            <Trash2 className="w-5 h-5" />
                          </button>
                        </div>
                        {/* ربط سريع بمشرف */}
                        <select
                          value={restaurant.referredBy || ''}
                          onChange={async (e) => {
                            const newAdminId = e.target.value
                            try {
                              await updateDoc(doc(db, 'restaurants', restaurant.id), {
                                referredBy: newAdminId || null,
                                updatedAt: serverTimestamp()
                              })
                              toast.success(newAdminId ? 'تم ربط المطعم بالمشرف' : 'تم إلغاء ربط المشرف')
                              loadData()
                            } catch (err) {
                              toast.error('فشل في تحديث الربط')
                            }
                          }}
                          className="text-xs border rounded-lg p-1"
                          title="ربط بمشرف"
                        >
                          <option value="">👤 بدون مشرف</option>
                          {users
                            .filter(u => u.role === 'admin')
                            .map(admin => (
                              <option key={admin.uid} value={admin.uid}>
                                👑 {admin.name || admin.email}
                              </option>
                            ))}
                        </select>
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
            <div className="flex items-center justify-between flex-wrap gap-4">
              <h2 className="text-xl font-bold">🚗 المناديب ({stats.couriers})</h2>
              <button
                onClick={() => setShowAddCourier(!showAddCourier)}
                className="flex items-center gap-2 bg-cyan-600 hover:bg-cyan-700 text-white px-4 py-2 rounded-xl font-semibold"
              >
                {showAddCourier ? '❌ إلغاء' : '➕ إضافة مندوب'}
              </button>
            </div>

            {/* نموذج إضافة مندوب */}
            {showAddCourier && (
              <div className="bg-cyan-50 rounded-2xl p-6 border-2 border-cyan-200">
                <h3 className="text-lg font-bold text-cyan-800 mb-4">🚗 إضافة مندوب جديد</h3>
                <div className="grid md:grid-cols-2 gap-4">
                  <div>
                    <label className="text-sm text-gray-600 block mb-1">البريد الإلكتروني *</label>
                    <input
                      type="email"
                      placeholder="courier@example.com"
                      value={newCourierEmail}
                      onChange={e => setNewCourierEmail(e.target.value)}
                      className="w-full border rounded-xl p-3"
                    />
                  </div>
                  <div>
                    <label className="text-sm text-gray-600 block mb-1">كلمة المرور *</label>
                    <input
                      type="password"
                      placeholder="6 أحرف على الأقل"
                      value={newCourierPassword}
                      onChange={e => setNewCourierPassword(e.target.value)}
                      className="w-full border rounded-xl p-3"
                    />
                  </div>
                  <div>
                    <label className="text-sm text-gray-600 block mb-1">الاسم</label>
                    <input
                      type="text"
                      placeholder="اسم المندوب"
                      value={newCourierName}
                      onChange={e => setNewCourierName(e.target.value)}
                      className="w-full border rounded-xl p-3"
                    />
                  </div>
                  <div>
                    <label className="text-sm text-gray-600 block mb-1">رقم الهاتف</label>
                    <input
                      type="tel"
                      placeholder="05xxxxxxxx"
                      value={newCourierPhone}
                      onChange={e => setNewCourierPhone(e.target.value)}
                      className="w-full border rounded-xl p-3"
                    />
                  </div>
                </div>
                <button
                  onClick={handleCreateNewCourier}
                  disabled={creatingCourier || !newCourierEmail.trim() || !newCourierPassword.trim()}
                  className="mt-4 w-full bg-cyan-600 hover:bg-cyan-700 text-white py-3 rounded-xl font-bold disabled:opacity-50 flex items-center justify-center gap-2"
                >
                  {creatingCourier ? (
                    <>
                      <RefreshCw className="w-5 h-5 animate-spin" />
                      جاري الإنشاء...
                    </>
                  ) : (
                    '🚗 إنشاء حساب المندوب'
                  )}
                </button>
              </div>
            )}
            
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

        {/* ===== المهام ===== */}
        {activeTab === 'tasks' && (
          <div className="space-y-6">
            <div className="flex items-center justify-between">
              <h2 className="text-xl font-bold">📋 إدارة المهام اليومية</h2>
              <button
                onClick={() => setShowAddTask(true)}
                className="flex items-center gap-2 bg-primary hover:bg-sky-600 text-white px-4 py-2 rounded-xl font-semibold transition"
              >
                <Plus className="w-5 h-5" />
                مهمة جديدة
              </button>
            </div>

            {/* فلترة المهام */}
            <div className="flex flex-wrap gap-2">
              {(['all', 'pending', 'in_progress', 'completed', 'cancelled'] as const).map(filter => (
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
                  {filter === 'cancelled' && '❌ ملغاة'}
                </button>
              ))}
            </div>

            {/* إحصائيات المهام */}
            <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
              <div className="bg-yellow-50 rounded-xl p-4 text-center">
                <p className="text-2xl font-bold text-yellow-600">
                  {tasks.filter(t => t.status === 'pending').length}
                </p>
                <p className="text-sm text-yellow-700">قيد الانتظار</p>
              </div>
              <div className="bg-blue-50 rounded-xl p-4 text-center">
                <p className="text-2xl font-bold text-blue-600">
                  {tasks.filter(t => t.status === 'in_progress').length}
                </p>
                <p className="text-sm text-blue-700">جاري التنفيذ</p>
              </div>
              <div className="bg-green-50 rounded-xl p-4 text-center">
                <p className="text-2xl font-bold text-green-600">
                  {tasks.filter(t => t.status === 'completed').length}
                </p>
                <p className="text-sm text-green-700">مكتملة</p>
              </div>
              <div className="bg-red-50 rounded-xl p-4 text-center">
                <p className="text-2xl font-bold text-red-600">
                  {tasks.filter(t => t.status === 'cancelled').length}
                </p>
                <p className="text-sm text-red-700">ملغاة</p>
              </div>
            </div>

            {/* قائمة المهام */}
            <div className="bg-white rounded-2xl shadow-lg overflow-hidden">
              {tasks
                .filter(t => taskFilter === 'all' || t.status === taskFilter)
                .length === 0 ? (
                <div className="p-8 text-center text-gray-500">
                  <p className="text-4xl mb-2">📋</p>
                  <p>لا توجد مهام {taskFilter !== 'all' && 'في هذه الفئة'}</p>
                </div>
              ) : (
                <div className="divide-y">
                  {tasks
                    .filter(t => taskFilter === 'all' || t.status === taskFilter)
                    .map(task => {
                      const admin = users.find(u => u.uid === task.assignedTo)
                      return (
                        <div key={task.id} className="p-4 hover:bg-gray-50">
                          <div className="flex items-start justify-between gap-4">
                            <div className="flex-1">
                              <div className="flex items-center gap-2 mb-1">
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
                              <h3 className="font-bold text-gray-800">{task.title}</h3>
                              {task.description && (
                                <p className="text-sm text-gray-600 mt-1">{task.description}</p>
                              )}
                              <div className="flex flex-wrap gap-3 mt-2 text-xs text-gray-500">
                                <span>👤 {admin?.name || task.assignedToName || 'غير محدد'}</span>
                                {task.dueDate && (
                                  <span>📅 {new Date(task.dueDate).toLocaleDateString('ar-SA')}</span>
                                )}
                                <span>🕐 {task.createdAt?.toDate?.()?.toLocaleDateString('ar-SA') || 'غير محدد'}</span>
                              </div>
                              {task.notes && (
                                <p className="text-sm text-gray-500 mt-2 bg-gray-50 p-2 rounded">💬 {task.notes}</p>
                              )}
                            </div>
                            <div className="flex flex-col gap-2">
                              {task.status === 'pending' && (
                                <button
                                  onClick={async () => {
                                    try {
                                      await updateDoc(doc(db, 'tasks', task.id), {
                                        status: 'in_progress',
                                        updatedAt: serverTimestamp()
                                      })
                                      toast.success('تم بدء المهمة')
                                      loadData()
                                    } catch (err) {
                                      toast.error('فشل في تحديث المهمة')
                                    }
                                  }}
                                  className="text-blue-600 hover:bg-blue-50 p-2 rounded-lg transition"
                                  title="بدء المهمة"
                                >
                                  ▶️
                                </button>
                              )}
                              {(task.status === 'pending' || task.status === 'in_progress') && (
                                <>
                                  <button
                                    onClick={async () => {
                                      try {
                                        await updateDoc(doc(db, 'tasks', task.id), {
                                          status: 'completed',
                                          completedAt: serverTimestamp(),
                                          updatedAt: serverTimestamp()
                                        })
                                        toast.success('تم إكمال المهمة')
                                        loadData()
                                      } catch (err) {
                                        toast.error('فشل في تحديث المهمة')
                                      }
                                    }}
                                    className="text-green-600 hover:bg-green-50 p-2 rounded-lg transition"
                                    title="إكمال المهمة"
                                  >
                                    ✅
                                  </button>
                                  <button
                                    onClick={async () => {
                                      const confirmed = await dialog.confirm('هل تريد إلغاء هذه المهمة؟', { dangerous: true })
                                      if (!confirmed) return
                                      try {
                                        await updateDoc(doc(db, 'tasks', task.id), {
                                          status: 'cancelled',
                                          updatedAt: serverTimestamp()
                                        })
                                        toast.success('تم إلغاء المهمة')
                                        loadData()
                                      } catch (err) {
                                        toast.error('فشل في إلغاء المهمة')
                                      }
                                    }}
                                    className="text-red-600 hover:bg-red-50 p-2 rounded-lg transition"
                                    title="إلغاء المهمة"
                                  >
                                    ❌
                                  </button>
                                </>
                              )}
                              <button
                                onClick={async () => {
                                  const confirmed = await dialog.confirm('هل تريد حذف هذه المهمة نهائياً؟', { dangerous: true })
                                  if (!confirmed) return
                                  try {
                                    await deleteDoc(doc(db, 'tasks', task.id))
                                    toast.success('تم حذف المهمة')
                                    loadData()
                                  } catch (err) {
                                    toast.error('فشل في حذف المهمة')
                                  }
                                }}
                                className="text-gray-400 hover:text-red-600 hover:bg-red-50 p-2 rounded-lg transition"
                                title="حذف المهمة"
                              >
                                🗑️
                              </button>
                            </div>
                          </div>
                        </div>
                      )
                    })}
                </div>
              )}
            </div>

            {/* نموذج إضافة مهمة */}
            {showAddTask && (
              <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
                <div className="bg-white rounded-2xl w-full max-w-lg p-6">
                  <h3 className="text-xl font-bold mb-4">📋 إضافة مهمة جديدة</h3>
                  <div className="space-y-4">
                    <div>
                      <label className="block text-sm font-semibold mb-1">عنوان المهمة *</label>
                      <input
                        type="text"
                        value={newTaskTitle}
                        onChange={e => setNewTaskTitle(e.target.value)}
                        className="w-full border rounded-xl px-4 py-2"
                        placeholder="مثال: متابعة طلبات المطعم الجديد"
                      />
                    </div>
                    <div>
                      <label className="block text-sm font-semibold mb-1">الوصف</label>
                      <textarea
                        value={newTaskDescription}
                        onChange={e => setNewTaskDescription(e.target.value)}
                        className="w-full border rounded-xl px-4 py-2 h-24"
                        placeholder="تفاصيل المهمة..."
                      />
                    </div>
                    <div>
                      <label className="block text-sm font-semibold mb-1">تعيين إلى *</label>
                      <select
                        value={newTaskAssignedTo}
                        onChange={e => setNewTaskAssignedTo(e.target.value)}
                        className="w-full border rounded-xl px-4 py-2"
                      >
                        <option value="">-- اختر مشرف --</option>
                        {users
                          .filter(u => u.role === 'admin')
                          .map(admin => (
                            <option key={admin.uid} value={admin.uid}>
                              {admin.name || admin.email}
                            </option>
                          ))}
                      </select>
                    </div>
                    <div className="grid grid-cols-2 gap-4">
                      <div>
                        <label className="block text-sm font-semibold mb-1">الأولوية</label>
                        <select
                          value={newTaskPriority}
                          onChange={e => setNewTaskPriority(e.target.value as 'low' | 'medium' | 'high')}
                          className="w-full border rounded-xl px-4 py-2"
                        >
                          <option value="low">⚪ منخفضة</option>
                          <option value="medium">🟡 متوسطة</option>
                          <option value="high">🔴 عالية</option>
                        </select>
                      </div>
                      <div>
                        <label className="block text-sm font-semibold mb-1">تاريخ الاستحقاق</label>
                        <input
                          type="date"
                          value={newTaskDueDate}
                          onChange={e => setNewTaskDueDate(e.target.value)}
                          className="w-full border rounded-xl px-4 py-2"
                        />
                      </div>
                    </div>
                  </div>
                  <div className="flex gap-3 mt-6">
                    <button
                      onClick={() => {
                        setShowAddTask(false)
                        setNewTaskTitle('')
                        setNewTaskDescription('')
                        setNewTaskAssignedTo('')
                        setNewTaskPriority('medium')
                        setNewTaskDueDate('')
                      }}
                      className="flex-1 bg-gray-100 hover:bg-gray-200 text-gray-700 py-2 rounded-xl font-semibold transition"
                    >
                      إلغاء
                    </button>
                    <button
                      onClick={async () => {
                        if (!newTaskTitle.trim() || !newTaskAssignedTo) {
                          toast.error('يرجى ملء الحقول المطلوبة')
                          return
                        }
                        setCreatingTask(true)
                        try {
                          const assignedAdmin = users.find(u => u.uid === newTaskAssignedTo)
                          await addDoc(collection(db, 'tasks'), {
                            title: newTaskTitle.trim(),
                            description: newTaskDescription.trim(),
                            assignedTo: newTaskAssignedTo,
                            assignedToName: assignedAdmin?.name || assignedAdmin?.email || '',
                            status: 'pending',
                            priority: newTaskPriority,
                            dueDate: newTaskDueDate || null,
                            createdBy: user?.uid,
                            createdAt: serverTimestamp(),
                            updatedAt: serverTimestamp(),
                            completedAt: null,
                            notes: ''
                          })
                          toast.success('تم إنشاء المهمة بنجاح')
                          setShowAddTask(false)
                          setNewTaskTitle('')
                          setNewTaskDescription('')
                          setNewTaskAssignedTo('')
                          setNewTaskPriority('medium')
                          setNewTaskDueDate('')
                          loadData()
                        } catch (err) {
                          console.error(err)
                          toast.error('فشل في إنشاء المهمة')
                        } finally {
                          setCreatingTask(false)
                        }
                      }}
                      disabled={creatingTask}
                      className="flex-1 bg-primary hover:bg-sky-600 text-white py-2 rounded-xl font-semibold transition disabled:opacity-50"
                    >
                      {creatingTask ? 'جارِ الإنشاء...' : 'إنشاء المهمة'}
                    </button>
                  </div>
                </div>
              </div>
            )}
          </div>
        )}

        {/* ===== الأدوات ===== */}
        {activeTab === 'tools' && (
          <div className="space-y-6">
            <h2 className="text-xl font-bold">🛠️ أدوات النظام</h2>

            {/* أدوات إدارة البيانات */}
            <div className="bg-white rounded-2xl shadow-lg p-6">
              <h3 className="text-lg font-bold mb-4">📊 إدارة البيانات</h3>
              <div className="grid md:grid-cols-2 lg:grid-cols-3 gap-4">
                {/* تصدير البيانات */}
                <button
                  onClick={() => {
                    const data = {
                      exportDate: new Date().toISOString(),
                      users: users.length,
                      restaurants: restaurants.length,
                      orders: orders.length,
                      admins: admins.length,
                      stats,
                      settings,
                    }
                    const blob = new Blob([JSON.stringify(data, null, 2)], { type: 'application/json' })
                    const url = URL.createObjectURL(blob)
                    const a = document.createElement('a')
                    a.href = url
                    a.download = `app-data-${new Date().toISOString().split('T')[0]}.json`
                    a.click()
                    toast.success('تم تصدير البيانات بنجاح')
                  }}
                  className="flex items-center gap-3 bg-blue-100 hover:bg-blue-200 text-blue-800 p-4 rounded-xl transition"
                >
                  <span className="text-2xl">📥</span>
                  <div className="text-right">
                    <p className="font-bold">تصدير البيانات</p>
                    <p className="text-xs opacity-75">تحميل ملخص JSON</p>
                  </div>
                </button>

                {/* تصدير الطلبات */}
                <button
                  onClick={() => {
                    const csv = [
                      ['رقم الطلب', 'المطعم', 'المبلغ', 'الحالة', 'التاريخ'].join(','),
                      ...orders.map(o => [
                        o.id.slice(-8),
                        o.restaurantName || 'غير محدد',
                        o.total,
                        o.status,
                        o.createdAt?.toDate?.()?.toLocaleDateString('ar-SA') || ''
                      ].join(','))
                    ].join('\n')
                    const blob = new Blob(['\ufeff' + csv], { type: 'text/csv;charset=utf-8' })
                    const url = URL.createObjectURL(blob)
                    const a = document.createElement('a')
                    a.href = url
                    a.download = `orders-${new Date().toISOString().split('T')[0]}.csv`
                    a.click()
                    toast.success('تم تصدير الطلبات بنجاح')
                  }}
                  className="flex items-center gap-3 bg-green-100 hover:bg-green-200 text-green-800 p-4 rounded-xl transition"
                >
                  <span className="text-2xl">📋</span>
                  <div className="text-right">
                    <p className="font-bold">تصدير الطلبات</p>
                    <p className="text-xs opacity-75">ملف CSV للإكسل</p>
                  </div>
                </button>

                {/* تصدير المستخدمين */}
                <button
                  onClick={() => {
                    const csv = [
                      ['الاسم', 'الإيميل', 'الدور', 'الهاتف'].join(','),
                      ...users.map(u => [
                        u.name || 'بدون اسم',
                        u.email,
                        u.role,
                        u.phone || ''
                      ].join(','))
                    ].join('\n')
                    const blob = new Blob(['\ufeff' + csv], { type: 'text/csv;charset=utf-8' })
                    const url = URL.createObjectURL(blob)
                    const a = document.createElement('a')
                    a.href = url
                    a.download = `users-${new Date().toISOString().split('T')[0]}.csv`
                    a.click()
                    toast.success('تم تصدير المستخدمين بنجاح')
                  }}
                  className="flex items-center gap-3 bg-purple-100 hover:bg-purple-200 text-purple-800 p-4 rounded-xl transition"
                >
                  <span className="text-2xl">👥</span>
                  <div className="text-right">
                    <p className="font-bold">تصدير المستخدمين</p>
                    <p className="text-xs opacity-75">ملف CSV للإكسل</p>
                  </div>
                </button>
              </div>
            </div>

            {/* أدوات الصيانة */}
            <div className="bg-white rounded-2xl shadow-lg p-6">
              <h3 className="text-lg font-bold mb-4">🔧 أدوات الصيانة</h3>
              <div className="grid md:grid-cols-2 gap-4">
                {/* إلغاء جميع الطلبات المعلقة */}
                <button
                  onClick={async () => {
                    const pendingOrders = orders.filter(o => o.status === 'pending')
                    if (pendingOrders.length === 0) {
                      toast.info('لا توجد طلبات معلقة')
                      return
                    }
                    const confirmed = await dialog.confirm(
                      `سيتم إلغاء ${pendingOrders.length} طلب معلق. هل أنت متأكد؟`,
                      { title: 'إلغاء الطلبات المعلقة', dangerous: true }
                    )
                    if (!confirmed) return
                    try {
                      await Promise.all(pendingOrders.map(o => 
                        updateDoc(doc(db, 'orders', o.id), { status: 'cancelled', updatedAt: serverTimestamp() })
                      ))
                      toast.success(`تم إلغاء ${pendingOrders.length} طلب`)
                      loadData()
                    } catch (err) {
                      toast.error('فشل في إلغاء الطلبات')
                    }
                  }}
                  className="flex items-center gap-3 bg-yellow-100 hover:bg-yellow-200 text-yellow-800 p-4 rounded-xl transition"
                >
                  <span className="text-2xl">⏳</span>
                  <div className="text-right">
                    <p className="font-bold">إلغاء الطلبات المعلقة</p>
                    <p className="text-xs opacity-75">{orders.filter(o => o.status === 'pending').length} طلب معلق</p>
                  </div>
                </button>

                {/* تنظيف الطلبات القديمة */}
                <button
                  onClick={async () => {
                    const oldDate = new Date()
                    oldDate.setMonth(oldDate.getMonth() - 3)
                    const oldOrders = orders.filter(o => {
                      const orderDate = o.createdAt?.toDate?.() || new Date()
                      return orderDate < oldDate && (o.status === 'delivered' || o.status === 'cancelled')
                    })
                    if (oldOrders.length === 0) {
                      toast.info('لا توجد طلبات قديمة')
                      return
                    }
                    const confirmed = await dialog.confirm(
                      `سيتم حذف ${oldOrders.length} طلب قديم (أكثر من 3 أشهر). هل أنت متأكد؟`,
                      { title: 'حذف الطلبات القديمة', dangerous: true }
                    )
                    if (!confirmed) return
                    try {
                      await Promise.all(oldOrders.map(o => deleteDoc(doc(db, 'orders', o.id))))
                      toast.success(`تم حذف ${oldOrders.length} طلب قديم`)
                      loadData()
                    } catch (err) {
                      toast.error('فشل في حذف الطلبات')
                    }
                  }}
                  className="flex items-center gap-3 bg-orange-100 hover:bg-orange-200 text-orange-800 p-4 rounded-xl transition"
                >
                  <span className="text-2xl">🗑️</span>
                  <div className="text-right">
                    <p className="font-bold">تنظيف الطلبات القديمة</p>
                    <p className="text-xs opacity-75">حذف أقدم من 3 أشهر</p>
                  </div>
                </button>
              </div>
            </div>

            {/* روابط سريعة */}
            <div className="bg-white rounded-2xl shadow-lg p-6">
              <h3 className="text-lg font-bold mb-4">🔗 روابط سريعة</h3>
              <div className="grid md:grid-cols-2 lg:grid-cols-4 gap-4">
                <a
                  href={`https://console.firebase.google.com/project/${firebaseConfig.projectId}/firestore`}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="flex items-center gap-3 bg-blue-50 hover:bg-blue-100 text-blue-800 p-4 rounded-xl transition"
                >
                  <span className="text-2xl">📊</span>
                  <span className="font-semibold">Firestore</span>
                </a>
                <a
                  href={`https://console.firebase.google.com/project/${firebaseConfig.projectId}/authentication/users`}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="flex items-center gap-3 bg-green-50 hover:bg-green-100 text-green-800 p-4 rounded-xl transition"
                >
                  <span className="text-2xl">🔐</span>
                  <span className="font-semibold">Authentication</span>
                </a>
                <a
                  href={`https://console.firebase.google.com/project/${firebaseConfig.projectId}/storage`}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="flex items-center gap-3 bg-purple-50 hover:bg-purple-100 text-purple-800 p-4 rounded-xl transition"
                >
                  <span className="text-2xl">📁</span>
                  <span className="font-semibold">Storage</span>
                </a>
                <a
                  href={`https://console.firebase.google.com/project/${firebaseConfig.projectId}/hosting`}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="flex items-center gap-3 bg-orange-50 hover:bg-orange-100 text-orange-800 p-4 rounded-xl transition"
                >
                  <span className="text-2xl">🌐</span>
                  <span className="font-semibold">Hosting</span>
                </a>
              </div>
            </div>

            {/* معلومات النظام */}
            <div className="bg-gray-50 rounded-2xl p-6">
              <h3 className="text-lg font-bold mb-4">ℹ️ معلومات النظام</h3>
              <div className="grid md:grid-cols-2 gap-4 text-sm">
                <div>
                  <p className="text-gray-500">Project ID</p>
                  <p className="font-mono">{firebaseConfig.projectId}</p>
                </div>
                <div>
                  <p className="text-gray-500">Storage Bucket</p>
                  <p className="font-mono">{firebaseConfig.storageBucket}</p>
                </div>
                <div>
                  <p className="text-gray-500">إصدار التطبيق</p>
                  <p className="font-bold">{settings.appVersion || '1.0.0'}</p>
                </div>
                <div>
                  <p className="text-gray-500">وضع الصيانة</p>
                  <p className={`font-bold ${settings.maintenanceMode ? 'text-red-600' : 'text-green-600'}`}>
                    {settings.maintenanceMode ? '🔴 مفعّل' : '🟢 معطّل'}
                  </p>
                </div>
              </div>
            </div>
          </div>
        )}

        {/* ===== مراجعة التراخيص ===== */}
        {activeTab === 'licenses' && (
          <LicensesReviewSection 
            restaurants={restaurants} 
            onUpdate={handleRefresh}
            toast={toast}
            dialog={dialog}
          />
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

// ===== مكون مراجعة التراخيص =====
type LicenseRestaurant = {
  id: string
  name: string
  ownerId: string
  email?: string
  phone?: string
  city?: string
  commercialLicenseUrl?: string
  licenseStatus?: 'pending' | 'approved' | 'rejected'
  licenseNotes?: string
}

const LicensesReviewSection: React.FC<{
  restaurants: any[]
  onUpdate: () => void
  toast: any
  dialog: any
}> = ({ restaurants, onUpdate, toast, dialog }) => {
  const [filter, setFilter] = useState<'all' | 'pending' | 'approved' | 'rejected' | 'missing'>('pending')
  const [reviewNotes, setReviewNotes] = useState<Record<string, string>>({})
  const [updating, setUpdating] = useState<string | null>(null)
  const [messageText, setMessageText] = useState('')
  const [sendingTo, setSendingTo] = useState<string | null>(null)
  const [selectedMissing, setSelectedMissing] = useState<Set<string>>(new Set())
  const [bulkMessage, setBulkMessage] = useState('')
  const [sendingBulk, setSendingBulk] = useState(false)

  // المطاعم التي لديها تراخيص
  const restaurantsWithLicenses = restaurants.filter(
    (r: LicenseRestaurant) => r.commercialLicenseUrl
  ) as LicenseRestaurant[]

  // المطاعم التي لم ترفع التراخيص
  const restaurantsWithoutLicenses = restaurants.filter(
    (r: LicenseRestaurant) => !r.commercialLicenseUrl
  ) as LicenseRestaurant[]

  // فلترة حسب الحالة
  const filteredRestaurants = restaurantsWithLicenses.filter((r: LicenseRestaurant) => {
    if (filter === 'all') return true
    if (filter === 'missing') return false // يتم عرضها في قسم منفصل
    return r.licenseStatus === filter || (!r.licenseStatus && filter === 'pending')
  })

  // عدد كل حالة
  const counts = {
    all: restaurantsWithLicenses.length,
    pending: restaurantsWithLicenses.filter(r => !r.licenseStatus || r.licenseStatus === 'pending').length,
    approved: restaurantsWithLicenses.filter(r => r.licenseStatus === 'approved').length,
    rejected: restaurantsWithLicenses.filter(r => r.licenseStatus === 'rejected').length,
    missing: restaurantsWithoutLicenses.length,
  }

  // إرسال رسالة لمطعم واحد
  const sendMessageToRestaurant = async (restaurant: LicenseRestaurant, message: string) => {
    if (!message.trim()) {
      toast.warning('يرجى كتابة الرسالة')
      return
    }

    setSendingTo(restaurant.id)
    try {
      await addDoc(collection(db, 'notifications'), {
        type: 'license_reminder',
        recipientId: restaurant.ownerId,
        recipientType: 'owner',
        restaurantId: restaurant.id,
        restaurantName: restaurant.name,
        title: '⚠️ تذكير: رفع الترخيص التجاري',
        message: message,
        read: false,
        createdAt: serverTimestamp(),
      })
      toast.success(`تم إرسال الرسالة لـ ${restaurant.name}`)
      setMessageText('')
    } catch (err: any) {
      toast.error('فشل إرسال الرسالة: ' + (err.message || 'خطأ غير معروف'))
    } finally {
      setSendingTo(null)
    }
  }

  // إرسال رسالة جماعية
  const sendBulkMessage = async () => {
    if (!bulkMessage.trim()) {
      toast.warning('يرجى كتابة الرسالة')
      return
    }
    
    const targets = selectedMissing.size > 0 
      ? restaurantsWithoutLicenses.filter(r => selectedMissing.has(r.id))
      : restaurantsWithoutLicenses

    if (targets.length === 0) {
      toast.warning('لا توجد مطاعم لإرسال الرسالة')
      return
    }

    const confirmed = await dialog.confirm(
      `هل أنت متأكد من إرسال الرسالة لـ ${targets.length} مطعم؟`,
      { title: 'إرسال رسالة جماعية' }
    )
    if (!confirmed) return

    setSendingBulk(true)
    try {
      const promises = targets.map(restaurant => 
        addDoc(collection(db, 'notifications'), {
          type: 'license_reminder',
          recipientId: restaurant.ownerId,
          recipientType: 'owner',
          restaurantId: restaurant.id,
          restaurantName: restaurant.name,
          title: '⚠️ تذكير: رفع الترخيص التجاري',
          message: bulkMessage,
          read: false,
          createdAt: serverTimestamp(),
        })
      )
      await Promise.all(promises)
      toast.success(`تم إرسال الرسالة لـ ${targets.length} مطعم بنجاح ✓`)
      setBulkMessage('')
      setSelectedMissing(new Set())
    } catch (err: any) {
      toast.error('فشل إرسال بعض الرسائل: ' + (err.message || 'خطأ غير معروف'))
    } finally {
      setSendingBulk(false)
    }
  }

  // تحديد/إلغاء تحديد الكل
  const toggleSelectAll = () => {
    if (selectedMissing.size === restaurantsWithoutLicenses.length) {
      setSelectedMissing(new Set())
    } else {
      setSelectedMissing(new Set(restaurantsWithoutLicenses.map(r => r.id)))
    }
  }

  // تبديل تحديد مطعم
  const toggleSelectRestaurant = (id: string) => {
    const newSet = new Set(selectedMissing)
    if (newSet.has(id)) {
      newSet.delete(id)
    } else {
      newSet.add(id)
    }
    setSelectedMissing(newSet)
  }

  // تحديث حالة الترخيص
  const updateLicenseStatus = async (restaurantId: string, status: 'approved' | 'rejected') => {
    const notes = reviewNotes[restaurantId] || ''
    
    if (status === 'rejected' && !notes.trim()) {
      toast.warning('يرجى كتابة سبب الرفض')
      return
    }

    const actionText = status === 'approved' ? 'الموافقة على' : 'رفض'
    const confirmed = await dialog.confirm(
      `هل أنت متأكد من ${actionText} تراخيص هذا المطعم؟`,
      { title: `${actionText} التراخيص` }
    )
    if (!confirmed) return

    setUpdating(restaurantId)
    try {
      await updateDoc(doc(db, 'restaurants', restaurantId), {
        licenseStatus: status,
        licenseNotes: status === 'rejected' ? notes : '',
        updatedAt: serverTimestamp(),
      })
      toast.success(status === 'approved' ? 'تمت الموافقة على التراخيص ✓' : 'تم رفض التراخيص')
      setReviewNotes(prev => ({ ...prev, [restaurantId]: '' }))
      onUpdate()
    } catch (err: any) {
      toast.error('فشل التحديث: ' + (err.message || 'خطأ غير معروف'))
    } finally {
      setUpdating(null)
    }
  }

  // حذف الترخيص بالكامل وإرسال رسالة لإعادة الرفع
  const deleteLicenseAndNotify = async (restaurant: LicenseRestaurant, licenseType: 'commercial') => {
    const licenseText = 'السجل التجاري'
    
    const confirmed = await dialog.confirm(
      `هل أنت متأكد من حذف ${licenseText} لـ "${restaurant.name}"؟\nسيتم إرسال إشعار للمطعم لإعادة رفع الترخيص.`,
      { title: `🗑️ حذف ${licenseText}` }
    )
    if (!confirmed) return

    setUpdating(restaurant.id)
    try {
      // تحديد الحقول المراد حذفها
      const updateData: any = {
        licenseStatus: null,
        licenseNotes: '',
        updatedAt: serverTimestamp(),
        commercialLicenseUrl: null
      }

      // حذف الترخيص من قاعدة البيانات
      await updateDoc(doc(db, 'restaurants', restaurant.id), updateData)

      // إرسال إشعار للمطعم
      await addDoc(collection(db, 'notifications'), {
        type: 'license_deleted',
        recipientId: restaurant.ownerId,
        recipientType: 'owner',
        restaurantId: restaurant.id,
        restaurantName: restaurant.name,
        title: `⚠️ تم حذف ${licenseText}`,
        message: `تم حذف ${licenseText} الخاصة بمطعمك. يرجى إعادة رفع الترخيص الصحيح من صفحة إعدادات المطعم.`,
        read: false,
        createdAt: serverTimestamp(),
      })

      toast.success(`تم حذف ${licenseText} وإرسال إشعار للمطعم ✓`)
      onUpdate()
    } catch (err: any) {
      toast.error('فشل حذف الترخيص: ' + (err.message || 'خطأ غير معروف'))
    } finally {
      setUpdating(null)
    }
  }

  const statusBadge = (status?: string) => {
    switch (status) {
      case 'approved':
        return <span className="inline-flex items-center gap-1 px-2 py-1 rounded-full bg-green-100 text-green-700 text-xs font-semibold"><CheckCircle className="w-3 h-3" /> موافق</span>
      case 'rejected':
        return <span className="inline-flex items-center gap-1 px-2 py-1 rounded-full bg-red-100 text-red-700 text-xs font-semibold"><AlertCircle className="w-3 h-3" /> مرفوض</span>
      default:
        return <span className="inline-flex items-center gap-1 px-2 py-1 rounded-full bg-yellow-100 text-yellow-700 text-xs font-semibold"><Clock className="w-3 h-3" /> قيد المراجعة</span>
    }
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between flex-wrap gap-4">
        <h2 className="text-xl font-bold flex items-center gap-2">
          <FileCheck className="w-6 h-6 text-sky-500" />
          مراجعة التراخيص
        </h2>
        <div className="flex gap-2 flex-wrap">
          {(['pending', 'approved', 'rejected', 'all', 'missing'] as const).map(f => (
            <button
              key={f}
              onClick={() => setFilter(f)}
              className={`px-3 py-1.5 rounded-lg text-sm font-medium transition ${
                filter === f
                  ? f === 'missing' ? 'bg-orange-500 text-white' : 'bg-sky-500 text-white'
                  : 'bg-gray-100 text-gray-600 hover:bg-gray-200'
              }`}
            >
              {f === 'all' && `الكل (${counts.all})`}
              {f === 'pending' && `قيد المراجعة (${counts.pending})`}
              {f === 'approved' && `موافق (${counts.approved})`}
              {f === 'rejected' && `مرفوض (${counts.rejected})`}
              {f === 'missing' && `⚠️ لم يرفع (${counts.missing})`}
            </button>
          ))}
        </div>
      </div>

      {/* قسم المطاعم التي لم ترفع التراخيص */}
      {filter === 'missing' && (
        <div className="space-y-4">
          {restaurantsWithoutLicenses.length === 0 ? (
            <div className="text-center py-12 text-gray-400">
              <CheckCircle className="w-16 h-16 mx-auto mb-4 text-green-400" />
              <p className="text-green-600 font-semibold">جميع المطاعم رفعت تراخيصها ✓</p>
            </div>
          ) : (
            <>
              {/* رسالة جماعية */}
              <div className="bg-gradient-to-r from-orange-50 to-amber-50 border border-orange-200 rounded-2xl p-5">
                <h3 className="font-bold text-orange-800 mb-3 flex items-center gap-2">
                  📢 إرسال رسالة جماعية
                </h3>
                <div className="flex items-center gap-3 mb-3">
                  <label className="flex items-center gap-2 cursor-pointer">
                    <input
                      type="checkbox"
                      checked={selectedMissing.size === restaurantsWithoutLicenses.length}
                      onChange={toggleSelectAll}
                      className="w-5 h-5 rounded border-orange-300 text-orange-500 focus:ring-orange-500"
                    />
                    <span className="text-sm text-orange-700">
                      تحديد الكل ({restaurantsWithoutLicenses.length})
                    </span>
                  </label>
                  {selectedMissing.size > 0 && (
                    <span className="text-sm bg-orange-200 text-orange-800 px-2 py-1 rounded-full">
                      محدد: {selectedMissing.size}
                    </span>
                  )}
                </div>
                <textarea
                  placeholder="اكتب الرسالة التي سترسل للمطاعم المحددة (أو جميعها إذا لم تحدد)..."
                  value={bulkMessage}
                  onChange={(e) => setBulkMessage(e.target.value)}
                  className="w-full border border-orange-200 rounded-xl p-3 text-sm resize-none h-24 focus:ring-2 focus:ring-orange-400 focus:border-transparent"
                />
                <button
                  onClick={sendBulkMessage}
                  disabled={sendingBulk || !bulkMessage.trim()}
                  className="mt-3 w-full flex items-center justify-center gap-2 bg-orange-500 hover:bg-orange-600 text-white py-2.5 rounded-xl font-semibold transition disabled:opacity-50 disabled:cursor-not-allowed"
                >
                  {sendingBulk ? (
                    <>
                      <RefreshCw className="w-5 h-5 animate-spin" />
                      جارِ الإرسال...
                    </>
                  ) : (
                    <>
                      📤 إرسال لـ {selectedMissing.size > 0 ? selectedMissing.size : restaurantsWithoutLicenses.length} مطعم
                    </>
                  )}
                </button>
              </div>

              {/* قائمة المطاعم */}
              <div className="grid gap-3">
                {restaurantsWithoutLicenses.map((r: LicenseRestaurant) => (
                  <div key={r.id} className="bg-white border rounded-2xl p-4 shadow-sm hover:shadow-md transition">
                    <div className="flex items-start gap-3">
                      <input
                        type="checkbox"
                        checked={selectedMissing.has(r.id)}
                        onChange={() => toggleSelectRestaurant(r.id)}
                        className="w-5 h-5 mt-1 rounded border-gray-300 text-orange-500 focus:ring-orange-500"
                      />
                      <div className="flex-1">
                        <div className="flex items-start justify-between gap-3 mb-2">
                          <div>
                            <h3 className="font-bold text-gray-800">{r.name}</h3>
                            <p className="text-sm text-gray-500">{r.city || 'بدون مدينة'}</p>
                          </div>
                          <span className="inline-flex items-center gap-1 px-2 py-1 rounded-full bg-orange-100 text-orange-700 text-xs font-semibold">
                            <AlertCircle className="w-3 h-3" />
                            لم يرفع الترخيص
                          </span>
                        </div>
                        
                        {/* معلومات الاتصال */}
                        <div className="flex flex-wrap gap-3 text-sm text-gray-600 mb-3">
                          {r.email && <span>📧 {r.email}</span>}
                          {r.phone && <span>📱 {r.phone}</span>}
                        </div>

                        {/* إرسال رسالة فردية */}
                        <div className="flex gap-2">
                          <input
                            type="text"
                            placeholder="رسالة سريعة..."
                            value={sendingTo === r.id ? messageText : ''}
                            onChange={(e) => {
                              setSendingTo(r.id)
                              setMessageText(e.target.value)
                            }}
                            onFocus={() => setSendingTo(r.id)}
                            className="flex-1 border rounded-lg px-3 py-2 text-sm"
                          />
                          <button
                            onClick={() => sendMessageToRestaurant(r, messageText)}
                            disabled={sendingTo === r.id && !messageText.trim()}
                            className="px-4 py-2 bg-sky-500 hover:bg-sky-600 text-white rounded-lg text-sm font-medium transition disabled:opacity-50"
                          >
                            إرسال
                          </button>
                        </div>
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            </>
          )}
        </div>
      )}

      {filter !== 'missing' && filteredRestaurants.length === 0 ? (
        <div className="text-center py-12 text-gray-400">
          <FileCheck className="w-16 h-16 mx-auto mb-4 opacity-50" />
          <p>لا توجد تراخيص {filter === 'pending' ? 'قيد المراجعة' : filter === 'approved' ? 'موافق عليها' : filter === 'rejected' ? 'مرفوضة' : ''}</p>
        </div>
      ) : filter !== 'missing' && (
        <div className="grid gap-4">
          {filteredRestaurants.map((r: LicenseRestaurant) => (
            <div key={r.id} className="bg-white border rounded-2xl p-5 shadow-sm">
              <div className="flex items-start justify-between gap-4 mb-4">
                <div>
                  <h3 className="font-bold text-lg">{r.name}</h3>
                  <p className="text-sm text-gray-500">{r.city || 'بدون مدينة'} • {r.email || 'بدون بريد'}</p>
                </div>
                {statusBadge(r.licenseStatus)}
              </div>

              {/* عرض التراخيص */}
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 mb-4">
                {r.commercialLicenseUrl && (
                  <div className="bg-gray-50 rounded-xl p-3">
                    <div className="flex items-center justify-between mb-2">
                      <p className="text-sm font-semibold text-gray-700">📜 الرخصة التجارية</p>
                      <button
                        onClick={() => deleteLicenseAndNotify(r, 'commercial')}
                        disabled={updating === r.id}
                        className="p-1.5 text-red-400 hover:text-red-600 hover:bg-red-50 rounded-lg transition"
                        title="حذف الرخصة التجارية"
                      >
                        <Trash2 className="w-4 h-4" />
                      </button>
                    </div>
                    <a
                      href={r.commercialLicenseUrl}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="inline-flex items-center gap-1 text-sky-600 hover:text-sky-800 text-sm"
                    >
                      <ExternalLink className="w-4 h-4" />
                      عرض الملف
                    </a>
                  </div>
                )}
              </div>

              {/* زر حذف السجل التجاري */}
              {r.commercialLicenseUrl && (
                <button
                  onClick={() => deleteLicenseAndNotify(r, 'commercial')}
                  disabled={updating === r.id}
                  className="w-full flex items-center justify-center gap-2 mb-4 py-2 px-4 border-2 border-dashed border-red-200 text-red-500 hover:bg-red-50 hover:border-red-300 rounded-xl text-sm font-medium transition"
                >
                  <Trash2 className="w-4 h-4" />
                  حذف السجل التجاري وإعادة الطلب
                </button>
              )}

              {/* ملاحظات الرفض السابقة */}
              {r.licenseStatus === 'rejected' && r.licenseNotes && (
                <div className="bg-red-50 text-red-700 rounded-xl p-3 mb-4 text-sm">
                  <strong>سبب الرفض:</strong> {r.licenseNotes}
                </div>
              )}

              {/* أزرار المراجعة */}
              {r.licenseStatus !== 'approved' && (
                <div className="space-y-3">
                  <textarea
                    placeholder="ملاحظات (مطلوبة للرفض)..."
                    value={reviewNotes[r.id] || ''}
                    onChange={(e) => setReviewNotes(prev => ({ ...prev, [r.id]: e.target.value }))}
                    className="w-full border rounded-xl p-3 text-sm resize-none h-20"
                  />
                  <div className="flex gap-3">
                    <button
                      onClick={() => updateLicenseStatus(r.id, 'approved')}
                      disabled={updating === r.id}
                      className="flex-1 flex items-center justify-center gap-2 bg-green-500 hover:bg-green-600 text-white py-2.5 rounded-xl font-semibold transition disabled:opacity-50"
                    >
                      <CheckCircle className="w-5 h-5" />
                      موافقة
                    </button>
                    <button
                      onClick={() => updateLicenseStatus(r.id, 'rejected')}
                      disabled={updating === r.id}
                      className="flex-1 flex items-center justify-center gap-2 bg-red-500 hover:bg-red-600 text-white py-2.5 rounded-xl font-semibold transition disabled:opacity-50"
                    >
                      <AlertCircle className="w-5 h-5" />
                      رفض
                    </button>
                  </div>
                </div>
              )}

{/* أزرار التحكم للتراخيص الموافق عليها */}
              {r.licenseStatus === 'approved' && (
                <div className="space-y-3">
                  <textarea
                    placeholder="سبب إلغاء الموافقة..."
                    value={reviewNotes[r.id] || ''}
                    onChange={(e) => setReviewNotes(prev => ({ ...prev, [r.id]: e.target.value }))}
                    className="w-full border border-yellow-200 rounded-xl p-3 text-sm resize-none h-20 focus:ring-2 focus:ring-yellow-400 focus:border-transparent"
                  />
                  <div className="flex gap-3">
                    <button
                      onClick={() => updateLicenseStatus(r.id, 'rejected')}
                      disabled={updating === r.id}
                      className="flex-1 flex items-center justify-center gap-2 bg-yellow-500 hover:bg-yellow-600 text-white py-2.5 rounded-xl font-semibold transition disabled:opacity-50"
                    >
                      <AlertCircle className="w-5 h-5" />
                      إلغاء الموافقة
                    </button>
                    <button
                      onClick={() => deleteLicenseAndNotify(r, 'commercial')}
                      disabled={updating === r.id}
                      className="flex-1 flex items-center justify-center gap-2 bg-red-500 hover:bg-red-600 text-white py-2.5 rounded-xl font-semibold transition disabled:opacity-50"
                    >
                      <Trash2 className="w-5 h-5" />
                      حذف وإعادة الطلب
                    </button>
                  </div>
                </div>
              )}
            </div>
          ))}
        </div>
      )}
    </div>
  )
}


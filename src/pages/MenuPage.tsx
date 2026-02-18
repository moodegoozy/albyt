// src/pages/MenuPage.tsx
import React, { useEffect, useState, useMemo, useRef } from 'react'
import { db } from '@/firebase'
import { collection, getDocs, query, where, doc, getDoc, updateDoc, increment, documentId, addDoc, serverTimestamp, deleteDoc } from 'firebase/firestore'
import { useCart } from '@/hooks/useCart'
import { Link, useSearchParams } from 'react-router-dom'
import { useAuth } from '@/auth'
import { useToast } from '@/components/ui/Toast'
import { MenuItem, Restaurant, Promotion } from '@/types'
import { OptimizedImage } from '@/components/OptimizedImage'
import { 
  Megaphone, X, MapPin, Phone, Star, ShoppingBag, ArrowRight, 
  CheckCircle, Building2, Copy, Package, Clock, Plus, Minus,
  Utensils, Share2, Users, Briefcase, MessageCircle, Heart, Lock,
  Search, Filter, TrendingUp, Sparkles, Flame, ChevronLeft, ChevronRight
} from 'lucide-react'

type MenuItemWithRestaurant = MenuItem & { restaurant?: Restaurant }

const chunkArray = <T,>(arr: T[], size: number): T[][] => {
  const chunks: T[][] = []
  for (let i = 0; i < arr.length; i += size) {
    chunks.push(arr.slice(i, i + size))
  }
  return chunks
}

export const MenuPage: React.FC = () => {
  const [items, setItems] = useState<MenuItemWithRestaurant[]>([])
  const [loading, setLoading] = useState(true)
  const [restaurant, setRestaurant] = useState<Restaurant | null>(null)
  const [activePromotion, setActivePromotion] = useState<Promotion | null>(null)
  const [showPromotion, setShowPromotion] = useState(true)
  const [isFollowing, setIsFollowing] = useState(false)
  const [followDocId, setFollowDocId] = useState<string | null>(null)
  const [followersCount, setFollowersCount] = useState(0)
  
  // ===== فلاتر وبحث =====
  const [searchQuery, setSearchQuery] = useState('')
  const [activeCategory, setActiveCategory] = useState<string>('all')
  const [activeFilter, setActiveFilter] = useState<'all' | 'popular' | 'price_low' | 'price_high' | 'new' | 'available'>('all')
  
  const categoryScrollRef = useRef<HTMLDivElement>(null)
  
  const { add, subtotal, items: cartItems, changeQty } = useCart()
  const { user, role } = useAuth()
  const toast = useToast()
  const [searchParams] = useSearchParams()
  const restaurantId = searchParams.get('restaurant')

  const SERVICE_FEE_PER_ITEM = 1.75

  // ===== استخراج التصنيفات =====
  const categories = useMemo(() => {
    const cats = new Set<string>()
    items.forEach(item => {
      if (item.category) cats.add(item.category)
    })
    return ['all', ...Array.from(cats)]
  }, [items])

  // ===== فلترة وترتيب الأصناف =====
  const filteredItems = useMemo(() => {
    let result = [...items]
    
    // فلتر التصنيف
    if (activeCategory !== 'all') {
      result = result.filter(item => item.category === activeCategory)
    }
    
    // فلتر البحث
    if (searchQuery.trim()) {
      const q = searchQuery.toLowerCase()
      result = result.filter(item => 
        item.name.toLowerCase().includes(q) ||
        item.description?.toLowerCase().includes(q) ||
        item.category?.toLowerCase().includes(q)
      )
    }
    
    // فلتر الحالة
    switch (activeFilter) {
      case 'popular':
        result.sort((a, b) => (b.orderCount || 0) - (a.orderCount || 0))
        break
      case 'price_low':
        result.sort((a, b) => a.price - b.price)
        break
      case 'price_high':
        result.sort((a, b) => b.price - a.price)
        break
      case 'new':
        result.sort((a, b) => {
          const dateA = (a as any).createdAt?.toDate?.()?.getTime() || 0
          const dateB = (b as any).createdAt?.toDate?.()?.getTime() || 0
          return dateB - dateA
        })
        break
      case 'available':
        result = result.filter(item => item.available !== false)
        break
    }
    
    return result
  }, [items, activeCategory, searchQuery, activeFilter])

  const copyToClipboard = (text: string) => {
    navigator.clipboard.writeText(text)
    toast.success('تم النسخ! 📋')
  }

  const shareProfile = () => {
    if (navigator.share) {
      navigator.share({
        title: restaurant?.name || 'أسرة منتجة',
        text: `تفضل بزيارة ${restaurant?.name} على سفرة البيت`,
        url: window.location.href
      })
    } else {
      copyToClipboard(window.location.href)
    }
  }

  // التحقق من حالة المتابعة وجلب عدد المتابعين
  useEffect(() => {
    if (!restaurantId) return
    
    const checkFollowStatus = async () => {
      try {
        const followersQuery = query(
          collection(db, 'storeFollowers'),
          where('restaurantId', '==', restaurantId)
        )
        const followersSnap = await getDocs(followersQuery)
        setFollowersCount(followersSnap.size)
        
        if (user) {
          const userFollowQuery = query(
            collection(db, 'storeFollowers'),
            where('restaurantId', '==', restaurantId),
            where('followerId', '==', user.uid)
          )
          const userFollowSnap = await getDocs(userFollowQuery)
          if (!userFollowSnap.empty) {
            setIsFollowing(true)
            setFollowDocId(userFollowSnap.docs[0].id)
          }
        }
      } catch (err) {
        console.warn('خطأ في جلب بيانات المتابعة:', err)
      }
    }
    
    checkFollowStatus()
  }, [restaurantId, user])

  // متابعة/إلغاء متابعة المتجر
  const toggleFollow = async () => {
    if (!user) {
      toast.warning('سجّل دخولك أولاً للمتابعة')
      return
    }
    if (!restaurantId) return
    
    try {
      if (isFollowing && followDocId) {
        await deleteDoc(doc(db, 'storeFollowers', followDocId))
        setIsFollowing(false)
        setFollowDocId(null)
        setFollowersCount(prev => Math.max(0, prev - 1))
        
        const statsRef = doc(db, 'restaurantStats', restaurantId)
        await updateDoc(statsRef, {
          followersCount: increment(-1)
        }).catch(() => {})
        
        toast.info('تم إلغاء المتابعة')
      } else {
        const newFollow = await addDoc(collection(db, 'storeFollowers'), {
          followerId: user.uid,
          followerName: user.displayName || user.email?.split('@')[0] || 'عميل',
          restaurantId,
          createdAt: serverTimestamp()
        })
        setIsFollowing(true)
        setFollowDocId(newFollow.id)
        setFollowersCount(prev => prev + 1)
        
        const statsRef = doc(db, 'restaurantStats', restaurantId)
        const statsSnap = await getDoc(statsRef)
        if (statsSnap.exists()) {
          await updateDoc(statsRef, {
            followersCount: increment(1)
          })
        } else {
          // استخدام setDoc مع معرف restaurantId لضمان التوافق مع الأكواد الأخرى
          const { setDoc } = await import('firebase/firestore')
          await setDoc(doc(db, 'restaurantStats', restaurantId), {
            restaurantId,
            totalProfileViews: 0,
            totalMenuViews: 0,
            totalItemViews: 0,
            totalShareClicks: 0,
            whatsappShareCount: 0,
            registeredCustomers: 0,
            appDownloads: 0,
            followersCount: 1,
            dailyViews: {},
            updatedAt: serverTimestamp()
          })
        }
        
        toast.success('أنت الآن تتابع هذا المتجر! 💜')
      }
    } catch (err) {
      console.error('خطأ في المتابعة:', err)
      toast.error('حدث خطأ، حاول مرة أخرى')
    }
  }

  useEffect(() => {
    (async () => {
      let qy
      
      if (restaurantId) {
        // إذا كان صاحب المتجر، نعرض جميع المنتجات (متاحة وغير متاحة)
        // أما العملاء فيرون فقط المتاحة
        const isOwnerViewing = user?.uid === restaurantId
        
        if (isOwnerViewing) {
          // صاحب المتجر يرى كل منتجاته
          qy = query(
            collection(db, 'menuItems'), 
            where('ownerId', '==', restaurantId)
          )
        } else {
          // العملاء يرون فقط المتاح
          qy = query(
            collection(db, 'menuItems'), 
            where('available', '==', true),
            where('ownerId', '==', restaurantId)
          )
        }
        
        const rSnap = await getDoc(doc(db, 'restaurants', restaurantId))
        if (rSnap.exists()) {
          setRestaurant({ id: rSnap.id, ...rSnap.data() } as Restaurant)
        }

        try {
          const promoQuery = query(
            collection(db, 'promotions'),
            where('ownerId', '==', restaurantId),
            where('isActive', '==', true)
          )
          const promoSnap = await getDocs(promoQuery)
          if (!promoSnap.empty) {
            const promos = promoSnap.docs.map(d => ({
              id: d.id,
              ...d.data(),
              expiresAt: d.data().expiresAt?.toDate?.(),
            } as Promotion))
            
            const now = new Date()
            const activePromos = promos.filter(p => !p.expiresAt || new Date(p.expiresAt) > now)
            
            if (activePromos.length > 0) {
              const promo = activePromos[0]
              setActivePromotion(promo)
              await updateDoc(doc(db, 'promotions', promo.id), {
                viewsCount: increment(1)
              })
            }
          }
        } catch (err) {}
      } else {
        qy = query(collection(db, 'menuItems'), where('available', '==', true))
      }
      
      const snap = await getDocs(qy)
      const itemsData: MenuItem[] = snap.docs.map(d => ({ id: d.id, ...d.data() } as MenuItem))

      const uniqueOwnerIds = [...new Set(itemsData.map(it => it.ownerId).filter(Boolean))] as string[]
      const restaurantsMap = new Map<string, Restaurant>()
      
      if (uniqueOwnerIds.length > 0) {
        const chunks = chunkArray(uniqueOwnerIds, 30)
        for (const chunk of chunks) {
          const q = query(collection(db, 'restaurants'), where(documentId(), 'in', chunk))
          const rSnap = await getDocs(q)
          rSnap.docs.forEach(d => restaurantsMap.set(d.id, { id: d.id, ...d.data() } as Restaurant))
        }
      }

      const enriched = itemsData.map(it => ({
        ...it,
        restaurant: it.ownerId ? restaurantsMap.get(it.ownerId) : undefined
      }))

      setItems(enriched)
      setLoading(false)
    })()
  }, [restaurantId])

  const getItemInCart = (itemId: string) => {
    return cartItems.find(c => c.id === itemId)
  }

  const handleAdd = (it: MenuItem) => {
    if (!it.ownerId) {
      toast.warning('⚠️ الصنف غير مرتبط بمطعم')
      return
    }

    const currentRestaurantId = cartItems[0]?.ownerId
    if (currentRestaurantId && currentRestaurantId !== it.ownerId) {
      toast.warning('⚠️ لا يمكن إضافة منتجات من أكثر من مطعم في نفس الطلب')
      return
    }

    const hasDiscount = it.discountPercent && it.discountPercent > 0
    const expiryDate = (it.discountExpiresAt as any)?.toDate?.() || (it.discountExpiresAt ? new Date(it.discountExpiresAt) : null)
    const isDiscountValid = hasDiscount && (!expiryDate || expiryDate > new Date())
    
    const basePrice = it.price + SERVICE_FEE_PER_ITEM
    const finalPrice = isDiscountValid 
      ? basePrice - (basePrice * ((it.discountPercent || 0) / 100))
      : basePrice

    add({ 
      id: it.id, 
      name: it.name, 
      price: finalPrice, 
      ownerId: it.ownerId 
    })
    toast.success('تمت الإضافة ✅')
  }

  const scrollCategories = (direction: 'left' | 'right') => {
    if (categoryScrollRef.current) {
      const scrollAmount = 200
      categoryScrollRef.current.scrollBy({
        left: direction === 'left' ? -scrollAmount : scrollAmount,
        behavior: 'smooth'
      })
    }
  }

  if (loading) {
    return (
      <div className="fixed inset-0 flex flex-col items-center justify-center bg-gradient-to-b from-sky-50 to-white gap-6">
        <div className="relative">
          <div className="w-20 h-20 border-4 border-sky-200 rounded-full" />
          <div className="w-20 h-20 border-4 border-sky-500 border-t-transparent rounded-full animate-spin absolute inset-0" />
        </div>
        <div className="text-center">
          <p className="text-sky-600 text-lg font-bold mb-1">جارِ تحميل المنيو</p>
          <p className="text-gray-400 text-sm">لحظات...</p>
        </div>
      </div>
    )
  }

  // ✅ السماح للزوار بالإضافة للسلة (بدون تسجيل دخول)
  // المستخدمين المسجلين: عملاء، أدمن، مطورين
  // أو زائر غير مسجل (user === null)
  const canOrder = !user || (role === 'customer' || role === 'admin' || role === 'developer' || !role)
  const isStoreOpen = restaurant?.isOpen !== false
  const isOwnStore = user && restaurantId === user.uid
  const totalCartItems = cartItems.reduce((sum, i) => sum + i.qty, 0)

  const getTierBadge = (tier?: string) => {
    switch (tier) {
      case 'gold': return { label: 'ذهبي', bg: 'from-yellow-400 to-amber-500', icon: '👑' }
      case 'silver': return { label: 'فضي', bg: 'from-gray-300 to-gray-400', icon: '🥈' }
      default: return { label: 'برونزي', bg: 'from-orange-400 to-orange-500', icon: '🥉' }
    }
  }

  const tier = getTierBadge(restaurant?.sellerTier)

  const filterOptions = [
    { value: 'all', label: 'الكل', icon: <Utensils className="w-4 h-4" /> },
    { value: 'popular', label: 'الأكثر طلبًا', icon: <Flame className="w-4 h-4" /> },
    { value: 'price_low', label: 'الأرخص', icon: <TrendingUp className="w-4 h-4 rotate-180" /> },
    { value: 'price_high', label: 'الأغلى', icon: <TrendingUp className="w-4 h-4" /> },
    { value: 'new', label: 'جديد', icon: <Sparkles className="w-4 h-4" /> },
    { value: 'available', label: 'متوفر الآن', icon: <CheckCircle className="w-4 h-4" /> },
  ]

  return (
    <div className="min-h-screen bg-gradient-to-b from-slate-200 via-slate-100 to-slate-200 pb-32 -mx-4 -mt-4">
      
      {/* ========== بانر المتجر مغلق ========== */}
      {!isStoreOpen && !isOwnStore && (
        <div className="bg-gradient-to-l from-red-500 to-rose-600 text-white p-4 flex items-center justify-center gap-3 shadow-lg">
          <div className="w-10 h-10 bg-white/20 rounded-full flex items-center justify-center">
            <Lock className="w-5 h-5" />
          </div>
          <div>
            <span className="font-bold text-lg block">المتجر مغلق حالياً</span>
            <span className="text-white/80 text-sm">لا يمكن استقبال الطلبات</span>
          </div>
        </div>
      )}
      
      {/* ========== بانر للصاحب ========== */}
      {isOwnStore && (
        <div className="bg-gradient-to-l from-emerald-500 to-teal-600 text-white p-4 shadow-lg">
          <div className="flex items-center justify-between mb-3">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 bg-white/20 rounded-full flex items-center justify-center">
                <Building2 className="w-5 h-5" />
              </div>
              <div>
                <span className="font-bold block">هذا متجرك!</span>
                <span className="text-white/80 text-sm">أنت ترى {items.length} صنف ({items.filter(i => i.available !== false).length} متاح)</span>
              </div>
            </div>
          </div>
          <div className="flex items-center gap-2 flex-wrap">
            <Link 
              to="/owner/menu"
              className="flex-1 bg-white text-emerald-600 px-4 py-2.5 rounded-xl font-bold hover:bg-gray-100 transition flex items-center justify-center gap-2 shadow-lg"
            >
              <Utensils className="w-4 h-4" />
              إدارة المنيو
            </Link>
            <Link 
              to="/owner/edit"
              className="flex-1 bg-white/20 text-white px-4 py-2.5 rounded-xl font-bold hover:bg-white/30 transition flex items-center justify-center gap-2"
            >
              تعديل المتجر
            </Link>
            <Link 
              to="/"
              className="flex-1 bg-white/20 text-white px-4 py-2.5 rounded-xl font-bold hover:bg-white/30 transition flex items-center justify-center gap-2"
            >
              لوحة التحكم
              <ArrowRight className="w-4 h-4" />
            </Link>
          </div>
        </div>
      )}
      
      {/* ========== الهيدر الفاخر مع الغلاف ========== */}
      <div className="relative">
        {/* صورة الغلاف */}
        <div className="h-56 sm:h-72 relative overflow-hidden">
          {restaurant?.coverUrl ? (
            <img 
              src={restaurant.coverUrl} 
              alt="غلاف" 
              className="w-full h-full object-cover"
            />
          ) : (
            <div className="w-full h-full bg-gradient-to-br from-sky-400 via-sky-500 to-sky-600" />
          )}
          
          {/* تراكب الظل */}
          <div className="absolute inset-0 bg-gradient-to-t from-black/70 via-black/20 to-transparent" />
          
          {/* أشكال ديكورية */}
          <div className="absolute top-0 right-0 w-72 h-72 bg-white/5 rounded-full -translate-y-1/2 translate-x-1/2 blur-3xl" />
          <div className="absolute bottom-0 left-0 w-56 h-56 bg-sky-300/10 rounded-full translate-y-1/2 -translate-x-1/2 blur-2xl" />
          
          {/* زر الرجوع */}
          <Link 
            to="/restaurants" 
            className="absolute top-4 right-4 flex items-center gap-2 bg-white/90 backdrop-blur-sm text-gray-700 px-4 py-2.5 rounded-xl text-sm font-bold hover:bg-white transition shadow-lg"
          >
            <ArrowRight className="w-4 h-4" />
            رجوع
          </Link>
          
          {/* أزرار المشاركة والمتابعة */}
          <div className="absolute top-4 left-4 flex items-center gap-2">
            {!isOwnStore && (
              <button 
                onClick={toggleFollow}
                className={`flex items-center gap-2 px-4 py-2.5 backdrop-blur-sm rounded-xl font-bold transition shadow-lg ${
                  isFollowing 
                    ? 'bg-pink-500 text-white hover:bg-pink-600' 
                    : 'bg-white/90 text-gray-700 hover:bg-white'
                }`}
              >
                <Heart className={`w-5 h-5 ${isFollowing ? 'fill-white' : ''}`} />
                <span className="text-sm">{isFollowing ? 'متابَع' : 'متابعة'}</span>
              </button>
            )}
            
            <button 
              onClick={shareProfile}
              className="p-3 bg-white/90 backdrop-blur-sm rounded-xl text-gray-700 hover:bg-white transition shadow-lg"
            >
              <Share2 className="w-5 h-5" />
            </button>
          </div>

          {/* معلومات المتجر على الغلاف */}
          {restaurant && (
            <div className="absolute bottom-0 left-0 right-0 p-4">
              <div className="flex items-end gap-4">
                {/* الشعار */}
                <div className="relative flex-shrink-0">
                  <div className="w-24 h-24 sm:w-28 sm:h-28 rounded-2xl bg-white p-1 shadow-2xl">
                    {restaurant.logoUrl ? (
                      <img 
                        src={restaurant.logoUrl} 
                        alt={restaurant.name} 
                        className="w-full h-full rounded-xl object-cover" 
                      />
                    ) : (
                      <div className="w-full h-full rounded-xl bg-gradient-to-br from-sky-100 to-sky-200 flex items-center justify-center">
                        <span className="text-4xl">🍽️</span>
                      </div>
                    )}
                  </div>
                  
                  {/* شارة التوثيق */}
                  {(restaurant.isVerified || restaurant.licenseStatus === 'approved') && (
                    <div className="absolute -bottom-1 -right-1 w-8 h-8 bg-emerald-500 rounded-full flex items-center justify-center border-3 border-white shadow-lg">
                      <CheckCircle className="w-5 h-5 text-white" />
                    </div>
                  )}
                </div>

                {/* المعلومات */}
                <div className="flex-1 pb-1">
                  <h1 className="text-2xl sm:text-3xl font-black text-white mb-1 drop-shadow-lg">
                    {restaurant.name}
                  </h1>
                  
                  <div className="flex items-center gap-2 flex-wrap">
                    {/* حالة الفتح */}
                    {isStoreOpen ? (
                      <span className="bg-emerald-500 text-white text-xs font-bold px-3 py-1.5 rounded-lg flex items-center gap-1 shadow">
                        <span className="w-2 h-2 bg-white rounded-full animate-pulse" />
                        متاح الآن
                      </span>
                    ) : (
                      <span className="bg-red-500 text-white text-xs font-bold px-3 py-1.5 rounded-lg shadow">
                        مغلق
                      </span>
                    )}
                    
                    {/* التقييم */}
                    <span className="bg-white/90 backdrop-blur-sm text-gray-700 text-xs font-bold px-3 py-1.5 rounded-lg flex items-center gap-1 shadow">
                      <Star className="w-4 h-4 text-amber-500 fill-amber-500" />
                      {restaurant.averageRating?.toFixed(1) || '0.0'}
                    </span>
                    
                    {/* شارة التصنيف */}
                    <span className={`bg-gradient-to-r ${tier.bg} text-white text-xs font-bold px-3 py-1.5 rounded-lg shadow`}>
                      {tier.icon} {tier.label}
                    </span>
                    
                    {/* المدينة */}
                    {restaurant.city && (
                      <span className="bg-white/90 backdrop-blur-sm text-gray-600 text-xs font-medium px-3 py-1.5 rounded-lg flex items-center gap-1 shadow">
                        <MapPin className="w-3 h-3" />
                        {restaurant.city}
                      </span>
                    )}
                  </div>
                </div>
              </div>
            </div>
          )}
        </div>

        {/* الإحصائيات السريعة */}
        {restaurant && (
          <div className="mx-4 -mt-4 relative z-10">
            <div className="bg-white rounded-2xl shadow-xl border border-gray-100 p-4">
              <div className="grid grid-cols-4 divide-x divide-gray-100 divide-x-reverse">
                <div className="text-center px-2">
                  <div className="w-10 h-10 mx-auto mb-1 bg-pink-50 rounded-xl flex items-center justify-center">
                    <Heart className="w-5 h-5 text-pink-500" />
                  </div>
                  <p className="text-lg font-black text-gray-800">{followersCount}</p>
                  <p className="text-[10px] text-gray-500">متابع</p>
                </div>
                <div className="text-center px-2">
                  <div className="w-10 h-10 mx-auto mb-1 bg-amber-50 rounded-xl flex items-center justify-center">
                    <Utensils className="w-5 h-5 text-amber-500" />
                  </div>
                  <p className="text-lg font-black text-gray-800">{items.length}</p>
                  <p className="text-[10px] text-gray-500">صنف</p>
                </div>
                <div className="text-center px-2">
                  <div className="w-10 h-10 mx-auto mb-1 bg-emerald-50 rounded-xl flex items-center justify-center">
                    <Package className="w-5 h-5 text-emerald-500" />
                  </div>
                  <p className="text-lg font-black text-gray-800">{restaurant.totalOrders || 0}</p>
                  <p className="text-[10px] text-gray-500">طلب</p>
                </div>
                <div className="text-center px-2">
                  <div className="w-10 h-10 mx-auto mb-1 bg-sky-50 rounded-xl flex items-center justify-center">
                    <Clock className="w-5 h-5 text-sky-500" />
                  </div>
                  <p className="text-lg font-black text-gray-800">
                    {restaurant.onTimeDeliveryRate ? `${Math.round(restaurant.onTimeDeliveryRate)}%` : '—'}
                  </p>
                  <p className="text-[10px] text-gray-500">التزام</p>
                </div>
              </div>
            </div>
          </div>
        )}
      </div>

      {/* ========== ملاحظة المتجر ========== */}
      {restaurant?.announcement && (
        <div className="mx-4 mt-4">
          <div className="bg-gradient-to-l from-sky-50 to-sky-100 border border-sky-200 rounded-2xl p-4 flex items-start gap-3">
            <div className="w-10 h-10 bg-sky-500 rounded-xl flex items-center justify-center flex-shrink-0">
              <Megaphone className="w-5 h-5 text-white" />
            </div>
            <div className="flex-1">
              <p className="text-sky-900 font-medium leading-relaxed">
                {restaurant.announcement}
              </p>
            </div>
          </div>
        </div>
      )}

      {/* ========== الإعلان الممول ========== */}
      {activePromotion && showPromotion && (
        <div className="mx-4 mt-6 bg-gradient-to-r from-violet-500 via-purple-500 to-pink-500 rounded-2xl shadow-xl overflow-hidden relative">
          <button
            onClick={() => setShowPromotion(false)}
            className="absolute top-3 left-3 z-10 p-2 bg-white/20 hover:bg-white/30 rounded-full text-white transition"
          >
            <X className="w-4 h-4" />
          </button>

          <div className="absolute top-3 right-3 z-10 inline-flex items-center gap-1.5 px-3 py-1.5 bg-white text-purple-600 text-xs font-bold rounded-full shadow">
            <Megaphone className="w-3.5 h-3.5" />
            إعلان
          </div>

          {activePromotion.mediaUrl && (
            <OptimizedImage 
              src={activePromotion.mediaUrl} 
              alt="إعلان" 
              className="w-full h-40"
            />
          )}
          <div className="p-4">
            {activePromotion.title && <h3 className="text-lg font-bold text-white mb-1">{activePromotion.title}</h3>}
            {activePromotion.description && <p className="text-white/80 text-sm">{activePromotion.description}</p>}
          </div>
        </div>
      )}

      {/* ========== شريط البحث والفلاتر ========== */}
      <div className="px-4 mt-6 space-y-4">
        {/* حقل البحث */}
        <div className="relative">
          <Search className="absolute right-4 top-1/2 -translate-y-1/2 w-5 h-5 text-gray-400" />
          <input
            type="text"
            placeholder="ابحث عن صنف..."
            value={searchQuery}
            onChange={e => setSearchQuery(e.target.value)}
            className="w-full pr-12 pl-12 py-4 bg-white rounded-2xl border-2 border-gray-100 focus:border-sky-400 focus:ring-4 focus:ring-sky-100 transition-all text-lg shadow-sm"
          />
          {searchQuery && (
            <button
              onClick={() => setSearchQuery('')}
              className="absolute left-4 top-1/2 -translate-y-1/2 text-gray-400 hover:text-gray-600"
            >
              <X className="w-5 h-5" />
            </button>
          )}
        </div>

        {/* أزرار الفلاتر */}
        <div className="flex items-center gap-2 overflow-x-auto pb-2 scrollbar-hide">
          {filterOptions.map(option => (
            <button
              key={option.value}
              onClick={() => setActiveFilter(option.value as any)}
              className={`flex items-center gap-2 px-4 py-2.5 rounded-xl text-sm font-bold whitespace-nowrap transition-all ${
                activeFilter === option.value
                  ? 'bg-sky-500 text-white shadow-lg shadow-sky-200'
                  : 'bg-white text-gray-600 border border-gray-200 hover:border-sky-300'
              }`}
            >
              {option.icon}
              {option.label}
            </button>
          ))}
        </div>

        {/* شريط التصنيفات */}
        {categories.length > 1 && (
          <div className="relative">
            {/* زر التمرير يسار */}
            <button
              onClick={() => scrollCategories('right')}
              className="absolute right-0 top-1/2 -translate-y-1/2 z-10 w-10 h-10 bg-gradient-to-l from-sky-50 via-sky-50 to-transparent flex items-center justify-start"
            >
              <ChevronRight className="w-5 h-5 text-gray-500" />
            </button>
            
            {/* التصنيفات */}
            <div 
              ref={categoryScrollRef}
              className="flex items-center gap-2 overflow-x-auto px-8 py-2 scrollbar-hide scroll-smooth"
            >
              {categories.map(cat => (
                <button
                  key={cat}
                  onClick={() => setActiveCategory(cat)}
                  className={`px-5 py-2.5 rounded-xl text-sm font-bold whitespace-nowrap transition-all ${
                    activeCategory === cat
                      ? 'bg-gradient-to-r from-sky-500 to-blue-600 text-white shadow-lg shadow-sky-200'
                      : 'bg-white text-gray-600 border border-gray-200 hover:border-sky-300 hover:bg-sky-50'
                  }`}
                >
                  {cat === 'all' ? '🍽️ الكل' : cat}
                </button>
              ))}
            </div>

            {/* زر التمرير يمين */}
            <button
              onClick={() => scrollCategories('left')}
              className="absolute left-0 top-1/2 -translate-y-1/2 z-10 w-10 h-10 bg-gradient-to-r from-sky-50 via-sky-50 to-transparent flex items-center justify-end"
            >
              <ChevronLeft className="w-5 h-5 text-gray-500" />
            </button>
          </div>
        )}
      </div>

      {/* ========== قائمة الأصناف ========== */}
      <div className="px-4 mt-6">
        {/* عنوان القسم */}
        <div className="flex items-center justify-between mb-6">
          <div className="flex items-center gap-3">
            <div className="w-12 h-12 bg-gradient-to-br from-sky-100 to-blue-100 rounded-2xl flex items-center justify-center shadow-sm">
              <Utensils className="w-6 h-6 text-sky-600" />
            </div>
            <div>
              <h2 className="text-xl font-bold text-gray-800">قائمة الأصناف</h2>
              <p className="text-sm text-gray-500">
                {filteredItems.length} صنف
                {isOwnStore && ` • ${items.filter(i => i.available === false).length} غير متاح`}
              </p>
            </div>
          </div>
          {isOwnStore && (
            <Link
              to="/owner/menu"
              className="flex items-center gap-2 px-4 py-2 bg-sky-100 text-sky-600 rounded-xl font-medium hover:bg-sky-200 transition"
            >
              <Plus className="w-4 h-4" />
              إضافة صنف
            </Link>
          )}
        </div>

        {filteredItems.length === 0 ? (
          <div className="text-center py-16 bg-white rounded-3xl border border-gray-100 shadow-sm">
            <div className="w-20 h-20 mx-auto mb-4 bg-gray-100 rounded-full flex items-center justify-center">
              <Search className="w-10 h-10 text-gray-400" />
            </div>
            <p className="text-gray-600 text-lg font-bold mb-2">لا توجد أصناف</p>
            <p className="text-gray-400">جرب تغيير الفلتر أو البحث</p>
            <button
              onClick={() => {
                setSearchQuery('')
                setActiveCategory('all')
                setActiveFilter('all')
              }}
              className="mt-4 px-6 py-2 bg-sky-100 text-sky-600 rounded-xl font-medium hover:bg-sky-200 transition"
            >
              إعادة التعيين
            </button>
          </div>
        ) : activeCategory === 'all' && !searchQuery ? (
          // ===== عرض مجمّع حسب التصنيفات =====
          <div className="space-y-8">
            {categories.filter(cat => cat !== 'all').map(category => {
              const categoryItems = filteredItems.filter(item => item.category === category)
              if (categoryItems.length === 0) return null
              
              return (
                <div key={category} className="bg-white rounded-3xl border border-gray-100 shadow-sm overflow-hidden">
                  {/* عنوان التصنيف */}
                  <div className="bg-gradient-to-r from-sky-50 to-blue-50 px-5 py-4 border-b border-gray-100">
                    <div className="flex items-center justify-between">
                      <div className="flex items-center gap-3">
                        <div className="w-10 h-10 bg-white rounded-xl flex items-center justify-center shadow-sm">
                          <span className="text-xl">🍽️</span>
                        </div>
                        <div>
                          <h3 className="text-lg font-bold text-gray-800">{category}</h3>
                          <p className="text-sm text-gray-500">{categoryItems.length} صنف</p>
                        </div>
                      </div>
                      {isOwnStore && (
                        <span className="text-xs text-gray-400">
                          {categoryItems.filter(i => i.available === false).length} غير متاح
                        </span>
                      )}
                    </div>
                  </div>
                  
                  {/* شبكة الأصناف */}
                  <div className="p-4">
                    <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 gap-4">
                      {categoryItems.map(it => (
                        <ItemCard 
                          key={it.id} 
                          item={it} 
                          isOwnStore={isOwnStore}
                          canOrder={canOrder}
                          isStoreOpen={isStoreOpen}
                          getItemInCart={getItemInCart}
                          handleAdd={handleAdd}
                          changeQty={changeQty}
                          SERVICE_FEE_PER_ITEM={SERVICE_FEE_PER_ITEM}
                        />
                      ))}
                    </div>
                  </div>
                </div>
              )
            })}
            
            {/* أصناف بدون تصنيف */}
            {(() => {
              const uncategorizedItems = filteredItems.filter(item => !item.category)
              if (uncategorizedItems.length === 0) return null
              
              return (
                <div className="bg-white rounded-3xl border border-gray-100 shadow-sm overflow-hidden">
                  <div className="bg-gradient-to-r from-gray-50 to-slate-50 px-5 py-4 border-b border-gray-100">
                    <div className="flex items-center gap-3">
                      <div className="w-10 h-10 bg-white rounded-xl flex items-center justify-center shadow-sm">
                        <span className="text-xl">📦</span>
                      </div>
                      <div>
                        <h3 className="text-lg font-bold text-gray-800">أصناف أخرى</h3>
                        <p className="text-sm text-gray-500">{uncategorizedItems.length} صنف</p>
                      </div>
                    </div>
                  </div>
                  
                  <div className="p-4">
                    <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 gap-4">
                      {uncategorizedItems.map(it => (
                        <ItemCard 
                          key={it.id} 
                          item={it} 
                          isOwnStore={isOwnStore}
                          canOrder={canOrder}
                          isStoreOpen={isStoreOpen}
                          getItemInCart={getItemInCart}
                          handleAdd={handleAdd}
                          changeQty={changeQty}
                          SERVICE_FEE_PER_ITEM={SERVICE_FEE_PER_ITEM}
                        />
                      ))}
                    </div>
                  </div>
                </div>
              )
            })()}
          </div>
        ) : (
          // ===== عرض عادي (عند البحث أو اختيار تصنيف معين) =====
          <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 gap-4">
            {filteredItems.map(it => (
              <ItemCard 
                key={it.id} 
                item={it} 
                isOwnStore={isOwnStore}
                canOrder={canOrder}
                isStoreOpen={isStoreOpen}
                getItemInCart={getItemInCart}
                handleAdd={handleAdd}
                changeQty={changeQty}
                SERVICE_FEE_PER_ITEM={SERVICE_FEE_PER_ITEM}
              />
            ))}
          </div>
        )}
      </div>

      {/* ========== زر السلة العائم ========== */}
      {totalCartItems > 0 && canOrder && (
        <div className="fixed bottom-0 left-0 right-0 z-50 p-4 pb-6 bg-gradient-to-t from-white via-white/95 to-transparent">
          <Link 
            to="/checkout" 
            className="flex items-center justify-between w-full max-w-lg mx-auto px-6 py-4 rounded-2xl bg-gradient-to-r from-sky-500 to-blue-600 text-white shadow-2xl shadow-sky-300/50 font-bold hover:from-sky-600 hover:to-blue-700 transition-all transform hover:scale-[1.02] active:scale-[0.98]"
          >
            <div className="flex items-center gap-3">
              <div className="relative">
                <div className="w-12 h-12 bg-white/20 rounded-xl flex items-center justify-center">
                  <ShoppingBag className="w-6 h-6" />
                </div>
                <span className="absolute -top-2 -right-2 w-6 h-6 bg-amber-400 text-sky-900 text-sm font-black rounded-full flex items-center justify-center shadow-lg">
                  {totalCartItems}
                </span>
              </div>
              <div>
                <span className="block text-lg font-bold">عرض السلة</span>
                <span className="block text-sky-100 text-sm">{totalCartItems} منتج</span>
              </div>
            </div>
            <div className="text-left">
              <span className="block text-2xl font-black">{subtotal.toFixed(2)}</span>
              <span className="block text-sky-100 text-sm">ر.س</span>
            </div>
          </Link>
        </div>
      )}
    </div>
  )
}

// ===== مكون بطاقة الصنف =====
interface ItemCardProps {
  item: MenuItemWithRestaurant
  isOwnStore: boolean | null
  canOrder: boolean | null
  isStoreOpen: boolean
  getItemInCart: (id: string) => any
  handleAdd: (item: MenuItem) => void
  changeQty: (id: string, qty: number) => void
  SERVICE_FEE_PER_ITEM: number
}

const ItemCard: React.FC<ItemCardProps> = ({
  item: it,
  isOwnStore,
  canOrder,
  isStoreOpen,
  getItemInCart,
  handleAdd,
  changeQty,
  SERVICE_FEE_PER_ITEM
}) => {
  const cartItem = getItemInCart(it.id)
  const hasDiscount = it.discountPercent && it.discountPercent > 0
  const expiryDate = (it.discountExpiresAt as any)?.toDate?.() || (it.discountExpiresAt ? new Date(it.discountExpiresAt) : null)
  const isDiscountValid = hasDiscount && (!expiryDate || expiryDate > new Date())
  const originalPrice = it.price + SERVICE_FEE_PER_ITEM
  const discountedPrice = isDiscountValid 
    ? originalPrice - (originalPrice * ((it.discountPercent || 0) / 100))
    : originalPrice

  return (
    <div 
      className={`bg-white rounded-2xl overflow-hidden border shadow-sm hover:shadow-xl transition-all duration-300 group ${
        it.available === false ? 'border-red-200 opacity-75' : 'border-gray-100 hover:border-sky-200'
      }`}
    >
      {/* صورة الصنف */}
      <div className="relative aspect-square overflow-hidden">
        <OptimizedImage
          src={it.imageUrl}
          alt={it.name}
          className={`w-full h-full group-hover:scale-110 transition-transform duration-500 ${
            it.available === false ? 'grayscale' : ''
          }`}
          fallback={
            <div className="w-full h-full flex items-center justify-center bg-gradient-to-br from-gray-100 to-gray-200">
              <span className="text-5xl opacity-30">🍽️</span>
            </div>
          }
        />
        
        {/* شارة غير متاح (لصاحب المتجر فقط) */}
        {it.available === false && isOwnStore && (
          <div className="absolute inset-0 bg-black/50 flex items-center justify-center">
            <span className="bg-red-500 text-white text-xs font-bold px-3 py-1.5 rounded-lg shadow-lg">
              🚫 غير متاح
            </span>
          </div>
        )}
        
        {/* شارة الخصم */}
        {isDiscountValid && it.available !== false && (
          <div className="absolute top-2 right-2 bg-red-500 text-white text-xs font-bold px-2.5 py-1 rounded-lg shadow-lg">
            خصم {it.discountPercent}%
          </div>
        )}
        
        {/* شارة الأكثر طلبًا */}
        {(it.orderCount || 0) > 10 && it.available !== false && (
          <div className="absolute top-2 left-2 bg-amber-500 text-white text-xs font-bold px-2 py-1 rounded-lg shadow flex items-center gap-1">
            <Flame className="w-3 h-3" />
            شائع
          </div>
        )}
      </div>

      {/* معلومات الصنف */}
      <div className="p-3">
        <h3 className="font-bold text-gray-800 text-sm mb-1 line-clamp-1">{it.name}</h3>
        {it.description && (
          <p className="text-xs text-gray-500 line-clamp-1 mb-2">{it.description}</p>
        )}
        
        {/* السعر */}
        <div className="flex items-center gap-2 mb-3">
          <span className={`text-lg font-black ${it.available === false ? 'text-gray-400' : 'text-sky-600'}`}>
            {discountedPrice.toFixed(0)} ر.س
          </span>
          {isDiscountValid && (
            <span className="text-sm text-gray-400 line-through">
              {originalPrice.toFixed(0)}
            </span>
          )}
        </div>

        {/* أزرار الإضافة */}
        {canOrder && isStoreOpen && it.available !== false && (
          <>
            {cartItem ? (
              <div className="flex items-center justify-between bg-sky-50 rounded-xl p-1">
                <button
                  onClick={() => changeQty(it.id, cartItem.qty - 1)}
                  className="w-9 h-9 bg-white rounded-lg flex items-center justify-center text-sky-600 shadow-sm hover:bg-sky-100 transition"
                >
                  <Minus className="w-4 h-4" />
                </button>
                <span className="text-lg font-black text-sky-600">{cartItem.qty}</span>
                <button
                  onClick={() => handleAdd(it)}
                  className="w-9 h-9 bg-sky-500 rounded-lg flex items-center justify-center text-white shadow-lg hover:bg-sky-600 transition"
                >
                  <Plus className="w-4 h-4" />
                </button>
              </div>
            ) : (
              <button 
                onClick={() => handleAdd(it)}
                className="w-full py-2.5 rounded-xl font-bold text-sm bg-gradient-to-r from-sky-500 to-blue-600 text-white shadow-lg shadow-sky-200 hover:shadow-xl hover:from-sky-600 hover:to-blue-700 transition-all flex items-center justify-center gap-2"
              >
                <Plus className="w-4 h-4" />
                أضف
              </button>
            )}
          </>
        )}
        
        {canOrder && !isStoreOpen && (
          <div className="w-full py-2.5 rounded-xl font-bold text-sm bg-gray-100 text-gray-400 text-center flex items-center justify-center gap-2">
            <Lock className="w-4 h-4" />
            مغلق
          </div>
        )}
      </div>
    </div>
  )
}

// src/pages/MenuPage.tsx
import React, { useEffect, useState } from 'react'
import { db } from '@/firebase'
import { collection, getDocs, query, where, doc, getDoc, updateDoc, increment, documentId, addDoc, serverTimestamp, deleteDoc } from 'firebase/firestore'
import { useCart } from '@/hooks/useCart'
import { Link, useSearchParams } from 'react-router-dom'
import { useAuth } from '@/auth'
import { useToast } from '@/components/ui/Toast'
import { MenuItem, Restaurant, Promotion } from '@/types'
import { 
  Megaphone, X, MapPin, Phone, Star, ShoppingBag, ArrowRight, 
  CheckCircle, Building2, Copy, Package, Clock,
  Utensils, Share2, Users, Briefcase, MessageCircle, Heart
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
  const { add, subtotal, items: cartItems } = useCart()
  const { user, role } = useAuth()
  const toast = useToast()
  const [searchParams] = useSearchParams()
  const restaurantId = searchParams.get('restaurant')

  const SERVICE_FEE_PER_ITEM = 1.75

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
      // جلب عدد المتابعين
      try {
        const followersQuery = query(
          collection(db, 'storeFollowers'),
          where('restaurantId', '==', restaurantId)
        )
        const followersSnap = await getDocs(followersQuery)
        setFollowersCount(followersSnap.size)
        
        // التحقق إذا كان المستخدم متابع
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
        // إلغاء المتابعة
        await deleteDoc(doc(db, 'storeFollowers', followDocId))
        setIsFollowing(false)
        setFollowDocId(null)
        setFollowersCount(prev => Math.max(0, prev - 1))
        
        // تحديث إحصائيات المتجر
        const statsRef = doc(db, 'restaurantStats', restaurantId)
        await updateDoc(statsRef, {
          followersCount: increment(-1)
        }).catch(() => {})
        
        toast.info('تم إلغاء المتابعة')
      } else {
        // متابعة جديدة
        const newFollow = await addDoc(collection(db, 'storeFollowers'), {
          followerId: user.uid,
          followerName: user.displayName || user.email?.split('@')[0] || 'عميل',
          restaurantId,
          createdAt: serverTimestamp()
        })
        setIsFollowing(true)
        setFollowDocId(newFollow.id)
        setFollowersCount(prev => prev + 1)
        
        // تحديث إحصائيات المتجر
        const statsRef = doc(db, 'restaurantStats', restaurantId)
        const statsSnap = await getDoc(statsRef)
        if (statsSnap.exists()) {
          await updateDoc(statsRef, {
            followersCount: increment(1)
          })
        } else {
          // إنشاء سجل إحصائيات جديد
          await addDoc(collection(db, 'restaurantStats'), {
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
        qy = query(
          collection(db, 'menuItems'), 
          where('available', '==', true),
          where('ownerId', '==', restaurantId)
        )
        
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

    add({ 
      id: it.id, 
      name: it.name, 
      price: it.price + SERVICE_FEE_PER_ITEM, 
      ownerId: it.ownerId 
    })
    toast.success('تمت الإضافة ✅')
  }

  if (loading) {
    return (
      <div className="flex flex-col items-center justify-center h-screen gap-4">
        <div className="w-16 h-16 border-4 border-amber-500 border-t-transparent rounded-full animate-spin" />
        <p className="text-gray-400 text-lg">جارِ التحميل...</p>
      </div>
    )
  }

  const canOrder = user && (role === 'customer' || role === 'admin' || role === 'developer' || !role)
  
  // هل هذا المتجر هو متجر المستخدم الحالي؟
  const isOwnStore = user && restaurantId === user.uid

  const getTierBadge = (tier?: string) => {
    switch (tier) {
      case 'gold': return { label: 'ذهبي', bg: 'bg-gradient-to-r from-yellow-400 to-amber-500', icon: '👑' }
      case 'silver': return { label: 'فضي', bg: 'bg-gradient-to-r from-gray-300 to-gray-400', icon: '🥈' }
      default: return { label: 'برونزي', bg: 'bg-gradient-to-r from-orange-500 to-orange-600', icon: '🥉' }
    }
  }

  const tier = getTierBadge(restaurant?.sellerTier)

  return (
    <div className="min-h-screen pb-32 -mx-4 -mt-4">
      
      {/* ========== بانر للصاحب ========== */}
      {isOwnStore && (
        <div className="bg-gradient-to-l from-emerald-500 to-teal-600 text-white p-4 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <Building2 className="w-6 h-6" />
            <span className="font-bold">هذا متجرك! لإدارة المتجر:</span>
          </div>
          <Link 
            to="/"
            className="bg-white text-emerald-600 px-4 py-2 rounded-full font-bold hover:bg-gray-100 transition flex items-center gap-2"
          >
            لوحة التحكم
            <ArrowRight className="w-4 h-4" />
          </Link>
        </div>
      )}
      
      {/* ========== الهيدر مع الغلاف ========== */}
      <div className="relative">
        {/* الغلاف */}
        <div className="h-48 sm:h-56 bg-gradient-to-br from-amber-500 via-orange-500 to-red-500 relative overflow-hidden">
          <div className="absolute inset-0 bg-black/20" />
          {/* أشكال ديكورية */}
          <div className="absolute top-0 right-0 w-64 h-64 bg-white/10 rounded-full -translate-y-1/2 translate-x-1/2" />
          <div className="absolute bottom-0 left-0 w-48 h-48 bg-black/10 rounded-full translate-y-1/2 -translate-x-1/2" />
          
          {/* زر الرجوع */}
          <Link 
            to="/restaurants" 
            className="absolute top-4 right-4 flex items-center gap-2 bg-black/30 backdrop-blur-sm text-white px-4 py-2 rounded-full text-sm font-bold hover:bg-black/50 transition"
          >
            <ArrowRight className="w-4 h-4" />
            رجوع
          </Link>
          
          {/* أزرار المشاركة والمتابعة */}
          <div className="absolute top-4 left-4 flex items-center gap-2">
            {/* زر المتابعة */}
            {!isOwnStore && (
              <button 
                onClick={toggleFollow}
                className={`flex items-center gap-2 px-4 py-2 backdrop-blur-sm rounded-full font-bold transition ${
                  isFollowing 
                    ? 'bg-pink-500 text-white hover:bg-pink-600' 
                    : 'bg-black/30 text-white hover:bg-black/50'
                }`}
              >
                <Heart className={`w-5 h-5 ${isFollowing ? 'fill-white' : ''}`} />
                <span className="text-sm">{isFollowing ? 'متابَع' : 'متابعة'}</span>
              </button>
            )}
            
            {/* زر المشاركة */}
            <button 
              onClick={shareProfile}
              className="p-3 bg-black/30 backdrop-blur-sm rounded-full text-white hover:bg-black/50 transition"
            >
              <Share2 className="w-5 h-5" />
            </button>
          </div>
        </div>

        {/* بطاقة المعلومات الرئيسية */}
        {restaurant && (
          <div className="mx-4 -mt-20 relative z-10">
            <div className="bg-gray-900 rounded-3xl shadow-2xl border border-gray-800 overflow-hidden">
              
              {/* الجزء العلوي: الشعار والاسم */}
              <div className="p-6 text-center relative">
                {/* إطار الشعار */}
                <div className="relative inline-block mb-4">
                  <div className="w-28 h-28 rounded-full bg-gradient-to-br from-amber-400 to-orange-500 p-1 shadow-2xl">
                    <div className="w-full h-full rounded-full bg-white overflow-hidden">
                      {restaurant.logoUrl ? (
                        <img src={restaurant.logoUrl} alt={restaurant.name} className="w-full h-full object-cover" />
                      ) : (
                        <div className="w-full h-full bg-gradient-to-br from-amber-50 to-orange-100 flex items-center justify-center">
                          <span className="text-5xl">🍽️</span>
                        </div>
                      )}
                    </div>
                  </div>
                  
                  {/* شارة التوثيق */}
                  {restaurant.isVerified && (
                    <div className="absolute -bottom-1 -right-1 w-8 h-8 bg-green-500 rounded-full flex items-center justify-center border-4 border-gray-900 shadow-lg">
                      <CheckCircle className="w-5 h-5 text-white" />
                    </div>
                  )}
                </div>

                {/* اسم الأسرة */}
                <h1 className="text-2xl sm:text-3xl font-black text-white mb-2">{restaurant.name}</h1>
                
                {/* الموقع */}
                {restaurant.city && (
                  <div className="flex items-center justify-center gap-2 text-gray-400 mb-3">
                    <MapPin className="w-4 h-4" />
                    <span>{restaurant.city}</span>
                  </div>
                )}

                {/* الشارات */}
                <div className="flex items-center justify-center gap-2 flex-wrap">
                  <span className={`${tier.bg} text-white text-xs font-bold px-3 py-1.5 rounded-full shadow-lg`}>
                    {tier.icon} {tier.label}
                  </span>
                  {restaurant.isVerified && (
                    <span className="bg-green-500 text-white text-xs font-bold px-3 py-1.5 rounded-full">
                      ✓ موثّق
                    </span>
                  )}
                </div>
              </div>

              {/* الإحصائيات */}
              <div className="grid grid-cols-5 border-t border-gray-800">
                <div className="p-3 text-center border-l border-gray-800">
                  <Heart className="w-5 h-5 text-pink-400 mx-auto mb-1" />
                  <p className="text-lg font-black text-white">{followersCount}</p>
                  <p className="text-[10px] text-gray-500">متابع</p>
                </div>
                <div className="p-3 text-center border-l border-gray-800">
                  <Utensils className="w-5 h-5 text-amber-400 mx-auto mb-1" />
                  <p className="text-lg font-black text-white">{items.length}</p>
                  <p className="text-[10px] text-gray-500">صنف</p>
                </div>
                <div className="p-3 text-center border-l border-gray-800">
                  <Package className="w-5 h-5 text-green-400 mx-auto mb-1" />
                  <p className="text-lg font-black text-white">{restaurant.totalOrders || 0}</p>
                  <p className="text-[10px] text-gray-500">طلب</p>
                </div>
                <div className="p-3 text-center border-l border-gray-800">
                  <Star className="w-5 h-5 text-yellow-400 mx-auto mb-1" />
                  <p className="text-lg font-black text-white">{restaurant.averageRating?.toFixed(1) || '0'}</p>
                  <p className="text-[10px] text-gray-500">تقييم</p>
                </div>
                <div className="p-3 text-center">
                  <Clock className="w-5 h-5 text-sky-400 mx-auto mb-1" />
                  <p className="text-lg font-black text-white">{restaurant.onTimeDeliveryRate ? `${Math.round(restaurant.onTimeDeliveryRate)}%` : '—'}</p>
                  <p className="text-[10px] text-gray-500">التزام</p>
                </div>
              </div>

              {/* معلومات التواصل */}
              <div className="p-4 border-t border-gray-800 space-y-3">
                {restaurant.phone && (
                  <a 
                    href={`tel:${restaurant.phone}`}
                    className="flex items-center justify-between p-3 bg-green-500/10 hover:bg-green-500/20 rounded-xl transition"
                  >
                    <div className="flex items-center gap-3">
                      <div className="w-10 h-10 bg-green-500 rounded-xl flex items-center justify-center">
                        <Phone className="w-5 h-5 text-white" />
                      </div>
                      <div>
                        <p className="text-white font-bold">اتصل الآن</p>
                        <p className="text-green-400 text-sm" dir="ltr">{restaurant.phone}</p>
                      </div>
                    </div>
                    <ArrowRight className="w-5 h-5 text-green-400 rotate-180" />
                  </a>
                )}

                {restaurant.location && (
                  <div className="flex items-center gap-3 p-3 bg-gray-800/50 rounded-xl">
                    <div className="w-10 h-10 bg-sky-500/20 rounded-xl flex items-center justify-center">
                      <MapPin className="w-5 h-5 text-sky-400" />
                    </div>
                    <p className="text-gray-300 text-sm">{restaurant.location}</p>
                  </div>
                )}
              </div>

              {/* قسم التوظيف */}
              {restaurant.isHiring && (
                <div className="p-4 border-t border-gray-800">
                  <div className="bg-gradient-to-br from-purple-900/40 to-pink-900/40 rounded-2xl p-4 border border-purple-700/30">
                    <div className="flex items-center gap-2 mb-3">
                      <div className="w-10 h-10 bg-purple-500 rounded-xl flex items-center justify-center">
                        <Briefcase className="w-5 h-5 text-white" />
                      </div>
                      <div>
                        <span className="text-purple-400 font-bold block">🔔 نوظّف الآن!</span>
                        <span className="text-purple-300/70 text-xs">فرص عمل متاحة</span>
                      </div>
                    </div>
                    
                    {restaurant.hiringDescription && (
                      <p className="text-gray-300 text-sm mb-4 leading-relaxed bg-gray-900/40 p-3 rounded-xl">
                        {restaurant.hiringDescription}
                      </p>
                    )}

                    {restaurant.hiringContact && (
                      <a
                        href={`https://wa.me/${restaurant.hiringContact.replace(/\D/g, '')}`}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="flex items-center justify-center gap-2 w-full py-3 bg-gradient-to-r from-purple-500 to-pink-500 hover:from-purple-600 hover:to-pink-600 text-white rounded-xl font-bold transition"
                      >
                        <MessageCircle className="w-5 h-5" />
                        تواصل للتوظيف
                      </a>
                    )}
                  </div>
                </div>
              )}
            </div>
          </div>
        )}
      </div>

      {/* ========== الإعلان الممول ========== */}
      {activePromotion && showPromotion && (
        <div className="mx-4 mt-6 bg-gradient-to-r from-purple-900 via-purple-800 to-pink-900 rounded-2xl shadow-xl overflow-hidden relative">
          <button
            onClick={() => setShowPromotion(false)}
            className="absolute top-3 left-3 z-10 p-2 bg-black/40 hover:bg-black/60 rounded-full text-white transition"
          >
            <X className="w-4 h-4" />
          </button>

          <div className="absolute top-3 right-3 z-10 inline-flex items-center gap-1 px-3 py-1 bg-gradient-to-r from-purple-500 to-pink-500 text-white text-xs font-bold rounded-full shadow">
            <Megaphone className="w-3 h-3" />
            إعلان
          </div>

          {activePromotion.mediaUrl && (
            <img src={activePromotion.mediaUrl} alt="" className="w-full h-40 object-cover" />
          )}
          <div className="p-4">
            {activePromotion.title && <h3 className="text-lg font-bold text-white mb-1">{activePromotion.title}</h3>}
            {activePromotion.description && <p className="text-purple-100 text-sm">{activePromotion.description}</p>}
          </div>
        </div>
      )}

      {/* ========== قسم الأصناف ========== */}
      <div className="px-4 mt-6">
        <div className="flex items-center gap-3 mb-4">
          <div className="w-10 h-10 bg-amber-500/20 rounded-xl flex items-center justify-center">
            <Utensils className="w-5 h-5 text-amber-400" />
          </div>
          <h2 className="text-xl font-bold text-white">قائمة الأصناف</h2>
          <span className="bg-amber-500/20 text-amber-400 text-sm font-bold px-3 py-1 rounded-full mr-auto">
            {items.length}
          </span>
        </div>

        {items.length === 0 ? (
          <div className="text-center py-16 bg-gray-800/30 rounded-2xl">
            <ShoppingBag className="w-16 h-16 text-gray-600 mx-auto mb-4" />
            <p className="text-gray-400 text-lg">لا توجد أصناف حالياً</p>
          </div>
        ) : (
          <div className="grid grid-cols-2 gap-3">
            {items.map(it => (
              <div 
                key={it.id} 
                className="bg-gray-800 rounded-2xl overflow-hidden border border-gray-700/50 hover:border-amber-500/50 shadow-lg transition-all"
              >
                <div className="relative h-28 sm:h-36 overflow-hidden">
                  {it.imageUrl ? (
                    <img src={it.imageUrl} alt={it.name} className="w-full h-full object-cover" />
                  ) : (
                    <div className="w-full h-full flex items-center justify-center bg-gradient-to-br from-gray-700 to-gray-800">
                      <span className="text-4xl opacity-30">🍽️</span>
                    </div>
                  )}
                  <div className="absolute bottom-2 left-2 bg-black/80 px-2 py-1 rounded-full">
                    <span className="font-black text-amber-400 text-sm">
                      {(it.price + SERVICE_FEE_PER_ITEM).toFixed(0)} ر.س
                    </span>
                  </div>
                </div>

                <div className="p-3">
                  <h3 className="font-bold text-white text-sm mb-2 line-clamp-1">{it.name}</h3>
                  {canOrder && (
                    <button 
                      onClick={() => handleAdd(it)}
                      className="w-full py-2 rounded-xl font-bold text-sm bg-gradient-to-r from-amber-500 to-orange-500 text-black"
                    >
                      + أضف
                    </button>
                  )}
                </div>
              </div>
            ))}
          </div>
        )}
      </div>

      {/* ========== شريط السلة ========== */}
      {subtotal > 0 && canOrder && (
        <div className="fixed bottom-0 left-0 right-0 z-50 p-4 bg-gradient-to-t from-gray-900 via-gray-900/98 to-transparent">
          <Link 
            to="/checkout" 
            className="flex items-center justify-between w-full max-w-lg mx-auto px-5 py-4 rounded-2xl bg-gradient-to-r from-sky-500 to-blue-600 text-white shadow-2xl font-bold"
          >
            <div className="flex items-center gap-3">
              <div className="relative">
                <ShoppingBag className="w-6 h-6" />
                <span className="absolute -top-2 -right-2 w-5 h-5 bg-amber-400 text-black text-xs font-black rounded-full flex items-center justify-center">
                  {cartItems.reduce((sum, i) => sum + i.qty, 0)}
                </span>
              </div>
              <span>عرض السلة</span>
            </div>
            <span className="text-xl font-black">{subtotal.toFixed(2)} ر.س</span>
          </Link>
        </div>
      )}
    </div>
  )
}

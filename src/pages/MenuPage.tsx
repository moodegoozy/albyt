// src/pages/MenuPage.tsx
import React, { useEffect, useState } from 'react'
import { db } from '@/firebase'
import { collection, getDocs, query, where, doc, getDoc, updateDoc, increment } from 'firebase/firestore'
import { useCart } from '@/hooks/useCart'
import { Link, useSearchParams } from 'react-router-dom'
import { useAuth } from '@/auth'
import { useToast } from '@/components/ui/Toast'
import { MenuItem, Restaurant, Promotion } from '@/types'
import { Megaphone, X, Play } from 'lucide-react'

type MenuItemWithRestaurant = MenuItem & { restaurant?: Restaurant }

export const MenuPage: React.FC = () => {
  const [items, setItems] = useState<MenuItemWithRestaurant[]>([])
  const [loading, setLoading] = useState(true)
  const [restaurantName, setRestaurantName] = useState<string | null>(null)
  const [activePromotion, setActivePromotion] = useState<Promotion | null>(null)
  const [showPromotion, setShowPromotion] = useState(true)
  const { add, subtotal, items: cartItems } = useCart()
  const { user, role } = useAuth()
  const toast = useToast()
  const [searchParams] = useSearchParams()
  const restaurantId = searchParams.get('restaurant')

  useEffect(() => {
    (async () => {
      let qy
      
      // إذا تم تحديد مطعم معين، نفلتر الأصناف حسبه
      if (restaurantId) {
        qy = query(
          collection(db, 'menuItems'), 
          where('available', '==', true),
          where('ownerId', '==', restaurantId)
        )
        
        // جلب اسم المطعم
        const rSnap = await getDoc(doc(db, 'restaurants', restaurantId))
        if (rSnap.exists()) {
          setRestaurantName((rSnap.data() as Restaurant).name)
        }

        // جلب الإعلان النشط للمطعم
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
            
            // فلترة الإعلانات غير المنتهية
            const now = new Date()
            const activePromos = promos.filter(p => !p.expiresAt || new Date(p.expiresAt) > now)
            
            if (activePromos.length > 0) {
              const promo = activePromos[0]
              setActivePromotion(promo)
              
              // زيادة عداد المشاهدات
              await updateDoc(doc(db, 'promotions', promo.id), {
                viewsCount: increment(1)
              })
            }
          }
        } catch (err) {
          console.warn('Error loading promotion:', err)
        }
      } else {
        qy = query(collection(db, 'menuItems'), where('available', '==', true))
      }
      
      const snap = await getDocs(qy)
      const itemsData: MenuItem[] = snap.docs.map(d => ({ id: d.id, ...d.data() } as MenuItem))

      const enriched = await Promise.all(
        itemsData.map(async (it) => {
          if (!it.ownerId) return it
          const rSnap = await getDoc(doc(db, 'restaurants', it.ownerId))
          if (rSnap.exists()) {
            return { ...it, restaurant: rSnap.data() as Restaurant }
          }
          return it
        })
      )

      setItems(enriched)
      setLoading(false)
    })()
  }, [restaurantId])

  const SERVICE_FEE_PER_ITEM = 1.75

  const handleAdd = (it: MenuItem) => {
    if (!it.ownerId) {
      toast.warning('⚠️ الصنف غير مرتبط بمطعم', { title: 'تنبيه' })
      return
    }

    const currentRestaurantId = cartItems[0]?.ownerId
    if (currentRestaurantId && currentRestaurantId !== it.ownerId) {
      toast.warning('⚠️ لا يمكن إضافة منتجات من أكثر من مطعم في نفس الطلب', { title: 'تحذير' })
      return
    }

    add({ 
      id: it.id, 
      name: it.name, 
      price: it.price + SERVICE_FEE_PER_ITEM, 
      ownerId: it.ownerId 
    })
    toast.success('تم إضافة المنتج للسلة ✅')
  }

  if (loading) {
    return (
      <div className="flex items-center justify-center h-96 text-lg text-gray-300">
        ⏳ جارِ تحميل القائمة...
      </div>
    )
  }

  // هل يمكن للمستخدم الطلب؟ (أي مستخدم مسجل دخوله ما عدا صاحب المطعم والمندوب)
  const canOrder = user && (role === 'customer' || role === 'admin' || role === 'developer' || !role)

  return (
    <div className="py-10">
      <h1 className="text-3xl font-extrabold text-center mb-8 text-yellow-400">
        {restaurantName ? `🍽️ قائمة ${restaurantName}` : '🍗 قائمة الأصناف'}
      </h1>

      {restaurantId && (
        <div className="text-center mb-6">
          <Link to="/restaurants" className="text-sky-400 hover:text-sky-300 underline">
            ← العودة لقائمة المطاعم
          </Link>
        </div>
      )}

      {/* الإعلان الممول */}
      {activePromotion && showPromotion && (
        <div className="mb-8 bg-gradient-to-r from-purple-900 via-purple-800 to-pink-900 rounded-2xl shadow-xl overflow-hidden relative">
          {/* زر الإغلاق */}
          <button
            onClick={() => setShowPromotion(false)}
            className="absolute top-3 left-3 z-10 p-2 bg-black/40 hover:bg-black/60 rounded-full text-white transition"
          >
            <X className="w-4 h-4" />
          </button>

          {/* شارة الإعلان */}
          <div className="absolute top-3 right-3 z-10 inline-flex items-center gap-1 px-3 py-1 bg-gradient-to-r from-purple-500 to-pink-500 text-white text-xs font-bold rounded-full shadow">
            <Megaphone className="w-3 h-3" />
            إعلان
          </div>

          {/* المحتوى */}
          <div className="relative">
            {/* الوسائط */}
            {activePromotion.mediaUrl && (
              <div className="relative">
                {activePromotion.type === 'video' ? (
                  <div className="relative">
                    <video
                      src={activePromotion.mediaUrl}
                      controls
                      className="w-full h-56 object-cover"
                      poster=""
                    />
                    <div className="absolute inset-0 flex items-center justify-center pointer-events-none">
                      <div className="w-16 h-16 bg-white/20 rounded-full flex items-center justify-center backdrop-blur-sm">
                        <Play className="w-8 h-8 text-white fill-white" />
                      </div>
                    </div>
                  </div>
                ) : (
                  <img
                    src={activePromotion.mediaUrl}
                    alt={activePromotion.title}
                    className="w-full h-56 object-cover"
                  />
                )}
              </div>
            )}

            {/* النص */}
            <div className="p-5">
              {activePromotion.title && (
                <h3 className="text-xl font-bold text-white mb-2">{activePromotion.title}</h3>
              )}
              {activePromotion.description && (
                <p className="text-purple-100 text-sm leading-relaxed">{activePromotion.description}</p>
              )}
            </div>
          </div>
        </div>
      )}

      {items.length === 0 && (
        <div className="text-center text-gray-400">😔 لا توجد أصناف حالياً</div>
      )}

      <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-6">
        {items.map(it => (
          <div 
            key={it.id} 
            className="bg-gray-800 text-white rounded-2xl shadow hover:shadow-xl transition p-4 flex flex-col"
          >
            {/* بيانات المطعم */}
            {it.restaurant && (
              <div className="flex items-center gap-3 mb-3">
                {it.restaurant.logoUrl ? (
                  <img 
                    src={it.restaurant.logoUrl} 
                    alt={it.restaurant.name} 
                    className="w-10 h-10 rounded-full object-cover border border-gray-700"
                  />
                ) : (
                  <div className="w-10 h-10 flex items-center justify-center rounded-full bg-gray-600 text-xl">
                    🍴
                  </div>
                )}
                <span className="font-semibold">{it.restaurant.name}</span>
              </div>
            )}

            {/* صورة الطبق */}
            <div className="h-48 bg-gray-700 rounded-xl mb-3 flex items-center justify-center overflow-hidden">
              {it.imageUrl ? (
                <img 
                  src={it.imageUrl} 
                  alt={it.name} 
                  className="w-full h-full object-cover rounded-xl"
                />
              ) : (
                <span className="text-gray-400">بدون صورة</span>
              )}
            </div>

            {/* تفاصيل */}
            <div className="flex-1">
              <h3 className="font-bold text-lg">{it.name}</h3>
              {it.desc && <p className="text-sm text-gray-300 mt-1">{it.desc}</p>}
            </div>

            {/* السعر + زر الإضافة */}
            <div className="mt-3 flex items-center justify-between">
              <span className="font-bold text-xl text-yellow-400">{(it.price + SERVICE_FEE_PER_ITEM).toFixed(2)} ر.س</span>
              
              {/* ✅ زر الإضافة يظهر للعميل والمشرف */}
              {canOrder && (
                <button 
                  onClick={() => handleAdd(it)}
                  disabled={!it.ownerId}
                  className={`px-4 py-2 rounded-xl font-semibold transition ${
                    it.ownerId 
                      ? 'bg-yellow-500 hover:bg-yellow-600 text-black' 
                      : 'bg-gray-500 text-white cursor-not-allowed'
                  }`}
                >
                  🛒 أضف للسلة
                </button>
              )}
            </div>
          </div>
        ))}
      </div>

      {/* ✅ السلة تظهر للعميل والمشرف */}
      {subtotal > 0 && canOrder && (
        <div className="fixed bottom-4 left-4 right-4 sm:left-1/2 sm:right-auto sm:-translate-x-1/2 z-40">
          <Link 
            to="/checkout" 
            className="block w-full sm:w-auto text-center px-6 py-4 rounded-2xl bg-sky-600 text-white shadow-xl font-bold hover:bg-sky-700 transition text-base sm:text-lg"
          >
            🛒 إتمام الطلب • {subtotal.toFixed(2)} ر.س
          </Link>
        </div>
      )}
    </div>
  )
}

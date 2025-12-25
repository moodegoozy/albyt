// src/pages/MenuPage.tsx
import React, { useEffect, useState } from 'react'
import { db } from '@/firebase'
import { collection, getDocs, query, where, doc, getDoc } from 'firebase/firestore'
import { useCart } from '@/hooks/useCart'
import { Link, useSearchParams } from 'react-router-dom'
import { useAuth } from '@/auth'
import { useToast } from '@/components/ui/Toast'
import { MenuItem, Restaurant } from '@/types'

type MenuItemWithRestaurant = MenuItem & { restaurant?: Restaurant }

export const MenuPage: React.FC = () => {
  const [items, setItems] = useState<MenuItemWithRestaurant[]>([])
  const [loading, setLoading] = useState(true)
  const [restaurantName, setRestaurantName] = useState<string | null>(null)
  const { add, subtotal, items: cartItems } = useCart()
  const { role } = useAuth()
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
      price: it.price, 
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

  // هل يمكن للمستخدم الطلب؟
  const canOrder = role === 'customer' || role === 'admin'

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
              <span className="font-bold text-xl text-yellow-400">{it.price.toFixed(2)} ر.س</span>
              
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

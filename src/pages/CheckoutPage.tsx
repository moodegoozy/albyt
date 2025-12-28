import React, { useState, useEffect } from 'react'
import { addDoc, collection, doc, getDoc, updateDoc, increment, serverTimestamp } from 'firebase/firestore'
import { db } from '@/firebase'
import { useCart } from '@/hooks/useCart'
import { useAuth } from '@/auth'
import { useNavigate } from 'react-router-dom'
import { RoleGate } from '@/routes/RoleGate'
import { useDialog } from '@/components/ui/ConfirmDialog'
import { useToast } from '@/components/ui/Toast'

// 💰 رسوم التطبيق والمشرف (لكل منتج)
const PLATFORM_FEE_PER_ITEM = 1.0 // ريال للتطبيق على كل منتج
const ADMIN_COMMISSION_PER_ITEM = 0.75 // 75 هللة للمشرف على كل منتج
// المجموع = 1.75 ريال لكل منتج

export const CheckoutPage: React.FC = () => {
  const { items, subtotal, clear } = useCart()
  const { user } = useAuth()
  const nav = useNavigate()
  const dialog = useDialog()
  const toast = useToast()
  const [address, setAddress] = useState('')
  const [saving, setSaving] = useState(false)
  const [restaurant, setRestaurant] = useState<{ id: string; name: string; referredBy?: string; referrerType?: string } | null>(null)
  const [location, setLocation] = useState<{ lat: number; lng: number } | null>(null)

  const deliveryFee = 7
  const total = subtotal + deliveryFee

  // ✅ تحميل بيانات المطعم
  useEffect(() => {
    const loadRestaurant = async () => {
      if (items.length === 0) return
      let ownerId = items[0]?.ownerId

      if (!ownerId && items[0]?.id) {
        try {
          const menuSnap = await getDoc(doc(db, 'menuItems', items[0].id))
          const menuData = menuSnap.exists() ? (menuSnap.data() as any) : null
          ownerId = menuData?.ownerId || null
        } catch (err) {
          console.error('خطأ في جلب بيانات الصنف:', err)
        }
      }

      if (!ownerId) {
        setRestaurant(null)
        return
      }

      const rSnap = await getDoc(doc(db, 'restaurants', ownerId))
      const rData = rSnap.exists() ? (rSnap.data() as any) : null
      setRestaurant({ 
        id: ownerId, 
        name: rData?.name || 'مطعم',
        referredBy: rData?.referredBy,
        referrerType: rData?.referrerType
      })
    }
    loadRestaurant()
  }, [items])

  // ✅ تحديد موقعي عبر GPS
  const getMyLocation = () => {
    if (!navigator.geolocation) {
      dialog.warning('المتصفح لا يدعم تحديد الموقع')
      return
    }
    navigator.geolocation.getCurrentPosition(
      (pos) => {
        console.log('📍 موقعك الحالي:', pos.coords)
        setLocation({ lat: pos.coords.latitude, lng: pos.coords.longitude })
        toast.success('تم تحديد موقعك بنجاح 📍')
      },
      (err) => {
        console.error('خطأ في تحديد الموقع:', err)
        dialog.error('تعذر تحديد الموقع. تأكد من منح إذن الوصول للموقع.')
      },
      { enableHighAccuracy: true }
    )
  }

  // ✅ إرسال الطلب
  const placeOrder = async () => {
    if (!user) return
    if (items.length === 0) { dialog.warning('السلة فارغة'); return }
    if (!address) { dialog.warning('أدخل العنوان'); return }
    if (!location) { dialog.warning('حدّد موقعك على الخريطة'); return }

    let restId = restaurant?.id
    if (!restId && items[0]?.id) {
      const menuSnap = await getDoc(doc(db, 'menuItems', items[0].id))
      const menuData = menuSnap.exists() ? (menuSnap.data() as any) : null
      restId = menuData?.ownerId || null
    }

    if (!restId) {
      dialog.error('تعذر تحديد المطعم للطلب. أعد الإضافة من القائمة.')
      return
    }

    setSaving(true)
    
    // 💰 حساب العمولات (كلها على أساس عدد المنتجات)
    // رسوم التطبيق = 0.5 ريال × عدد المنتجات
    // عمولة المشرف = 0.5 ريال × عدد المنتجات (إذا المطعم مضاف من مشرف)
    const referredByAdmin = restaurant?.referrerType === 'admin' && restaurant?.referredBy
    const totalItemsCount = items.reduce((sum, item) => sum + item.qty, 0) // إجمالي عدد المنتجات
    const platformFee = PLATFORM_FEE_PER_ITEM * totalItemsCount // رسوم التطبيق
    const adminCommission = referredByAdmin ? (ADMIN_COMMISSION_PER_ITEM * totalItemsCount) : 0
    // التطبيق يأخذ رسومه دائماً + عمولة المنتجات إذا ما فيه مشرف
    const appEarnings = platformFee + (referredByAdmin ? 0 : (ADMIN_COMMISSION_PER_ITEM * totalItemsCount))

    // إنشاء الطلب مع معلومات العمولة
    const orderRef = await addDoc(collection(db, 'orders'), {
      customerId: user.uid,
      restaurantId: restId,
      restaurantName: restaurant?.name || 'مطعم',
      items: items.map(i => ({
        id: i.id,
        name: i.name,
        price: i.price,
        qty: i.qty,
        ownerId: i.ownerId ?? restId,
      })),
      subtotal,
      deliveryFee,
      total,
      status: 'pending',
      address,
      location,
      createdAt: serverTimestamp(),
      updatedAt: serverTimestamp(),
      paymentMethod: 'cod',
      // 💰 معلومات العمولة
      platformFee: platformFee,
      platformFeePerItem: PLATFORM_FEE_PER_ITEM,
      adminCommission: adminCommission,
      adminCommissionPerItem: ADMIN_COMMISSION_PER_ITEM,
      totalItemsCount: totalItemsCount,
      referredBy: restaurant?.referredBy || null,
    })

    // 💰 تحديث محفظة المشرف إذا كان المطعم مسجل عن طريقه
    if (referredByAdmin && restaurant?.referredBy && adminCommission > 0) {
      try {
        const walletRef = doc(db, 'wallets', restaurant.referredBy)
        const walletSnap = await getDoc(walletRef)
        
        if (walletSnap.exists()) {
          // تحديث المحفظة الموجودة
          await updateDoc(walletRef, {
            balance: increment(adminCommission),
            totalEarnings: increment(adminCommission),
            updatedAt: serverTimestamp(),
          })
        } else {
          // إنشاء محفظة جديدة للمشرف
          const { setDoc } = await import('firebase/firestore')
          await setDoc(walletRef, {
            balance: adminCommission,
            totalEarnings: adminCommission,
            totalWithdrawn: 0,
            transactions: [],
            updatedAt: serverTimestamp(),
          })
        }
        
        // إضافة المعاملة للسجل (اختياري - يمكن إضافته لاحقاً)
        console.log(`✅ تم إضافة ${adminCommission} ريال لمحفظة المشرف ${restaurant.referredBy} (${totalItemsCount} منتج × ${ADMIN_COMMISSION_PER_ITEM} ر.س)`)
      } catch (err) {
        console.error('خطأ في تحديث محفظة المشرف:', err)
      }
    }

    // 💰 تحديث محفظة التطبيق (المطور الرئيسي)
    try {
      const appWalletRef = doc(db, 'wallets', 'app_earnings')
      const appWalletSnap = await getDoc(appWalletRef)
      
      if (appWalletSnap.exists()) {
        await updateDoc(appWalletRef, {
          balance: increment(appEarnings),
          totalEarnings: increment(appEarnings),
          updatedAt: serverTimestamp(),
        })
      } else {
        const { setDoc } = await import('firebase/firestore')
        await setDoc(appWalletRef, {
          balance: appEarnings,
          totalEarnings: appEarnings,
          totalWithdrawn: 0,
          transactions: [],
          updatedAt: serverTimestamp(),
        })
      }
      console.log(`✅ تم إضافة ${appEarnings} ريال لمحفظة التطبيق`)
    } catch (err) {
      console.error('خطأ في تحديث محفظة التطبيق:', err)
    }

    clear()
    setSaving(false)
    nav('/orders')
  }

  return (
    <RoleGate allow={['customer', 'admin']}>
      <div className="max-w-xl mx-auto bg-white rounded-2xl shadow p-6 text-gray-900">
        <h1 className="text-xl font-bold mb-4">إتمام الطلب</h1>

        {/* 🧾 تفاصيل الطلب */}
        <div className="border rounded-xl p-3 text-gray-800">
          {items.map(i => (
            <div key={i.id} className="flex items-center justify-between py-2 border-b last:border-b-0">
              <span className="text-sm">{i.name} × {i.qty}</span>
              <span className="font-semibold">{(i.price * i.qty).toFixed(2)} ر.س</span>
            </div>
          ))}
        </div>

        {/* 🏠 العنوان */}
        <input
          className="w-full border rounded-xl p-3 text-gray-900 placeholder-gray-500 mt-3"
          placeholder="العنوان التفصيلي"
          value={address}
          onChange={e => setAddress(e.target.value)}
        />

        {/* 📍 تحديد الموقع */}
        <button
          onClick={getMyLocation}
          className="w-full mt-3 rounded-xl p-3 bg-blue-600 text-white font-semibold hover:bg-blue-700"
        >
          📍 تحديد موقعي الحالي
        </button>

        {/* 🗺️ الخريطة */}
        {location && (
          <iframe
            title="خريطة الموقع"
            width="100%"
            height="250"
            style={{ borderRadius: '12px', marginTop: '10px' }}
            loading="lazy"
            allowFullScreen
            src={`https://maps.google.com/maps?hl=ar&q=${location.lat},${location.lng}&z=15&output=embed`}
          />
        )}

        {/* 💰 الملخص */}
        <div className="bg-gray-50 rounded-xl p-3 text-gray-800 mt-3">
          <div className="flex items-center justify-between text-sm">
            <span>المجموع</span>
            <span>{subtotal.toFixed(2)} ر.س</span>
          </div>
          <div className="flex items-center justify-between text-sm">
            <span>رسوم التوصيل</span>
            <span>{deliveryFee.toFixed(2)} ر.س</span>
          </div>
          <div className="flex items-center justify-between font-bold text-lg mt-1 text-gray-900">
            <span>الإجمالي</span>
            <span>{total.toFixed(2)} ر.س</span>
          </div>
        </div>

        {/* ✅ زر تأكيد الطلب */}
        <button
          disabled={saving}
          onClick={placeOrder}
          className="w-full rounded-xl p-3 bg-green-600 hover:bg-green-700 text-white font-bold mt-3"
        >
          {saving ? '...' : 'تأكيد الطلب (دفع عند الاستلام)'}
        </button>
      </div>
    </RoleGate>
  )
}

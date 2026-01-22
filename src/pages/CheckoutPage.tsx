import React, { useState, useEffect } from 'react'
import { addDoc, collection, doc, getDoc, updateDoc, increment, serverTimestamp } from 'firebase/firestore'
import { db } from '@/firebase'
import { useCart } from '@/hooks/useCart'
import { useAuth } from '@/auth'
import { useNavigate } from 'react-router-dom'
import { RoleGate } from '@/routes/RoleGate'
import { useDialog } from '@/components/ui/ConfirmDialog'
import { useToast } from '@/components/ui/Toast'
import { LocationPicker } from '@/components/LocationPicker'
import { MapPin, Check, ShoppingBag, Truck, CreditCard, ChevronLeft, Store, XCircle } from 'lucide-react'

const PLATFORM_FEE_PER_ITEM = 1.0
const ADMIN_COMMISSION_PER_ITEM = 0.75

// ❌ التوصيل غير متوفر حالياً - الاستلام من المطعم فقط
const DELIVERY_AVAILABLE = false

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
  const [showLocationPicker, setShowLocationPicker] = useState(false)
  const [deliveryType, setDeliveryType] = useState<'pickup' | 'delivery'>('pickup') // الاستلام افتراضي

  const deliveryFee = deliveryType === 'delivery' ? 7 : 0
  const totalItemsCount = items.reduce((sum, item) => sum + item.qty, 0)
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

  // ✅ معالجة تأكيد الموقع من LocationPicker
  const handleLocationConfirm = (loc: { lat: number; lng: number }, addr: string) => {
    setLocation(loc)
    setAddress(addr)
    setShowLocationPicker(false)
    toast.success('تم تحديد موقعك بنجاح! 📍')
  }

  // ✅ إرسال الطلب
  const placeOrder = async () => {
    if (!user) return
    if (items.length === 0) { dialog.warning('السلة فارغة'); return }
    
    // التحقق من الموقع والعنوان فقط إذا كان التوصيل مفعل ومختار
    if (deliveryType === 'delivery' && DELIVERY_AVAILABLE) {
      if (!address) { dialog.warning('أدخل العنوان'); return }
      if (!location) { dialog.warning('حدّد موقعك على الخريطة'); return }
    }

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
    
    // 💰 حساب تقسيم الدخل
    const referredByAdmin = restaurant?.referrerType === 'admin' && restaurant?.referredBy
    const totalItemsCount = items.reduce((sum, item) => sum + item.qty, 0)
    
    // حساب سعر المنتجات الأصلي (بدون رسوم التطبيق)
    const SERVICE_FEE_PER_ITEM = PLATFORM_FEE_PER_ITEM + ADMIN_COMMISSION_PER_ITEM // 1.75
    const originalSubtotal = subtotal - (SERVICE_FEE_PER_ITEM * totalItemsCount) // سعر المنتجات الأصلي للمطعم
    
    // تقسيم الدخل:
    const restaurantEarnings = originalSubtotal // المطعم يحصل على السعر الأصلي
    const platformFee = PLATFORM_FEE_PER_ITEM * totalItemsCount // رسوم التطبيق (1 ر.س × عدد المنتجات)
    const adminCommission = referredByAdmin ? (ADMIN_COMMISSION_PER_ITEM * totalItemsCount) : 0 // عمولة المشرف
    const appEarnings = platformFee + (referredByAdmin ? 0 : (ADMIN_COMMISSION_PER_ITEM * totalItemsCount)) // التطبيق يأخذ عمولة المشرف إذا ما فيه مشرف

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
      deliveryType, // نوع التسليم: pickup أو delivery
      address: deliveryType === 'pickup' ? 'استلام من المطعم' : address,
      location: deliveryType === 'pickup' ? null : location,
      createdAt: serverTimestamp(),
      updatedAt: serverTimestamp(),
      paymentMethod: 'cod',
      // 💰 معلومات تقسيم الدخل
      restaurantEarnings: restaurantEarnings,
      platformFee: platformFee,
      platformFeePerItem: PLATFORM_FEE_PER_ITEM,
      adminCommission: adminCommission,
      adminCommissionPerItem: ADMIN_COMMISSION_PER_ITEM,
      appEarnings: appEarnings,
      totalItemsCount: totalItemsCount,
      referredBy: restaurant?.referredBy || null,
    })

    // 💰 تحديث محفظة المطعم
    try {
      const restaurantWalletRef = doc(db, 'wallets', restId)
      const restaurantWalletSnap = await getDoc(restaurantWalletRef)
      
      if (restaurantWalletSnap.exists()) {
        await updateDoc(restaurantWalletRef, {
          balance: increment(restaurantEarnings),
          totalEarnings: increment(restaurantEarnings),
          updatedAt: serverTimestamp(),
        })
      } else {
        const { setDoc } = await import('firebase/firestore')
        await setDoc(restaurantWalletRef, {
          balance: restaurantEarnings,
          totalEarnings: restaurantEarnings,
          totalWithdrawn: 0,
          transactions: [],
          updatedAt: serverTimestamp(),
        })
      }
    } catch (err) {
      // خطأ في تحديث محفظة المطعم
    }

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
      } catch (err) {
        // خطأ في تحديث محفظة المشرف
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
    } catch (err) {
      // خطأ في تحديث محفظة التطبيق
    }

    clear()
    setSaving(false)
    nav('/orders')
  }

  return (
    <RoleGate allow={['customer', 'admin']}>
      <div className="max-w-xl mx-auto space-y-4">
        
        {/* العنوان الرئيسي */}
        <div className="bg-gradient-to-r from-sky-500 to-sky-600 rounded-2xl p-5 text-white shadow-lg">
          <div className="flex items-center gap-3">
            <div className="w-12 h-12 bg-white/20 rounded-xl flex items-center justify-center">
              <ShoppingBag className="w-6 h-6" />
            </div>
            <div>
              <h1 className="text-xl font-bold">إتمام الطلب</h1>
              <p className="text-sm text-white/80">{restaurant?.name || 'جارِ التحميل...'}</p>
            </div>
          </div>
        </div>

        {/* 🧾 تفاصيل الطلب */}
        <div className="bg-white rounded-2xl shadow-lg overflow-hidden">
          <div className="bg-gray-50 px-4 py-3 border-b flex items-center gap-2">
            <ShoppingBag className="w-5 h-5 text-sky-500" />
            <span className="font-bold text-gray-800">تفاصيل الطلب</span>
            <span className="text-xs bg-sky-100 text-sky-600 px-2 py-0.5 rounded-full mr-auto">
              {items.length} صنف
            </span>
          </div>
          <div className="p-4 space-y-2">
            {items.map(i => (
              <div key={i.id} className="flex items-center justify-between py-2 border-b border-gray-100 last:border-0">
                <div className="flex items-center gap-3">
                  <span className="w-8 h-8 bg-sky-100 rounded-lg flex items-center justify-center text-sm">
                    {i.qty}×
                  </span>
                  <span className="text-gray-800 font-medium">{i.name}</span>
                </div>
                <span className="font-bold text-sky-600">{(i.price * i.qty).toFixed(2)} ر.س</span>
              </div>
            ))}
          </div>
        </div>

        {/* � اختيار طريقة الاستلام */}
        <div className="bg-white rounded-2xl shadow-lg overflow-hidden">
          <div className="bg-gray-50 px-4 py-3 border-b flex items-center gap-2">
            <Truck className="w-5 h-5 text-sky-500" />
            <span className="font-bold text-gray-800">طريقة الاستلام</span>
          </div>
          <div className="p-4 space-y-3">
            {/* خيار الاستلام من المطعم */}
            <button
              onClick={() => setDeliveryType('pickup')}
              className={`w-full p-4 rounded-xl border-2 transition flex items-center gap-4 ${
                deliveryType === 'pickup'
                  ? 'border-green-500 bg-green-50'
                  : 'border-gray-200 hover:border-gray-300'
              }`}
            >
              <div className={`w-12 h-12 rounded-xl flex items-center justify-center ${
                deliveryType === 'pickup' ? 'bg-green-500' : 'bg-gray-100'
              }`}>
                <Store className={`w-6 h-6 ${deliveryType === 'pickup' ? 'text-white' : 'text-gray-500'}`} />
              </div>
              <div className="flex-1 text-right">
                <p className={`font-bold ${deliveryType === 'pickup' ? 'text-green-700' : 'text-gray-800'}`}>
                  استلام من المطعم
                </p>
                <p className="text-sm text-gray-500">مجاناً - بدون رسوم توصيل</p>
              </div>
              {deliveryType === 'pickup' && (
                <Check className="w-6 h-6 text-green-500" />
              )}
            </button>

            {/* خيار التوصيل - غير متوفر */}
            <div
              className="w-full p-4 rounded-xl border-2 border-gray-200 bg-gray-50 flex items-center gap-4 opacity-60 cursor-not-allowed"
            >
              <div className="w-12 h-12 rounded-xl flex items-center justify-center bg-gray-200">
                <Truck className="w-6 h-6 text-gray-400" />
              </div>
              <div className="flex-1 text-right">
                <p className="font-bold text-gray-500">
                  توصيل للمنزل
                </p>
                <p className="text-sm text-gray-400">رسوم التوصيل: 7 ر.س</p>
              </div>
              <div className="flex items-center gap-2 bg-red-100 text-red-600 px-3 py-1.5 rounded-lg">
                <XCircle className="w-4 h-4" />
                <span className="text-sm font-semibold">غير متوفر</span>
              </div>
            </div>
          </div>
        </div>

        {/* 📍 تحديد الموقع - يظهر فقط إذا كان التوصيل متوفر ومختار */}
        {DELIVERY_AVAILABLE && deliveryType === 'delivery' && (
        <div className="bg-white rounded-2xl shadow-lg overflow-hidden">
          <div className="bg-gray-50 px-4 py-3 border-b flex items-center gap-2">
            <MapPin className="w-5 h-5 text-green-500" />
            <span className="font-bold text-gray-800">موقع التوصيل</span>
          </div>
          <div className="p-4">
            {location ? (
              <div className="space-y-3">
                {/* الموقع المحدد */}
                <div className="bg-green-50 border-2 border-green-200 rounded-xl p-4">
                  <div className="flex items-start gap-3">
                    <div className="w-10 h-10 bg-green-500 rounded-xl flex items-center justify-center flex-shrink-0">
                      <Check className="w-5 h-5 text-white" />
                    </div>
                    <div className="flex-1 min-w-0">
                      <p className="font-bold text-green-700 mb-1">تم تحديد الموقع ✓</p>
                      <p className="text-sm text-gray-600 break-words">{address}</p>
                      <p className="text-xs text-gray-400 mt-1 font-mono">
                        {location.lat.toFixed(5)}, {location.lng.toFixed(5)}
                      </p>
                    </div>
                  </div>
                </div>
                
                {/* زر تغيير الموقع */}
                <button
                  onClick={() => setShowLocationPicker(true)}
                  className="w-full py-3 px-4 rounded-xl border-2 border-sky-200 text-sky-600 font-semibold hover:bg-sky-50 transition flex items-center justify-center gap-2"
                >
                  <MapPin className="w-5 h-5" />
                  تغيير الموقع
                </button>
              </div>
            ) : (
              <button
                onClick={() => setShowLocationPicker(true)}
                className="w-full py-4 rounded-xl bg-gradient-to-r from-sky-500 to-sky-600 text-white font-bold shadow-lg hover:shadow-xl transition flex items-center justify-center gap-3"
              >
                <MapPin className="w-6 h-6" />
                <span>تحديد موقع التوصيل</span>
                <ChevronLeft className="w-5 h-5" />
              </button>
            )}
          </div>
        </div>
        )}

        {/* 💰 الملخص */}
        <div className="bg-white rounded-2xl shadow-lg overflow-hidden">
          <div className="bg-gray-50 px-4 py-3 border-b flex items-center gap-2">
            <CreditCard className="w-5 h-5 text-amber-500" />
            <span className="font-bold text-gray-800">ملخص الفاتورة</span>
          </div>
          <div className="p-4 space-y-2">
            <div className="flex items-center justify-between text-gray-600">
              <span>المجموع الفرعي</span>
              <span className="font-semibold">{subtotal.toFixed(2)} ر.س</span>
            </div>
            {deliveryType === 'delivery' && (
            <div className="flex items-center justify-between text-gray-600">
              <div className="flex items-center gap-2">
                <Truck className="w-4 h-4" />
                <span>رسوم التوصيل</span>
              </div>
              <span className="font-semibold">{deliveryFee.toFixed(2)} ر.س</span>
            </div>
            )}
            {deliveryType === 'pickup' && (
            <div className="flex items-center justify-between text-green-600">
              <div className="flex items-center gap-2">
                <Store className="w-4 h-4" />
                <span>استلام من المطعم</span>
              </div>
              <span className="font-semibold">مجاناً</span>
            </div>
            )}
            <div className="h-px bg-gray-200 my-2" />
            <div className="flex items-center justify-between">
              <span className="font-bold text-lg text-gray-800">الإجمالي</span>
              <span className="font-black text-xl text-sky-600">{total.toFixed(2)} ر.س</span>
            </div>
          </div>
        </div>

        {/* ✅ زر تأكيد الطلب */}
        <button
          disabled={saving || (deliveryType === 'delivery' && DELIVERY_AVAILABLE && !location)}
          onClick={placeOrder}
          className="w-full py-4 rounded-2xl bg-gradient-to-r from-green-500 to-green-600 text-white font-bold text-lg shadow-xl hover:shadow-2xl disabled:opacity-50 disabled:cursor-not-allowed transition flex items-center justify-center gap-3"
        >
          {saving ? (
            <>
              <div className="w-5 h-5 border-2 border-white/30 border-t-white rounded-full animate-spin" />
              جارِ إرسال الطلب...
            </>
          ) : (
            <>
              <Check className="w-6 h-6" />
              {deliveryType === 'pickup' ? 'تأكيد الطلب (استلام من المطعم)' : 'تأكيد الطلب (دفع عند الاستلام)'}
            </>
          )}
        </button>

        {/* تحذير للتوصيل */}
        {deliveryType === 'delivery' && DELIVERY_AVAILABLE && !location && (
          <p className="text-center text-sm text-amber-600 bg-amber-50 rounded-xl p-3">
            ⚠️ يجب تحديد موقع التوصيل قبل إرسال الطلب
          </p>
        )}

        {/* LocationPicker Modal */}
        <LocationPicker
          isOpen={showLocationPicker}
          onClose={() => setShowLocationPicker(false)}
          onConfirm={handleLocationConfirm}
          initialLocation={location}
        />
      </div>
    </RoleGate>
  )
}

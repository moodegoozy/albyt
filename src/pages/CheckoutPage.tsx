import React, { useState, useEffect, useMemo } from 'react'
import { addDoc, collection, doc, getDoc, updateDoc, increment, serverTimestamp, setDoc, arrayUnion, query, where, getDocs } from 'firebase/firestore'
import { db } from '@/firebase'
import { useCart } from '@/hooks/useCart'
import { useAuth } from '@/auth'
import { useNavigate } from 'react-router-dom'
import { RoleGate } from '@/routes/RoleGate'
import { useDialog } from '@/components/ui/ConfirmDialog'
import { useToast } from '@/components/ui/Toast'
import { LocationPicker } from '@/components/LocationPicker'
import { MapPin, Check, ShoppingBag, Truck, CreditCard, ChevronLeft, Store, XCircle, Info, Wallet, RefreshCw, Tag, Gift, Percent } from 'lucide-react'
import { PayPalScriptProvider, PayPalButtons } from '@paypal/react-paypal-js'
import { PAYPAL_CONFIG, getPayPalOptions } from '@/utils/paypal'
import { SpecialOffer, OfferType } from '@/types'

const PLATFORM_FEE_PER_ITEM = 1.0
const ADMIN_COMMISSION_PER_ITEM = 0.75

// رسوم المنصة على كل طلب توصيل (تُخصم من المندوب)
const COURIER_PLATFORM_FEE = 3.75

// رسوم التطبيق: 1.57 هللة على المنتجات التي سعرها 5 ريال أو أكثر
const APP_FEE_PER_ITEM = 0.0157  // 1.57 هللة = 0.0157 ريال
const APP_FEE_MIN_PRICE = 5      // الحد الأدنى للسعر لتطبيق الرسوم

// ✅ التوصيل متوفر - رسوم التوصيل يحددها المندوب/الأسرة
const DELIVERY_AVAILABLE = true

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
  const [paymentMethod, setPaymentMethod] = useState<'cod' | 'paypal' | 'wallet'>('cod') // طريقة الدفع
  const [walletBalance, setWalletBalance] = useState(0)
  const [processingPayment, setProcessingPayment] = useState(false)
  
  // 🎁 نظام العروض
  const [availableOffers, setAvailableOffers] = useState<SpecialOffer[]>([])
  const [selectedOffer, setSelectedOffer] = useState<SpecialOffer | null>(null)
  const [loadingOffers, setLoadingOffers] = useState(false)

  // رسوم التوصيل تبدأ بـ 0 - يحددها المندوب أو الأسرة عند قبول الطلب
  const deliveryFee = 0 // سيتم تحديدها لاحقاً
  const totalItemsCount = items.reduce((sum, item) => sum + item.qty, 0)
  
  // 💰 حساب رسوم التطبيق (1.57 هللة على المنتجات ≥ 5 ريال)
  const appFee = useMemo(() => {
    return items.reduce((fee, item) => {
      if (item.price >= APP_FEE_MIN_PRICE) {
        return fee + (APP_FEE_PER_ITEM * item.qty)
      }
      return fee
    }, 0)
  }, [items])

  // 🎁 حساب قيمة الخصم من العرض
  const discountAmount = useMemo(() => {
    if (!selectedOffer) return 0
    
    switch (selectedOffer.offerType) {
      case 'percent_discount':
        // خصم نسبة مئوية
        const percentDiscount = (subtotal * (selectedOffer.discountPercent || 0)) / 100
        return Math.min(percentDiscount, subtotal) // لا يتجاوز الإجمالي
        
      case 'fixed_discount':
        // خصم مبلغ ثابت
        return Math.min(selectedOffer.discountAmount || 0, subtotal)
        
      case 'bundle_meal':
        // وجبة مجمّعة - الخصم هو الفرق بين السعر الأصلي والسعر الخاص
        if (selectedOffer.bundleOriginalPrice && selectedOffer.bundlePrice) {
          return selectedOffer.bundleOriginalPrice - selectedOffer.bundlePrice
        }
        return 0
        
      case 'buy_x_get_y':
        // اشترِ X واحصل على Y - حساب سعر العناصر المجانية
        // هذا يحتاج منطق أكثر تعقيداً لتحديد الأصناف المشمولة
        return 0 // TODO: implement buy_x_get_y logic
        
      default:
        return 0
    }
  }, [selectedOffer, subtotal])
  
  const total = subtotal + appFee - discountAmount // الإجمالي بعد إضافة رسوم التطبيق والخصم

  // ✅ تحميل بيانات المطعم ورصيد المحفظة
  useEffect(() => {
    const loadData = async () => {
      if (!user) return
      
      // جلب رصيد المحفظة
      try {
        const walletSnap = await getDoc(doc(db, 'wallets', user.uid))
        if (walletSnap.exists()) {
          setWalletBalance(walletSnap.data()?.balance || 0)
        }
      } catch (err) {
        console.warn('Error loading wallet:', err)
      }
      
      // جلب بيانات المطعم
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
    loadData()
  }, [items, user])

  // 🎁 جلب العروض المتاحة للمطعم
  useEffect(() => {
    const loadOffers = async () => {
      if (!restaurant?.id) {
        setAvailableOffers([])
        return
      }
      
      setLoadingOffers(true)
      try {
        const offersQuery = query(
          collection(db, 'offers'),
          where('ownerId', '==', restaurant.id),
          where('isActive', '==', true)
        )
        const offersSnap = await getDocs(offersQuery)
        const now = new Date()
        
        const activeOffers = offersSnap.docs
          .map(d => ({
            id: d.id,
            ...d.data(),
            expiresAt: d.data().expiresAt?.toDate?.(),
            startsAt: d.data().startsAt?.toDate?.(),
          } as SpecialOffer))
          .filter(o => {
            // العرض نشط ولم ينتهِ
            if (o.expiresAt && new Date(o.expiresAt) < now) return false
            // العرض بدأ أو ليس له تاريخ بداية
            if (o.startsAt && new Date(o.startsAt) > now) return false
            // التحقق من الحد الأدنى للطلب
            if (o.minOrderAmount && subtotal < o.minOrderAmount) return false
            return true
          })
        
        setAvailableOffers(activeOffers)
        
        // إذا كان هناك عرض واحد فقط، اختره تلقائياً
        if (activeOffers.length === 1) {
          setSelectedOffer(activeOffers[0])
        }
      } catch (err) {
        console.warn('Error loading offers:', err)
        setAvailableOffers([])
      } finally {
        setLoadingOffers(false)
      }
    }
    loadOffers()
  }, [restaurant?.id, subtotal])

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
    
    try {
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
      deliveryFee: 0, // يحددها المندوب أو الأسرة لاحقاً
      deliveryFeeSetBy: null, // من حدد رسوم التوصيل
      deliveryFeeSetAt: null, // متى تم تحديدها
      total, // الإجمالي بعد الخصم (بدون رسوم توصيل)
      status: 'pending',
      deliveryType, // نوع التسليم: pickup أو delivery
      address: deliveryType === 'pickup' ? 'استلام من المطعم' : address,
      location: deliveryType === 'pickup' ? null : location,
      createdAt: serverTimestamp(),
      updatedAt: serverTimestamp(),
      paymentMethod: 'cod',
      // 🎁 معلومات العرض المطبّق
      appliedOffer: selectedOffer ? {
        id: selectedOffer.id,
        title: selectedOffer.title,
        offerType: selectedOffer.offerType,
        discountPercent: selectedOffer.discountPercent || null,
        discountAmount: selectedOffer.discountAmount || null,
      } : null,
      discountAmount: discountAmount, // قيمة الخصم المحسوبة
      // 💰 معلومات تقسيم الدخل
      restaurantEarnings: restaurantEarnings,
      platformFee: platformFee,
      platformFeePerItem: PLATFORM_FEE_PER_ITEM,
      adminCommission: adminCommission,
      adminCommissionPerItem: ADMIN_COMMISSION_PER_ITEM,
      appEarnings: appEarnings,
      totalItemsCount: totalItemsCount,
      referredBy: restaurant?.referredBy || null,
      // 💰 رسوم المنصة على المندوب (3.75 ريال)
      courierPlatformFee: deliveryType === 'delivery' ? COURIER_PLATFORM_FEE : 0,
    })

    // 💰 تحديث محفظة المطعم (معلقة - تُرصد فعلياً عند التسليم)
    try {
      const restaurantWalletRef = doc(db, 'wallets', restId)
      const restaurantWalletSnap = await getDoc(restaurantWalletRef)
      
      if (restaurantWalletSnap.exists()) {
        await updateDoc(restaurantWalletRef, {
          pendingBalance: increment(restaurantEarnings),
          updatedAt: serverTimestamp(),
        })
      } else {
        await setDoc(restaurantWalletRef, {
          balance: 0,
          pendingBalance: restaurantEarnings,
          totalSales: 0,
          totalWithdrawn: 0,
          ownerType: 'restaurant',
          updatedAt: serverTimestamp(),
        })
      }
    } catch (err) {
      console.warn('خطأ في تحديث محفظة المطعم:', err)
    }

    // 💰 تحديث محفظة المشرف إذا كان المطعم مسجل عن طريقه
    if (referredByAdmin && restaurant?.referredBy && adminCommission > 0) {
      try {
        const walletRef = doc(db, 'wallets', restaurant.referredBy)
        const walletSnap = await getDoc(walletRef)
        
        if (walletSnap.exists()) {
          await updateDoc(walletRef, {
            balance: increment(adminCommission),
            totalEarnings: increment(adminCommission),
            updatedAt: serverTimestamp(),
          })
        } else {
          await setDoc(walletRef, {
            balance: adminCommission,
            totalEarnings: adminCommission,
            totalWithdrawn: 0,
            transactions: [],
            updatedAt: serverTimestamp(),
          })
        }
      } catch (err) {
        console.warn('خطأ في تحديث محفظة المشرف:', err)
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
        await setDoc(appWalletRef, {
          balance: appEarnings,
          totalEarnings: appEarnings,
          totalWithdrawn: 0,
          transactions: [],
          updatedAt: serverTimestamp(),
        })
      }
    } catch (err) {
      console.warn('خطأ في تحديث محفظة التطبيق:', err)
    }

    // 🎁 تحديث عداد استخدام العرض
    if (selectedOffer) {
      try {
        await updateDoc(doc(db, 'offers', selectedOffer.id), {
          usedCount: increment(1),
          updatedAt: serverTimestamp()
        })
      } catch (err) {
        console.warn('Error updating offer usage count:', err)
      }
    }

    // 🔔 إرسال إشعارات للمطعم والعميل
    try {
      const { notifyRestaurantNewOrder, notifyOrderCreated } = await import('@/utils/notificationService')
      
      // إشعار للمطعم
      await notifyRestaurantNewOrder(
        restId,
        orderRef.id,
        user.displayName || 'عميل',
        total,
        items.reduce((sum, i) => sum + i.qty, 0)
      )
      
      // إشعار للعميل
      await notifyOrderCreated(
        user.uid,
        orderRef.id,
        restaurant?.name || 'المطعم',
        total
      )
      
      console.log('✅ تم إرسال إشعارات الطلب الجديد')
    } catch (notifErr) {
      console.warn('⚠️ فشل إرسال الإشعارات:', notifErr)
    }

    clear()
    nav('/orders')
    } catch (err) {
      console.error('خطأ في إنشاء الطلب:', err)
      dialog.error('حدث خطأ أثناء إنشاء الطلب. حاول مرة أخرى.')
    } finally {
      setSaving(false)
    }
  }

  // ✅ إرسال الطلب مع الدفع (PayPal أو المحفظة)
  const placeOrderWithPayment = async (method: 'paypal' | 'wallet', paypalOrderId?: string) => {
    if (!user) return
    if (items.length === 0) { dialog.warning('السلة فارغة'); return }
    
    // التحقق من الموقع والعنوان فقط إذا كان التوصيل مفعل ومختار
    if (deliveryType === 'delivery' && DELIVERY_AVAILABLE) {
      if (!address) { dialog.warning('أدخل العنوان'); return }
      if (!location) { dialog.warning('حدّد موقعك على الخريطة'); return }
    }

    // التحقق من رصيد المحفظة
    if (method === 'wallet' && walletBalance < total) {
      dialog.warning('رصيد المحفظة غير كافي')
      return
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
    const itemsCount = items.reduce((sum, item) => sum + item.qty, 0)
    
    const SERVICE_FEE_PER_ITEM = PLATFORM_FEE_PER_ITEM + ADMIN_COMMISSION_PER_ITEM
    const originalSubtotal = subtotal - (SERVICE_FEE_PER_ITEM * itemsCount)
    
    const restaurantEarnings = originalSubtotal
    const platformFee = PLATFORM_FEE_PER_ITEM * itemsCount
    const adminCommission = referredByAdmin ? (ADMIN_COMMISSION_PER_ITEM * itemsCount) : 0
    const appEarnings = platformFee + (referredByAdmin ? 0 : (ADMIN_COMMISSION_PER_ITEM * itemsCount))

    try {
      // خصم من المحفظة إذا كان الدفع بالمحفظة
      if (method === 'wallet') {
        const walletRef = doc(db, 'wallets', user.uid)
        const newTransaction = {
          id: `order_${Date.now()}`,
          type: 'debit',
          amount: total,
          description: `دفع طلب من ${restaurant?.name}`,
          createdAt: new Date()
        }
        await updateDoc(walletRef, {
          balance: increment(-total),
          transactions: arrayUnion(newTransaction),
          updatedAt: serverTimestamp()
        })
        setWalletBalance(prev => prev - total)
      }

      // إنشاء الطلب
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
        deliveryFee: 0,
        deliveryFeeSetBy: null,
        deliveryFeeSetAt: null,
        total, // الإجمالي بعد الخصم
        status: 'pending',
        deliveryType,
        address: deliveryType === 'pickup' ? 'استلام من المطعم' : address,
        location: deliveryType === 'pickup' ? null : location,
        createdAt: serverTimestamp(),
        updatedAt: serverTimestamp(),
        // معلومات الدفع
        paymentMethod: method,
        paymentStatus: 'paid',
        paypalOrderId: paypalOrderId || null,
        paidAt: serverTimestamp(),
        // 🎁 معلومات العرض المطبّق
        appliedOffer: selectedOffer ? {
          id: selectedOffer.id,
          title: selectedOffer.title,
          offerType: selectedOffer.offerType,
          discountPercent: selectedOffer.discountPercent || null,
          discountAmount: selectedOffer.discountAmount || null,
        } : null,
        discountAmount: discountAmount,
        // 💰 معلومات تقسيم الدخل
        restaurantEarnings,
        platformFee,
        platformFeePerItem: PLATFORM_FEE_PER_ITEM,
        adminCommission,
        adminCommissionPerItem: ADMIN_COMMISSION_PER_ITEM,
        appEarnings,
        totalItemsCount: itemsCount,
        referredBy: restaurant?.referredBy || null,
        courierPlatformFee: deliveryType === 'delivery' ? COURIER_PLATFORM_FEE : 0,
      })

      // تحديث المحافظ (نفس المنطق السابق)
      try {
        const restaurantWalletRef = doc(db, 'wallets', restId)
        const restaurantWalletSnap = await getDoc(restaurantWalletRef)
        
        if (restaurantWalletSnap.exists()) {
          await updateDoc(restaurantWalletRef, {
            pendingBalance: increment(restaurantEarnings),
            totalEarnings: increment(restaurantEarnings),
            updatedAt: serverTimestamp(),
          })
        } else {
          await setDoc(restaurantWalletRef, {
            pendingBalance: restaurantEarnings,
            totalEarnings: restaurantEarnings,
            balance: 0,
            totalWithdrawn: 0,
            transactions: [],
            updatedAt: serverTimestamp(),
          })
        }
      } catch (err) { console.warn('Error updating restaurant wallet:', err) }

      if (referredByAdmin && restaurant?.referredBy && adminCommission > 0) {
        try {
          const adminWalletRef = doc(db, 'wallets', restaurant.referredBy)
          const adminWalletSnap = await getDoc(adminWalletRef)
          
          if (adminWalletSnap.exists()) {
            await updateDoc(adminWalletRef, {
              balance: increment(adminCommission),
              totalEarnings: increment(adminCommission),
              updatedAt: serverTimestamp(),
            })
          } else {
            await setDoc(adminWalletRef, {
              balance: adminCommission,
              totalEarnings: adminCommission,
              totalWithdrawn: 0,
              transactions: [],
              updatedAt: serverTimestamp(),
            })
          }
        } catch (err) { console.warn('Error updating admin wallet:', err) }
      }

      // 🎁 تحديث عداد استخدام العرض
      if (selectedOffer) {
        try {
          await updateDoc(doc(db, 'offers', selectedOffer.id), {
            usedCount: increment(1),
            updatedAt: serverTimestamp()
          })
        } catch (err) {
          console.warn('Error updating offer usage count:', err)
        }
      }

      // 🔔 إرسال إشعارات للمطعم والعميل
      try {
        const { notifyRestaurantNewOrder, notifyOrderCreated } = await import('@/utils/notificationService')
        
        // إشعار للمطعم
        await notifyRestaurantNewOrder(
          restId,
          orderRef.id,
          user.displayName || 'عميل',
          total,
          items.reduce((sum, i) => sum + i.qty, 0)
        )
        
        // إشعار للعميل
        await notifyOrderCreated(
          user.uid,
          orderRef.id,
          restaurant?.name || 'المطعم',
          total
        )
        
        console.log('✅ تم إرسال إشعارات الطلب الجديد')
      } catch (notifErr) {
        console.warn('⚠️ فشل إرسال الإشعارات:', notifErr)
      }

      clear()
      dialog.success(method === 'paypal' 
        ? 'تم إرسال طلبك بنجاح! ✅\nتم الدفع عبر PayPal' 
        : 'تم إرسال طلبك بنجاح! ✅\nتم الخصم من المحفظة')
      nav('/orders')
    } catch (err) {
      console.error('Error placing order:', err)
      dialog.error('فشل في إرسال الطلب')
    } finally {
      setSaving(false)
    }
  }

  return (
    <RoleGate allow={['customer', 'owner', 'admin', 'developer']}>
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

        {/* 🎁 العروض المتاحة */}
        {(availableOffers.length > 0 || loadingOffers) && (
          <div className="bg-white rounded-2xl shadow-lg overflow-hidden">
            <div className="bg-gradient-to-r from-orange-50 to-yellow-50 px-4 py-3 border-b flex items-center gap-2">
              <Gift className="w-5 h-5 text-orange-500" />
              <span className="font-bold text-gray-800">العروض المتاحة</span>
              {availableOffers.length > 0 && (
                <span className="text-xs bg-orange-100 text-orange-600 px-2 py-0.5 rounded-full mr-auto">
                  {availableOffers.length} عرض
                </span>
              )}
            </div>
            <div className="p-4 space-y-3">
              {loadingOffers ? (
                <div className="flex items-center justify-center py-4">
                  <div className="w-6 h-6 border-2 border-orange-300 border-t-orange-600 rounded-full animate-spin" />
                  <span className="mr-2 text-gray-500">جارِ تحميل العروض...</span>
                </div>
              ) : (
                <>
                  {availableOffers.map(offer => {
                    const isSelected = selectedOffer?.id === offer.id
                    const offerIcon = offer.offerType === 'percent_discount' ? <Percent className="w-5 h-5" /> 
                      : offer.offerType === 'fixed_discount' ? <Tag className="w-5 h-5" />
                      : <Gift className="w-5 h-5" />
                    
                    const offerValue = offer.offerType === 'percent_discount' 
                      ? `${offer.discountPercent}%`
                      : offer.offerType === 'fixed_discount'
                      ? `${offer.discountAmount} ر.س`
                      : offer.offerType === 'bundle_meal' && offer.bundlePrice
                      ? `${offer.bundlePrice} ر.س`
                      : ''
                    
                    return (
                      <button
                        key={offer.id}
                        onClick={() => setSelectedOffer(isSelected ? null : offer)}
                        className={`w-full p-4 rounded-xl border-2 transition flex items-center gap-3 ${
                          isSelected
                            ? 'border-orange-500 bg-orange-50'
                            : 'border-gray-200 hover:border-orange-300'
                        }`}
                      >
                        <div className={`w-12 h-12 rounded-xl flex items-center justify-center ${
                          isSelected ? 'bg-orange-500 text-white' : 'bg-orange-100 text-orange-600'
                        }`}>
                          {offerIcon}
                        </div>
                        <div className="flex-1 text-right">
                          <p className={`font-bold ${isSelected ? 'text-orange-700' : 'text-gray-800'}`}>
                            {offer.title}
                          </p>
                          <p className="text-sm text-gray-500">
                            {offer.description || (
                              offer.offerType === 'percent_discount' ? `خصم ${offer.discountPercent}% على طلبك` :
                              offer.offerType === 'fixed_discount' ? `خصم ${offer.discountAmount} ر.س من طلبك` :
                              offer.offerType === 'bundle_meal' ? `وجبة مجمّعة بسعر ${offer.bundlePrice} ر.س` :
                              offer.offerType === 'buy_x_get_y' ? `اشترِ ${offer.buyQuantity} واحصل على ${offer.getQuantity} مجاناً` :
                              'عرض خاص'
                            )}
                          </p>
                          {offer.minOrderAmount && (
                            <p className="text-xs text-gray-400 mt-1">
                              الحد الأدنى للطلب: {offer.minOrderAmount} ر.س
                            </p>
                          )}
                        </div>
                        <div className="flex flex-col items-center">
                          {offerValue && (
                            <span className={`text-lg font-black ${isSelected ? 'text-orange-600' : 'text-gray-700'}`}>
                              {offerValue}
                            </span>
                          )}
                          {isSelected && <Check className="w-5 h-5 text-orange-500 mt-1" />}
                        </div>
                      </button>
                    )
                  })}
                  
                  {/* زر إلغاء العرض المحدد */}
                  {selectedOffer && (
                    <button
                      onClick={() => setSelectedOffer(null)}
                      className="w-full text-center text-sm text-gray-500 hover:text-red-500 py-2"
                    >
                      إلغاء تطبيق العرض
                    </button>
                  )}
                </>
              )}
            </div>
          </div>
        )}

        {/* 🚚 اختيار طريقة الاستلام */}
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

            {/* خيار التوصيل */}
            <button
              onClick={() => setDeliveryType('delivery')}
              className={`w-full p-4 rounded-xl border-2 transition flex items-center gap-4 ${
                deliveryType === 'delivery'
                  ? 'border-sky-500 bg-sky-50'
                  : 'border-gray-200 hover:border-gray-300'
              }`}
            >
              <div className={`w-12 h-12 rounded-xl flex items-center justify-center ${
                deliveryType === 'delivery' ? 'bg-sky-500' : 'bg-gray-100'
              }`}>
                <Truck className={`w-6 h-6 ${deliveryType === 'delivery' ? 'text-white' : 'text-gray-500'}`} />
              </div>
              <div className="flex-1 text-right">
                <p className={`font-bold ${deliveryType === 'delivery' ? 'text-sky-700' : 'text-gray-800'}`}>
                  توصيل للمنزل
                </p>
                <p className="text-sm text-amber-600">رسوم التوصيل يحددها المندوب/الأسرة</p>
              </div>
              {deliveryType === 'delivery' && (
                <Check className="w-6 h-6 text-sky-500" />
              )}
            </button>
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
            {/* 💰 رسوم التطبيق */}
            {appFee > 0 && (
              <div className="flex items-center justify-between text-gray-500">
                <span className="text-sm">رسوم التطبيق</span>
                <span className="font-semibold text-sm">{appFee.toFixed(2)} ر.س</span>
              </div>
            )}
            {/* 🎁 عرض الخصم إذا تم تطبيق عرض */}
            {selectedOffer && discountAmount > 0 && (
              <div className="flex items-center justify-between text-green-600 bg-green-50 -mx-4 px-4 py-2">
                <div className="flex items-center gap-2">
                  <Gift className="w-4 h-4" />
                  <span className="text-sm">خصم: {selectedOffer.title}</span>
                </div>
                <span className="font-bold">- {discountAmount.toFixed(2)} ر.س</span>
              </div>
            )}
            {deliveryType === 'delivery' && (
            <div className="flex items-center justify-between text-amber-600">
              <div className="flex items-center gap-2">
                <Truck className="w-4 h-4" />
                <span>رسوم التوصيل</span>
              </div>
              <span className="font-semibold text-sm">تُحدد لاحقاً</span>
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
              <div className="text-left">
                {discountAmount > 0 && (
                  <span className="text-sm text-gray-400 line-through ml-2">{subtotal.toFixed(2)}</span>
                )}
                <span className="font-black text-xl text-sky-600">{total.toFixed(2)} ر.س</span>
              </div>
            </div>
          </div>
        </div>

        {/* 💳 طريقة الدفع */}
        <div className="bg-white rounded-2xl shadow-lg overflow-hidden">
          <div className="bg-gray-50 px-4 py-3 border-b flex items-center gap-2">
            <CreditCard className="w-5 h-5 text-purple-500" />
            <span className="font-bold text-gray-800">طريقة الدفع</span>
          </div>
          <div className="p-4 space-y-3">
            {/* الدفع عند الاستلام */}
            <button
              onClick={() => setPaymentMethod('cod')}
              className={`w-full p-4 rounded-xl border-2 transition flex items-center gap-3 ${
                paymentMethod === 'cod' 
                  ? 'border-green-500 bg-green-50' 
                  : 'border-gray-200 hover:border-gray-300'
              }`}
            >
              <div className={`w-5 h-5 rounded-full border-2 flex items-center justify-center ${
                paymentMethod === 'cod' ? 'border-green-500' : 'border-gray-300'
              }`}>
                {paymentMethod === 'cod' && <div className="w-3 h-3 rounded-full bg-green-500" />}
              </div>
              <div className="flex-1 text-right">
                <p className="font-bold text-gray-800">💵 الدفع عند الاستلام</p>
                <p className="text-xs text-gray-500">ادفع نقداً عند استلام طلبك</p>
              </div>
            </button>
            
            {/* الدفع بـ PayPal */}
            <button
              onClick={() => setPaymentMethod('paypal')}
              className={`w-full p-4 rounded-xl border-2 transition flex items-center gap-3 ${
                paymentMethod === 'paypal' 
                  ? 'border-blue-500 bg-blue-50' 
                  : 'border-gray-200 hover:border-gray-300'
              }`}
            >
              <div className={`w-5 h-5 rounded-full border-2 flex items-center justify-center ${
                paymentMethod === 'paypal' ? 'border-blue-500' : 'border-gray-300'
              }`}>
                {paymentMethod === 'paypal' && <div className="w-3 h-3 rounded-full bg-blue-500" />}
              </div>
              <div className="flex-1 text-right">
                <p className="font-bold text-gray-800">💳 PayPal</p>
                <p className="text-xs text-gray-500">ادفع بـ Visa/Mastercard أو حساب PayPal</p>
              </div>
            </button>
            
            {/* الدفع من المحفظة */}
            <button
              onClick={() => setPaymentMethod('wallet')}
              disabled={walletBalance < total}
              className={`w-full p-4 rounded-xl border-2 transition flex items-center gap-3 ${
                paymentMethod === 'wallet' 
                  ? 'border-sky-500 bg-sky-50' 
                  : walletBalance < total
                    ? 'border-gray-200 bg-gray-50 opacity-60'
                    : 'border-gray-200 hover:border-gray-300'
              }`}
            >
              <div className={`w-5 h-5 rounded-full border-2 flex items-center justify-center ${
                paymentMethod === 'wallet' ? 'border-sky-500' : 'border-gray-300'
              }`}>
                {paymentMethod === 'wallet' && <div className="w-3 h-3 rounded-full bg-sky-500" />}
              </div>
              <div className="flex-1 text-right">
                <p className="font-bold text-gray-800">
                  <Wallet className="w-4 h-4 inline ml-1" />
                  المحفظة
                  <span className={`text-sm mr-2 ${walletBalance >= total ? 'text-green-600' : 'text-red-500'}`}>
                    ({walletBalance.toFixed(2)} ر.س)
                  </span>
                </p>
                {walletBalance < total ? (
                  <p className="text-xs text-red-500">رصيد غير كافي - تحتاج {(total - walletBalance).toFixed(2)} ر.س</p>
                ) : (
                  <p className="text-xs text-gray-500">ادفع من رصيد محفظتك</p>
                )}
              </div>
            </button>
          </div>
        </div>

        {/* ✅ زر تأكيد الطلب أو PayPal */}
        {paymentMethod === 'paypal' ? (
          <div className="space-y-3">
            <p className="text-center text-sm text-gray-600">
              اضغط على زر PayPal لإتمام الدفع بمبلغ <span className="font-bold text-sky-600">{total.toFixed(2)} ر.س</span>
              <span className="text-gray-400 text-xs mr-1">(≈ ${PAYPAL_CONFIG.sarToUsd(total)})</span>
            </p>
            <PayPalScriptProvider options={getPayPalOptions()}>
              <PayPalButtons
                style={{
                  layout: 'vertical',
                  shape: 'pill',
                  color: 'blue',
                  label: 'pay',
                  height: 50
                }}
                disabled={saving || processingPayment || (deliveryType === 'delivery' && DELIVERY_AVAILABLE && !location)}
                createOrder={(_data, actions) => {
                  const usdAmount = PAYPAL_CONFIG.sarToUsd(total)
                  return actions.order.create({
                    intent: 'CAPTURE',
                    purchase_units: [{
                      amount: {
                        currency_code: 'USD',
                        value: usdAmount.toString()
                      },
                      description: `طلب من ${restaurant?.name || 'سفرة البيت'}`
                    }]
                  })
                }}
                onApprove={async (_data, actions) => {
                  if (actions.order) {
                    setProcessingPayment(true)
                    try {
                      const details = await actions.order.capture()
                      // إنشاء الطلب مع معلومات الدفع
                      await placeOrderWithPayment('paypal', details.id)
                    } catch (err) {
                      console.error('PayPal capture error:', err)
                      toast.error('فشل في إتمام الدفع')
                    } finally {
                      setProcessingPayment(false)
                    }
                  }
                }}
                onError={(err) => {
                  console.error('PayPal Error:', err)
                  toast.error('حدث خطأ في عملية الدفع')
                }}
                onCancel={() => {
                  toast.info('تم إلغاء عملية الدفع')
                }}
              />
            </PayPalScriptProvider>
            {processingPayment && (
              <div className="flex items-center justify-center gap-2 text-sky-600">
                <RefreshCw className="w-5 h-5 animate-spin" />
                <span>جارِ معالجة طلبك...</span>
              </div>
            )}
          </div>
        ) : (
          <button
            disabled={saving || (deliveryType === 'delivery' && DELIVERY_AVAILABLE && !location) || (paymentMethod === 'wallet' && walletBalance < total)}
            onClick={() => {
              if (paymentMethod === 'wallet') {
                placeOrderWithPayment('wallet')
              } else {
                placeOrder()
              }
            }}
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
                {paymentMethod === 'wallet' 
                  ? `تأكيد الطلب (خصم ${total.toFixed(2)} من المحفظة)`
                  : deliveryType === 'pickup' 
                    ? 'تأكيد الطلب (استلام من المطعم)' 
                    : 'تأكيد الطلب (دفع عند الاستلام)'}
              </>
            )}
          </button>
        )}

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

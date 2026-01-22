// src/pages/PackagesPage.tsx
import React, { useState, useEffect, useRef } from 'react'
import { useAuth } from '@/auth'
import { db, storage } from '@/firebase'
import { doc, getDoc, updateDoc, serverTimestamp, addDoc, collection, query, where, getDocs, onSnapshot } from 'firebase/firestore'
import { ref, uploadBytes, getDownloadURL } from 'firebase/storage'
import { useToast } from '@/components/ui/Toast'
import { useDialog } from '@/components/ui/ConfirmDialog'
import { 
  Crown, 
  Star, 
  Check, 
  Sparkles, 
  TrendingUp, 
  Eye, 
  ShoppingBag,
  FileText,
  Award,
  Megaphone,
  Calendar,
  ChevronLeft,
  Gift,
  Home,
  Upload,
  ExternalLink,
  Clock,
  CreditCard
} from 'lucide-react'

type PackageType = 'free' | 'premium'
type RequestStatus = 'pending' | 'bank_sent' | 'payment_sent' | 'approved' | 'rejected' | 'expired'

type PackageRequest = {
  id: string
  status: RequestStatus
  bankAccountImageUrl?: string
  paymentProofImageUrl?: string
  subscriptionAmount?: number
  subscriptionDuration?: number
  createdAt?: any
  expiresAt?: any
}

export const PackagesPage: React.FC = () => {
  const { user } = useAuth()
  const toast = useToast()
  const dialog = useDialog()
  const [currentPackage, setCurrentPackage] = useState<PackageType>('free')
  const [loading, setLoading] = useState(true)
  const [subscribing, setSubscribing] = useState(false)
  const [selectingFree, setSelectingFree] = useState(false)
  
  // حالة طلب الاشتراك
  const [activeRequest, setActiveRequest] = useState<PackageRequest | null>(null)
  const [uploadingProof, setUploadingProof] = useState(false)
  const [proofFile, setProofFile] = useState<File | null>(null)
  const proofFileRef = useRef<HTMLInputElement>(null)

  useEffect(() => {
    if (!user) return
    
    const loadData = async () => {
      try {
        // تحميل بيانات المطعم
        const restSnap = await getDoc(doc(db, 'restaurants', user.uid))
        if (restSnap.exists()) {
          const data = restSnap.data()
          setCurrentPackage(data?.packageType || 'free')
        }
        
        // تحميل طلب الاشتراك النشط
        const requestsQuery = query(
          collection(db, 'packageRequests'),
          where('restaurantId', '==', user.uid)
        )
        const requestsSnap = await getDocs(requestsQuery)
        if (!requestsSnap.empty) {
          // جلب آخر طلب
          const requests = requestsSnap.docs.map(d => ({ id: d.id, ...d.data() } as PackageRequest))
          const activeReq = requests.find(r => !['approved', 'rejected', 'expired'].includes(r.status))
          if (activeReq) {
            setActiveRequest(activeReq)
          }
        }
      } catch (err) {
        console.error('خطأ في تحميل البيانات:', err)
      } finally {
        setLoading(false)
      }
    }
    
    loadData()
    
    // الاستماع لتحديثات الطلب في الوقت الفعلي
    const requestsQuery = query(
      collection(db, 'packageRequests'),
      where('restaurantId', '==', user.uid)
    )
    const unsub = onSnapshot(requestsQuery, (snap) => {
      if (!snap.empty) {
        const requests = snap.docs.map(d => ({ id: d.id, ...d.data() } as PackageRequest))
        const activeReq = requests.find(r => !['approved', 'rejected', 'expired'].includes(r.status))
        setActiveRequest(activeReq || null)
        
        // إذا تمت الموافقة، تحديث الباقة
        const approvedReq = requests.find(r => r.status === 'approved')
        if (approvedReq) {
          setCurrentPackage('premium')
        }
      }
    })
    
    return () => unsub()
  }, [user])

  // اختيار الباقة المجانية
  const handleSelectFree = async () => {
    if (!user) return
    if (currentPackage === 'free') {
      toast.info('أنت بالفعل مشترك في الباقة المجانية')
      return
    }
    
    const confirmed = await dialog.confirm(
      'هل تريد التحويل إلى الباقة المجانية؟ ستفقد مميزات باقة التميز.',
      {
        title: '📦 التحويل للباقة المجانية',
        confirmText: 'نعم، حوّل للمجانية',
        cancelText: 'إلغاء',
      }
    )
    
    if (!confirmed) return

    setSelectingFree(true)
    try {
      await updateDoc(doc(db, 'restaurants', user.uid), {
        packageType: 'free',
        packageRequest: null,
        updatedAt: serverTimestamp(),
      })
      setCurrentPackage('free')
      toast.success('تم التحويل للباقة المجانية')
    } catch (err) {
      console.error('خطأ:', err)
      toast.error('حدث خطأ، حاول مرة أخرى')
    } finally {
      setSelectingFree(false)
    }
  }

  // الاشتراك في باقة التميز
  const handleSubscribePremium = async () => {
    if (!user) return
    
    // التحقق من وجود طلب نشط
    if (activeRequest) {
      toast.info('لديك طلب اشتراك قيد المعالجة')
      return
    }
    
    const confirmed = await dialog.confirm(
      'سيتم إرسال طلبك للمطور وسيتواصل معك لإتمام الاشتراك في باقة التميز. هل تريد المتابعة؟',
      {
        title: '✨ الاشتراك في باقة التميز',
        confirmText: 'نعم، أريد الاشتراك',
        cancelText: 'لاحقاً',
      }
    )
    
    if (!confirmed) return

    setSubscribing(true)
    try {
      // جلب بيانات المطعم
      const restSnap = await getDoc(doc(db, 'restaurants', user.uid))
      const restData = restSnap.data()
      
      // إنشاء طلب اشتراك جديد
      const requestRef = await addDoc(collection(db, 'packageRequests'), {
        restaurantId: user.uid,
        restaurantName: restData?.name || 'أسرة منتجة',
        ownerName: restData?.ownerName || '',
        ownerPhone: restData?.phone || '',
        status: 'pending',
        subscriptionAmount: 99, // سيحدده المطور
        subscriptionDuration: 30, // 30 يوم
        requestedAt: serverTimestamp(),
        createdAt: serverTimestamp(),
        updatedAt: serverTimestamp(),
      })
      
      // تحديث المطعم
      await updateDoc(doc(db, 'restaurants', user.uid), {
        packageRequest: 'premium',
        packageRequestedAt: serverTimestamp(),
        updatedAt: serverTimestamp(),
      })
      
      // إرسال إشعار للمطور
      try {
        const devQuery = query(collection(db, 'users'), where('role', '==', 'developer'))
        const devSnap = await getDocs(devQuery)
        
        if (!devSnap.empty) {
          // إرسال إشعار لكل المطورين
          for (const devDoc of devSnap.docs) {
            await addDoc(collection(db, 'notifications'), {
              recipientId: devDoc.id,
              title: '📦 طلب اشتراك جديد في باقة التميز',
              message: `${restData?.name || 'أسرة منتجة'} طلبت الاشتراك في باقة التميز`,
              type: 'package_request',
              read: false,
              data: { requestId: requestRef.id, restaurantId: user.uid },
              createdAt: serverTimestamp(),
            })
          }
        } else {
          // لا يوجد مطور - نرسل للمشرفين بدلاً منه
          const adminQuery = query(collection(db, 'users'), where('role', '==', 'admin'))
          const adminSnap = await getDocs(adminQuery)
          for (const adminDoc of adminSnap.docs) {
            await addDoc(collection(db, 'notifications'), {
              recipientId: adminDoc.id,
              title: '📦 طلب اشتراك جديد في باقة التميز',
              message: `${restData?.name || 'أسرة منتجة'} طلبت الاشتراك في باقة التميز`,
              type: 'package_request',
              read: false,
              data: { requestId: requestRef.id, restaurantId: user.uid },
              createdAt: serverTimestamp(),
            })
          }
        }
      } catch (notifErr) {
        // لا نوقف العملية إذا فشل إرسال الإشعار
        console.warn('فشل إرسال الإشعار:', notifErr)
      }
      
      toast.success('تم إرسال طلب الاشتراك! سنتواصل معك قريباً ✨')
    } catch (err) {
      console.error('خطأ في إرسال الطلب:', err)
      toast.error('حدث خطأ، حاول مرة أخرى')
    } finally {
      setSubscribing(false)
    }
  }

  // رفع إثبات التحويل
  const handleUploadPaymentProof = async () => {
    if (!user || !activeRequest || !proofFile) {
      toast.warning('يرجى اختيار صورة إثبات التحويل')
      return
    }

    setUploadingProof(true)
    try {
      // رفع الصورة
      const path = `paymentProofs/${user.uid}_${Date.now()}_${proofFile.name}`
      const storageRef = ref(storage, path)
      await uploadBytes(storageRef, proofFile)
      const imageUrl = await getDownloadURL(storageRef)

      // تحديث الطلب
      await updateDoc(doc(db, 'packageRequests', activeRequest.id), {
        status: 'payment_sent',
        paymentProofImageUrl: imageUrl,
        paymentSentAt: serverTimestamp(),
        updatedAt: serverTimestamp(),
      })

      // إرسال إشعار للمطور
      try {
        const restSnap = await getDoc(doc(db, 'restaurants', user.uid))
        const restName = restSnap.data()?.name || 'أسرة منتجة'
        
        const devQuery = query(collection(db, 'users'), where('role', '==', 'developer'))
        const devSnap = await getDocs(devQuery)
        
        if (!devSnap.empty) {
          for (const devDoc of devSnap.docs) {
            await addDoc(collection(db, 'notifications'), {
              recipientId: devDoc.id,
              title: '💳 تم إرسال إثبات تحويل',
              message: `${restName} أرسلت إثبات تحويل مبلغ الاشتراك`,
              type: 'payment_proof_sent',
              read: false,
              data: { requestId: activeRequest.id, restaurantId: user.uid },
              createdAt: serverTimestamp(),
            })
          }
        } else {
          // لا يوجد مطور - نرسل للمشرفين
          const adminQuery = query(collection(db, 'users'), where('role', '==', 'admin'))
          const adminSnap = await getDocs(adminQuery)
          for (const adminDoc of adminSnap.docs) {
            await addDoc(collection(db, 'notifications'), {
              recipientId: adminDoc.id,
              title: '💳 تم إرسال إثبات تحويل',
              message: `${restName} أرسلت إثبات تحويل مبلغ الاشتراك`,
              type: 'payment_proof_sent',
              read: false,
              data: { requestId: activeRequest.id, restaurantId: user.uid },
              createdAt: serverTimestamp(),
            })
          }
        }
      } catch (notifErr) {
        console.warn('فشل إرسال الإشعار:', notifErr)
      }

      toast.success('تم إرسال إثبات التحويل بنجاح! سيتم مراجعته وتفعيل الباقة ✨')
      setProofFile(null)
      if (proofFileRef.current) proofFileRef.current.value = ''
    } catch (err: any) {
      console.error('خطأ في رفع الإثبات:', err)
      toast.error(`حدث خطأ: ${err.message}`)
    } finally {
      setUploadingProof(false)
    }
  }

  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-[400px]">
        <div className="text-center">
          <div className="w-12 h-12 border-4 border-amber-200 border-t-amber-500 rounded-full animate-spin mx-auto mb-4" />
          <p className="text-gray-500">جارِ التحميل...</p>
        </div>
      </div>
    )
  }

  return (
    <div className="max-w-4xl mx-auto space-y-8">
      {/* العنوان الرئيسي */}
      <div className="text-center">
        <div className="inline-flex items-center gap-2 bg-gradient-to-r from-amber-100 to-yellow-100 px-5 py-2.5 rounded-full mb-4 shadow-sm">
          <span className="text-xl">💼</span>
          <span className="text-amber-700 font-bold text-lg">باقات سفرة البيت</span>
        </div>
        <h1 className="text-3xl md:text-4xl font-black text-gray-900 mb-3">
          اختر الباقة المناسبة لأسرتك
        </h1>
        <p className="text-gray-600 max-w-lg mx-auto">
          ابدأ مجاناً واستمتع بجميع المميزات الأساسية، أو اشترك في باقة التميز للحصول على مزايا حصرية
        </p>
      </div>

      {/* === قسم حالة طلب الاشتراك النشط === */}
      {activeRequest && (
        <div className="bg-gradient-to-r from-amber-50 to-orange-50 rounded-2xl p-6 border-2 border-amber-200 shadow-lg">
          <div className="flex items-center gap-3 mb-4">
            <div className="w-12 h-12 bg-amber-500 rounded-xl flex items-center justify-center">
              <CreditCard className="w-6 h-6 text-white" />
            </div>
            <div>
              <h3 className="text-xl font-bold text-amber-800">طلب اشتراك قيد المعالجة</h3>
              <p className="text-amber-600 text-sm">
                {activeRequest.status === 'pending' && '⏳ بانتظار إرسال بيانات الحساب البنكي'}
                {activeRequest.status === 'bank_sent' && '🏦 تم إرسال بيانات البنك - يرجى التحويل ورفع الإثبات'}
                {activeRequest.status === 'payment_sent' && '💳 تم إرسال إثبات التحويل - بانتظار التأكيد'}
              </p>
            </div>
          </div>

          {/* === حالة: المطور أرسل صورة البنك === */}
          {activeRequest.status === 'bank_sent' && (
            <div className="space-y-4">
              {/* عرض صورة الحساب البنكي */}
              {activeRequest.bankAccountImageUrl && (
                <div className="bg-white rounded-xl p-4">
                  <p className="font-semibold text-gray-700 mb-2">📋 بيانات الحساب البنكي للتحويل:</p>
                  <a
                    href={activeRequest.bankAccountImageUrl}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="inline-flex items-center gap-2 bg-blue-100 hover:bg-blue-200 text-blue-700 px-4 py-2 rounded-lg transition"
                  >
                    <ExternalLink className="w-5 h-5" />
                    عرض صورة الحساب البنكي
                  </a>
                  <p className="text-green-600 font-bold mt-2">
                    💰 المبلغ المطلوب: {activeRequest.subscriptionAmount || 99} ريال
                  </p>
                </div>
              )}

              {/* رفع إثبات التحويل */}
              <div className="bg-white rounded-xl p-4 space-y-3">
                <p className="font-semibold text-gray-700">📤 بعد التحويل، ارفع صورة إثبات التحويل:</p>
                <input
                  ref={proofFileRef}
                  type="file"
                  accept="image/*"
                  onChange={(e) => setProofFile(e.target.files?.[0] || null)}
                  className="w-full border-2 border-dashed border-amber-300 rounded-xl p-4 bg-amber-50"
                />
                {proofFile && (
                  <p className="text-sm text-green-600">✅ تم اختيار: {proofFile.name}</p>
                )}
                <button
                  onClick={handleUploadPaymentProof}
                  disabled={uploadingProof || !proofFile}
                  className="w-full bg-gradient-to-r from-green-500 to-emerald-600 hover:from-green-600 hover:to-emerald-700 text-white py-3 rounded-xl font-bold disabled:opacity-50 transition flex items-center justify-center gap-2"
                >
                  {uploadingProof ? (
                    <>
                      <Clock className="w-5 h-5 animate-spin" />
                      جارِ الرفع...
                    </>
                  ) : (
                    <>
                      <Upload className="w-5 h-5" />
                      إرسال إثبات التحويل
                    </>
                  )}
                </button>
              </div>
            </div>
          )}

          {/* === حالة: بانتظار تأكيد المطور === */}
          {activeRequest.status === 'payment_sent' && (
            <div className="bg-purple-100 rounded-xl p-4 flex items-center gap-3">
              <Clock className="w-8 h-8 text-purple-600 animate-pulse" />
              <div>
                <p className="font-bold text-purple-800">تم إرسال إثبات التحويل بنجاح ✅</p>
                <p className="text-purple-600 text-sm">جارِ مراجعة الإثبات وتفعيل الباقة... سيتم إشعارك قريباً</p>
              </div>
            </div>
          )}

          {/* === حالة: طلب جديد بانتظار المطور === */}
          {activeRequest.status === 'pending' && (
            <div className="bg-yellow-100 rounded-xl p-4 flex items-center gap-3">
              <Clock className="w-8 h-8 text-yellow-600 animate-pulse" />
              <div>
                <p className="font-bold text-yellow-800">تم إرسال طلبك بنجاح ✅</p>
                <p className="text-yellow-600 text-sm">جارِ مراجعة الطلب وإرسال بيانات الحساب البنكي للتحويل...</p>
              </div>
            </div>
          )}
        </div>
      )}

      {/* الباقات */}
      <div className="grid md:grid-cols-2 gap-6">
        
        {/* ═══════════════════════════════════════════════════════ */}
        {/* الباقة المجانية */}
        {/* ═══════════════════════════════════════════════════════ */}
        <div className={`relative rounded-3xl overflow-hidden transition-all duration-300 ${
          currentPackage === 'free' 
            ? 'ring-4 ring-green-400 shadow-2xl' 
            : 'shadow-lg hover:shadow-xl'
        }`}>
          {currentPackage === 'free' && (
            <div className="absolute top-4 right-4 bg-green-500 text-white px-3 py-1 rounded-full text-sm font-bold flex items-center gap-1 z-10">
              <Check className="w-4 h-4" />
              باقتك الحالية
            </div>
          )}
          
          <div className="bg-gradient-to-br from-green-50 via-emerald-50 to-teal-50 p-6 md:p-8 h-full flex flex-col">
            {/* رأس الباقة */}
            <div className="flex items-center gap-4 mb-6">
              <div className="w-16 h-16 bg-gradient-to-br from-green-400 to-emerald-500 rounded-2xl flex items-center justify-center shadow-lg">
                <Gift className="w-8 h-8 text-white" />
              </div>
              <div>
                <h2 className="text-2xl font-black text-gray-900">الباقة المجانية</h2>
                <p className="text-green-600 font-semibold">للجميع • مدى الحياة</p>
              </div>
            </div>

            {/* السعر */}
            <div className="bg-white/70 backdrop-blur rounded-2xl p-4 mb-6 text-center">
              <div className="flex items-baseline justify-center gap-1">
                <span className="text-5xl font-black text-gray-900">0</span>
                <span className="text-xl text-gray-600">ر.س</span>
              </div>
              <p className="text-green-600 font-medium mt-1">مجاناً للأبد</p>
            </div>

            {/* المميزات */}
            <div className="space-y-4 flex-1">
              <h3 className="font-bold text-gray-800 flex items-center gap-2">
                <Star className="w-5 h-5 text-amber-500" />
                المميزات المتاحة:
              </h3>
              
              <div className="space-y-3">
                <FeatureItem 
                  icon={<Eye className="w-5 h-5" />}
                  title="الظهور في التطبيق"
                  desc="أسرتك تظهر لجميع العملاء في منطقتك"
                  included
                />
                <FeatureItem 
                  icon={<ShoppingBag className="w-5 h-5" />}
                  title="استقبال الطلبات"
                  desc="استقبل طلبات العملاء بدون حدود"
                  included
                />
                <FeatureItem 
                  icon={<FileText className="w-5 h-5" />}
                  title="صفحة خاصة لأسرتك"
                  desc="صفحة مخصصة تعرض قائمتك ومنتجاتك"
                  included
                />
              </div>
            </div>

            {/* زر الباقة المجانية */}
            <div className="mt-6">
              {currentPackage === 'free' ? (
                <div className="bg-green-100 text-green-700 py-4 px-6 rounded-2xl text-center font-bold flex items-center justify-center gap-2">
                  <Check className="w-5 h-5" />
                  أنت مشترك في هذه الباقة
                </div>
              ) : (
                <button
                  onClick={handleSelectFree}
                  disabled={selectingFree}
                  className="w-full py-4 px-6 rounded-2xl bg-gradient-to-r from-green-500 to-emerald-500 text-white font-bold text-lg shadow-lg hover:shadow-xl transition-all duration-300 hover:scale-[1.02] disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center gap-3"
                >
                  {selectingFree ? (
                    <>
                      <div className="w-5 h-5 border-2 border-white/30 border-t-white rounded-full animate-spin" />
                      جارِ التحويل...
                    </>
                  ) : (
                    <>
                      <Gift className="w-6 h-6" />
                      اختر الباقة المجانية
                      <ChevronLeft className="w-5 h-5" />
                    </>
                  )}
                </button>
              )}
            </div>
          </div>
        </div>

        {/* ═══════════════════════════════════════════════════════ */}
        {/* باقة التميز */}
        {/* ═══════════════════════════════════════════════════════ */}
        <div className={`relative rounded-3xl overflow-hidden transition-all duration-300 ${
          currentPackage === 'premium' 
            ? 'ring-4 ring-amber-400 shadow-2xl' 
            : 'shadow-lg hover:shadow-xl hover:scale-[1.01]'
        }`}>
          {/* شريط التميز */}
          <div className="absolute top-0 left-0 right-0 bg-gradient-to-r from-amber-500 via-yellow-400 to-amber-500 py-2 text-center z-10">
            <div className="flex items-center justify-center gap-2 text-white font-bold">
              <Crown className="w-5 h-5" />
              <span>الأكثر شعبية</span>
              <Crown className="w-5 h-5" />
            </div>
          </div>

          {currentPackage === 'premium' && (
            <div className="absolute top-12 right-4 bg-amber-500 text-white px-3 py-1 rounded-full text-sm font-bold flex items-center gap-1 z-10">
              <Crown className="w-4 h-4" />
              باقتك الحالية
            </div>
          )}
          
          <div className="bg-gradient-to-br from-amber-50 via-yellow-50 to-orange-50 p-6 md:p-8 pt-14 h-full flex flex-col">
            {/* رأس الباقة */}
            <div className="flex items-center gap-4 mb-6">
              <div className="w-16 h-16 bg-gradient-to-br from-amber-400 via-yellow-400 to-orange-400 rounded-2xl flex items-center justify-center shadow-lg relative">
                <Crown className="w-8 h-8 text-white" />
                <div className="absolute -top-1 -right-1 w-6 h-6 bg-white rounded-full flex items-center justify-center shadow">
                  <Sparkles className="w-4 h-4 text-amber-500" />
                </div>
              </div>
              <div>
                <h2 className="text-2xl font-black text-gray-900">باقة التميّز</h2>
                <p className="text-amber-600 font-semibold">للأسر المميزة ✨</p>
              </div>
            </div>

            {/* السعر */}
            <div className="bg-white/70 backdrop-blur rounded-2xl p-4 mb-6 text-center relative overflow-hidden">
              <div className="absolute inset-0 bg-gradient-to-r from-amber-400/10 via-yellow-400/10 to-orange-400/10" />
              <div className="relative">
                <div className="flex items-baseline justify-center gap-1">
                  <span className="text-5xl font-black bg-gradient-to-r from-amber-600 to-orange-500 bg-clip-text text-transparent">99</span>
                  <span className="text-xl text-gray-600">ر.س</span>
                </div>
                <p className="text-amber-600 font-medium mt-1">شهرياً</p>
              </div>
            </div>

            {/* المميزات */}
            <div className="space-y-4 flex-1">
              <h3 className="font-bold text-gray-800 flex items-center gap-2">
                <Crown className="w-5 h-5 text-amber-500" />
                جميع مميزات الباقة المجانية، بالإضافة إلى:
              </h3>
              
              <div className="space-y-3">
                <FeatureItem 
                  icon={<TrendingUp className="w-5 h-5" />}
                  title="الظهور أعلى في النتائج"
                  desc="أسرتك تظهر في أعلى قائمة البحث دائماً"
                  included
                  premium
                />
                <FeatureItem 
                  icon={<Award className="w-5 h-5" />}
                  title="علامة أسرة مميزة"
                  desc="شارة ذهبية تميزك عن الآخرين"
                  included
                  premium
                />
                <FeatureItem 
                  icon={<Home className="w-5 h-5" />}
                  title="اقتراحك في الصفحة الرئيسية"
                  desc="ظهور أسرتك في قسم الأسر المميزة"
                  included
                  premium
                />
                <FeatureItem 
                  icon={<Calendar className="w-5 h-5" />}
                  title="الحملات الموسمية"
                  desc="دخول مجاني في حملات رمضان والأعياد"
                  included
                  premium
                />
              </div>
            </div>

            {/* زر الاشتراك */}
            <div className="mt-6">
              {currentPackage === 'premium' ? (
                <div className="bg-amber-100 text-amber-700 py-4 px-6 rounded-2xl text-center font-bold flex items-center justify-center gap-2">
                  <Crown className="w-5 h-5" />
                  أنت مشترك في باقة التميز
                </div>
              ) : (
                <button
                  onClick={handleSubscribePremium}
                  disabled={subscribing}
                  className="w-full py-4 px-6 rounded-2xl bg-gradient-to-r from-amber-500 via-yellow-400 to-orange-500 text-white font-bold text-lg shadow-xl hover:shadow-2xl transition-all duration-300 hover:scale-[1.02] disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center gap-3 relative overflow-hidden group"
                >
                  <div className="absolute inset-0 bg-gradient-to-r from-white/0 via-white/30 to-white/0 translate-x-[-100%] group-hover:translate-x-[100%] transition-transform duration-700" />
                  {subscribing ? (
                    <>
                      <div className="w-5 h-5 border-2 border-white/30 border-t-white rounded-full animate-spin" />
                      جارِ الإرسال...
                    </>
                  ) : (
                    <>
                      <Crown className="w-6 h-6" />
                      اشترك في باقة التميّز
                      <ChevronLeft className="w-5 h-5" />
                    </>
                  )}
                </button>
              )}
            </div>
          </div>
        </div>
      </div>

      {/* مقارنة سريعة */}
      <div className="bg-white rounded-3xl shadow-xl overflow-hidden">
        <div className="bg-gradient-to-r from-gray-800 to-gray-900 px-6 py-4">
          <h3 className="text-white font-bold text-lg flex items-center gap-2">
            <Sparkles className="w-5 h-5 text-amber-400" />
            مقارنة سريعة بين الباقات
          </h3>
        </div>
        <div className="overflow-x-auto">
          <table className="w-full">
            <thead className="bg-gray-50">
              <tr>
                <th className="px-6 py-4 text-right font-bold text-gray-700">الميزة</th>
                <th className="px-6 py-4 text-center font-bold text-green-600">
                  <div className="flex items-center justify-center gap-2">
                    <Gift className="w-5 h-5" />
                    المجانية
                  </div>
                </th>
                <th className="px-6 py-4 text-center font-bold text-amber-600">
                  <div className="flex items-center justify-center gap-2">
                    <Crown className="w-5 h-5" />
                    التميّز
                  </div>
                </th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-100">
              <CompareRow label="الظهور في التطبيق" free premium />
              <CompareRow label="استقبال الطلبات" free premium />
              <CompareRow label="صفحة خاصة لأسرتك" free premium />
              <CompareRow label="الظهور أعلى في النتائج" premium />
              <CompareRow label="علامة أسرة مميزة" premium />
              <CompareRow label="اقتراحك في الصفحة الرئيسية" premium />
              <CompareRow label="الحملات الموسمية" premium />
            </tbody>
          </table>
        </div>
      </div>

      {/* ملاحظة */}
      <div className="bg-gradient-to-r from-sky-50 to-blue-50 rounded-2xl p-6 text-center">
        <p className="text-gray-600">
          <span className="font-bold text-sky-600">💡 ملاحظة:</span>
          {' '}يمكنك الترقية أو إلغاء الاشتراك في أي وقت. لا توجد التزامات طويلة المدى.
        </p>
      </div>
    </div>
  )
}

// مكون عنصر الميزة
const FeatureItem: React.FC<{
  icon: React.ReactNode
  title: string
  desc: string
  included: boolean
  premium?: boolean
}> = ({ icon, title, desc, included, premium }) => (
  <div className={`flex items-start gap-3 p-3 rounded-xl transition ${
    included 
      ? premium 
        ? 'bg-gradient-to-r from-amber-100/50 to-yellow-100/50' 
        : 'bg-white/50'
      : 'opacity-50'
  }`}>
    <div className={`w-10 h-10 rounded-xl flex items-center justify-center flex-shrink-0 ${
      included
        ? premium
          ? 'bg-gradient-to-br from-amber-400 to-orange-400 text-white'
          : 'bg-green-100 text-green-600'
        : 'bg-gray-100 text-gray-400'
    }`}>
      {icon}
    </div>
    <div className="flex-1">
      <div className="flex items-center gap-2">
        <h4 className={`font-bold ${included ? 'text-gray-800' : 'text-gray-400'}`}>{title}</h4>
        {premium && (
          <span className="bg-gradient-to-r from-amber-400 to-orange-400 text-white text-xs px-2 py-0.5 rounded-full font-bold">
            حصري
          </span>
        )}
      </div>
      <p className={`text-sm ${included ? 'text-gray-500' : 'text-gray-400'}`}>{desc}</p>
    </div>
    {included && (
      <Check className={`w-5 h-5 flex-shrink-0 ${premium ? 'text-amber-500' : 'text-green-500'}`} />
    )}
  </div>
)

// مكون صف المقارنة
const CompareRow: React.FC<{
  label: string
  free?: boolean
  premium?: boolean
}> = ({ label, free, premium }) => (
  <tr className="hover:bg-gray-50 transition">
    <td className="px-6 py-4 text-gray-700 font-medium">{label}</td>
    <td className="px-6 py-4 text-center">
      {free ? (
        <div className="inline-flex items-center justify-center w-8 h-8 bg-green-100 rounded-full">
          <Check className="w-5 h-5 text-green-600" />
        </div>
      ) : (
        <div className="inline-flex items-center justify-center w-8 h-8 bg-gray-100 rounded-full">
          <span className="text-gray-400">—</span>
        </div>
      )}
    </td>
    <td className="px-6 py-4 text-center">
      {premium ? (
        <div className="inline-flex items-center justify-center w-8 h-8 bg-amber-100 rounded-full">
          <Check className="w-5 h-5 text-amber-600" />
        </div>
      ) : (
        <div className="inline-flex items-center justify-center w-8 h-8 bg-gray-100 rounded-full">
          <span className="text-gray-400">—</span>
        </div>
      )}
    </td>
  </tr>
)

export default PackagesPage

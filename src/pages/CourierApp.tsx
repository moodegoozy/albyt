import React, { useEffect, useState } from 'react'
import { collection, doc, onSnapshot, orderBy, query, updateDoc, where, serverTimestamp, limit } from 'firebase/firestore'
import { db } from '@/firebase'
import { useAuth } from '@/auth'
import { Order } from '@/types'
import { useNavigate } from 'react-router-dom'
import { useToast } from '@/components/ui/Toast'
import { 
  MessageCircle, Package, MapPin, Truck, CheckCircle, 
  Clock, Navigation, Phone, DollarSign, Sparkles, AlertCircle 
} from 'lucide-react'

// رسوم المنصة على كل طلب توصيل (تُخصم من المندوب)
const COURIER_PLATFORM_FEE = 3.75

export const CourierApp: React.FC = () => {
  const { user } = useAuth()
  const nav = useNavigate()
  const toast = useToast()
  const [ready, setReady] = useState<Order[]>([])
  const [mine, setMine] = useState<Order[]>([])
  const [deliveryFees, setDeliveryFees] = useState<Record<string, string>>({})
  const [savingFee, setSavingFee] = useState<string | null>(null)

  useEffect(() => {
    if (!user?.uid) return
    
    // ✅ إضافة limit لتحسين الأداء
    const q1 = query(
      collection(db, 'orders'), 
      where('status', 'in', ['ready']), 
      orderBy('createdAt', 'desc'),
      limit(20) // أحدث 20 طلب جاهز
    )
    const u1 = onSnapshot(q1, (snap) => setReady(snap.docs.map(d => ({ id: d.id, ...d.data() } as Order))))
    
    const q2 = query(
      collection(db, 'orders'), 
      where('courierId', '==', user.uid), 
      orderBy('createdAt', 'desc'),
      limit(20) // أحدث 20 طلب للمندوب
    )
    const u2 = onSnapshot(q2, (snap) => setMine(snap.docs.map(d => ({ id: d.id, ...d.data() } as Order))))
    
    return () => { u1(); u2() }
  }, [user?.uid])

  const take = async (id: string, order: Order) => {
    if (!user) return
    
    // التحقق من تحديد رسوم التوصيل
    if (!order.deliveryFeeSetBy) {
      const feeStr = deliveryFees[id]
      const fee = parseFloat(feeStr)
      
      if (isNaN(fee) || fee < 0) {
        toast.error('حدد رسوم التوصيل أولاً')
        return
      }

      setSavingFee(id)
      const newTotal = order.subtotal + fee

      // تحديد رسوم التوصيل واستلام الطلب معاً
      await updateDoc(doc(db, 'orders', id), { 
        courierId: user.uid, 
        status: 'out_for_delivery',
        deliveryFee: fee,
        deliveryFeeSetBy: 'courier',
        deliveryFeeSetAt: serverTimestamp(),
        total: newTotal,
        courierPlatformFee: COURIER_PLATFORM_FEE, // رسوم المنصة على المندوب
        updatedAt: serverTimestamp() 
      })
      
      setSavingFee(null)
      toast.success(`تم استلام الطلب! رسوم التوصيل: ${fee} ر.س (- ${COURIER_PLATFORM_FEE} رسوم منصة)`)
    } else {
      // رسوم التوصيل محددة مسبقاً من الأسرة
      await updateDoc(doc(db, 'orders', id), { 
        courierId: user.uid, 
        status: 'out_for_delivery',
        courierPlatformFee: COURIER_PLATFORM_FEE,
        updatedAt: serverTimestamp() 
      })
      toast.success('تم استلام الطلب!')
    }
  }

  const delivered = async (id: string) => {
    await updateDoc(doc(db, 'orders', id), { status: 'delivered', updatedAt: serverTimestamp() })
  }

  return (
    <div className="space-y-6">
      {/* إحصائيات سريعة */}
      <div className="grid grid-cols-2 gap-4">
        <div className="bg-gradient-to-br from-sky-500 to-blue-600 rounded-2xl p-4 text-white shadow-lg">
          <div className="flex items-center gap-2 mb-1">
            <Package className="w-5 h-5" />
            <span className="text-sm opacity-90">طلبات جاهزة</span>
          </div>
          <div className="text-3xl font-bold">{ready.length}</div>
        </div>
        <div className="bg-gradient-to-br from-green-500 to-emerald-600 rounded-2xl p-4 text-white shadow-lg">
          <div className="flex items-center gap-2 mb-1">
            <Truck className="w-5 h-5" />
            <span className="text-sm opacity-90">طلباتي الحالية</span>
          </div>
          <div className="text-3xl font-bold">{mine.filter(o => o.status !== 'delivered').length}</div>
        </div>
      </div>

      <div className="grid lg:grid-cols-2 gap-6">
        {/* طلبات جاهزة للاستلام */}
        <div>
          <div className="flex items-center gap-2 mb-4">
            <div className="w-10 h-10 rounded-full bg-purple-100 flex items-center justify-center">
              <Package className="w-5 h-5 text-purple-600" />
            </div>
            <h2 className="font-bold text-lg">طلبات جاهزة للتسليم 📦</h2>
          </div>
          <div className="space-y-3">
            {ready.map(o => (
              <div key={o.id} className="bg-white rounded-2xl shadow-card overflow-hidden hover:shadow-lg transition-all">
                <div className="bg-gradient-to-r from-purple-500 to-pink-500 px-4 py-2 flex items-center justify-between">
                  <span className="text-white font-bold">#{o.id.slice(-6)}</span>
                  <span className="text-white/90 text-sm">{o.restaurantName || 'مطعم'}</span>
                </div>
                <div className="p-4">
                  <div className="flex items-center gap-2 text-gray-600 text-sm mb-2">
                    <MapPin className="w-4 h-4" />
                    <span className="truncate">{o.address}</span>
                  </div>
                  
                  {/* عرض الأسعار */}
                  <div className="bg-gray-50 rounded-xl p-3 mb-3 space-y-1">
                    <div className="flex justify-between text-sm">
                      <span className="text-gray-600">سعر المنتجات</span>
                      <span className="font-semibold">{o.subtotal?.toFixed(2)} ر.س</span>
                    </div>
                    {o.deliveryFeeSetBy ? (
                      <div className="flex justify-between text-sm">
                        <span className="text-gray-600">رسوم التوصيل</span>
                        <span className="font-semibold text-green-600">{o.deliveryFee?.toFixed(2)} ر.س</span>
                      </div>
                    ) : (
                      <div className="flex justify-between text-sm">
                        <span className="text-gray-600">رسوم التوصيل</span>
                        <span className="text-amber-600 text-xs">تحددها أنت</span>
                      </div>
                    )}
                    <div className="h-px bg-gray-200 my-1"></div>
                    <div className="flex justify-between">
                      <span className="font-bold text-gray-800">الإجمالي</span>
                      <span className="font-bold text-green-600">{o.total?.toFixed(2)} ر.س</span>
                    </div>
                  </div>

                  {/* تحديد رسوم التوصيل إذا لم تُحدد */}
                  {!o.deliveryFeeSetBy && (
                    <div className="bg-amber-50 border border-amber-200 rounded-xl p-3 mb-3">
                      <div className="flex items-center gap-2 mb-2">
                        <AlertCircle className="w-4 h-4 text-amber-600" />
                        <span className="font-semibold text-amber-800 text-sm">حدد رسوم التوصيل</span>
                      </div>
                      <div className="flex gap-2">
                        <input
                          type="number"
                          min="0"
                          step="0.5"
                          placeholder="مثال: 10"
                          value={deliveryFees[o.id] || ''}
                          onChange={(e) => setDeliveryFees(prev => ({ ...prev, [o.id]: e.target.value }))}
                          className="flex-1 px-3 py-2 rounded-lg border border-amber-200 focus:border-amber-400 focus:outline-none text-gray-800 text-sm"
                        />
                        <span className="flex items-center text-gray-500 text-sm">ر.س</span>
                      </div>
                      <p className="text-xs text-amber-700 mt-2">
                        ⚠️ سيُخصم {COURIER_PLATFORM_FEE} ر.س رسوم منصة من أرباحك
                      </p>
                    </div>
                  )}

                  <button 
                    onClick={() => take(o.id, o)}
                    disabled={savingFee === o.id}
                    className="w-full py-3 rounded-xl bg-gradient-to-r from-gray-800 to-gray-900 
                               text-white font-bold flex items-center justify-center gap-2
                               hover:from-gray-900 hover:to-black transition-all shadow-lg hover:shadow-xl disabled:opacity-50"
                  >
                    {savingFee === o.id ? (
                      <span>جارِ الحفظ...</span>
                    ) : (
                      <>
                        <Truck className="w-5 h-5" />
                        <span>استلام الطلب 🚗</span>
                      </>
                    )}
                  </button>
                </div>
              </div>
            ))}
            {ready.length === 0 && (
              <div className="text-center py-10 bg-gray-50 rounded-2xl">
                <div className="text-5xl mb-3">📦</div>
                <p className="text-gray-500">لا توجد طلبات جاهزة الآن</p>
                <p className="text-gray-400 text-sm mt-1">سيظهر هنا الطلبات الجاهزة للتوصيل</p>
              </div>
            )}
          </div>
        </div>

        {/* طلباتي الحالية */}
        <div>
          <div className="flex items-center gap-2 mb-4">
            <div className="w-10 h-10 rounded-full bg-green-100 flex items-center justify-center">
              <Navigation className="w-5 h-5 text-green-600" />
            </div>
            <h2 className="font-bold text-lg">طلباتي 🛵</h2>
          </div>
          <div className="space-y-3">
            {mine.filter(o => o.status !== 'delivered').map(o => (
              <div key={o.id} className="bg-white rounded-2xl shadow-card overflow-hidden hover:shadow-lg transition-all">
                <div className="bg-gradient-to-r from-sky-500 to-blue-500 px-4 py-2 flex items-center justify-between">
                  <span className="text-white font-bold">#{o.id.slice(-6)}</span>
                  <div className="flex items-center gap-1 text-white/90 text-sm">
                    <Clock className="w-3 h-3" />
                    <span>في الطريق</span>
                  </div>
                </div>
                <div className="p-4">
                  <div className="flex items-center gap-2 text-gray-600 text-sm mb-2">
                    <MapPin className="w-4 h-4" />
                    <span className="truncate">{o.address}</span>
                  </div>
                  <div className="flex items-center gap-2 text-green-600 font-bold text-lg mb-3">
                    <DollarSign className="w-5 h-5" />
                    <span>{o.total?.toFixed?.(2)} ر.س</span>
                  </div>
                  
                  {/* أزرار الإجراءات */}
                  <div className="flex gap-2">
                    <button 
                      onClick={() => nav(`/chat?orderId=${o.id}`)}
                      className="flex-1 py-3 rounded-xl bg-gradient-to-r from-primary to-accent 
                                 text-white font-bold flex items-center justify-center gap-2
                                 hover:shadow-lg transition-all"
                    >
                      <MessageCircle className="w-5 h-5" />
                      <span>محادثة 💬</span>
                    </button>
                    <button 
                      onClick={() => delivered(o.id)} 
                      className="flex-1 py-3 rounded-xl bg-gradient-to-r from-green-500 to-emerald-500 
                                 text-white font-bold flex items-center justify-center gap-2
                                 hover:from-green-600 hover:to-emerald-600 transition-all shadow-lg hover:shadow-xl"
                    >
                      <CheckCircle className="w-5 h-5" />
                      <span>تم التسليم ✅</span>
                    </button>
                  </div>
                </div>
              </div>
            ))}
            {mine.filter(o => o.status !== 'delivered').length === 0 && (
              <div className="text-center py-10 bg-gray-50 rounded-2xl">
                <div className="text-5xl mb-3">🛵</div>
                <p className="text-gray-500">لا يوجد لديك طلبات حالياً</p>
                <p className="text-gray-400 text-sm mt-1">استلم طلباً من القائمة الجاهزة</p>
              </div>
            )}
          </div>
        </div>
      </div>

      {/* الطلبات المسلمة اليوم */}
      {mine.filter(o => o.status === 'delivered').length > 0 && (
        <div className="mt-6">
          <div className="flex items-center gap-2 mb-4">
            <Sparkles className="w-5 h-5 text-yellow-500" />
            <h3 className="font-bold text-gray-700">تم التسليم ✅</h3>
          </div>
          <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-3">
            {mine.filter(o => o.status === 'delivered').slice(0, 6).map(o => (
              <div key={o.id} className="bg-green-50 border border-green-200 rounded-xl p-3">
                <div className="flex items-center justify-between">
                  <span className="font-bold text-green-700">#{o.id.slice(-6)}</span>
                  <span className="text-green-600 font-bold">{o.total?.toFixed?.(2)} ر.س</span>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  )
}

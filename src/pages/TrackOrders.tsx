// src/pages/TrackOrders.tsx
import React, { useEffect, useState } from 'react'
import { collection, getDocs, onSnapshot, orderBy, query, where, limit } from 'firebase/firestore'
import { db } from '@/firebase'
import { useAuth } from '@/auth'
import { Order } from '@/types'
import { useNavigate } from 'react-router-dom'
import { MessageCircle, Package, MapPin, Truck, CheckCircle, Clock, ChefHat, XCircle, Store } from 'lucide-react'

export const TrackOrders: React.FC = () => {
  const { user } = useAuth()
  const nav = useNavigate()
  const [err, setErr] = useState<string | null>(null)
  const [orders, setOrders] = useState<Order[]>([])
  const [diag, setDiag] = useState<{ uid: string; fallbackCount: number; sample: any[] } | null>(null)

  useEffect(() => {
    if (!user) return
    setErr(null)
    setDiag(null)

    // الاستعلام الأساسي: customerId + orderBy(createdAt)
    const q1 = query(
      collection(db, 'orders'),
      where('customerId', '==', user.uid),
      orderBy('createdAt', 'desc')
    )

    // نحاول الاشتراك.. لو صار خطأ فهرس، نطيح على فولبّاك
    const unsub = onSnapshot(
      q1,
      snap => {
        setOrders(snap.docs.map(d => ({ id: d.id, ...d.data() } as Order)))
        setErr(null)
      },
      async (e) => {
        console.error('TrackOrders onSnapshot error:', e)
        setErr('⚠️ احتمال تحتاج Composite Index لـ customerId + createdAt. بنعرض البيانات بدون ترتيب مؤقتًا.')

        // فولبّاك بدون orderBy (ما يحتاج فهرس مركب)
        const q2 = query(
          collection(db, 'orders'),
          where('customerId', '==', user.uid)
        )
        const s2 = await getDocs(q2)
        const list = s2.docs.map(d => ({ id: d.id, ...d.data() } as Order))

        // تشخيص سريع: نعرض عينة من أحدث 5 طلبات عامة
        const q3 = query(collection(db, 'orders'), orderBy('createdAt', 'desc'), limit(5))
        let sample: any[] = []
        try {
          const s3 = await getDocs(q3)
          sample = s3.docs.map(d => {
            const data = d.data() as any
            return {
              id: d.id,
              customerId: data.customerId,
              restaurantId: data.restaurantId,
              createdAt: data.createdAt?.toDate?.()?.toISOString?.() ?? null,
            }
          })
        } catch {}

        setDiag({
          uid: user.uid,
          fallbackCount: list.length,
          sample,
        })
        setOrders(list)
      }
    )

    return () => unsub()
  }, [user])

  const badge = (s: string) => {
    const map: Record<string, { text: string; emoji: string; color: string; icon: any }> = {
      pending: { text: 'قيد المراجعة', emoji: '⏳', color: 'bg-yellow-500', icon: Clock },
      accepted: { text: 'تم القبول', emoji: '✅', color: 'bg-blue-500', icon: CheckCircle },
      preparing: { text: 'قيد التحضير', emoji: '👨‍🍳', color: 'bg-orange-500', icon: ChefHat },
      ready: { text: 'جاهز للتسليم', emoji: '📦', color: 'bg-purple-500', icon: Package },
      out_for_delivery: { text: 'في الطريق', emoji: '🚗', color: 'bg-sky-500', icon: Truck },
      delivered: { text: 'تم التسليم', emoji: '🎉', color: 'bg-green-500', icon: CheckCircle },
      cancelled: { text: 'ملغي', emoji: '❌', color: 'bg-red-500', icon: XCircle },
    }
    return map[s] || { text: s, emoji: '📦', color: 'bg-gray-500', icon: Package }
  }

  // التحقق إذا كان الطلب يسمح بالمحادثة
  // 1. مع المندوب: إذا كان الطلب في الطريق ويوجد مندوب
  // 2. مع المطعم: إذا كان الطلب قيد التحضير أو جاهز ولا يوجد مندوب
  const canChatWithCourier = (order: Order) => {
    return order.courierId && order.status === 'out_for_delivery'
  }
  
  const canChatWithRestaurant = (order: Order) => {
    const activeStatuses = ['pending', 'accepted', 'preparing', 'ready']
    return !order.courierId && order.restaurantId && activeStatuses.includes(order.status)
  }
  
  const canChat = (order: Order) => {
    return canChatWithCourier(order) || canChatWithRestaurant(order)
  }

  return (
    <div className="space-y-3">
      <h1 className="text-xl font-bold">طلباتي</h1>

      {err && (
        <div className="text-xs bg-yellow-50 text-yellow-800 border border-yellow-200 rounded-xl p-3">
          {err}
          {diag && (
            <div className="mt-1">
              <div>UID: <b>{diag.uid}</b></div>
              <div>عدد نتائج الفولبّاك: <b>{diag.fallbackCount}</b></div>
              {Array.isArray(diag.sample) && diag.sample.length > 0 && (
                <div className="mt-1">
                  <div className="font-semibold">عينة (أحدث 5):</div>
                  {diag.sample.map((x) => (
                    <div key={x.id} className="truncate">
                      #{x.id} • customerId: {String(x.customerId)} • restaurantId: {String(x.restaurantId)} • createdAt: {x.createdAt || '—'}
                    </div>
                  ))}
                </div>
              )}
            </div>
          )}
        </div>
      )}

      {orders.map((o) => (
        <div key={o.id} className="bg-white rounded-2xl shadow-card overflow-hidden hover:shadow-lg transition-shadow">
          {/* رأس الطلب مع الحالة */}
          <div className={`${badge(o.status).color} px-4 py-3 flex items-center justify-between`}>
            <div className="flex items-center gap-2 text-white">
              <span className="text-xl">{badge(o.status).emoji}</span>
              <span className="font-bold">{badge(o.status).text}</span>
            </div>
            <div className="text-white/80 text-sm font-medium">
              #{o.id.slice(-6)}
            </div>
          </div>

          <div className="p-4">
            {o.restaurantName && (
              <div className="flex items-center gap-2 text-primary font-semibold mb-2">
                <span>🍽️</span>
                <span>{String(o.restaurantName)}</span>
              </div>
            )}

            <div className="text-sm text-gray-700 bg-gray-50 rounded-xl p-3 mb-3">
              {o.items?.map((i) => `${i.name}×${i.qty}`).join(' • ')}
            </div>

            {/* تفاصيل التوصيل */}
            <div className="text-sm text-gray-600 space-y-2">
              {o.deliveryType === 'pickup' ? (
                <div className="flex items-center gap-2 text-green-600 font-medium bg-green-50 rounded-xl p-3">
                  <MapPin className="w-4 h-4" />
                  <span>استلام من المطعم</span>
                </div>
              ) : (
                <div className="space-y-1 bg-gray-50 rounded-xl p-3">
                  <div className="flex justify-between">
                    <span>المبلغ الأساسي:</span>
                    <span>{o.subtotal?.toFixed?.(2) || '—'} ر.س</span>
                  </div>
                  <div className="flex justify-between">
                    <span>رسوم التوصيل:</span>
                    {o.deliveryFee !== undefined && o.deliveryFee > 0 ? (
                      <span className="font-medium">{o.deliveryFee?.toFixed?.(2)} ر.س</span>
                    ) : (
                      <span className="text-amber-600">بانتظار تحديد المطعم</span>
                    )}
                  </div>
                </div>
              )}
            </div>

            <div className="mt-3 pt-3 border-t flex items-center justify-between">
              <div className="font-bold text-lg text-primary">
                الإجمالي: {o.total?.toFixed?.(2)} ر.س
              </div>
              
              {/* زر المحادثة مع المندوب */}
              {canChatWithCourier(o) && (
                <button
                  onClick={() => nav(`/chat?orderId=${o.id}`)}
                  className="flex items-center gap-2 px-4 py-2 bg-gradient-to-r from-primary to-accent 
                             text-white rounded-full font-medium shadow-lg hover:shadow-xl 
                             hover:scale-105 transition-all duration-200 animate-pulse"
                >
                  <MessageCircle className="w-5 h-5" />
                  <span>تواصل مع المندوب 🚗</span>
                </button>
              )}
              
              {/* زر المحادثة مع المطعم (إذا لم يكن هناك مندوب) */}
              {canChatWithRestaurant(o) && (
                <button
                  onClick={() => nav(`/chat?orderId=${o.id}`)}
                  className="flex items-center gap-2 px-4 py-2 bg-gradient-to-r from-orange-500 to-amber-500 
                             text-white rounded-full font-medium shadow-lg hover:shadow-xl 
                             hover:scale-105 transition-all duration-200"
                >
                  <Store className="w-5 h-5" />
                  <span>تواصل مع المطعم 🍽️</span>
                </button>
              )}
            </div>
          </div>
        </div>
      ))}

      {orders.length === 0 && !err && (
        <div className="text-gray-600">لا توجد طلبات حتى الآن.</div>
      )}
    </div>
  )
}

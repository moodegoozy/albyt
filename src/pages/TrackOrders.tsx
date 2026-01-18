// src/pages/TrackOrders.tsx
import React, { useEffect, useState } from 'react'
import { collection, getDocs, onSnapshot, orderBy, query, where, limit } from 'firebase/firestore'
import { db } from '@/firebase'
import { useAuth } from '@/auth'
import { Order } from '@/types'

export const TrackOrders: React.FC = () => {
  const { user } = useAuth()
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
    const map: Record<string, string> = {
      pending: 'قيد المراجعة',
      accepted: 'تم القبول',
      preparing: 'قيد التحضير',
      ready: 'جاهز للتسليم',
      out_for_delivery: 'في الطريق',
      delivered: 'تم التسليم',
      cancelled: 'ملغي',
    }
    return map[s] || s
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
        <div key={o.id} className="bg-white rounded-2xl shadow p-4">
          <div className="flex items-center justify-between">
            <div className="font-bold">طلب #{o.id.slice(-6)}</div>
            <div className="text-sm px-3 py-1 rounded-full bg-gray-900 text-white">
              {badge(o.status)}
            </div>
          </div>

          {o.restaurantName && (
            <div className="mt-1 text-yellow-600 font-semibold">
              المطعم: {String(o.restaurantName)}
            </div>
          )}

          <div className="mt-2 text-sm text-gray-700">
            {o.items?.map((i) => `${i.name}×${i.qty}`).join(' • ')}
          </div>

          {/* تفاصيل التوصيل */}
          <div className="mt-2 text-sm text-gray-600 space-y-1">
            {o.deliveryType === 'pickup' ? (
              <div className="text-green-600 font-medium">📍 استلام من المطعم</div>
            ) : (
              <>
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
              </>
            )}
          </div>

          <div className="mt-2 font-bold border-t pt-2">
            الإجمالي: {o.total?.toFixed?.(2)} ر.س
          </div>
        </div>
      ))}

      {orders.length === 0 && !err && (
        <div className="text-gray-600">لا توجد طلبات حتى الآن.</div>
      )}
    </div>
  )
}

// src/pages/OrdersAdmin.tsx
import React, { useEffect, useMemo, useState } from 'react'
import { collection, doc, onSnapshot, updateDoc, serverTimestamp } from 'firebase/firestore'
import { db } from '@/firebase'
import { useAuth } from '@/auth'

type Order = any

// ✅ ترجمة الحالات
const badge = (s: string) => {
  const map: Record<string, string> = {
    pending: '⏳ قيد المراجعة',
    accepted: '✅ تم القبول',
    preparing: '👨‍🍳 قيد التحضير',
    ready: '📦 جاهز',
    out_for_delivery: '🚚 في الطريق',
    delivered: '🎉 تم التسليم',
    cancelled: '❌ ملغي',
  }
  return map[s] || s
}

// ✅ ألوان الحالات
const statusColor = (s: string) => {
  switch (s) {
    case 'pending': return 'bg-gray-200 text-gray-800'
    case 'accepted': return 'bg-blue-200 text-blue-800'
    case 'preparing': return 'bg-yellow-200 text-yellow-800'
    case 'ready': return 'bg-purple-200 text-purple-800'
    case 'out_for_delivery': return 'bg-indigo-200 text-indigo-800'
    case 'delivered': return 'bg-green-200 text-green-800'
    case 'cancelled': return 'bg-red-200 text-red-800'
    default: return 'bg-gray-100 text-gray-700'
  }
}

export const OrdersAdmin: React.FC = () => {
  const { user } = useAuth()
  const [orders, setOrders] = useState<Order[]>([])
  const [error, setError] = useState<string | null>(null)
  const [deliveryFees, setDeliveryFees] = useState<Record<string, number>>({})

  const restaurantUid = useMemo(() => user?.uid ?? null, [user])

  useEffect(() => {
    if (!restaurantUid) return
    setError(null)

    const unsub = onSnapshot(
      collection(db, 'orders'),
      (snap) => {
        const all = snap.docs.map(d => ({ id: d.id, ...(d.data() as any) }))
        const mine = all.filter((o: any) => {
          const r1 = o.restaurantId === restaurantUid
          const r2 = o?.items?.[0]?.ownerId === restaurantUid
          return r1 || r2
        })

        mine.sort((a: any, b: any) => {
          const ta = a.createdAt?.toMillis?.() ?? 0
          const tb = b.createdAt?.toMillis?.() ?? 0
          return tb - ta
        })

        setOrders(mine)
        setError(null)
      },
      (err) => {
        console.error('Firestore error:', err)
        setError('حدثت مشكلة في جلب الطلبات.')
      }
    )

    return () => unsub()
  }, [restaurantUid])

  const updateStatus = async (id: string, status: string, order?: any) => {
    const updates: any = { 
      status, 
      updatedAt: serverTimestamp()
    }
    
    // عند القبول، نضيف رسوم التوصيل ونحدث الإجمالي
    if (status === 'accepted' && order?.deliveryType === 'delivery') {
      const fee = deliveryFees[id] || 0
      updates.deliveryFee = fee
      updates.total = (order.subtotal || 0) + fee
    }
    
    await updateDoc(doc(db, 'orders', id), updates)
  }

  return (
    <div className="space-y-6">
      <h1 className="text-2xl font-extrabold text-yellow-500">📋 إدارة الطلبات</h1>

      {error && <div className="text-red-500 text-sm mb-2">{error}</div>}

      {orders.map((o: any) => (
        <div 
          key={o.id} 
          className="bg-white rounded-2xl shadow-xl p-5 text-gray-900 space-y-4 transition hover:shadow-2xl"
        >
          {/* 🧾 رأس الطلب */}
          <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-2">
            <div className="font-bold text-lg">
              طلب #{o.id.slice(-6)} 
              <span className="text-gray-500 text-sm ml-2">
                {o.items?.map((i:any)=>`${i.name}×${i.qty}`).join(' • ')}
              </span>
            </div>
            <div className="font-extrabold text-xl text-green-600">{o.total?.toFixed?.(2)} ر.س</div>
          </div>

          {/* 📌 الحالة الحالية */}
          <div className="flex items-center gap-2">
            <span className="text-sm font-semibold">الحالة:</span>
            <span className={`px-3 py-1 rounded-full text-sm font-bold ${statusColor(o.status)}`}>
              {badge(o.status || 'pending')}
            </span>
          </div>

          {/* 🏠 العنوان */}
          <div className="text-sm text-gray-700">
            <span className="font-semibold">العنوان:</span> {o.address}
          </div>

          {/* 🗺️ موقع العميل على الخريطة */}
          {o.location && (
            <div className="mt-3">
              <h3 className="font-semibold text-sm text-gray-800 mb-2">📍 موقع العميل:</h3>
              <iframe
                title={`map-${o.id}`}
                width="100%"
                height="250"
                style={{ borderRadius: '12px' }}
                loading="lazy"
                allowFullScreen
                src={`https://www.google.com/maps?q=${o.location.lat},${o.location.lng}&hl=ar&z=15&output=embed`}
              ></iframe>
            </div>
          )}

          {/* � إدخال رسوم التوصيل للطلبات الجديدة */}
          {o.status === 'pending' && o.deliveryType === 'delivery' && (
            <div className="bg-amber-50 border border-amber-200 rounded-xl p-4">
              <label className="block text-sm font-bold text-amber-800 mb-2">
                💵 حدد رسوم التوصيل قبل القبول:
              </label>
              <div className="flex items-center gap-3">
                <input
                  type="number"
                  min="0"
                  step="0.5"
                  placeholder="مثال: 10"
                  value={deliveryFees[o.id] || ''}
                  onChange={(e) => setDeliveryFees(prev => ({ ...prev, [o.id]: parseFloat(e.target.value) || 0 }))}
                  className="flex-1 px-4 py-3 border-2 border-amber-300 rounded-xl focus:border-amber-500 focus:ring-2 focus:ring-amber-200 text-lg font-bold text-center"
                />
                <span className="text-amber-700 font-bold">ر.س</span>
              </div>
              <p className="text-xs text-amber-600 mt-2">سيتم إضافتها للإجمالي عند قبول الطلب</p>
            </div>
          )}

          {/* عرض رسوم التوصيل المحددة */}
          {o.deliveryFee !== undefined && o.deliveryFee > 0 && (
            <div className="text-sm text-gray-700">
              <span className="font-semibold">رسوم التوصيل:</span> {o.deliveryFee?.toFixed?.(2)} ر.س
            </div>
          )}

          {/* 🔘 أزرار تغيير الحالة */}
          <div className="mt-3 grid grid-cols-2 sm:flex sm:flex-wrap gap-2">
            {['accepted','preparing','ready','out_for_delivery','delivered','cancelled'].map(s => {
              // منع القبول بدون تحديد رسوم التوصيل
              const needsFee = s === 'accepted' && o.status === 'pending' && o.deliveryType === 'delivery'
              const hasFee = deliveryFees[o.id] !== undefined && deliveryFees[o.id] >= 0
              const disabled = needsFee && !hasFee
              
              return (
                <button 
                  key={s} 
                  onClick={()=>updateStatus(o.id, s, o)} 
                  disabled={disabled}
                  className={`px-4 py-2 rounded-xl text-sm font-semibold transition ${disabled ? 'bg-gray-200 text-gray-400 cursor-not-allowed' : 'bg-gray-100 hover:bg-gray-200'}`}
                  title={disabled ? 'حدد رسوم التوصيل أولاً' : ''}
                >
                  {badge(s)}
                </button>
              )
            })}
          </div>
        </div>
      ))}

      {orders.length === 0 && !error && (
        <div className="text-gray-400 text-center text-lg">🚫 لا توجد طلبات حالياً.</div>
      )}
    </div>
  )
}

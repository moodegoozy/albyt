import React, { useEffect, useState } from 'react'
import { collection, doc, onSnapshot, orderBy, query, updateDoc, where, serverTimestamp } from 'firebase/firestore'
import { db } from '@/firebase'
import { useAuth } from '@/auth'
import { Order } from '@/types'
import { useNavigate } from 'react-router-dom'
import { 
  MessageCircle, Package, MapPin, Truck, CheckCircle, 
  Clock, Navigation, Phone, DollarSign, Sparkles 
} from 'lucide-react'

export const CourierApp: React.FC = () => {
  const { user } = useAuth()
  const nav = useNavigate()
  const [ready, setReady] = useState<Order[]>([])
  const [mine, setMine] = useState<Order[]>([])

  useEffect(() => {
    const q1 = query(collection(db, 'orders'), where('status','in',['ready']), orderBy('createdAt','desc'))
    const u1 = onSnapshot(q1, (snap) => setReady(snap.docs.map(d => ({ id: d.id, ...d.data() } as Order))))
    const q2 = query(collection(db, 'orders'), where('courierId','==', user?.uid || ''), orderBy('createdAt','desc'))
    const u2 = onSnapshot(q2, (snap) => setMine(snap.docs.map(d => ({ id: d.id, ...d.data() } as Order))))
    return () => { u1(); u2(); }
  }, [user?.uid])

  const take = async (id: string) => {
    if (!user) return
    await updateDoc(doc(db, 'orders', id), { courierId: user!.uid, status: 'out_for_delivery', updatedAt: serverTimestamp() })
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
                  <div className="flex items-center gap-2 text-green-600 font-bold text-lg mb-3">
                    <DollarSign className="w-5 h-5" />
                    <span>{o.total?.toFixed?.(2)} ر.س</span>
                  </div>
                  <button 
                    onClick={() => take(o.id)} 
                    className="w-full py-3 rounded-xl bg-gradient-to-r from-gray-800 to-gray-900 
                               text-white font-bold flex items-center justify-center gap-2
                               hover:from-gray-900 hover:to-black transition-all shadow-lg hover:shadow-xl"
                  >
                    <Truck className="w-5 h-5" />
                    <span>استلام الطلب 🚗</span>
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

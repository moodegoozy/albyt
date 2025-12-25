import React, { useEffect, useState } from 'react'
import { collection, getDocs, addDoc, deleteDoc, doc } from 'firebase/firestore'
import { db } from '@/firebase'
import { useAuth } from '@/auth'
import { RoleGate } from '@/routes/RoleGate'
import { useToast } from '@/components/ui/Toast'
import { useDialog } from '@/components/ui/ConfirmDialog'
import { Restaurant } from '@/types'
import { Trash2, Plus, UserCheck } from 'lucide-react'

export const AdminRestaurants: React.FC = () => {
  const { user, role } = useAuth()
  const toast = useToast()
  const dialog = useDialog()
  const [restaurants, setRestaurants] = useState<Restaurant[]>([])
  const [loading, setLoading] = useState(true)
  const [showForm, setShowForm] = useState(false)
  const [formData, setFormData] = useState({
    name: '',
    phone: '',
    city: '',
    location: '',
  })

  // تحميل المطاعم
  useEffect(() => {
    loadRestaurants()
  }, [])

  const loadRestaurants = async () => {
    try {
      const snap = await getDocs(collection(db, 'restaurants'))
      const data = snap.docs.map(d => ({
        id: d.id,
        ...d.data(),
      } as Restaurant))
      setRestaurants(data)
    } catch (err) {
      toast.error('خطأ في تحميل المطاعم')
      console.error(err)
    } finally {
      setLoading(false)
    }
  }

  const handleAddRestaurant = async (e: React.FormEvent) => {
    e.preventDefault()

    if (!formData.name.trim()) {
      toast.warning('أدخل اسم المطعم')
      return
    }

    try {
      // 💰 تحديد نوع المُضيف ومعلومات الإحالة
      const isAdmin = role === 'admin'
      const isDev = role === 'developer'
      
      await addDoc(collection(db, 'restaurants'), {
        ...formData,
        ownerId: 'admin_' + Date.now(),
        email: user?.email || '',
        logoUrl: '',
        createdAt: new Date(),
        // 💰 نظام العمولات - حفظ من أضاف المطعم
        referredBy: isAdmin ? user?.uid : null, // UID المشرف إذا كان مشرف
        referrerType: isAdmin ? 'admin' : (isDev ? 'developer' : null), // نوع المُضيف
      })

      toast.success('تم إضافة المطعم بنجاح ✅')
      if (isAdmin) {
        toast.info('💰 ستحصل على 50 هللة من كل طلب لهذا المطعم')
      }
      setFormData({ name: '', phone: '', city: '', location: '' })
      setShowForm(false)
      loadRestaurants()
    } catch (err) {
      toast.error('خطأ في إضافة المطعم')
      console.error(err)
    }
  }

  const handleDelete = async (id: string) => {
    const confirmed = await dialog.confirm('هل أنت متأكد من حذف هذا المطعم؟', { dangerous: true, title: 'حذف المطعم' })
    if (!confirmed) return

    try {
      await deleteDoc(doc(db, 'restaurants', id))
      toast.success('تم حذف المطعم بنجاح')
      loadRestaurants()
    } catch (err) {
      toast.error('خطأ في حذف المطعم')
      console.error(err)
    }
  }

  if (loading) {
    return (
      <RoleGate allow={['admin', 'developer']}>
        <div className="flex items-center justify-center h-96">جارِ التحميل...</div>
      </RoleGate>
    )
  }

  return (
    <RoleGate allow={['admin', 'developer']}>
      <div className="space-y-6">
        <div className="flex items-center justify-between">
          <h1 className="text-3xl font-bold text-primary">المطاعم المضافة</h1>
          <button
            onClick={() => setShowForm(!showForm)}
            className="flex items-center gap-2 bg-primary hover:bg-red-900 text-white px-6 py-3 rounded-xl font-semibold transition"
          >
            <Plus className="w-5 h-5" /> مطعم جديد
          </button>
        </div>

        {/* نموذج الإضافة */}
        {showForm && (
          <div className="bg-white rounded-2xl shadow p-6">
            <h2 className="text-xl font-bold mb-4">إضافة مطعم جديد</h2>
            <form onSubmit={handleAddRestaurant} className="space-y-4">
              <input
                type="text"
                placeholder="اسم المطعم"
                value={formData.name}
                onChange={e => setFormData({ ...formData, name: e.target.value })}
                className="w-full border rounded-xl p-3 text-gray-900"
              />
              <input
                type="text"
                placeholder="رقم الهاتف"
                value={formData.phone}
                onChange={e => setFormData({ ...formData, phone: e.target.value })}
                className="w-full border rounded-xl p-3 text-gray-900"
              />
              <input
                type="text"
                placeholder="المدينة"
                value={formData.city}
                onChange={e => setFormData({ ...formData, city: e.target.value })}
                className="w-full border rounded-xl p-3 text-gray-900"
              />
              <textarea
                placeholder="الموقع / العنوان"
                value={formData.location}
                onChange={e => setFormData({ ...formData, location: e.target.value })}
                className="w-full border rounded-xl p-3 text-gray-900"
              />
              <div className="flex gap-3">
                <button
                  type="submit"
                  className="flex-1 bg-primary hover:bg-red-900 text-white rounded-xl p-3 font-semibold transition"
                >
                  ✅ حفظ
                </button>
                <button
                  type="button"
                  onClick={() => setShowForm(false)}
                  className="flex-1 bg-gray-200 hover:bg-gray-300 text-gray-800 rounded-xl p-3 font-semibold transition"
                >
                  ❌ إلغاء
                </button>
              </div>
            </form>
          </div>
        )}

        {/* قائمة المطاعم */}
        <div className="grid gap-4">
          {restaurants.length === 0 ? (
            <div className="text-center text-gray-500 py-12">
              لا توجد مطاعم مسجلة حالياً
            </div>
          ) : (
            restaurants.map(restaurant => (
              <div
                key={restaurant.id}
                className="bg-white rounded-2xl shadow p-6 hover:shadow-lg transition"
              >
                <div className="flex items-start justify-between">
                  <div className="flex-1">
                    <h3 className="text-xl font-bold text-primary">{restaurant.name}</h3>
                    {restaurant.city && (
                      <p className="text-gray-600 text-sm">📍 {restaurant.city}</p>
                    )}
                    {restaurant.phone && (
                      <p className="text-gray-600 text-sm">📞 {restaurant.phone}</p>
                    )}
                    {restaurant.location && (
                      <p className="text-gray-600 text-sm">🏢 {restaurant.location}</p>
                    )}
                  </div>
                  <button
                    onClick={() => handleDelete(restaurant.id)}
                    className="p-3 bg-red-100 hover:bg-red-200 text-red-600 rounded-xl transition"
                    title="حذف المطعم"
                  >
                    <Trash2 className="w-5 h-5" />
                  </button>
                </div>
              </div>
            ))
          )}
        </div>
      </div>
    </RoleGate>
  )
}

export default AdminRestaurants

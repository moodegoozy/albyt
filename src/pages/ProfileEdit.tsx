// src/pages/ProfileEdit.tsx
import React, { useEffect, useState } from "react"
import { db } from "@/firebase"
import { useAuth } from "@/auth"
import { doc, getDoc, updateDoc } from "firebase/firestore"
import { useDialog } from '@/components/ui/ConfirmDialog'
import { User, MapPin, Phone, Building2, Home, Save, RefreshCw } from 'lucide-react'

export const ProfileEdit: React.FC = () => {
  const { user, role } = useAuth()
  const dialog = useDialog()
  const [form, setForm] = useState({
    name: "",
    phone: "",
    city: "",
    address: "",
    restaurantName: ""
  })
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)

  // تحميل البيانات الحالية
  useEffect(() => {
    if (!user) return
    const load = async () => {
      const snap = await getDoc(doc(db, "users", user.uid))
      if (snap.exists()) {
        const data = snap.data()
        setForm({
          name: data.name || "",
          phone: data.phone || user.phoneNumber || "",
          city: data.city || "",
          address: data.address || "",
          restaurantName: data.restaurantName || ""
        })
      }
      setLoading(false)
    }
    load()
  }, [user])

  // حفظ التعديلات
  const save = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!user) return
    
    setSaving(true)
    try {
      await updateDoc(doc(db, "users", user.uid), {
        name: form.name,
        phone: form.phone,
        city: form.city,
        address: form.address,
        ...(role === 'owner' && { restaurantName: form.restaurantName })
      })
      dialog.success('تم تحديث بياناتك بنجاح! ✅')
    } catch (err) {
      dialog.error('فشل في حفظ البيانات')
    } finally {
      setSaving(false)
    }
  }

  if (loading) {
    return (
      <div className="flex items-center justify-center h-96 text-lg">
        <RefreshCw className="w-6 h-6 animate-spin ml-2" />
        جارِ تحميل البيانات...
      </div>
    )
  }

  // تحديد العنوان حسب الدور
  const getTitle = () => {
    if (role === 'owner') return 'تعديل بيانات المطعم'
    if (role === 'courier') return 'تعديل بيانات المندوب'
    if (role === 'admin') return 'تعديل بيانات المشرف'
    return 'تعديل بياناتي'
  }

  return (
    <div className="max-w-md mx-auto py-8 px-4">
      <div className="bg-white rounded-2xl shadow-xl p-6">
        {/* العنوان */}
        <div className="flex items-center gap-3 mb-6">
          <div className="w-12 h-12 bg-sky-100 rounded-xl flex items-center justify-center">
            <User className="w-6 h-6 text-sky-600" />
          </div>
          <div>
            <h1 className="text-xl font-bold text-gray-800">{getTitle()}</h1>
            <p className="text-sm text-gray-500">{user?.email || user?.phoneNumber}</p>
          </div>
        </div>

        <form onSubmit={save} className="space-y-4">
          {/* الاسم */}
          <div>
            <label className="block text-sm font-semibold text-gray-700 mb-1">
              <User className="w-4 h-4 inline ml-1" />
              الاسم الكامل
            </label>
            <input
              className="w-full border-2 border-gray-200 rounded-xl p-3 focus:border-sky-400 focus:outline-none transition"
              placeholder="أدخل اسمك"
              value={form.name}
              onChange={(e) => setForm({ ...form, name: e.target.value })}
            />
          </div>

          {/* رقم الجوال */}
          <div>
            <label className="block text-sm font-semibold text-gray-700 mb-1">
              <Phone className="w-4 h-4 inline ml-1" />
              رقم الجوال
            </label>
            <input
              className="w-full border-2 border-gray-200 rounded-xl p-3 focus:border-sky-400 focus:outline-none transition"
              placeholder="05xxxxxxxx"
              value={form.phone}
              onChange={(e) => setForm({ ...form, phone: e.target.value })}
              dir="ltr"
            />
          </div>

          {/* المدينة */}
          <div>
            <label className="block text-sm font-semibold text-gray-700 mb-1">
              <Building2 className="w-4 h-4 inline ml-1" />
              المدينة
            </label>
            <input
              className="w-full border-2 border-gray-200 rounded-xl p-3 focus:border-sky-400 focus:outline-none transition"
              placeholder="مثال: الرياض"
              value={form.city}
              onChange={(e) => setForm({ ...form, city: e.target.value })}
            />
          </div>

          {/* العنوان / الموقع */}
          <div>
            <label className="block text-sm font-semibold text-gray-700 mb-1">
              <MapPin className="w-4 h-4 inline ml-1" />
              العنوان التفصيلي
            </label>
            <textarea
              className="w-full border-2 border-gray-200 rounded-xl p-3 focus:border-sky-400 focus:outline-none transition h-24"
              placeholder="الحي، الشارع، رقم المبنى، معلومات إضافية..."
              value={form.address}
              onChange={(e) => setForm({ ...form, address: e.target.value })}
            />
          </div>

          {/* اسم المطعم - لصاحب المطعم فقط */}
          {role === 'owner' && (
            <div>
              <label className="block text-sm font-semibold text-gray-700 mb-1">
                <Home className="w-4 h-4 inline ml-1" />
                اسم المطعم
              </label>
              <input
                className="w-full border-2 border-gray-200 rounded-xl p-3 focus:border-sky-400 focus:outline-none transition"
                placeholder="اسم المطعم"
                value={form.restaurantName}
                onChange={(e) => setForm({ ...form, restaurantName: e.target.value })}
              />
            </div>
          )}

          {/* زر الحفظ */}
          <button 
            type="submit"
            disabled={saving}
            className="w-full flex items-center justify-center gap-2 bg-gradient-to-r from-sky-500 to-sky-600 hover:from-sky-600 hover:to-sky-700 text-white font-bold p-4 rounded-xl shadow-lg transition disabled:opacity-50"
          >
            {saving ? (
              <>
                <RefreshCw className="w-5 h-5 animate-spin" />
                جارِ الحفظ...
              </>
            ) : (
              <>
                <Save className="w-5 h-5" />
                حفظ التعديلات
              </>
            )}
          </button>
        </form>

        {/* معلومات إضافية */}
        <div className="mt-6 pt-4 border-t text-center text-sm text-gray-500">
          <p>💡 يمكنك تعديل بياناتك في أي وقت</p>
          {role === 'customer' && (
            <p className="mt-1">📍 العنوان سيُستخدم لتوصيل طلباتك</p>
          )}
        </div>
      </div>
    </div>
  )
}

// src/pages/ProfileEdit.tsx
import React, { useEffect, useState } from "react"
import { db } from "@/firebase"
import { useAuth } from "@/auth"
import { doc, getDoc, updateDoc } from "firebase/firestore"
import { useDialog } from '@/components/ui/ConfirmDialog'
import { useToast } from '@/components/ui/Toast'
import { LocationPicker } from '@/components/LocationPicker'
import { User, MapPin, Phone, Building2, Home, Save, RefreshCw, Navigation, Trash2 } from 'lucide-react'

type SavedLocation = { lat: number; lng: number; address: string }

export const ProfileEdit: React.FC = () => {
  const { user, role } = useAuth()
  const dialog = useDialog()
  const toast = useToast()
  const [form, setForm] = useState({
    name: "",
    phone: "",
    city: "",
    address: "",
    restaurantName: ""
  })
  const [savedLocation, setSavedLocation] = useState<SavedLocation | null>(null)
  const [showLocationPicker, setShowLocationPicker] = useState(false)
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
        // تحميل الموقع المحفوظ
        if (data.savedLocation) {
          setSavedLocation(data.savedLocation)
        }
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
        savedLocation: savedLocation || null,
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

          {/* 📍 الموقع المحفوظ للتوصيل - للعملاء والمشرفين فقط */}
          {(role === 'customer' || role === 'admin') && (
            <div className="border-t pt-4 mt-4">
              <label className="block text-sm font-semibold text-gray-700 mb-3">
                <Navigation className="w-4 h-4 inline ml-1" />
                موقع التوصيل المحفوظ
              </label>
              
              {savedLocation ? (
                <div className="bg-green-50 border-2 border-green-200 rounded-xl p-4">
                  <div className="flex items-start gap-3">
                    <div className="w-10 h-10 bg-green-500 rounded-xl flex items-center justify-center flex-shrink-0">
                      <MapPin className="w-5 h-5 text-white" />
                    </div>
                    <div className="flex-1 min-w-0">
                      <p className="font-bold text-green-700 mb-1">الموقع محفوظ ✓</p>
                      <p className="text-sm text-gray-600">{savedLocation.address}</p>
                      <p className="text-xs text-gray-400 mt-1 font-mono">
                        {savedLocation.lat.toFixed(5)}, {savedLocation.lng.toFixed(5)}
                      </p>
                    </div>
                  </div>
                  <div className="flex gap-2 mt-3">
                    <button
                      type="button"
                      onClick={() => setShowLocationPicker(true)}
                      className="flex-1 py-2 px-3 rounded-lg border border-sky-200 text-sky-600 text-sm font-medium hover:bg-sky-50 transition"
                    >
                      تغيير الموقع
                    </button>
                    <button
                      type="button"
                      onClick={() => {
                        setSavedLocation(null)
                        toast.info('تم حذف الموقع المحفوظ')
                      }}
                      className="py-2 px-3 rounded-lg border border-red-200 text-red-500 hover:bg-red-50 transition"
                    >
                      <Trash2 className="w-4 h-4" />
                    </button>
                  </div>
                </div>
              ) : (
                <button
                  type="button"
                  onClick={() => setShowLocationPicker(true)}
                  className="w-full py-4 rounded-xl bg-gradient-to-r from-sky-100 to-sky-50 border-2 border-dashed border-sky-300 text-sky-600 font-semibold hover:border-sky-400 transition flex items-center justify-center gap-3"
                >
                  <Navigation className="w-5 h-5" />
                  <span>إضافة موقع للتوصيل السريع</span>
                </button>
              )}
              <p className="text-xs text-gray-500 mt-2 text-center">
                💡 سيظهر هذا الموقع كخيار سريع عند كل طلب جديد
              </p>
            </div>
          )}

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
          {(role === 'customer' || role === 'admin') && (
            <p className="mt-1">📍 الموقع المحفوظ سيظهر كخيار سريع عند الطلب</p>
          )}
        </div>
      </div>

      {/* Location Picker Modal */}
      <LocationPicker
        isOpen={showLocationPicker}
        onClose={() => setShowLocationPicker(false)}
        onConfirm={(loc, addr) => {
          setSavedLocation({ lat: loc.lat, lng: loc.lng, address: addr })
          setShowLocationPicker(false)
          toast.success('تم تحديد الموقع! اضغط حفظ لتأكيد التغييرات')
        }}
        initialLocation={savedLocation ? { lat: savedLocation.lat, lng: savedLocation.lng } : null}
      />
    </div>
  )
}

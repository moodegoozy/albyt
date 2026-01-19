// src/pages/ProfileEdit.tsx
import React, { useEffect, useState } from "react"
import { db } from "@/firebase"
import { useAuth } from "@/auth"
import { doc, getDoc, updateDoc } from "firebase/firestore"
import { useDialog } from '@/components/ui/ConfirmDialog'
import { useToast } from '@/components/ui/Toast'
import { LocationPicker } from '@/components/LocationPicker'
import { User, MapPin, Phone, Building2, Home, Save, RefreshCw, Navigation, Trash2, Plus, Star, Check } from 'lucide-react'

type SavedLocation = { lat: number; lng: number; address: string; label?: string }

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
  // دعم عناوين متعددة
  const [savedLocations, setSavedLocations] = useState<SavedLocation[]>([])
  const [defaultLocationIndex, setDefaultLocationIndex] = useState<number>(0)
  const [showLocationPicker, setShowLocationPicker] = useState(false)
  const [editingLocationIndex, setEditingLocationIndex] = useState<number | null>(null)
  const [newLocationLabel, setNewLocationLabel] = useState('')
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
        // تحميل العناوين المحفوظة (دعم التنسيق القديم والجديد)
        if (data.savedLocations && Array.isArray(data.savedLocations)) {
          setSavedLocations(data.savedLocations)
          setDefaultLocationIndex(data.defaultLocationIndex || 0)
        } else if (data.savedLocation) {
          // تحويل التنسيق القديم (عنوان واحد) للجديد (قائمة عناوين)
          setSavedLocations([{ ...data.savedLocation, label: 'المنزل' }])
          setDefaultLocationIndex(0)
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
      // حفظ العنوان الافتراضي كـ savedLocation للتوافق مع auth.tsx
      const defaultLoc = savedLocations[defaultLocationIndex] || null
      
      await updateDoc(doc(db, "users", user.uid), {
        name: form.name,
        phone: form.phone,
        city: form.city,
        address: form.address,
        savedLocation: defaultLoc, // العنوان الافتراضي للتوافق
        savedLocations: savedLocations, // قائمة كل العناوين
        defaultLocationIndex: defaultLocationIndex,
        ...(role === 'owner' && { restaurantName: form.restaurantName })
      })
      dialog.success('تم تحديث بياناتك بنجاح! ✅')
    } catch (err) {
      dialog.error('فشل في حفظ البيانات')
    } finally {
      setSaving(false)
    }
  }

  // إضافة عنوان جديد
  const handleAddLocation = (loc: { lat: number; lng: number }, addr: string) => {
    const newLoc: SavedLocation = {
      lat: loc.lat,
      lng: loc.lng,
      address: addr,
      label: newLocationLabel || `عنوان ${savedLocations.length + 1}`
    }
    setSavedLocations([...savedLocations, newLoc])
    setNewLocationLabel('')
    setShowLocationPicker(false)
    toast.success('تم إضافة العنوان! اضغط حفظ لتأكيد التغييرات')
  }

  // تعديل عنوان موجود
  const handleEditLocation = (loc: { lat: number; lng: number }, addr: string) => {
    if (editingLocationIndex === null) return
    const updated = [...savedLocations]
    updated[editingLocationIndex] = {
      ...updated[editingLocationIndex],
      lat: loc.lat,
      lng: loc.lng,
      address: addr
    }
    setSavedLocations(updated)
    setEditingLocationIndex(null)
    setShowLocationPicker(false)
    toast.success('تم تحديث العنوان! اضغط حفظ لتأكيد التغييرات')
  }

  // حذف عنوان
  const handleDeleteLocation = async (index: number) => {
    const confirmed = await dialog.confirm('هل تريد حذف هذا العنوان؟')
    if (!confirmed) return
    
    const updated = savedLocations.filter((_, i) => i !== index)
    setSavedLocations(updated)
    
    // تحديث الفهرس الافتراضي
    if (defaultLocationIndex >= updated.length) {
      setDefaultLocationIndex(Math.max(0, updated.length - 1))
    } else if (defaultLocationIndex > index) {
      setDefaultLocationIndex(defaultLocationIndex - 1)
    }
    
    toast.info('تم حذف العنوان')
  }

  // تعيين عنوان كافتراضي
  const handleSetDefault = (index: number) => {
    setDefaultLocationIndex(index)
    toast.success('تم تعيين العنوان كافتراضي')
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

          {/* 📍 العناوين المحفوظة للتوصيل - للعملاء والمشرفين فقط */}
          {(role === 'customer' || role === 'admin') && (
            <div className="border-t pt-4 mt-4">
              <div className="flex items-center justify-between mb-3">
                <label className="text-sm font-semibold text-gray-700 flex items-center gap-1">
                  <Navigation className="w-4 h-4" />
                  عناوين التوصيل المحفوظة
                </label>
                <span className="text-xs text-gray-400">{savedLocations.length}/5</span>
              </div>
              
              {/* قائمة العناوين */}
              {savedLocations.length > 0 && (
                <div className="space-y-3 mb-4">
                  {savedLocations.map((loc, index) => (
                    <div 
                      key={index}
                      className={`rounded-xl p-3 border-2 transition ${
                        index === defaultLocationIndex 
                          ? 'bg-green-50 border-green-300' 
                          : 'bg-gray-50 border-gray-200'
                      }`}
                    >
                      <div className="flex items-start gap-3">
                        <div className={`w-10 h-10 rounded-xl flex items-center justify-center flex-shrink-0 ${
                          index === defaultLocationIndex ? 'bg-green-500' : 'bg-gray-400'
                        }`}>
                          <MapPin className="w-5 h-5 text-white" />
                        </div>
                        <div className="flex-1 min-w-0">
                          <div className="flex items-center gap-2 mb-1">
                            <p className="font-bold text-gray-800">{loc.label || `عنوان ${index + 1}`}</p>
                            {index === defaultLocationIndex && (
                              <span className="inline-flex items-center gap-1 px-2 py-0.5 bg-green-500 text-white text-xs font-bold rounded-full">
                                <Star className="w-3 h-3" /> افتراضي
                              </span>
                            )}
                          </div>
                          <p className="text-sm text-gray-600 line-clamp-2">{loc.address}</p>
                        </div>
                      </div>
                      
                      {/* أزرار الإجراءات */}
                      <div className="flex gap-2 mt-3">
                        {index !== defaultLocationIndex && (
                          <button
                            type="button"
                            onClick={() => handleSetDefault(index)}
                            className="flex-1 py-2 px-3 rounded-lg border border-green-200 text-green-600 text-xs font-medium hover:bg-green-50 transition flex items-center justify-center gap-1"
                          >
                            <Check className="w-3 h-3" /> تعيين كافتراضي
                          </button>
                        )}
                        <button
                          type="button"
                          onClick={() => {
                            setEditingLocationIndex(index)
                            setShowLocationPicker(true)
                          }}
                          className="flex-1 py-2 px-3 rounded-lg border border-sky-200 text-sky-600 text-xs font-medium hover:bg-sky-50 transition"
                        >
                          تعديل
                        </button>
                        <button
                          type="button"
                          onClick={() => handleDeleteLocation(index)}
                          className="py-2 px-3 rounded-lg border border-red-200 text-red-500 hover:bg-red-50 transition"
                        >
                          <Trash2 className="w-4 h-4" />
                        </button>
                      </div>
                    </div>
                  ))}
                </div>
              )}

              {/* زر إضافة عنوان جديد */}
              {savedLocations.length < 5 && (
                <div className="space-y-2">
                  <input
                    type="text"
                    value={newLocationLabel}
                    onChange={(e) => setNewLocationLabel(e.target.value)}
                    placeholder="اسم العنوان (مثال: المنزل، العمل...)"
                    className="w-full border-2 border-gray-200 rounded-xl p-3 text-sm focus:border-sky-400 focus:outline-none"
                  />
                  <button
                    type="button"
                    onClick={() => {
                      setEditingLocationIndex(null)
                      setShowLocationPicker(true)
                    }}
                    className="w-full py-4 rounded-xl bg-gradient-to-r from-sky-100 to-sky-50 border-2 border-dashed border-sky-300 text-sky-600 font-semibold hover:border-sky-400 transition flex items-center justify-center gap-3"
                  >
                    <Plus className="w-5 h-5" />
                    <span>إضافة عنوان جديد</span>
                  </button>
                </div>
              )}

              {savedLocations.length === 0 && (
                <p className="text-xs text-gray-500 mt-2 text-center">
                  💡 أضف عناوينك المفضلة لتسهيل الطلب
                </p>
              )}
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
            <p className="mt-1">📍 يمكنك حفظ حتى 5 عناوين مختلفة</p>
          )}
        </div>
      </div>

      {/* Location Picker Modal */}
      <LocationPicker
        isOpen={showLocationPicker}
        onClose={() => {
          setShowLocationPicker(false)
          setEditingLocationIndex(null)
        }}
        onConfirm={(loc, addr) => {
          if (editingLocationIndex !== null) {
            handleEditLocation(loc, addr)
          } else {
            handleAddLocation(loc, addr)
          }
        }}
        initialLocation={
          editingLocationIndex !== null && savedLocations[editingLocationIndex]
            ? { lat: savedLocations[editingLocationIndex].lat, lng: savedLocations[editingLocationIndex].lng }
            : null
        }
      />
    </div>
  )
}

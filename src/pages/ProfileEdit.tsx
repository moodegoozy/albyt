// src/pages/ProfileEdit.tsx
import React, { useEffect, useState, useCallback } from "react"
import { db } from "@/firebase"
import { useAuth } from "@/auth"
import { doc, getDoc, updateDoc } from "firebase/firestore"
import { useDialog } from '@/components/ui/ConfirmDialog'
import { User, MapPin, Phone, Building2, Home, Save, RefreshCw, Navigation, CheckCircle, Loader2 } from 'lucide-react'

type GeoLocation = { lat: number; lng: number }

export const ProfileEdit: React.FC = () => {
  const { user, role, refreshUserData } = useAuth()
  const dialog = useDialog()
  const [form, setForm] = useState({
    name: "",
    phone: "",
    city: "",
    address: "",
    restaurantName: ""
  })
  const [location, setLocation] = useState<GeoLocation | null>(null)
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  const [gpsLoading, setGpsLoading] = useState(false)
  const [mapReady, setMapReady] = useState(false)

  // موقع افتراضي (الرياض)
  const defaultLocation: GeoLocation = { lat: 24.7136, lng: 46.6753 }

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
        setLocation(data.location || null)
      }
      setLoading(false)
    }
    load()
  }, [user])

  // تحميل Leaflet
  useEffect(() => {
    if (!document.getElementById('leaflet-css')) {
      const link = document.createElement('link')
      link.id = 'leaflet-css'
      link.rel = 'stylesheet'
      link.href = 'https://unpkg.com/leaflet@1.9.4/dist/leaflet.css'
      document.head.appendChild(link)
    }

    if (!(window as any).L) {
      const script = document.createElement('script')
      script.src = 'https://unpkg.com/leaflet@1.9.4/dist/leaflet.js'
      script.onload = () => setMapReady(true)
      document.body.appendChild(script)
    } else {
      setMapReady(true)
    }
  }, [])

  // إنشاء الخريطة
  useEffect(() => {
    if (loading || !mapReady || !(window as any).L) return

    const L = (window as any).L
    const container = document.getElementById('profile-map')
    if (!container) return

    if ((window as any).profileMap) {
      (window as any).profileMap.remove()
    }

    const startLoc = location || defaultLocation

    const map = L.map('profile-map', {
      zoomControl: true,
      attributionControl: false,
    }).setView([startLoc.lat, startLoc.lng], location ? 15 : 10)

    L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', {
      maxZoom: 19,
    }).addTo(map)

    const customIcon = L.divIcon({
      className: 'custom-marker',
      html: `
        <div style="
          width: 40px; 
          height: 40px; 
          background: linear-gradient(135deg, #0EA5E9, #0284C7);
          border-radius: 50% 50% 50% 0;
          transform: rotate(-45deg);
          display: flex;
          align-items: center;
          justify-content: center;
          box-shadow: 0 4px 15px rgba(14, 165, 233, 0.5);
          border: 2px solid white;
        ">
          <div style="transform: rotate(45deg); color: white; font-size: 16px;">📍</div>
        </div>
      `,
      iconSize: [40, 40],
      iconAnchor: [20, 40],
    })

    const marker = L.marker([startLoc.lat, startLoc.lng], { 
      icon: customIcon,
      draggable: true 
    }).addTo(map)

    marker.on('dragend', () => {
      const pos = marker.getLatLng()
      setLocation({ lat: pos.lat, lng: pos.lng })
    })

    map.on('click', (e: any) => {
      const { lat, lng } = e.latlng
      setLocation({ lat, lng })
      marker.setLatLng([lat, lng])
    })

    ;(window as any).profileMap = map
    ;(window as any).profileMarker = marker

    return () => {
      if ((window as any).profileMap) {
        (window as any).profileMap.remove()
        ;(window as any).profileMap = null
        ;(window as any).profileMarker = null
      }
    }
  }, [loading, mapReady])

  // تحديث الماركر عند تغيير الموقع
  useEffect(() => {
    if (location && (window as any).profileMap && (window as any).profileMarker) {
      (window as any).profileMarker.setLatLng([location.lat, location.lng])
      (window as any).profileMap.setView([location.lat, location.lng], 15)
    }
  }, [location])

  // تحديد الموقع عبر GPS
  const getGPSLocation = useCallback(() => {
    if (!navigator.geolocation) {
      dialog.error('المتصفح لا يدعم تحديد الموقع')
      return
    }

    setGpsLoading(true)

    navigator.geolocation.getCurrentPosition(
      (pos) => {
        const newLoc = { lat: pos.coords.latitude, lng: pos.coords.longitude }
        setLocation(newLoc)
        setGpsLoading(false)
      },
      (err) => {
        setGpsLoading(false)
        if (err.code === 1) {
          dialog.error('تم رفض إذن الموقع. فعّل الموقع من إعدادات المتصفح')
        } else {
          dialog.error('تعذر تحديد الموقع. حاول مرة أخرى')
        }
      },
      { enableHighAccuracy: true, timeout: 15000, maximumAge: 0 }
    )
  }, [dialog])

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
        location: location,
        ...(role === 'owner' && { restaurantName: form.restaurantName })
      })

      // إذا كان صاحب مطعم، نحدث موقع المطعم أيضاً
      if (role === 'owner' && location) {
        try {
          await updateDoc(doc(db, 'restaurants', user.uid), {
            geoLocation: location,
            locationUpdatedAt: new Date()
          })
        } catch (err) {
          console.warn('تعذر تحديث موقع المطعم:', err)
        }
      }

      await refreshUserData()
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

          {/* 🗺️ تحديد الموقع على الخريطة */}
          <div className="border-2 border-sky-200 rounded-xl p-4 bg-sky-50/50">
            <label className="block text-sm font-semibold text-gray-700 mb-3">
              <Navigation className="w-4 h-4 inline ml-1" />
              موقعك على الخريطة
            </label>

            {/* زر تحديد الموقع GPS */}
            <button
              type="button"
              onClick={getGPSLocation}
              disabled={gpsLoading}
              className="w-full flex items-center justify-center gap-2 bg-gradient-to-r from-green-500 to-emerald-600 hover:from-green-600 hover:to-emerald-700 text-white font-bold p-3 rounded-xl shadow-lg transition disabled:opacity-50 mb-3"
            >
              {gpsLoading ? (
                <>
                  <Loader2 className="w-5 h-5 animate-spin" />
                  جارِ تحديد موقعك...
                </>
              ) : (
                <>
                  <Navigation className="w-5 h-5" />
                  📍 حدد موقعي تلقائياً
                </>
              )}
            </button>

            {/* الخريطة */}
            <div 
              id="profile-map" 
              className="h-48 rounded-xl overflow-hidden border border-sky-200"
              style={{ background: '#f0f9ff' }}
            />
            <p className="text-xs text-gray-500 mt-2 text-center">
              اضغط على الخريطة أو اسحب العلامة لتحديد موقعك
            </p>

            {/* حالة الموقع */}
            {location && (
              <div className="mt-3 bg-green-50 border border-green-200 rounded-lg p-2 flex items-center gap-2 text-green-700">
                <CheckCircle className="w-4 h-4 flex-shrink-0" />
                <span className="text-xs">تم تحديد الموقع ✓</span>
              </div>
            )}
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

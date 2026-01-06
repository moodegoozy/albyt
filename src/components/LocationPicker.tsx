// src/components/LocationPicker.tsx
import React, { useState, useEffect, useCallback } from 'react'
import { MapPin, Navigation, Check, X, Loader2, Target, Smartphone } from 'lucide-react'

type Location = { lat: number; lng: number }

type Props = {
  isOpen: boolean
  onClose: () => void
  onConfirm: (location: Location, address: string) => void
  initialLocation?: Location | null
}

export const LocationPicker: React.FC<Props> = ({ isOpen, onClose, onConfirm, initialLocation }) => {
  const [location, setLocation] = useState<Location | null>(initialLocation || null)
  const [address, setAddress] = useState('')
  const [loading, setLoading] = useState(false)
  const [gpsLoading, setGpsLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [mapReady, setMapReady] = useState(false)

  // 🎯 موقع افتراضي (الرياض)
  const defaultLocation: Location = { lat: 24.7136, lng: 46.6753 }

  // 📍 تحديد الموقع عبر GPS
  const getGPSLocation = useCallback(() => {
    if (!navigator.geolocation) {
      setError('المتصفح لا يدعم تحديد الموقع')
      return
    }

    setGpsLoading(true)
    setError(null)

    navigator.geolocation.getCurrentPosition(
      (pos) => {
        const newLoc = { lat: pos.coords.latitude, lng: pos.coords.longitude }
        setLocation(newLoc)
        setGpsLoading(false)
        // تحديث الخريطة
        if ((window as any).leafletMap) {
          (window as any).leafletMap.setView([newLoc.lat, newLoc.lng], 17)
          if ((window as any).leafletMarker) {
            (window as any).leafletMarker.setLatLng([newLoc.lat, newLoc.lng])
          }
        }
      },
      (err) => {
        setGpsLoading(false)
        if (err.code === 1) {
          setError('تم رفض إذن الموقع. فعّل الموقع من إعدادات المتصفح')
        } else if (err.code === 2) {
          setError('تعذر تحديد الموقع. تأكد من تفعيل GPS')
        } else {
          setError('انتهت مهلة تحديد الموقع. حاول مرة أخرى')
        }
      },
      { 
        enableHighAccuracy: true, 
        timeout: 15000,
        maximumAge: 0 
      }
    )
  }, [])

  // 🗺️ تحميل Leaflet
  useEffect(() => {
    if (!isOpen) return

    // تحميل CSS
    if (!document.getElementById('leaflet-css')) {
      const link = document.createElement('link')
      link.id = 'leaflet-css'
      link.rel = 'stylesheet'
      link.href = 'https://unpkg.com/leaflet@1.9.4/dist/leaflet.css'
      document.head.appendChild(link)
    }

    // تحميل JS
    if (!(window as any).L) {
      const script = document.createElement('script')
      script.src = 'https://unpkg.com/leaflet@1.9.4/dist/leaflet.js'
      script.onload = () => setMapReady(true)
      document.body.appendChild(script)
    } else {
      setMapReady(true)
    }
  }, [isOpen])

  // 🗺️ إنشاء الخريطة
  useEffect(() => {
    if (!isOpen || !mapReady || !(window as any).L) return

    const L = (window as any).L
    const container = document.getElementById('location-map')
    if (!container) return

    // إزالة خريطة قديمة إن وجدت
    if ((window as any).leafletMap) {
      (window as any).leafletMap.remove()
    }

    const startLoc = location || defaultLocation

    // إنشاء الخريطة
    const map = L.map('location-map', {
      zoomControl: false,
      attributionControl: false,
    }).setView([startLoc.lat, startLoc.lng], location ? 17 : 12)

    // إضافة طبقة الخريطة (OpenStreetMap خفيف وسريع)
    L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', {
      maxZoom: 19,
    }).addTo(map)

    // أيقونة مخصصة للماركر
    const customIcon = L.divIcon({
      className: 'custom-marker',
      html: `
        <div style="
          width: 50px; 
          height: 50px; 
          background: linear-gradient(135deg, #0EA5E9, #0284C7);
          border-radius: 50% 50% 50% 0;
          transform: rotate(-45deg);
          display: flex;
          align-items: center;
          justify-content: center;
          box-shadow: 0 4px 20px rgba(14, 165, 233, 0.5);
          border: 3px solid white;
        ">
          <div style="transform: rotate(45deg); color: white; font-size: 20px;">📍</div>
        </div>
      `,
      iconSize: [50, 50],
      iconAnchor: [25, 50],
    })

    // إضافة الماركر
    const marker = L.marker([startLoc.lat, startLoc.lng], { 
      icon: customIcon,
      draggable: true 
    }).addTo(map)

    // تحديث الموقع عند سحب الماركر
    marker.on('dragend', () => {
      const pos = marker.getLatLng()
      setLocation({ lat: pos.lat, lng: pos.lng })
    })

    // تحديث الموقع عند النقر على الخريطة
    map.on('click', (e: any) => {
      const { lat, lng } = e.latlng
      marker.setLatLng([lat, lng])
      setLocation({ lat, lng })
    })

    // حفظ المراجع
    ;(window as any).leafletMap = map
    ;(window as any).leafletMarker = marker

    // تحديث الموقع إذا كان موجود
    if (location) {
      setLocation(location)
    }

    return () => {
      if ((window as any).leafletMap) {
        (window as any).leafletMap.remove()
        ;(window as any).leafletMap = null
        ;(window as any).leafletMarker = null
      }
    }
  }, [isOpen, mapReady])

  // 📍 تمركز على الموقع الحالي
  const centerOnLocation = () => {
    if (location && (window as any).leafletMap) {
      (window as any).leafletMap.setView([location.lat, location.lng], 17, {
        animate: true,
        duration: 0.5
      })
    }
  }

  // ✅ تأكيد الموقع
  const handleConfirm = () => {
    if (!location) {
      setError('حدد موقعك أولاً')
      return
    }
    if (!address.trim()) {
      setError('أدخل وصف العنوان')
      return
    }
    onConfirm(location, address)
  }

  if (!isOpen) return null

  return (
    <div className="fixed inset-0 z-[9999] flex items-center justify-center">
      {/* خلفية معتمة */}
      <div 
        className="absolute inset-0 bg-black/60 backdrop-blur-sm"
        onClick={onClose}
      />

      {/* المحتوى الرئيسي */}
      <div className="relative w-full h-full sm:w-[95%] sm:h-[90%] sm:max-w-2xl sm:rounded-3xl overflow-hidden bg-white shadow-2xl flex flex-col">
        
        {/* الهيدر */}
        <div className="bg-gradient-to-r from-sky-500 to-sky-600 text-white p-4 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 bg-white/20 rounded-xl flex items-center justify-center">
              <MapPin className="w-5 h-5" />
            </div>
            <div>
              <h2 className="font-bold text-lg">تحديد موقع التوصيل</h2>
              <p className="text-sm text-white/80">اسحب الدبوس أو انقر على الخريطة</p>
            </div>
          </div>
          <button 
            onClick={onClose}
            className="w-10 h-10 bg-white/20 hover:bg-white/30 rounded-xl flex items-center justify-center transition"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* الخريطة */}
        <div className="flex-1 relative">
          {!mapReady && (
            <div className="absolute inset-0 flex items-center justify-center bg-sky-50">
              <div className="text-center">
                <Loader2 className="w-12 h-12 text-sky-500 animate-spin mx-auto mb-3" />
                <p className="text-sky-600 font-medium">جارِ تحميل الخريطة...</p>
              </div>
            </div>
          )}
          <div id="location-map" className="w-full h-full" />

          {/* أزرار التحكم */}
          <div className="absolute left-4 top-4 flex flex-col gap-2 z-[1000]">
            {/* زر GPS */}
            <button
              onClick={getGPSLocation}
              disabled={gpsLoading}
              className="w-12 h-12 bg-white rounded-xl shadow-lg flex items-center justify-center hover:bg-sky-50 transition disabled:opacity-50"
              title="موقعي الحالي"
            >
              {gpsLoading ? (
                <Loader2 className="w-5 h-5 text-sky-500 animate-spin" />
              ) : (
                <Navigation className="w-5 h-5 text-sky-500" />
              )}
            </button>

            {/* زر التمركز */}
            {location && (
              <button
                onClick={centerOnLocation}
                className="w-12 h-12 bg-white rounded-xl shadow-lg flex items-center justify-center hover:bg-sky-50 transition"
                title="تمركز"
              >
                <Target className="w-5 h-5 text-gray-600" />
              </button>
            )}
          </div>

          {/* مؤشر الموقع */}
          {location && (
            <div className="absolute right-4 top-4 bg-white/95 backdrop-blur-sm rounded-xl shadow-lg p-3 z-[1000] max-w-[200px]">
              <div className="flex items-center gap-2 text-green-600 mb-1">
                <Check className="w-4 h-4" />
                <span className="text-sm font-medium">تم تحديد الموقع</span>
              </div>
              <p className="text-xs text-gray-500 font-mono">
                {location.lat.toFixed(6)}, {location.lng.toFixed(6)}
              </p>
            </div>
          )}
        </div>

        {/* قسم العنوان والتأكيد */}
        <div className="bg-white border-t p-4 space-y-3">
          {/* رسالة الخطأ */}
          {error && (
            <div className="bg-red-50 border border-red-200 text-red-600 rounded-xl p-3 text-sm flex items-center gap-2">
              <X className="w-4 h-4 flex-shrink-0" />
              {error}
            </div>
          )}

          {/* حقل العنوان */}
          <div className="relative">
            <Smartphone className="absolute right-3 top-1/2 -translate-y-1/2 w-5 h-5 text-gray-400" />
            <input
              type="text"
              value={address}
              onChange={(e) => setAddress(e.target.value)}
              placeholder="وصف العنوان (مثال: حي النرجس، شارع الملك عبدالعزيز، بجانب مسجد...)"
              className="w-full border-2 border-gray-200 rounded-xl p-3 pr-10 focus:border-sky-400 focus:outline-none transition text-gray-800"
            />
          </div>

          {/* نصيحة */}
          <p className="text-xs text-gray-500 text-center">
            💡 أضف تفاصيل واضحة ليصلك الطلب بسرعة
          </p>

          {/* أزرار */}
          <div className="flex gap-3">
            <button
              onClick={onClose}
              className="flex-1 py-3 px-4 rounded-xl border-2 border-gray-200 text-gray-600 font-semibold hover:bg-gray-50 transition"
            >
              إلغاء
            </button>
            <button
              onClick={handleConfirm}
              disabled={!location}
              className="flex-1 py-3 px-4 rounded-xl bg-gradient-to-r from-green-500 to-green-600 text-white font-bold shadow-lg hover:shadow-xl disabled:opacity-50 disabled:cursor-not-allowed transition flex items-center justify-center gap-2"
            >
              <Check className="w-5 h-5" />
              تأكيد الموقع
            </button>
          </div>
        </div>
      </div>

      {/* أنماط CSS للماركر */}
      <style>{`
        .custom-marker {
          background: transparent !important;
          border: none !important;
        }
        .leaflet-container {
          font-family: inherit;
        }
        .leaflet-control-zoom {
          display: none;
        }
        #location-map {
          background: #f0f9ff;
        }
      `}</style>
    </div>
  )
}

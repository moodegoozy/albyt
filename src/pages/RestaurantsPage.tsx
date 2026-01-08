// src/pages/RestaurantsPage.tsx
import React, { useEffect, useState, useMemo } from 'react'
import { db } from '@/firebase'
import { collection, getDocs } from 'firebase/firestore'
import { Link } from 'react-router-dom'
import { SAUDI_CITIES } from '@/utils/cities'
import { MapPin, Filter, X, Navigation, AlertCircle } from 'lucide-react'
import { useAuth } from '@/auth'
import { calculateDistance, MAX_DELIVERY_DISTANCE } from '@/utils/distance'

type GeoLocation = { lat: number; lng: number }

type Restaurant = {
  id: string
  name: string
  logoUrl?: string
  city?: string
  geoLocation?: GeoLocation
}

type RestaurantWithDistance = Restaurant & {
  distance?: number
}

export const RestaurantsPage: React.FC = () => {
  const { userLocation, role } = useAuth()
  const [restaurants, setRestaurants] = useState<RestaurantWithDistance[]>([])
  const [loading, setLoading] = useState(true)
  const [selectedCity, setSelectedCity] = useState<string>('')

  useEffect(() => {
    (async () => {
      const snap = await getDocs(collection(db, 'restaurants'))
      const allRestaurants = snap.docs.map(d => ({ id: d.id, ...d.data() } as Restaurant))
      
      // حساب المسافة وفلترة المطاعم
      let processedRestaurants: RestaurantWithDistance[] = []
      
      if (userLocation) {
        // حساب المسافة لكل مطعم
        processedRestaurants = allRestaurants.map(r => {
          if (r.geoLocation) {
            const distance = calculateDistance(userLocation, r.geoLocation)
            return { ...r, distance }
          }
          return { ...r, distance: undefined }
        })
        
        // فلترة المطاعم ضمن 15 كم فقط (للعملاء والمناديب)
        if (role === 'customer' || role === 'courier') {
          processedRestaurants = processedRestaurants.filter(r => {
            // إذا المطعم ما عنده موقع، نخفيه
            if (!r.geoLocation || r.distance === undefined) return false
            return r.distance <= MAX_DELIVERY_DISTANCE
          })
        }
        
        // ترتيب حسب المسافة (الأقرب أولاً)
        processedRestaurants.sort((a, b) => (a.distance || 999) - (b.distance || 999))
      } else {
        // إذا ما عند المستخدم موقع، نعرض كل المطاعم
        processedRestaurants = allRestaurants
      }
      
      setRestaurants(processedRestaurants)
      setLoading(false)
    })()
  }, [userLocation, role])

  // المدن المتاحة (فقط التي لديها مطاعم)
  const availableCities = useMemo(() => {
    const cities = new Set(restaurants.map(r => r.city).filter(Boolean))
    return SAUDI_CITIES.filter(c => cities.has(c))
  }, [restaurants])

  // المطاعم المفلترة حسب المدينة
  const filteredRestaurants = useMemo(() => {
    if (!selectedCity) return restaurants
    return restaurants.filter(r => r.city === selectedCity)
  }, [restaurants, selectedCity])

  if (loading) {
    return (
      <div className="flex items-center justify-center h-96 text-lg text-gray-300">
        ⏳ جارِ تحميل المطاعم...
      </div>
    )
  }

  return (
    <div className="py-10">
      <h1 className="text-3xl font-extrabold text-center mb-8 text-sky-600">
        🍴 قائمة المطاعم
      </h1>

      {/* فلتر المدن */}
      {availableCities.length > 0 && (
        <div className="mb-6 flex flex-wrap items-center justify-center gap-2">
          <div className="flex items-center gap-2 text-sky-600">
            <Filter className="w-5 h-5" />
            <span className="font-semibold">المدينة:</span>
          </div>
          <button
            onClick={() => setSelectedCity('')}
            className={`px-4 py-2 rounded-full text-sm font-medium transition-all ${
              !selectedCity
                ? 'bg-sky-500 text-white shadow-lg'
                : 'bg-sky-100 text-sky-700 hover:bg-sky-200'
            }`}
          >
            الكل
          </button>
          {availableCities.map(city => (
            <button
              key={city}
              onClick={() => setSelectedCity(city)}
              className={`px-4 py-2 rounded-full text-sm font-medium transition-all flex items-center gap-1 ${
                selectedCity === city
                  ? 'bg-sky-500 text-white shadow-lg'
                  : 'bg-sky-100 text-sky-700 hover:bg-sky-200'
              }`}
            >
              <MapPin className="w-4 h-4" />
              {city}
            </button>
          ))}
          {selectedCity && (
            <button
              onClick={() => setSelectedCity('')}
              className="p-2 text-gray-400 hover:text-red-500 transition-colors"
              title="إزالة الفلتر"
            >
              <X className="w-5 h-5" />
            </button>
          )}
        </div>
      )}

      {filteredRestaurants.length === 0 && (
        <div className="text-center py-10">
          <div className="w-20 h-20 bg-sky-100 rounded-full flex items-center justify-center mx-auto mb-4">
            <AlertCircle className="w-10 h-10 text-sky-500" />
          </div>
          {userLocation ? (
            <>
              <p className="text-gray-600 text-lg font-semibold">😔 لا توجد مطاعم قريبة منك</p>
              <p className="text-gray-400 text-sm mt-2">نعرض المطاعم ضمن {MAX_DELIVERY_DISTANCE} كم فقط</p>
            </>
          ) : (
            <>
              <p className="text-gray-600 text-lg font-semibold">
                {selectedCity ? `😔 لا توجد مطاعم في ${selectedCity}` : '😔 لا توجد مطاعم حالياً'}
              </p>
            </>
          )}
        </div>
      )}

      {/* رسالة توضيحية للمسافة */}
      {userLocation && filteredRestaurants.length > 0 && (role === 'customer' || role === 'courier') && (
        <div className="mb-6 bg-sky-50 border border-sky-200 rounded-xl p-4 flex items-center gap-3">
          <Navigation className="w-6 h-6 text-sky-500 flex-shrink-0" />
          <div>
            <p className="text-sky-700 font-semibold">نعرض لك المطاعم القريبة فقط</p>
            <p className="text-sky-600 text-sm">المسافة القصوى للتوصيل: {MAX_DELIVERY_DISTANCE} كم</p>
          </div>
        </div>
      )}

      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-6">
        {filteredRestaurants.map(r => (
          <Link
            key={r.id}
            to={`/menu?restaurant=${r.id}`}
            className="bg-white border border-gray-200 text-gray-800 rounded-2xl shadow-lg hover:shadow-2xl hover:-translate-y-1 transform transition p-6 flex flex-col items-center text-center relative overflow-hidden"
          >
            {/* شارة المسافة */}
            {r.distance !== undefined && (
              <div className="absolute top-3 left-3 bg-sky-500 text-white text-xs font-bold px-3 py-1 rounded-full flex items-center gap-1">
                <Navigation className="w-3 h-3" />
                {r.distance < 1 ? `${Math.round(r.distance * 1000)} م` : `${r.distance.toFixed(1)} كم`}
              </div>
            )}
            
            {r.logoUrl ? (
              <img
                src={r.logoUrl}
                alt={r.name}
                className="w-28 h-28 object-cover rounded-full border-4 border-sky-100 mb-4"
              />
            ) : (
              <div className="w-28 h-28 flex items-center justify-center bg-sky-100 rounded-full text-3xl mb-4">
                🍴
              </div>
            )}
            <h3 className="font-bold text-xl text-gray-800">{r.name}</h3>
            {r.city && (
              <p className="text-sm text-gray-500 mt-1 flex items-center justify-center gap-1">
                <MapPin className="w-4 h-4" />
                {r.city}
              </p>
            )}
          </Link>
        ))}
      </div>
    </div>
  )
}

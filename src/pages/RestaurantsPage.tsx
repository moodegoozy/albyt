// src/pages/RestaurantsPage.tsx
import React, { useEffect, useState, useMemo } from 'react'
import { db } from '@/firebase'
import { collection, getDocs } from 'firebase/firestore'
import { Link } from 'react-router-dom'
import { SAUDI_CITIES } from '@/utils/cities'
import { MapPin, Filter, X } from 'lucide-react'

type Restaurant = {
  id: string
  name: string
  logoUrl?: string
  city?: string
}

export const RestaurantsPage: React.FC = () => {
  const [restaurants, setRestaurants] = useState<Restaurant[]>([])
  const [loading, setLoading] = useState(true)
  const [selectedCity, setSelectedCity] = useState<string>('')

  useEffect(() => {
    (async () => {
      const snap = await getDocs(collection(db, 'restaurants'))
      setRestaurants(snap.docs.map(d => ({ id: d.id, ...d.data() } as Restaurant)))
      setLoading(false)
    })()
  }, [])

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
        <div className="text-center text-gray-400">
          {selectedCity ? `😔 لا توجد مطاعم في ${selectedCity}` : '😔 لا توجد مطاعم حالياً'}
        </div>
      )}

      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-6">
        {filteredRestaurants.map(r => (
          <Link
            key={r.id}
            to={`/menu?restaurant=${r.id}`}
            className="bg-gray-800 text-white rounded-2xl shadow-lg hover:shadow-2xl hover:-translate-y-1 transform transition p-6 flex flex-col items-center text-center"
          >
            {r.logoUrl ? (
              <img
                src={r.logoUrl}
                alt={r.name}
                className="w-28 h-28 object-cover rounded-full border-4 border-gray-700 mb-4"
              />
            ) : (
              <div className="w-28 h-28 flex items-center justify-center bg-gray-600 rounded-full text-3xl mb-4">
                🍴
              </div>
            )}
            <h3 className="font-bold text-xl">{r.name}</h3>
            {r.city && (
              <p className="text-sm text-gray-400 mt-1 flex items-center justify-center gap-1">
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

// src/pages/RestaurantsPage.tsx
import React, { useEffect, useState, useMemo } from 'react'
import { db } from '@/firebase'
import { collection, getDocs, query, where, updateDoc, doc, increment, setDoc, addDoc, serverTimestamp, getDoc } from 'firebase/firestore'
import { Link, useSearchParams } from 'react-router-dom'
import { SAUDI_CITIES } from '@/utils/cities'
import { MapPin, Filter, X, Navigation, AlertCircle, CheckCircle, Crown, Medal, Award, Megaphone, ChevronLeft, ChevronRight, Play, Eye, Star, ShoppingBag, Utensils } from 'lucide-react'
import { useAuth } from '@/auth'
import { calculateDistance, MAX_DELIVERY_DISTANCE } from '@/utils/distance'
import { Promotion } from '@/types'

type GeoLocation = { lat: number; lng: number }

type Restaurant = {
  id: string
  name: string
  logoUrl?: string
  city?: string
  geoLocation?: GeoLocation
  isVerified?: boolean
  sellerTier?: 'bronze' | 'silver' | 'gold'
  packageType?: 'free' | 'premium'
  // إحصائيات للعرض في الباقة المميزة
  totalOrders?: number
  averageRating?: number
  menuItemsCount?: number
}

type RestaurantWithDistance = Restaurant & {
  distance?: number
}

// دالة تسجيل الزيارة
const logVisit = async (restaurantId: string, userId?: string, source?: string) => {
  try {
    // تسجيل الزيارة في سجلات الزيارات
    await addDoc(collection(db, 'visitLogs'), {
      restaurantId,
      visitorId: userId || null,
      visitorType: userId ? 'customer' : 'anonymous',
      source: source || 'direct',
      page: 'menu',
      createdAt: serverTimestamp()
    })

    // تحديث إحصائيات المطعم
    const statsRef = doc(db, 'restaurantStats', restaurantId)
    const statsSnap = await getDoc(statsRef)
    
    const today = new Date().toISOString().split('T')[0]
    
    if (statsSnap.exists()) {
      const data = statsSnap.data()
      const dailyViews = data.dailyViews || {}
      dailyViews[today] = (dailyViews[today] || 0) + 1
      
      await updateDoc(statsRef, {
        totalProfileViews: increment(1),
        dailyViews,
        updatedAt: serverTimestamp()
      })
    } else {
      await setDoc(statsRef, {
        totalProfileViews: 1,
        totalMenuViews: 0,
        totalItemViews: 0,
        totalShareClicks: 0,
        whatsappShareCount: 0,
        registeredCustomers: 0,
        appDownloads: 0,
        dailyViews: { [today]: 1 },
        updatedAt: serverTimestamp()
      })
    }
  } catch (err) {
    console.warn('خطأ في تسجيل الزيارة:', err)
  }
}

export const RestaurantsPage: React.FC = () => {
  const { userLocation, role, user } = useAuth()
  const [searchParams] = useSearchParams()
  const refSource = searchParams.get('ref') // مصدر الإحالة (whatsapp, social, etc)
  const [restaurants, setRestaurants] = useState<RestaurantWithDistance[]>([])
  const [promotions, setPromotions] = useState<(Promotion & { restaurantName?: string })[]>([])
  const [currentPromoIndex, setCurrentPromoIndex] = useState(0)
  const [loading, setLoading] = useState(true)
  const [selectedCity, setSelectedCity] = useState<string>('')
  const [viewMode, setViewMode] = useState<'grid' | 'list'>('grid')

  useEffect(() => {
    (async () => {
      // جلب المطاعم
      const snap = await getDocs(collection(db, 'restaurants'))
      const allRestaurants = snap.docs.map(d => ({ id: d.id, ...d.data() } as Restaurant))
      
      // جلب الإعلانات النشطة
      try {
        const promoQuery = query(
          collection(db, 'promotions'),
          where('isActive', '==', true)
        )
        const promoSnap = await getDocs(promoQuery)
        const now = new Date()
        const activePromos = promoSnap.docs
          .map(d => ({
            id: d.id,
            ...d.data(),
            expiresAt: d.data().expiresAt?.toDate?.(),
          } as Promotion))
          .filter(p => !p.expiresAt || new Date(p.expiresAt) > now)
          .map(p => {
            // إضافة اسم المطعم
            const restaurant = allRestaurants.find(r => r.id === p.ownerId)
            return { ...p, restaurantName: restaurant?.name }
          })
        setPromotions(activePromos)
      } catch (err) {
        console.warn('Error loading promotions:', err)
      }
      
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
        
        // ترتيب ذكي: Premium + Gold أولاً، ثم حسب المسافة
        processedRestaurants.sort((a, b) => {
          // Premium يظهر أولاً
          const aPremium = a.packageType === 'premium' ? 1 : 0
          const bPremium = b.packageType === 'premium' ? 1 : 0
          if (bPremium !== aPremium) return bPremium - aPremium
          
          // Gold ثم Silver ثم Bronze
          const tierOrder = { gold: 3, silver: 2, bronze: 1 }
          const aTier = tierOrder[a.sellerTier || 'bronze'] || 0
          const bTier = tierOrder[b.sellerTier || 'bronze'] || 0
          if (bTier !== aTier) return bTier - aTier
          
          // الموثقة تظهر قبل غير الموثقة
          const aVerified = a.isVerified ? 1 : 0
          const bVerified = b.isVerified ? 1 : 0
          if (bVerified !== aVerified) return bVerified - aVerified
          
          // ثم الترتيب حسب المسافة
          return (a.distance || 999) - (b.distance || 999)
        })
      } else {
        // إذا ما عند المستخدم موقع، نعرض كل المطاعم مرتبة
        processedRestaurants = allRestaurants.sort((a, b) => {
          const tierOrder = { gold: 3, silver: 2, bronze: 1 }
          const aTier = tierOrder[a.sellerTier || 'bronze'] || 0
          const bTier = tierOrder[b.sellerTier || 'bronze'] || 0
          if (bTier !== aTier) return bTier - aTier
          const aVerified = a.isVerified ? 1 : 0
          const bVerified = b.isVerified ? 1 : 0
          return bVerified - aVerified
        })
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

      {/* 📢 شريط الإعلانات الممولة */}
      {promotions.length > 0 && (
        <div className="mb-8">
          <div className="flex items-center justify-center gap-2 mb-3">
            <Megaphone className="w-5 h-5 text-purple-500" />
            <span className="font-bold text-purple-600">إعلانات مميزة</span>
          </div>
          
          <div className="relative">
            {/* الإعلان الحالي */}
            <Link
              to={`/menu?restaurant=${promotions[currentPromoIndex]?.ownerId}`}
              onClick={async () => {
                // زيادة عداد المشاهدات
                try {
                  await updateDoc(doc(db, 'promotions', promotions[currentPromoIndex].id), {
                    viewsCount: increment(1)
                  })
                } catch {}
              }}
              className="block bg-gradient-to-r from-purple-900 via-purple-800 to-pink-900 rounded-2xl shadow-xl overflow-hidden"
            >
              {/* شارة الإعلان */}
              <div className="absolute top-3 right-3 z-10 inline-flex items-center gap-1 px-3 py-1 bg-gradient-to-r from-purple-500 to-pink-500 text-white text-xs font-bold rounded-full shadow">
                <Megaphone className="w-3 h-3" />
                إعلان
              </div>

              {/* الوسائط */}
              {promotions[currentPromoIndex]?.mediaUrl && (
                <div className="relative h-48">
                  {promotions[currentPromoIndex].type === 'video' ? (
                    <>
                      <video
                        src={promotions[currentPromoIndex].mediaUrl}
                        className="w-full h-full object-cover"
                        muted
                        loop
                        autoPlay
                        playsInline
                      />
                      <div className="absolute inset-0 flex items-center justify-center pointer-events-none">
                        <div className="w-12 h-12 bg-white/20 rounded-full flex items-center justify-center backdrop-blur-sm">
                          <Play className="w-6 h-6 text-white fill-white" />
                        </div>
                      </div>
                    </>
                  ) : (
                    <img
                      src={promotions[currentPromoIndex].mediaUrl}
                      alt={promotions[currentPromoIndex].title}
                      className="w-full h-full object-cover"
                    />
                  )}
                </div>
              )}

              {/* المحتوى */}
              <div className="p-4">
                <div className="flex items-center gap-2 mb-2">
                  {promotions[currentPromoIndex]?.restaurantName && (
                    <span className="text-xs bg-white/20 text-white px-2 py-1 rounded-full">
                      {promotions[currentPromoIndex].restaurantName}
                    </span>
                  )}
                </div>
                {promotions[currentPromoIndex]?.title && (
                  <h3 className="text-lg font-bold text-white">{promotions[currentPromoIndex].title}</h3>
                )}
                {promotions[currentPromoIndex]?.description && (
                  <p className="text-purple-100 text-sm mt-1 line-clamp-2">{promotions[currentPromoIndex].description}</p>
                )}
              </div>
            </Link>

            {/* أزرار التنقل */}
            {promotions.length > 1 && (
              <>
                <button
                  onClick={(e) => {
                    e.preventDefault()
                    setCurrentPromoIndex((prev) => (prev === 0 ? promotions.length - 1 : prev - 1))
                  }}
                  className="absolute left-2 top-1/2 -translate-y-1/2 p-2 bg-white/80 hover:bg-white rounded-full shadow-lg transition z-10"
                >
                  <ChevronLeft className="w-5 h-5 text-gray-800" />
                </button>
                <button
                  onClick={(e) => {
                    e.preventDefault()
                    setCurrentPromoIndex((prev) => (prev === promotions.length - 1 ? 0 : prev + 1))
                  }}
                  className="absolute right-2 top-1/2 -translate-y-1/2 p-2 bg-white/80 hover:bg-white rounded-full shadow-lg transition z-10"
                >
                  <ChevronRight className="w-5 h-5 text-gray-800" />
                </button>
              </>
            )}

            {/* مؤشرات الصفحات */}
            {promotions.length > 1 && (
              <div className="flex justify-center gap-2 mt-3">
                {promotions.map((_, idx) => (
                  <button
                    key={idx}
                    onClick={() => setCurrentPromoIndex(idx)}
                    className={`w-2 h-2 rounded-full transition ${
                      idx === currentPromoIndex ? 'bg-purple-500 w-4' : 'bg-gray-300'
                    }`}
                  />
                ))}
              </div>
            )}
          </div>
        </div>
      )}

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

      {/* === الأسر المميزة (Premium) - عرض مميز بمربعات === */}
      {filteredRestaurants.filter(r => r.packageType === 'premium').length > 0 && (
        <div className="mb-8">
          <div className="flex items-center justify-between mb-4">
            <div className="flex items-center gap-2">
              <Crown className="w-6 h-6 text-amber-500" />
              <h2 className="text-xl font-bold text-gray-800">⭐ الأسر المميزة</h2>
            </div>
            <span className="text-sm text-gray-500">{filteredRestaurants.filter(r => r.packageType === 'premium').length} أسرة</span>
          </div>
          
          <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 gap-4">
            {filteredRestaurants.filter(r => r.packageType === 'premium').map(r => (
              <Link
                key={r.id}
                to={`/menu?restaurant=${r.id}${refSource ? `&ref=${refSource}` : ''}`}
                onClick={() => logVisit(r.id, user?.uid, refSource || 'direct')}
                className="group bg-gradient-to-br from-amber-50 via-white to-purple-50 border-2 border-amber-200 rounded-2xl shadow-lg hover:shadow-2xl hover:-translate-y-2 transform transition-all duration-300 p-4 flex flex-col items-center text-center relative overflow-hidden"
              >
                {/* خلفية متوهجة */}
                <div className="absolute inset-0 bg-gradient-to-br from-amber-500/5 to-purple-500/5 opacity-0 group-hover:opacity-100 transition-opacity" />
                
                {/* شارة مميزة */}
                <div className="absolute top-2 right-2">
                  <div className="bg-gradient-to-r from-amber-500 to-orange-500 text-white text-[10px] font-bold px-2 py-0.5 rounded-full shadow flex items-center gap-1">
                    <Crown className="w-3 h-3" />
                    مميزة
                  </div>
                </div>

                {/* شارة المسافة */}
                {r.distance !== undefined && (
                  <div className="absolute top-2 left-2 bg-sky-500/90 backdrop-blur text-white text-[10px] font-bold px-2 py-0.5 rounded-full flex items-center gap-0.5">
                    <Navigation className="w-2.5 h-2.5" />
                    {r.distance < 1 ? `${Math.round(r.distance * 1000)}م` : `${r.distance.toFixed(1)}كم`}
                  </div>
                )}
                
                {/* الشعار - مربع صغير مميز */}
                <div className="relative mt-4 mb-3">
                  {r.logoUrl ? (
                    <img
                      src={r.logoUrl}
                      alt={r.name}
                      className="w-20 h-20 object-cover rounded-xl border-3 border-amber-300 shadow-lg group-hover:scale-110 transition-transform duration-300"
                    />
                  ) : (
                    <div className="w-20 h-20 flex items-center justify-center rounded-xl bg-gradient-to-br from-amber-100 to-orange-100 border-3 border-amber-300 shadow-lg group-hover:scale-110 transition-transform duration-300">
                      <Utensils className="w-8 h-8 text-amber-600" />
                    </div>
                  )}
                  {/* شارة التوثيق */}
                  {r.isVerified && (
                    <div className="absolute -bottom-1 -right-1 w-6 h-6 bg-green-500 rounded-full flex items-center justify-center border-2 border-white">
                      <CheckCircle className="w-3.5 h-3.5 text-white" />
                    </div>
                  )}
                </div>
                
                {/* اسم الأسرة */}
                <h3 className="font-bold text-sm text-gray-800 line-clamp-1">{r.name}</h3>
                
                {/* المدينة */}
                {r.city && (
                  <p className="text-xs text-gray-500 flex items-center gap-0.5 mt-1">
                    <MapPin className="w-3 h-3" />
                    {r.city}
                  </p>
                )}

                {/* إحصائيات سريعة */}
                <div className="flex items-center justify-center gap-3 mt-2 text-[10px] text-gray-400">
                  {r.averageRating !== undefined && r.averageRating > 0 && (
                    <span className="flex items-center gap-0.5">
                      <Star className="w-3 h-3 text-amber-400 fill-amber-400" />
                      {r.averageRating.toFixed(1)}
                    </span>
                  )}
                  {r.totalOrders !== undefined && r.totalOrders > 0 && (
                    <span className="flex items-center gap-0.5">
                      <ShoppingBag className="w-3 h-3" />
                      {r.totalOrders}
                    </span>
                  )}
                </div>

                {/* شارات التصنيف */}
                <div className="flex gap-1 mt-2">
                  {r.sellerTier === 'gold' && (
                    <span className="bg-gradient-to-r from-amber-400 to-yellow-400 text-white text-[9px] font-bold px-1.5 py-0.5 rounded-full">👑 Gold</span>
                  )}
                  {r.sellerTier === 'silver' && (
                    <span className="bg-gradient-to-r from-gray-400 to-gray-500 text-white text-[9px] font-bold px-1.5 py-0.5 rounded-full">🥈 Silver</span>
                  )}
                </div>
              </Link>
            ))}
          </div>
        </div>
      )}

      {/* === باقي الأسر (المجانية) - العرض العادي === */}
      {filteredRestaurants.filter(r => r.packageType !== 'premium').length > 0 && (
        <div>
          {filteredRestaurants.filter(r => r.packageType === 'premium').length > 0 && (
            <div className="flex items-center gap-2 mb-4">
              <Utensils className="w-5 h-5 text-gray-500" />
              <h2 className="text-lg font-bold text-gray-700">جميع الأسر</h2>
            </div>
          )}
          
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-6">
            {filteredRestaurants.filter(r => r.packageType !== 'premium').map(r => (
              <Link
                key={r.id}
                to={`/menu?restaurant=${r.id}${refSource ? `&ref=${refSource}` : ''}`}
                onClick={() => logVisit(r.id, user?.uid, refSource || 'direct')}
                className={`bg-white border text-gray-800 rounded-2xl shadow-lg hover:shadow-2xl hover:-translate-y-1 transform transition p-6 flex flex-col items-center text-center relative overflow-hidden ${
                  r.sellerTier === 'gold' ? 'border-amber-300 ring-2 ring-amber-200' : 'border-gray-200'
                }`}
              >
                {/* شارات التميز في الأعلى */}
                <div className="absolute top-3 right-3 flex flex-col gap-1.5">
                  {/* شارة التوثيق */}
                  {r.isVerified ? (
                    <div className="bg-green-500 text-white text-xs font-bold px-2.5 py-1 rounded-full flex items-center gap-1 shadow">
                      <CheckCircle className="w-3 h-3" />
                      موثقة ✓
                    </div>
                  ) : (
                    <div className="bg-gray-400 text-white text-xs font-medium px-2.5 py-1 rounded-full flex items-center gap-1 shadow-sm">
                      غير موثقة
                    </div>
                  )}
                  {/* شارة التصنيف */}
                  {r.sellerTier === 'gold' && (
                    <div className="bg-gradient-to-r from-amber-400 to-yellow-400 text-white text-xs font-bold px-2.5 py-1 rounded-full flex items-center gap-1 shadow">
                      <Crown className="w-3 h-3" />
                      Gold
                    </div>
                  )}
                  {r.sellerTier === 'silver' && (
                    <div className="bg-gradient-to-r from-gray-400 to-gray-500 text-white text-xs font-bold px-2.5 py-1 rounded-full flex items-center gap-1 shadow">
                      <Medal className="w-3 h-3" />
                      Silver
                    </div>
                  )}
                </div>
                
                {/* شارة المسافة */}
                {r.distance !== undefined && (
                  <div className="absolute top-3 left-3 bg-sky-500 text-white text-xs font-bold px-3 py-1 rounded-full flex items-center gap-1">
                    <Navigation className="w-3 h-3" />
                    {r.distance < 1 ? `${Math.round(r.distance * 1000)} م` : `${r.distance.toFixed(1)} كم`}
                  </div>
                )}
                
                {/* الشعار مع إطار ذهبي للـ Gold */}
                {r.logoUrl ? (
                  <img
                    src={r.logoUrl}
                    alt={r.name}
                    className={`w-28 h-28 object-cover rounded-full mb-4 ${
                      r.sellerTier === 'gold' 
                        ? 'border-4 border-amber-400 ring-4 ring-amber-100' 
                        : r.sellerTier === 'silver'
                        ? 'border-4 border-gray-300'
                        : 'border-4 border-sky-100'
                    }`}
                  />
                ) : (
                  <div className={`w-28 h-28 flex items-center justify-center rounded-full text-3xl mb-4 ${
                    r.sellerTier === 'gold' 
                      ? 'bg-amber-100 border-4 border-amber-400' 
                      : r.sellerTier === 'silver'
                      ? 'bg-gray-100 border-4 border-gray-300'
                      : 'bg-sky-100 border-4 border-sky-200'
                  }`}>
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
      )}
    </div>
  )
}

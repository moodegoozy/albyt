// src/pages/Register.tsx
import React, { useState, useEffect } from 'react'
import { createUserWithEmailAndPassword } from 'firebase/auth'
import { auth, db } from '@/firebase'
import { doc, setDoc, addDoc, collection, serverTimestamp, updateDoc, increment, getDoc } from 'firebase/firestore'
import { useNavigate, Link, useSearchParams } from 'react-router-dom'
import { User, Mail, Lock, Store, UserPlus, Truck, ChefHat, Users, MapPin, CheckSquare, Square } from 'lucide-react'
import { SAUDI_CITIES } from '@/utils/cities'

export const Register: React.FC = () => {
  const [searchParams] = useSearchParams()
  const referralRestaurantId = searchParams.get('ref_restaurant') // رابط الإحالة من الأسرة
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [name, setName] = useState('')
  const [restaurantName, setRestaurantName] = useState('')
  const [city, setCity] = useState('')
  const [role, setRole] = useState<'customer'|'courier'|'owner'|''>('')
  const [acceptedTerms, setAcceptedTerms] = useState(false)
  const [loading, setLoading] = useState(false)
  const nav = useNavigate()

  // إذا جاء العميل من رابط إحالة، نحدد دوره تلقائياً كعميل
  useEffect(() => {
    if (referralRestaurantId) {
      setRole('customer')
    }
  }, [referralRestaurantId])

  // هل يتطلب هذا الدور الموافقة على الشروط؟
  const requiresTerms = role === 'owner' || role === 'courier'

  // عند تغيير الدور، نعيد تعيين الموافقة
  const handleRoleChange = (newRole: 'customer'|'courier'|'owner') => {
    setRole(newRole)
    setAcceptedTerms(false)
  }

  const submit = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!role) return alert('اختر نوع الحساب')
    if (role === 'owner' && !restaurantName) return alert('أدخل اسم المطعم')
    if (requiresTerms && !acceptedTerms) return alert('يجب الموافقة على الشروط والأحكام')

    setLoading(true)
    try {
      const cred = await createUserWithEmailAndPassword(auth, email, password)
      await setDoc(doc(db, 'users', cred.user.uid), {
        name,
        email,
        role,
        restaurantName: role === 'owner' ? restaurantName : null,
        referredBy: referralRestaurantId || null, // حفظ رابط الإحالة
        createdAt: serverTimestamp()
      })

      if (role === 'owner') {
        await setDoc(doc(db, 'restaurants', cred.user.uid), {
          name: restaurantName || name || 'مطعم جديد',
          ownerId: cred.user.uid,
          email,
          phone: '',
          city: city || '',
          location: '',
          logoUrl: '',
        }, { merge: true })
      }

      // إذا كان التسجيل عبر رابط إحالة، نسجل ذلك ونرسل إشعار للأسرة
      if (referralRestaurantId && role === 'customer') {
        try {
          // تسجيل في جدول تسجيلات العملاء
          await addDoc(collection(db, 'customerRegistrations'), {
            customerId: cred.user.uid,
            customerName: name,
            customerEmail: email,
            restaurantId: referralRestaurantId,
            registrationType: 'website',
            createdAt: serverTimestamp()
          })

          // تحديث إحصائيات المطعم
          const statsRef = doc(db, 'restaurantStats', referralRestaurantId)
          const statsSnap = await getDoc(statsRef)
          if (statsSnap.exists()) {
            await updateDoc(statsRef, {
              registeredCustomers: increment(1),
              updatedAt: serverTimestamp()
            })
          } else {
            await setDoc(statsRef, {
              totalProfileViews: 0,
              totalMenuViews: 0,
              totalItemViews: 0,
              totalShareClicks: 0,
              whatsappShareCount: 0,
              registeredCustomers: 1,
              appDownloads: 0,
              dailyViews: {},
              updatedAt: serverTimestamp()
            })
          }

          // إرسال إشعار للأسرة المنتجة
          await addDoc(collection(db, 'notifications'), {
            recipientId: referralRestaurantId,
            title: '🎉 عميل جديد سجل عبر رابطك!',
            message: `العميل "${name}" سجل في التطبيق عبر رابط الإحالة الخاص بك`,
            type: 'new_customer_registration',
            read: false,
            createdAt: serverTimestamp()
          })
        } catch (err) {
          console.warn('خطأ في تسجيل الإحالة:', err)
        }
      }

      nav('/')
    } catch (e: any) {
      alert(e.message)
    } finally { setLoading(false) }
  }

  const roleOptions = [
    { value: 'customer', label: 'عميل', icon: Users, color: 'sky' },
    { value: 'courier', label: 'مندوب', icon: Truck, color: 'emerald' },
    { value: 'owner', label: 'صاحب مطعم', icon: ChefHat, color: 'orange' },
  ]

  return (
    <div className="min-h-screen flex items-center justify-center bg-gradient-to-br from-sky-50 via-white to-sky-100 px-4 py-8">
      {/* خلفية زخرفية */}
      <div className="absolute top-0 left-0 w-72 h-72 bg-sky-300/20 rounded-full blur-3xl"></div>
      <div className="absolute bottom-0 right-0 w-72 h-72 bg-sky-400/20 rounded-full blur-3xl"></div>

      <div className="relative bg-white/80 backdrop-blur-xl border border-sky-100 rounded-[2rem] shadow-2xl shadow-sky-200/50 w-full max-w-md p-8">
        
        {/* شعار */}
        <div className="flex flex-col items-center mb-6">
          <div className="w-16 h-16 bg-gradient-to-br from-sky-500 to-sky-600 rounded-2xl flex items-center justify-center shadow-xl shadow-sky-300/50 mb-3">
            <UserPlus className="w-8 h-8 text-white" />
          </div>
          <h1 className="text-2xl font-black text-sky-600">إنشاء حساب جديد</h1>
        </div>

        <form onSubmit={submit} className="space-y-4">
          {/* الاسم */}
          <div className="relative">
            <User className="absolute right-4 top-1/2 -translate-y-1/2 w-5 h-5 text-sky-400" />
            <input 
              className="w-full rounded-2xl p-4 pr-12 bg-sky-50 text-sky-900 border-2 border-sky-100 focus:outline-none focus:border-sky-400 focus:ring-4 focus:ring-sky-100 transition-all" 
              placeholder="الاسم" 
              value={name} 
              onChange={e=>setName(e.target.value)} 
            />
          </div>

          {/* الإيميل */}
          <div className="relative">
            <Mail className="absolute right-4 top-1/2 -translate-y-1/2 w-5 h-5 text-sky-400" />
            <input 
              className="w-full rounded-2xl p-4 pr-12 bg-sky-50 text-sky-900 border-2 border-sky-100 focus:outline-none focus:border-sky-400 focus:ring-4 focus:ring-sky-100 transition-all" 
              placeholder="الإيميل" 
              type="email"
              value={email} 
              onChange={e=>setEmail(e.target.value)} 
            />
          </div>

          {/* كلمة المرور */}
          <div className="relative">
            <Lock className="absolute right-4 top-1/2 -translate-y-1/2 w-5 h-5 text-sky-400" />
            <input 
              className="w-full rounded-2xl p-4 pr-12 bg-sky-50 text-sky-900 border-2 border-sky-100 focus:outline-none focus:border-sky-400 focus:ring-4 focus:ring-sky-100 transition-all" 
              placeholder="كلمة المرور" 
              type="password" 
              value={password} 
              onChange={e=>setPassword(e.target.value)} 
            />
          </div>

          {/* اختيار نوع الحساب */}
          <div className="grid grid-cols-3 gap-3">
            {roleOptions.map(opt => {
              const Icon = opt.icon
              const isSelected = role === opt.value
              return (
                <label 
                  key={opt.value}
                  className={`relative flex flex-col items-center gap-2 p-4 rounded-2xl cursor-pointer transition-all duration-300 ${
                    isSelected 
                      ? 'bg-gradient-to-br from-sky-500 to-sky-600 text-white shadow-lg shadow-sky-300/50 scale-105' 
                      : 'bg-sky-50 text-sky-600 hover:bg-sky-100 border-2 border-sky-100'
                  }`}
                >
                  <input 
                    type="radio" 
                    name="role" 
                    value={opt.value} 
                    className="hidden" 
                    onChange={()=>handleRoleChange(opt.value as any)} 
                  />
                  <Icon className="w-6 h-6" />
                  <span className="text-sm font-bold">{opt.label}</span>
                </label>
              )
            })}
          </div>

          {/* حقل اسم المطعم والمدينة */}
          {role === 'owner' && (
            <>
              <div className="relative">
                <Store className="absolute right-4 top-1/2 -translate-y-1/2 w-5 h-5 text-orange-400" />
                <input 
                  className="w-full rounded-2xl p-4 pr-12 bg-orange-50 text-orange-900 border-2 border-orange-200 focus:outline-none focus:border-orange-400 focus:ring-4 focus:ring-orange-100 transition-all" 
                  placeholder="اسم المطعم" 
                  value={restaurantName} 
                  onChange={e=>setRestaurantName(e.target.value)} 
                />
              </div>
              <div className="relative">
                <MapPin className="absolute right-4 top-1/2 -translate-y-1/2 w-5 h-5 text-orange-400 pointer-events-none" />
                <select
                  value={city}
                  onChange={e => setCity(e.target.value)}
                  className="w-full rounded-2xl p-4 pr-12 bg-orange-50 text-orange-900 border-2 border-orange-200 focus:outline-none focus:border-orange-400 focus:ring-4 focus:ring-orange-100 transition-all appearance-none cursor-pointer"
                >
                  <option value="">اختر المدينة</option>
                  {SAUDI_CITIES.map(c => (
                    <option key={c} value={c}>{c}</option>
                  ))}
                </select>
              </div>

              {/* الموافقة على الشروط والأحكام */}
              <div 
                onClick={() => setAcceptedTerms(!acceptedTerms)}
                className={`flex items-start gap-3 p-4 rounded-2xl cursor-pointer transition-all border-2 ${
                  acceptedTerms 
                    ? 'bg-green-50 border-green-400' 
                    : 'bg-orange-50 border-orange-200 hover:border-orange-300'
                }`}
              >
                {acceptedTerms ? (
                  <CheckSquare className="w-6 h-6 text-green-500 flex-shrink-0 mt-0.5" />
                ) : (
                  <Square className="w-6 h-6 text-orange-400 flex-shrink-0 mt-0.5" />
                )}
                <div className="text-sm leading-relaxed">
                  <span className={acceptedTerms ? 'text-green-700' : 'text-orange-700'}>
                    أوافق على{' '}
                  </span>
                  <Link 
                    to="/terms" 
                    target="_blank"
                    onClick={(e) => e.stopPropagation()}
                    className="text-sky-600 hover:text-sky-800 font-bold underline"
                  >
                    الشروط والأحكام
                  </Link>
                  <span className={acceptedTerms ? 'text-green-700' : 'text-orange-700'}>
                    {' '}و{' '}
                  </span>
                  <Link 
                    to="/privacy-policy" 
                    target="_blank"
                    onClick={(e) => e.stopPropagation()}
                    className="text-sky-600 hover:text-sky-800 font-bold underline"
                  >
                    سياسة الخصوصية
                  </Link>
                  <span className={acceptedTerms ? 'text-green-700' : 'text-orange-700'}>
                    {' '}الخاصة بمنصة سفرة البيت
                  </span>
                </div>
              </div>
            </>
          )}

          {/* شروط وأحكام المندوب */}
          {role === 'courier' && (
            <div 
              onClick={() => setAcceptedTerms(!acceptedTerms)}
              className={`flex items-start gap-3 p-4 rounded-2xl cursor-pointer transition-all border-2 ${
                acceptedTerms 
                  ? 'bg-green-50 border-green-400' 
                  : 'bg-emerald-50 border-emerald-200 hover:border-emerald-300'
              }`}
            >
              {acceptedTerms ? (
                <CheckSquare className="w-6 h-6 text-green-500 flex-shrink-0 mt-0.5" />
              ) : (
                <Square className="w-6 h-6 text-emerald-400 flex-shrink-0 mt-0.5" />
              )}
              <div className="text-sm leading-relaxed">
                <span className={acceptedTerms ? 'text-green-700' : 'text-emerald-700'}>
                  أوافق على{' '}
                </span>
                <Link 
                  to="/courier-terms" 
                  target="_blank"
                  onClick={(e) => e.stopPropagation()}
                  className="text-emerald-600 hover:text-emerald-800 font-bold underline"
                >
                  شروط وأحكام المندوب
                </Link>
                <span className={acceptedTerms ? 'text-green-700' : 'text-emerald-700'}>
                  {' '}وأتحمل كامل المسؤولية كمندوب مستقل
                </span>
              </div>
            </div>
          )}

          <button 
            disabled={loading || (requiresTerms && !acceptedTerms)} 
            className={`w-full flex items-center justify-center gap-3 text-white font-bold p-4 rounded-2xl shadow-xl transition-all ${
              requiresTerms && !acceptedTerms
                ? 'bg-gray-400 cursor-not-allowed'
                : 'bg-gradient-to-r from-sky-500 to-sky-600 hover:from-sky-600 hover:to-sky-700 shadow-sky-300/50 hover:scale-[1.02]'
            }`}
          >
            {loading ? 'جارٍ التسجيل...' : (
              <>
                <UserPlus className="w-5 h-5" />
                تسجيل
              </>
            )}
          </button>

          {/* تنبيه للموافقة على الشروط */}
          {requiresTerms && !acceptedTerms && (
            <p className={`text-center text-sm p-3 rounded-xl ${
              role === 'courier' 
                ? 'text-emerald-600 bg-emerald-50' 
                : 'text-orange-600 bg-orange-50'
            }`}>
              ⚠️ يجب الموافقة على الشروط والأحكام لإكمال التسجيل
            </p>
          )}
        </form>

        {/* رابط تسجيل الدخول */}
        <p className="mt-6 text-center text-sky-600">
          عندك حساب؟{' '}
          <Link className="text-sky-500 hover:text-sky-700 font-bold" to="/login">
            سجّل دخول ✨
          </Link>
        </p>
      </div>
    </div>
  )
}

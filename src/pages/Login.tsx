// src/pages/Login.tsx
import React, { useState } from 'react'
import { signInWithEmailAndPassword, sendPasswordResetEmail } from 'firebase/auth'
import { auth, db } from '@/firebase'
import { doc, getDoc } from 'firebase/firestore'
import { Link, useNavigate } from 'react-router-dom'
import { Mail, Lock, LogIn, Sparkles, KeyRound, ArrowRight, Loader2 } from 'lucide-react'
import { useDialog } from '@/components/ui/ConfirmDialog'
import { useToast } from '@/components/ui/Toast'

export const Login: React.FC = () => {
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [loading, setLoading] = useState(false)
  const [showForgotPassword, setShowForgotPassword] = useState(false)
  const [resetEmail, setResetEmail] = useState('')
  const [resetLoading, setResetLoading] = useState(false)
  const nav = useNavigate()
  const dialog = useDialog()
  const toast = useToast()

  const submit = async (e: React.FormEvent) => {
    e.preventDefault()
    setLoading(true)
    try {
      const userCred = await signInWithEmailAndPassword(auth, email, password)
      const uid = userCred.user.uid

      const snap = await getDoc(doc(db, "users", uid))
      if (snap.exists()) {
        const userData = snap.data()

        if (userData.role === "owner") {
          nav("/owner")
        } else if (userData.role === "admin") {
          nav("/admin")
        } else if (userData.role === "developer") {
          nav("/developer")
        } else if (userData.role === "courier") {
          nav("/courier")
        } else {
          nav("/")
        }
      } else {
        dialog.warning('الحساب موجود في Auth لكن لا توجد له بيانات في Firestore')
      }
    } catch (e: any) {
      dialog.error(e.message, { title: 'خطأ في تسجيل الدخول' })
    } finally {
      setLoading(false)
    }
  }

  // دالة إرسال رابط إعادة تعيين كلمة المرور
  const handleForgotPassword = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!resetEmail.trim()) {
      toast.warning('الرجاء إدخال البريد الإلكتروني')
      return
    }
    
    setResetLoading(true)
    try {
      await sendPasswordResetEmail(auth, resetEmail.trim().toLowerCase())
      toast.success('تم إرسال رابط إعادة تعيين كلمة المرور! تحقق من بريدك 📧')
      // رسالة تنبيه إضافية
      setTimeout(() => {
        dialog.info('إذا لم تجد الرسالة، تحقق من مجلد الرسائل غير المرغوبة (Spam)', {
          title: '💡 ملاحظة مهمة'
        })
      }, 1000)
      setShowForgotPassword(false)
      setResetEmail('')
    } catch (error: any) {
      console.error('Reset password error:', error)
      if (error.code === 'auth/user-not-found') {
        toast.error('لا يوجد حساب مسجل بهذا البريد الإلكتروني')
      } else if (error.code === 'auth/invalid-email') {
        toast.error('البريد الإلكتروني غير صحيح')
      } else if (error.code === 'auth/too-many-requests') {
        toast.error('تم إرسال طلبات كثيرة، انتظر قليلاً ثم حاول مرة أخرى')
      } else {
        toast.error(`حدث خطأ: ${error.message}`)
      }
    } finally {
      setResetLoading(false)
    }
  }

  return (
    <div className="min-h-screen flex items-center justify-center bg-gradient-to-br from-sky-50 via-white to-sky-100 px-4">
      {/* خلفية زخرفية */}
      <div className="absolute top-0 left-0 w-72 h-72 bg-sky-300/20 rounded-full blur-3xl"></div>
      <div className="absolute bottom-0 right-0 w-72 h-72 bg-sky-400/20 rounded-full blur-3xl"></div>
      
      <div className="relative bg-white/80 backdrop-blur-xl border border-sky-100 rounded-[2rem] shadow-2xl shadow-sky-200/50 w-full max-w-md p-8">
        
        {/* شعار */}
        <div className="flex flex-col items-center mb-8">
          <div className="w-20 h-20 bg-gradient-to-br from-sky-500 to-sky-600 rounded-2xl flex items-center justify-center shadow-xl shadow-sky-300/50 mb-4">
            <span className="text-4xl">  🍝</span>
          </div>
          <h1 className="text-3xl font-black text-sky-600">سفرة البيت</h1>
          <p className="text-sky-500 mt-1">تسجيل الدخول</p>
        </div>

        {/* نموذج تسجيل الدخول */}
        <form onSubmit={submit} className="space-y-4">
          <div className="relative">
            <Mail className="absolute right-4 top-1/2 -translate-y-1/2 w-5 h-5 text-sky-400" />
            <input
              type="email"
              placeholder="الإيميل"
              className="w-full rounded-2xl p-4 pr-12 bg-sky-50 text-sky-900 border-2 border-sky-100 
                         focus:outline-none focus:border-sky-400 focus:ring-4 focus:ring-sky-100 transition-all"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
            />
          </div>
          <div className="relative">
            <Lock className="absolute right-4 top-1/2 -translate-y-1/2 w-5 h-5 text-sky-400" />
            <input
              type="password"
              placeholder="كلمة المرور"
              className="w-full rounded-2xl p-4 pr-12 bg-sky-50 text-sky-900 border-2 border-sky-100 
                         focus:outline-none focus:border-sky-400 focus:ring-4 focus:ring-sky-100 transition-all"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
            />
          </div>

          {/* رابط نسيت كلمة المرور */}
          <div className="text-left">
            <button
              type="button"
              onClick={() => {
                setShowForgotPassword(true)
                setResetEmail(email) // نقل الإيميل المدخل
              }}
              className="text-sm text-sky-500 hover:text-sky-700 font-medium hover:underline"
            >
              🔑 نسيت كلمة المرور؟
            </button>
          </div>

          <button
            disabled={loading}
            className="w-full flex items-center justify-center gap-3 bg-gradient-to-r from-sky-500 to-sky-600 hover:from-sky-600 hover:to-sky-700 text-white font-bold p-4 rounded-2xl 
                       shadow-xl shadow-sky-300/50 transition-all hover:scale-[1.02] hover:shadow-sky-400/50"
          >
            {loading ? (
              <>جارٍ الدخول...</>
            ) : (
              <>
                <LogIn className="w-5 h-5" />
                دخول
              </>
            )}
          </button>
        </form>

        {/* رابط التسجيل */}
        <p className="mt-8 text-center text-sky-600">
          ليس لديك حساب؟{' '}
          <Link 
            className="text-sky-500 hover:text-sky-700 font-bold" 
            to="/register"
          >
            سجّل الآن ✨
          </Link>
        </p>

        {/* رابط تسجيل دخول العملاء برقم الجوال */}
        <div className="mt-6 pt-6 border-t border-sky-100">
          <p className="text-center text-sm text-gray-500 mb-3">
            عميل تريد الدخول برقم الجوال؟
          </p>
          <Link 
            to="/customer-login"
            className="block w-full text-center bg-green-50 hover:bg-green-100 text-green-700 font-semibold py-3 px-4 rounded-2xl transition"
          >
            📱 الدخول برقم الجوال
          </Link>
        </div>
      </div>

      {/* نافذة نسيت كلمة المرور */}
      {showForgotPassword && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-3xl shadow-2xl w-full max-w-md p-8 relative">
            {/* زر الإغلاق */}
            <button
              onClick={() => setShowForgotPassword(false)}
              className="absolute top-4 left-4 p-2 hover:bg-gray-100 rounded-full transition"
            >
              <ArrowRight className="w-5 h-5 text-gray-500" />
            </button>

            {/* الأيقونة والعنوان */}
            <div className="text-center mb-6">
              <div className="w-16 h-16 bg-gradient-to-br from-amber-400 to-orange-500 rounded-2xl flex items-center justify-center mx-auto mb-4 shadow-lg">
                <KeyRound className="w-8 h-8 text-white" />
              </div>
              <h2 className="text-2xl font-bold text-gray-800">نسيت كلمة المرور؟</h2>
              <p className="text-gray-500 mt-2 text-sm">
                أدخل بريدك الإلكتروني وسنرسل لك رابط لإعادة تعيين كلمة المرور
              </p>
            </div>

            {/* نموذج إعادة التعيين */}
            <form onSubmit={handleForgotPassword} className="space-y-4">
              <div className="relative">
                <Mail className="absolute right-4 top-1/2 -translate-y-1/2 w-5 h-5 text-amber-500" />
                <input
                  type="email"
                  placeholder="البريد الإلكتروني"
                  className="w-full rounded-2xl p-4 pr-12 bg-amber-50 text-gray-900 border-2 border-amber-100 
                             focus:outline-none focus:border-amber-400 focus:ring-4 focus:ring-amber-100 transition-all"
                  value={resetEmail}
                  onChange={(e) => setResetEmail(e.target.value)}
                  autoFocus
                />
              </div>

              <button
                type="submit"
                disabled={resetLoading}
                className="w-full flex items-center justify-center gap-3 bg-gradient-to-r from-amber-500 to-orange-500 hover:from-amber-600 hover:to-orange-600 text-white font-bold p-4 rounded-2xl 
                           shadow-xl shadow-amber-300/50 transition-all hover:scale-[1.02] disabled:opacity-50 disabled:cursor-not-allowed"
              >
                {resetLoading ? (
                  <>
                    <Loader2 className="w-5 h-5 animate-spin" />
                    جارٍ الإرسال...
                  </>
                ) : (
                  <>
                    <Mail className="w-5 h-5" />
                    إرسال رابط إعادة التعيين
                  </>
                )}
              </button>
            </form>

            {/* رابط العودة */}
            <button
              onClick={() => setShowForgotPassword(false)}
              className="w-full mt-4 text-center text-gray-500 hover:text-gray-700 font-medium"
            >
              العودة لتسجيل الدخول
            </button>
          </div>
        </div>
      )}
    </div>
  )
}

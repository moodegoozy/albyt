// src/pages/Login.tsx
import React, { useState } from 'react'
import { signInWithEmailAndPassword } from 'firebase/auth'
import { auth, db } from '@/firebase'
import { doc, getDoc } from 'firebase/firestore'
import { Link, useNavigate } from 'react-router-dom'
import { Mail, Lock, LogIn, Sparkles } from 'lucide-react'
import { useDialog } from '@/components/ui/ConfirmDialog'

export const Login: React.FC = () => {
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [loading, setLoading] = useState(false)
  const nav = useNavigate()
  const dialog = useDialog()

  const submit = async (e: React.FormEvent) => {
    e.preventDefault()
    setLoading(true)
    try {
      const userCred = await signInWithEmailAndPassword(auth, email, password)
      const uid = userCred.user.uid

      const snap = await getDoc(doc(db, "users", uid))
      if (snap.exists()) {
        const userData = snap.data()
        console.log("✅ بيانات المستخدم:", userData)

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
      </div>
    </div>
  )
}

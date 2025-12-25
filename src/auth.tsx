import React, { createContext, useContext, useEffect, useState } from 'react'
import { onAuthStateChanged, signOut, User } from 'firebase/auth'
import { auth, db } from './firebase'
import { doc, getDoc, setDoc } from 'firebase/firestore'

type Role = 'owner' | 'courier' | 'customer' | 'admin' | 'developer'

type AuthContextType = {
  user: User | null,
  role: Role | null,
  loading: boolean,
  logout: () => Promise<void>,
}

const AuthContext = createContext<AuthContextType>({
  user: null,
  role: null,
  loading: true,
  logout: async () => {}
})

export const AuthProvider: React.FC<{children: React.ReactNode}> = ({ children }) => {
  const [user, setUser] = useState<User | null>(null)
  const [role, setRole] = useState<Role | null>(null)
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    const unsub = onAuthStateChanged(auth, async (u) => {
      setUser(u)
      if (u) {
        const snap = await getDoc(doc(db, 'users', u.uid))
        const data = snap.data()
        const r = snap.exists() ? (data?.role as Role) : null
        setRole(r)

        // تأكد من وجود مستند المطعم لأصحاب المطاعم
        if (r === 'owner') {
          try {
            const restRef = doc(db, 'restaurants', u.uid)
            const restSnap = await getDoc(restRef)
            if (!restSnap.exists()) {
              await setDoc(restRef, {
                name: data?.restaurantName || data?.name || 'مطعم جديد',
                ownerId: u.uid,
                email: data?.email || u.email || '',
                phone: '',
                city: '',
                location: '',
                logoUrl: '',
              }, { merge: true })
            }
          } catch (err) {
            console.warn('تعذر إنشاء مستند المطعم للمالك', err)
          }
        }
      } else {
        setRole(null)
      }
      setLoading(false)
    })
    return () => unsub()
  }, [])

  const logout = async () => { await signOut(auth) }

  return (
    <AuthContext.Provider value={{ user, role, loading, logout }}>
      {children}
    </AuthContext.Provider>
  )
}

export const useAuth = () => useContext(AuthContext)

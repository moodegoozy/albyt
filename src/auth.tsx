import React, { createContext, useContext, useEffect, useState } from 'react'
import { onAuthStateChanged, signOut, User } from 'firebase/auth'
import { auth, db } from './firebase'
import { doc, getDoc, setDoc } from 'firebase/firestore'

type Role = 'owner' | 'courier' | 'customer' | 'admin' | 'developer'
type GeoLocation = { lat: number; lng: number }

type AuthContextType = {
  user: User | null,
  role: Role | null,
  loading: boolean,
  logout: () => Promise<void>,
  userLocation: GeoLocation | null,
  locationRequired: boolean,
  refreshUserData: () => Promise<void>,
}

const AuthContext = createContext<AuthContextType>({
  user: null,
  role: null,
  loading: true,
  logout: async () => {},
  userLocation: null,
  locationRequired: false,
  refreshUserData: async () => {},
})

export const AuthProvider: React.FC<{children: React.ReactNode}> = ({ children }) => {
  const [user, setUser] = useState<User | null>(null)
  const [role, setRole] = useState<Role | null>(null)
  const [loading, setLoading] = useState(true)
  const [userLocation, setUserLocation] = useState<GeoLocation | null>(null)
  const [locationRequired, setLocationRequired] = useState(false)

  // دالة لتحديث بيانات المستخدم (تُستدعى بعد حفظ الموقع)
  const refreshUserData = async () => {
    if (!user) return
    const snap = await getDoc(doc(db, 'users', user.uid))
    if (snap.exists()) {
      const data = snap.data()
      setUserLocation(data?.location || null)
      setLocationRequired(!data?.location)
    }
  }

  useEffect(() => {
    const unsub = onAuthStateChanged(auth, async (u) => {
      setUser(u)
      if (u) {
        const snap = await getDoc(doc(db, 'users', u.uid))
        const data = snap.data()
        const r = snap.exists() ? (data?.role as Role) : null
        setRole(r)
        
        // التحقق من الموقع
        const loc = data?.location as GeoLocation | undefined
        setUserLocation(loc || null)
        
        // الموقع إلزامي للعملاء وأصحاب المطاعم والمناديب (ليس للأدمن والمطور)
        const needsLocation = r === 'customer' || r === 'owner' || r === 'courier'
        setLocationRequired(needsLocation && !loc)

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
        setUserLocation(null)
        setLocationRequired(false)
      }
      setLoading(false)
    })
    return () => unsub()
  }, [])

  const logout = async () => { await signOut(auth) }

  return (
    <AuthContext.Provider value={{ user, role, loading, logout, userLocation, locationRequired, refreshUserData }}>
      {children}
    </AuthContext.Provider>
  )
}

export const useAuth = () => useContext(AuthContext)

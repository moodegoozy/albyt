import React, { useEffect, useState } from 'react'
import { useAuth } from '@/auth'
import { db } from '@/firebase'
import { 
  collection, query, where, orderBy, onSnapshot, 
  updateDoc, deleteDoc, doc, Timestamp 
} from 'firebase/firestore'
import { Bell, Check, Trash2, AlertCircle, RefreshCw, ArrowRight } from 'lucide-react'
import { useToast } from '@/components/ui/Toast'
import { useNavigate } from 'react-router-dom'

type Notification = {
  id: string
  type: string
  recipientId: string
  recipientType: string
  restaurantId?: string
  restaurantName?: string
  title: string
  message: string
  read: boolean
  createdAt: Timestamp
}

export const NotificationsPage: React.FC = () => {
  const { user } = useAuth()
  const toast = useToast()
  const navigate = useNavigate()
  const [notifications, setNotifications] = useState<Notification[]>([])
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    if (!user) return

    const q = query(
      collection(db, 'notifications'),
      where('recipientId', '==', user.uid),
      orderBy('createdAt', 'desc')
    )

    const unsub = onSnapshot(q, (snap) => {
      const notifs = snap.docs.map(d => ({ id: d.id, ...d.data() })) as Notification[]
      setNotifications(notifs)
      setLoading(false)
    }, (err) => {
      console.error('Error fetching notifications:', err)
      setLoading(false)
    })

    return () => unsub()
  }, [user])

  const markAsRead = async (notifId: string) => {
    try {
      await updateDoc(doc(db, 'notifications', notifId), { read: true })
    } catch (err) {
      console.error('Error marking as read:', err)
    }
  }

  const markAllAsRead = async () => {
    const unread = notifications.filter(n => !n.read)
    try {
      await Promise.all(unread.map(n => 
        updateDoc(doc(db, 'notifications', n.id), { read: true })
      ))
      toast.success('تم تحديد الكل كمقروء')
    } catch (err) {
      toast.error('فشل تحديث الإشعارات')
    }
  }

  const deleteNotification = async (notifId: string) => {
    try {
      await deleteDoc(doc(db, 'notifications', notifId))
      toast.success('تم حذف الإشعار')
    } catch (err) {
      toast.error('فشل حذف الإشعار')
    }
  }

  const formatDate = (timestamp: Timestamp) => {
    if (!timestamp) return ''
    const date = timestamp.toDate()
    const now = new Date()
    const diff = now.getTime() - date.getTime()
    const minutes = Math.floor(diff / 60000)
    const hours = Math.floor(diff / 3600000)
    const days = Math.floor(diff / 86400000)

    if (minutes < 1) return 'الآن'
    if (minutes < 60) return `منذ ${minutes} دقيقة`
    if (hours < 24) return `منذ ${hours} ساعة`
    if (days < 7) return `منذ ${days} يوم`
    return date.toLocaleDateString('ar-SA')
  }

  const unreadCount = notifications.filter(n => !n.read).length

  if (loading) {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center">
        <RefreshCw className="w-8 h-8 animate-spin text-sky-500" />
      </div>
    )
  }

  return (
    <div className="min-h-screen bg-gradient-to-b from-gray-50 to-white">
      {/* Header */}
      <div className="bg-white shadow-sm sticky top-0 z-10">
        <div className="max-w-2xl mx-auto px-4 py-4">
          <div className="flex items-center justify-between">
            <button
              onClick={() => navigate(-1)}
              className="flex items-center gap-2 text-gray-600 hover:text-gray-800"
            >
              <ArrowRight className="w-5 h-5" />
              رجوع
            </button>
            <h1 className="text-xl font-bold flex items-center gap-2">
              <Bell className="w-6 h-6 text-sky-500" />
              الإشعارات
              {unreadCount > 0 && (
                <span className="bg-red-500 text-white text-xs px-2 py-0.5 rounded-full">
                  {unreadCount}
                </span>
              )}
            </h1>
            {unreadCount > 0 && (
              <button
                onClick={markAllAsRead}
                className="text-sm text-sky-600 hover:text-sky-800"
              >
                قراءة الكل
              </button>
            )}
          </div>
        </div>
      </div>

      {/* Content */}
      <div className="max-w-2xl mx-auto px-4 py-6">
        {notifications.length === 0 ? (
          <div className="text-center py-16">
            <Bell className="w-16 h-16 mx-auto mb-4 text-gray-300" />
            <p className="text-gray-500">لا توجد إشعارات</p>
          </div>
        ) : (
          <div className="space-y-3">
            {notifications.map(notif => (
              <div
                key={notif.id}
                className={`bg-white rounded-2xl p-4 shadow-sm border transition hover:shadow-md ${
                  !notif.read ? 'border-sky-200 bg-sky-50/50' : 'border-gray-100'
                }`}
                onClick={() => !notif.read && markAsRead(notif.id)}
              >
                <div className="flex items-start gap-3">
                  <div className={`p-2 rounded-xl ${
                    notif.type === 'license_reminder' 
                      ? 'bg-orange-100 text-orange-600'
                      : 'bg-sky-100 text-sky-600'
                  }`}>
                    <AlertCircle className="w-5 h-5" />
                  </div>
                  <div className="flex-1 min-w-0">
                    <div className="flex items-start justify-between gap-2">
                      <h3 className="font-semibold text-gray-800">{notif.title}</h3>
                      <span className="text-xs text-gray-400 whitespace-nowrap">
                        {formatDate(notif.createdAt)}
                      </span>
                    </div>
                    <p className="text-sm text-gray-600 mt-1">{notif.message}</p>
                    {!notif.read && (
                      <span className="inline-block mt-2 text-xs bg-sky-100 text-sky-700 px-2 py-0.5 rounded-full">
                        جديد
                      </span>
                    )}
                  </div>
                  <div className="flex flex-col gap-1">
                    {!notif.read && (
                      <button
                        onClick={(e) => {
                          e.stopPropagation()
                          markAsRead(notif.id)
                        }}
                        className="p-1.5 text-gray-400 hover:text-green-500 transition"
                        title="تحديد كمقروء"
                      >
                        <Check className="w-4 h-4" />
                      </button>
                    )}
                    <button
                      onClick={(e) => {
                        e.stopPropagation()
                        deleteNotification(notif.id)
                      }}
                      className="p-1.5 text-gray-400 hover:text-red-500 transition"
                      title="حذف"
                    >
                      <Trash2 className="w-4 h-4" />
                    </button>
                  </div>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  )
}

export default NotificationsPage

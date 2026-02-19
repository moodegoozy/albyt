/**
 * خدمة Push Notifications - سفرة البيت
 * إشعارات فورية تعمل في جميع الحالات:
 * ✔ التطبيق مفتوح (Foreground)
 * ✔ في الخلفية (Background)
 * ✔ مغلق (عبر FCM - Firebase Cloud Messaging)
 */

import { getToken, onMessage, Messaging } from 'firebase/messaging'
import { doc, setDoc } from 'firebase/firestore'
import { db, getMessagingInstance } from '@/firebase'
import { playNotificationSound } from './notificationSound'

// VAPID Key من Firebase Console -> Project Settings -> Cloud Messaging
// ملاحظة: يجب توليد مفتاح VAPID من Firebase Console إذا لم يكن موجوداً
const VAPID_KEY = 'BHIFuJLc84TdosXcdvg6nTtI5B4fNZVhILjhuhC43ASE_kecI4PHUzzbXRELLQa0fY-x7bvwaRHUqOnyVGQ9hTQ'

// حالة الإشعارات
let swRegistration: ServiceWorkerRegistration | null = null
let fcmToken: string | null = null
let messagingInstance: Messaging | null = null

/**
 * تسجيل Service Worker وطلب إذن الإشعارات مع FCM
 */
export async function initializePushNotifications(): Promise<boolean> {
  try {
    // التحقق من دعم المتصفح
    if (!('serviceWorker' in navigator)) {
      console.warn('⚠️ المتصفح لا يدعم Service Worker')
      return false
    }

    if (!('Notification' in window)) {
      console.warn('⚠️ المتصفح لا يدعم الإشعارات')
      return false
    }

    // تسجيل Firebase Messaging Service Worker
    swRegistration = await navigator.serviceWorker.register('/firebase-messaging-sw.js')
    console.log('✅ FCM Service Worker registered:', swRegistration)

    // انتظار تفعيل الـ Service Worker
    await navigator.serviceWorker.ready
    console.log('✅ Service Worker ready')

    // طلب إذن الإشعارات
    const permission = await Notification.requestPermission()
    
    if (permission !== 'granted') {
      console.warn('⚠️ تم رفض إذن الإشعارات:', permission)
      return false
    }

    console.log('✅ تم منح إذن الإشعارات')

    // تهيئة Firebase Messaging
    messagingInstance = await getMessagingInstance()
    
    if (messagingInstance && VAPID_KEY) {
      // الحصول على FCM token
      try {
        fcmToken = await getToken(messagingInstance, {
          vapidKey: VAPID_KEY,
          serviceWorkerRegistration: swRegistration
        })
        
        if (fcmToken) {
          console.log('✅ FCM Token:', fcmToken.substring(0, 20) + '...')
        }
      } catch (tokenError) {
        console.warn('⚠️ فشل الحصول على FCM token:', tokenError)
      }

      // 🔔 استقبال الإشعارات في المقدمة (التطبيق مفتوح)
      onMessage(messagingInstance, async (payload) => {
        console.log('🔔 [FCM] Foreground message:', payload)
        
        // تشغيل الصوت
        try {
          await playNotificationSound()
        } catch (e) {
          console.warn('⚠️ تعذر تشغيل الصوت:', e)
        }

        // عرض الإشعار
        const title = payload.notification?.title || payload.data?.title || 'سفرة البيت'
        const body = payload.notification?.body || payload.data?.body || 'لديك إشعار جديد'
        
        if (swRegistration) {
          swRegistration.showNotification(title, {
            body,
            icon: '/icon-192.png',
            badge: '/icon-192.png',
            tag: 'fcm-foreground-' + Date.now(),
            data: payload.data || {},
            vibrate: [200, 100, 200],
            requireInteraction: true,
            dir: 'rtl',
            lang: 'ar'
          } as NotificationOptions)
        }
      })
    } else {
      console.warn('⚠️ FCM غير مفعّل - يُرجى إضافة VAPID_KEY')
    }

    // 🔊 استقبال رسائل من Service Worker لتشغيل الصوت
    navigator.serviceWorker.addEventListener('message', async (event) => {
      if (event.data?.type === 'FCM_NOTIFICATION' || event.data?.type === 'PLAY_NOTIFICATION_SOUND') {
        console.log('[SW→App] إشعار FCM')
        try {
          await playNotificationSound()
        } catch (error) {
          console.warn('⚠️ تعذر تشغيل الصوت:', error)
        }
      }
    })

    return true
  } catch (error) {
    console.error('❌ فشل تهيئة الإشعارات:', error)
    return false
  }
}

/**
 * حفظ FCM token للمستخدم في Firestore
 */
export async function saveFCMToken(userId: string): Promise<boolean> {
  if (!fcmToken || !userId) {
    console.warn('⚠️ لا يوجد FCM token أو userId')
    return false
  }

  try {
    // حفظ الـ token في مجموعة fcmTokens
    await setDoc(doc(db, 'fcmTokens', userId), {
      token: fcmToken,
      updatedAt: new Date(),
      platform: 'web',
      userAgent: navigator.userAgent
    }, { merge: true })

    // تحديث حقل fcmToken في وثيقة المستخدم
    await setDoc(doc(db, 'users', userId), {
      fcmToken: fcmToken,
      fcmTokenUpdatedAt: new Date()
    }, { merge: true })

    console.log('✅ تم حفظ FCM token للمستخدم:', userId)
    return true
  } catch (error) {
    console.error('❌ فشل حفظ FCM token:', error)
    return false
  }
}

/**
 * الحصول على FCM token الحالي
 */
export function getFCMToken(): string | null {
  return fcmToken
}

/**
 * طلب إذن الإشعارات (يُستدعى عند التسجيل أو تسجيل الدخول)
 */
export async function requestNotificationPermission(): Promise<NotificationPermission> {
  if (!('Notification' in window)) {
    return 'denied'
  }

  if (Notification.permission === 'granted') {
    return 'granted'
  }

  return await Notification.requestPermission()
}

/**
 * عرض إشعار فوري
 */
export async function showPushNotification(
  title: string,
  body: string,
  options?: {
    icon?: string
    tag?: string
    url?: string
  }
): Promise<boolean> {
  try {
    // 🔊 تشغيل صوت الإشعار
    try {
      await playNotificationSound()
    } catch (soundError) {
      console.warn('⚠️ تعذر تشغيل صوت الإشعار:', soundError)
    }
    
    // التحقق من الإذن
    if (Notification.permission !== 'granted') {
      console.warn('⚠️ لا يوجد إذن للإشعارات')
      // محاولة طلب الإذن
      const permission = await requestNotificationPermission()
      if (permission !== 'granted') {
        return false
      }
    }

    // إذا Service Worker مسجل، نستخدمه (يعمل في الخلفية)
    if (swRegistration) {
      await swRegistration.showNotification(title, {
        body,
        icon: options?.icon || '/icon-192.png',
        badge: '/icon-192.png',
        tag: options?.tag || 'notification-' + Date.now(),
        data: { url: options?.url || '/' },
        requireInteraction: true,
        dir: 'rtl',
        lang: 'ar'
      } as NotificationOptions)
      return true
    }

    // إذا لم يكن Service Worker متاحاً، نستخدم Notification API مباشرة
    const notification = new Notification(title, {
      body,
      icon: options?.icon || '/icon-192.png',
      tag: options?.tag || 'notification-' + Date.now(),
      dir: 'rtl',
      lang: 'ar',
      requireInteraction: true
    })

    // عند الضغط على الإشعار
    notification.onclick = () => {
      window.focus()
      if (options?.url) {
        window.location.href = options.url
      }
      notification.close()
    }

    return true
  } catch (error) {
    console.error('❌ فشل عرض الإشعار:', error)
    return false
  }
}

/**
 * إرسال إشعار عبر Service Worker (للخلفية)
 */
export function sendNotificationToSW(data: {
  title: string
  body: string
  icon?: string
  tag?: string
  data?: any
}): void {
  if (swRegistration?.active) {
    swRegistration.active.postMessage({
      type: 'SHOW_NOTIFICATION',
      ...data
    })
  }
}

/**
 * التحقق من حالة الإشعارات
 */
export function getNotificationStatus(): {
  supported: boolean
  permission: NotificationPermission
  swRegistered: boolean
  fcmToken: string | null
} {
  return {
    supported: 'Notification' in window && 'serviceWorker' in navigator,
    permission: Notification.permission,
    swRegistered: !!swRegistration,
    fcmToken: fcmToken
  }
}

/**
 * التحقق إذا الإشعارات مفعّلة
 */
export function areNotificationsEnabled(): boolean {
  return Notification.permission === 'granted'
}

/**
 * خدمة Push Notifications - سفرة البيت
 * إشعارات فورية تعمل في جميع الحالات:
 * ✔ التطبيق مفتوح
 * ✔ في الخلفية
 * ✔ مغلق
 */

// حالة الإشعارات
let swRegistration: ServiceWorkerRegistration | null = null
let notificationPermission: NotificationPermission = 'default'

/**
 * تسجيل Service Worker وطلب إذن الإشعارات
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

    // تسجيل Service Worker
    swRegistration = await navigator.serviceWorker.register('/sw.js')
    console.log('✅ Service Worker registered:', swRegistration)

    // طلب إذن الإشعارات
    notificationPermission = await Notification.requestPermission()
    
    if (notificationPermission === 'granted') {
      console.log('✅ تم منح إذن الإشعارات')
      return true
    } else {
      console.warn('⚠️ تم رفض إذن الإشعارات:', notificationPermission)
      return false
    }
  } catch (error) {
    console.error('❌ فشل تهيئة الإشعارات:', error)
    return false
  }
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

  const permission = await Notification.requestPermission()
  notificationPermission = permission
  return permission
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
} {
  return {
    supported: 'Notification' in window && 'serviceWorker' in navigator,
    permission: Notification.permission,
    swRegistered: !!swRegistration
  }
}

/**
 * التحقق إذا الإشعارات مفعّلة
 */
export function areNotificationsEnabled(): boolean {
  return Notification.permission === 'granted'
}

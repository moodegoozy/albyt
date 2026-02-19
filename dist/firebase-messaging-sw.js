// Firebase Cloud Messaging Service Worker - سفرة البيت
// يعمل في الخلفية لاستقبال الإشعارات حتى لو التطبيق مغلق

// استيراد Firebase scripts
importScripts('https://www.gstatic.com/firebasejs/10.7.1/firebase-app-compat.js')
importScripts('https://www.gstatic.com/firebasejs/10.7.1/firebase-messaging-compat.js')

// إعدادات Firebase
firebase.initializeApp({
  apiKey: "AIzaSyC1iM3g3gGfu23GKLpDRQplBuHidPniFIk",
  authDomain: "albayt-sofra.firebaseapp.com",
  projectId: "albayt-sofra",
  storageBucket: "albayt-sofra.firebasestorage.app",
  messagingSenderId: "895117143740",
  appId: "1:895117143740:web:239cfccc93d101c1f36ab9",
})

const messaging = firebase.messaging()

const APP_NAME = 'سفرة البيت'

// 🔔 استقبال الإشعارات في الخلفية
messaging.onBackgroundMessage((payload) => {
  console.log('[FCM SW] Background message received:', payload)
  
  const notificationTitle = payload.notification?.title || payload.data?.title || APP_NAME
  const notificationOptions = {
    body: payload.notification?.body || payload.data?.body || 'لديك إشعار جديد',
    icon: payload.notification?.icon || '/icon-192.png',
    badge: '/icon-192.png',
    tag: payload.data?.tag || 'fcm-' + Date.now(),
    data: payload.data || {},
    vibrate: [200, 100, 200, 100, 200], // اهتزاز قوي
    requireInteraction: true,
    dir: 'rtl',
    lang: 'ar',
    actions: [
      { action: 'open', title: 'فتح' },
      { action: 'close', title: 'إغلاق' }
    ]
  }

  // إرسال رسالة للصفحة لتشغيل الصوت (إذا كانت مفتوحة)
  self.clients.matchAll({ type: 'window', includeUncontrolled: true }).then((clientList) => {
    for (const client of clientList) {
      client.postMessage({ 
        type: 'FCM_NOTIFICATION',
        payload: payload
      })
    }
  })

  return self.registration.showNotification(notificationTitle, notificationOptions)
})

// عند الضغط على الإشعار
self.addEventListener('notificationclick', (event) => {
  console.log('[FCM SW] Notification clicked:', event)
  event.notification.close()

  const action = event.action
  const data = event.notification.data || {}
  let urlToOpen = '/'

  // تحديد الرابط حسب نوع الإشعار
  if (data.type === 'order_new') {
    urlToOpen = '/owner/orders'
  } else if (data.type === 'order_accepted' || data.type === 'order_ready' || data.type === 'order_delivered') {
    urlToOpen = '/orders'
  } else if (data.url) {
    urlToOpen = data.url
  }

  if (action === 'close') {
    return
  }

  event.waitUntil(
    self.clients.matchAll({ type: 'window', includeUncontrolled: true }).then((clientList) => {
      // إذا التطبيق مفتوح، ننتقل للصفحة
      for (const client of clientList) {
        if ('focus' in client) {
          client.focus()
          if (client.navigate) {
            client.navigate(urlToOpen)
          }
          return
        }
      }
      // إذا مغلق، نفتح نافذة جديدة
      if (self.clients.openWindow) {
        return self.clients.openWindow(urlToOpen)
      }
    })
  )
})

console.log('[FCM SW] Firebase Messaging Service Worker loaded')

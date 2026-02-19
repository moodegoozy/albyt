/**
 * Cloud Functions - سفرة البيت
 * إرسال إشعارات FCM للمطاعم والمندوبين
 */

const { onDocumentCreated, onDocumentUpdated } = require('firebase-functions/v2/firestore')
const { initializeApp } = require('firebase-admin/app')
const { getFirestore } = require('firebase-admin/firestore')
const { getMessaging } = require('firebase-admin/messaging')

// تهيئة Firebase Admin
initializeApp()

const db = getFirestore()
const messaging = getMessaging()

/**
 * 🔔 إرسال إشعار للمطعم عند إنشاء طلب جديد
 * يُفعّل تلقائياً عند إضافة طلب جديد في Firestore
 */
exports.notifyRestaurantOnNewOrder = onDocumentCreated('orders/{orderId}', async (event) => {
  const snap = event.data
  if (!snap) {
    console.log('No data in event')
    return null
  }
  
  const order = snap.data()
  const orderId = event.params.orderId
  
  console.log('📦 طلب جديد:', orderId, order)
  
  // الحصول على معرف صاحب المطعم
  const ownerId = order.ownerId || order.restaurantOwnerId
  
  if (!ownerId) {
    console.error('❌ لا يوجد ownerId في الطلب')
    return null
  }
  
  try {
    // الحصول على FCM token لصاحب المطعم
    const tokenDoc = await db.collection('fcmTokens').doc(ownerId).get()
    
    if (!tokenDoc.exists) {
      console.warn('⚠️ لا يوجد FCM token للمطعم:', ownerId)
      return null
    }
    
    const fcmToken = tokenDoc.data().token
    
    if (!fcmToken) {
      console.warn('⚠️ FCM token فارغ للمطعم:', ownerId)
      return null
    }
    
    // تحضير رسالة الإشعار
    const message = {
      token: fcmToken,
      notification: {
        title: '🛒 طلب جديد!',
        body: `لديك طلب جديد من ${order.customerName || 'عميل'}`,
      },
      data: {
        type: 'new_order',
        orderId: orderId,
        click_action: '/orders',
      },
      android: {
        notification: {
          sound: 'default',
          priority: 'high',
          channelId: 'orders',
        }
      },
      webpush: {
        notification: {
          icon: '/icon-192.png',
          badge: '/icon-192.png',
          requireInteraction: 'true',
        },
        fcmOptions: {
          link: '/orders'
        }
      },
      apns: {
        payload: {
          aps: {
            sound: 'default',
            badge: 1,
          }
        }
      }
    }
    
    // إرسال الإشعار
    const response = await messaging.send(message)
    console.log('✅ تم إرسال الإشعار للمطعم:', ownerId, response)
    
    return response
  } catch (error) {
    console.error('❌ فشل إرسال الإشعار:', error)
    
    // إذا كان الـ token منتهي الصلاحية، نحذفه
    if (error.code === 'messaging/invalid-registration-token' ||
        error.code === 'messaging/registration-token-not-registered') {
      console.log('🗑️ حذف FCM token منتهي الصلاحية:', ownerId)
      await db.collection('fcmTokens').doc(ownerId).delete()
    }
    
    return null
  }
})

/**
 * 🔔 إرسال إشعار للمندوب عند تجهيز الطلب
 * يُفعّل عند تحديث حالة الطلب إلى "ready"
 */
exports.notifyCourierOnOrderReady = onDocumentUpdated('orders/{orderId}', async (event) => {
  const beforeSnap = event.data?.before
  const afterSnap = event.data?.after
  
  if (!beforeSnap || !afterSnap) {
    return null
  }
  
  const before = beforeSnap.data()
  const after = afterSnap.data()
  const orderId = event.params.orderId
  
  // التحقق من تغيير الحالة إلى ready
  if (before.status !== 'ready' && after.status === 'ready') {
    console.log('📦 الطلب جاهز للتوصيل:', orderId)
    
    const courierId = after.courierId
    
    if (!courierId) {
      console.log('⚠️ لا يوجد مندوب معين للطلب')
      return null
    }
    
    try {
      // الحصول على FCM token للمندوب
      const tokenDoc = await db.collection('fcmTokens').doc(courierId).get()
      
      if (!tokenDoc.exists || !tokenDoc.data().token) {
        console.warn('⚠️ لا يوجد FCM token للمندوب:', courierId)
        return null
      }
      
      const fcmToken = tokenDoc.data().token
      
      // إرسال الإشعار
      const message = {
        token: fcmToken,
        notification: {
          title: '📦 طلب جاهز للاستلام!',
          body: `الطلب ${orderId.substring(0, 8)} جاهز من المطعم`,
        },
        data: {
          type: 'order_ready',
          orderId: orderId,
          click_action: '/courier',
        },
        android: {
          notification: {
            sound: 'default',
            priority: 'high',
          }
        },
        webpush: {
          notification: {
            icon: '/icon-192.png',
            badge: '/icon-192.png',
            requireInteraction: 'true',
          }
        }
      }
      
      const response = await messaging.send(message)
      console.log('✅ تم إرسال الإشعار للمندوب:', courierId, response)
      
      return response
    } catch (error) {
      console.error('❌ فشل إرسال الإشعار للمندوب:', error)
      return null
    }
  }
  
  return null
})

/**
 * 🔔 إرسال إشعار للعميل عند تحديث حالة الطلب
 */
exports.notifyCustomerOnOrderUpdate = onDocumentUpdated('orders/{orderId}', async (event) => {
  const beforeSnap = event.data?.before
  const afterSnap = event.data?.after
  
  if (!beforeSnap || !afterSnap) {
    return null
  }
  
  const before = beforeSnap.data()
  const after = afterSnap.data()
  const orderId = event.params.orderId
  
  // التحقق من تغيير الحالة
  if (before.status === after.status) {
    return null
  }
  
  const customerId = after.customerId || after.userId
  
  if (!customerId) {
    console.log('⚠️ لا يوجد معرف عميل')
    return null
  }
  
  // تحديد نص الإشعار حسب الحالة
  const statusMessages = {
    'accepted': '✅ تم قبول طلبك وسيتم تجهيزه قريباً',
    'preparing': '👨‍🍳 جاري تجهيز طلبك',
    'ready': '📦 طلبك جاهز وفي انتظار المندوب',
    'out_for_delivery': '🚗 طلبك في الطريق إليك!',
    'delivered': '🎉 تم توصيل طلبك بنجاح!',
    'cancelled': '❌ تم إلغاء الطلب',
  }
  
  const messageBody = statusMessages[after.status]
  
  if (!messageBody) {
    return null
  }
  
  try {
    // الحصول على FCM token للعميل
    const tokenDoc = await db.collection('fcmTokens').doc(customerId).get()
    
    if (!tokenDoc.exists || !tokenDoc.data().token) {
      console.warn('⚠️ لا يوجد FCM token للعميل:', customerId)
      return null
    }
    
    const fcmToken = tokenDoc.data().token
    
    // إرسال الإشعار
    const message = {
      token: fcmToken,
      notification: {
        title: 'تحديث طلبك',
        body: messageBody,
      },
      data: {
        type: 'order_update',
        orderId: orderId,
        status: after.status,
        click_action: '/orders',
      },
      webpush: {
        notification: {
          icon: '/icon-192.png',
          badge: '/icon-192.png',
        }
      }
    }
    
    const response = await messaging.send(message)
    console.log('✅ تم إرسال الإشعار للعميل:', customerId, response)
    
    return response
  } catch (error) {
    console.error('❌ فشل إرسال الإشعار للعميل:', error)
    return null
  }
})

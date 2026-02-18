/**
 * خدمة صوت الإشعارات - سفرة البيت
 * صوت مشابه لواتساب يعمل عند وصول طلب جديد للأسرة/المطعم
 */

// مسار ملف الصوت
const NOTIFICATION_SOUND_URL = '/notification.mp3'

// حالة الصوت
let notificationAudio: HTMLAudioElement | null = null
let audioInitialized = false

/**
 * تهيئة صوت الإشعارات
 * يجب استدعاؤها مرة واحدة عند تحميل التطبيق
 */
export function initNotificationSound(): void {
  if (audioInitialized) return
  
  try {
    notificationAudio = new Audio(NOTIFICATION_SOUND_URL)
    notificationAudio.volume = 0.8 // صوت عالي نسبياً
    notificationAudio.preload = 'auto'
    audioInitialized = true
    console.log('🔊 تم تهيئة صوت الإشعارات')
  } catch (error) {
    console.error('❌ فشل تهيئة صوت الإشعارات:', error)
  }
}

/**
 * تشغيل صوت الإشعار
 * يُستخدم عند وصول طلب جديد
 */
export async function playNotificationSound(): Promise<void> {
  try {
    // تهيئة الصوت إذا لم يتم
    if (!audioInitialized) {
      initNotificationSound()
    }

    if (!notificationAudio) {
      // إنشاء audio جديد إذا لم يتوفر
      notificationAudio = new Audio(NOTIFICATION_SOUND_URL)
      notificationAudio.volume = 0.8
    }

    // إعادة الصوت للبداية إذا كان يعمل
    notificationAudio.currentTime = 0
    
    // تشغيل الصوت
    await notificationAudio.play()
    console.log('🔔 تم تشغيل صوت الإشعار')
  } catch (error) {
    // قد يفشل الصوت إذا لم يتفاعل المستخدم مع الصفحة بعد
    console.warn('⚠️ تعذر تشغيل الصوت (قد يحتاج تفاعل المستخدم):', error)
  }
}

/**
 * تشغيل صوت الإشعار مع اهتزاز (للجوال)
 */
export async function playNotificationWithVibrate(): Promise<void> {
  // تشغيل الصوت
  await playNotificationSound()
  
  // اهتزاز الجوال (إذا مدعوم)
  if ('vibrate' in navigator) {
    navigator.vibrate([200, 100, 200]) // نمط اهتزاز مثل واتساب
  }
}

/**
 * إيقاف صوت الإشعار
 */
export function stopNotificationSound(): void {
  if (notificationAudio) {
    notificationAudio.pause()
    notificationAudio.currentTime = 0
  }
}

/**
 * تغيير مستوى الصوت (0-1)
 */
export function setNotificationVolume(volume: number): void {
  if (notificationAudio) {
    notificationAudio.volume = Math.max(0, Math.min(1, volume))
  }
}

/**
 * التحقق من دعم الصوت
 */
export function isSoundSupported(): boolean {
  return typeof Audio !== 'undefined'
}

// تهيئة تلقائية عند استيراد الملف
if (typeof window !== 'undefined') {
  // ننتظر تفاعل المستخدم لتهيئة الصوت (مطلوب في المتصفحات الحديثة)
  const initOnInteraction = () => {
    initNotificationSound()
    document.removeEventListener('click', initOnInteraction)
    document.removeEventListener('touchstart', initOnInteraction)
  }
  document.addEventListener('click', initOnInteraction, { once: true })
  document.addEventListener('touchstart', initOnInteraction, { once: true })
}

/**
 * خدمة صوت الإشعارات - سفرة البيت
 * صوت مشابه لواتساب يعمل عند وصول طلب جديد للأسرة/المطعم
 * 🍎 محسّن للعمل على iOS WebView
 */

// مسار ملف الصوت
const NOTIFICATION_SOUND_URL = '/notification.mp3'

// حالة الصوت
let notificationAudio: HTMLAudioElement | null = null
let audioContext: AudioContext | null = null
let audioBuffer: AudioBuffer | null = null
let audioInitialized = false
let userInteracted = false // هل المستخدم تفاعل مع الصفحة؟

/**
 * الكشف عن iOS
 */
function isIOS(): boolean {
  return /iPad|iPhone|iPod/.test(navigator.userAgent) || 
    (navigator.platform === 'MacIntel' && navigator.maxTouchPoints > 1)
}

/**
 * تفعيل الصوت بعد تفاعل المستخدم (مطلوب لـ iOS)
 * يجب استدعاؤها من زر أو حدث click
 */
export async function enableSoundForIOS(): Promise<boolean> {
  try {
    userInteracted = true
    
    // إنشاء AudioContext (يعمل أفضل على iOS)
    if (!audioContext) {
      audioContext = new (window.AudioContext || (window as any).webkitAudioContext)()
    }
    
    // استئناف AudioContext إذا كان معلقاً
    if (audioContext.state === 'suspended') {
      await audioContext.resume()
    }
    
    // تحميل الصوت في AudioBuffer
    if (!audioBuffer) {
      const response = await fetch(NOTIFICATION_SOUND_URL)
      const arrayBuffer = await response.arrayBuffer()
      audioBuffer = await audioContext.decodeAudioData(arrayBuffer)
    }
    
    // تشغيل صوت صامت لفتح الصلاحية
    const silentOscillator = audioContext.createOscillator()
    const gainNode = audioContext.createGain()
    gainNode.gain.value = 0.001 // صامت تقريباً
    silentOscillator.connect(gainNode)
    gainNode.connect(audioContext.destination)
    silentOscillator.start()
    silentOscillator.stop(audioContext.currentTime + 0.1)
    
    // أيضاً تهيئة Audio element كـ fallback
    if (!notificationAudio) {
      notificationAudio = new Audio(NOTIFICATION_SOUND_URL)
      notificationAudio.volume = 0.8
      notificationAudio.preload = 'auto'
      // محاولة تشغيل صامت
      notificationAudio.muted = true
      await notificationAudio.play().catch(() => {})
      notificationAudio.pause()
      notificationAudio.muted = false
      notificationAudio.currentTime = 0
    }
    
    audioInitialized = true
    console.log('🔊 ✅ تم تفعيل الصوت للـ iOS')
    return true
  } catch (error) {
    console.error('❌ فشل تفعيل الصوت:', error)
    return false
  }
}

/**
 * تهيئة صوت الإشعارات
 * يجب استدعاؤها مرة واحدة عند تحميل التطبيق
 */
export function initNotificationSound(): void {
  if (audioInitialized) return
  
  try {
    notificationAudio = new Audio(NOTIFICATION_SOUND_URL)
    notificationAudio.volume = 0.8
    notificationAudio.preload = 'auto'
    
    // على iOS، نحتاج تفاعل المستخدم أولاً
    if (!isIOS()) {
      audioInitialized = true
    }
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
    // على iOS، إذا لم يتفاعل المستخدم، لا يمكن تشغيل الصوت
    if (isIOS() && !userInteracted) {
      console.warn('⚠️ iOS: يجب الضغط على زر تفعيل الصوت أولاً')
      return
    }
    
    // محاولة استخدام AudioContext (أفضل لـ iOS)
    if (audioContext && audioBuffer && audioContext.state === 'running') {
      const source = audioContext.createBufferSource()
      source.buffer = audioBuffer
      source.connect(audioContext.destination)
      source.start(0)
      console.log('🔔 تم تشغيل صوت الإشعار (AudioContext)')
      return
    }
    
    // Fallback: Audio element
    if (!audioInitialized) {
      initNotificationSound()
    }

    if (!notificationAudio) {
      notificationAudio = new Audio(NOTIFICATION_SOUND_URL)
      notificationAudio.volume = 0.8
    }

    notificationAudio.currentTime = 0
    await notificationAudio.play()
    console.log('🔔 تم تشغيل صوت الإشعار')
  } catch (error) {
    console.warn('⚠️ تعذر تشغيل الصوت:', error)
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

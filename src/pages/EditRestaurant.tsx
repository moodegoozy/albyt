// src/pages/EditRestaurant.tsx
import React, { useEffect, useMemo, useState } from "react"
import { ref, uploadBytes, getDownloadURL } from "firebase/storage"
import { doc, getDoc, setDoc } from "firebase/firestore"
import { db, storage } from "@/firebase"
import { useAuth } from "@/auth"
import { useToast } from "@/components/ui/Toast"
import { SAUDI_CITIES } from "@/utils/cities"
import { MapPin, FileText, ShieldCheck, AlertCircle, CheckCircle, Clock } from "lucide-react"

type RestaurantForm = {
  name: string
  phone: string
  city: string
  location: string
  logoUrl?: string
  commercialLicenseUrl?: string
  healthCertificateUrl?: string
  licenseStatus?: 'pending' | 'approved' | 'rejected'
  licenseNotes?: string
}

export const EditRestaurant: React.FC = () => {
  const { user } = useAuth()
  const toast = useToast()

  const [form, setForm] = useState<RestaurantForm>({
    name: "",
    phone: "",
    city: "",
    location: "",
    logoUrl: "",
    commercialLicenseUrl: "",
    healthCertificateUrl: "",
    licenseStatus: undefined,
    licenseNotes: "",
  })

  const [file, setFile] = useState<File | null>(null)
  const [preview, setPreview] = useState<string>("")
  const [commercialFile, setCommercialFile] = useState<File | null>(null)
  const [healthFile, setHealthFile] = useState<File | null>(null)
  const [loading, setLoading] = useState<boolean>(true)
  const [saving, setSaving] = useState<boolean>(false)
  const canSave = useMemo(() => !saving && !!user, [saving, user])

  // ====== Load current data ======
  useEffect(() => {
    if (!user) return
    ;(async () => {
      try {
        const snap = await getDoc(doc(db, "restaurants", user.uid))
        if (snap.exists()) {
          const data = snap.data() as RestaurantForm
          setForm({
            name: data.name ?? "",
            phone: data.phone ?? "",
            city: data.city ?? "",
            location: data.location ?? "",
            logoUrl: data.logoUrl ?? "",
            commercialLicenseUrl: (data as any).commercialLicenseUrl ?? "",
            healthCertificateUrl: (data as any).healthCertificateUrl ?? "",
            licenseStatus: (data as any).licenseStatus,
            licenseNotes: (data as any).licenseNotes ?? "",
          })
        }
      } catch (e: any) {
        toast.error("تعذّرت قراءة بيانات المطعم")
        // console.error(e)
      } finally {
        setLoading(false)
      }
    })()
  }, [user, toast])

  // نظافة معاينة blob
  useEffect(() => {
    return () => {
      if (preview) URL.revokeObjectURL(preview)
    }
  }, [preview])

  // ====== Handlers ======
  const onChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const { name, value } = e.target
    setForm((p) => ({ ...p, [name]: value }))
  }

  const onPickLogo = (e: React.ChangeEvent<HTMLInputElement>) => {
    const f = e.target.files?.[0] || null
    setFile(f)
    if (f) {
      const url = URL.createObjectURL(f)
      setPreview(url)
    } else {
      setPreview("")
    }
  }

  const uploadLogoIfNeeded = async (): Promise<string | undefined> => {
    if (!user || !file) return undefined

    // فحص خفيف: نوع/حجم
    const isImage = /^image\//.test(file.type)
    if (!isImage) {
      toast.warning("الملف المختار ليس صورة")
      return undefined
    }
    const MAX = 3 * 1024 * 1024 // 3MB
    if (file.size > MAX) {
      toast.warning("حجم الصورة كبير، يرجى اختيار صورة أقل من 3MB")
      return undefined
    }

    // اسم ملف فريد + امتداد صحيح
    const cleanName = file.name.replace(/\s+/g, "_")
    const path = `restaurants/${user.uid}/logo_${Date.now()}_${cleanName}`
    const r = ref(storage, path)
    const metadata = {
      contentType: file.type || "image/jpeg",
      cacheControl: "public,max-age=31536000,immutable",
    }

    // رفع
    await uploadBytes(r, file, metadata)
    const url = await getDownloadURL(r)

    // كسر الكاش على واجهة العميل عند التبديل مباشرة
    const busted = `${url}${url.includes("?") ? "&" : "?"}v=${Date.now()}`
    return busted
  }

  // رفع ملف الترخيص
  const uploadLicenseFile = async (licenseFile: File, type: 'commercial' | 'health'): Promise<string | undefined> => {
    if (!user || !licenseFile) return undefined

    const isValidType = /^(image\/|application\/pdf)/.test(licenseFile.type)
    if (!isValidType) {
      toast.warning("الملف يجب أن يكون صورة أو PDF")
      return undefined
    }
    const MAX = 5 * 1024 * 1024 // 5MB
    if (licenseFile.size > MAX) {
      toast.warning("حجم الملف كبير، يرجى اختيار ملف أقل من 5MB")
      return undefined
    }

    const cleanName = licenseFile.name.replace(/\s+/g, "_")
    const path = `restaurants/${user.uid}/licenses/${type}_${Date.now()}_${cleanName}`
    const r = ref(storage, path)
    const metadata = {
      contentType: licenseFile.type,
      cacheControl: "public,max-age=31536000,immutable",
    }

    await uploadBytes(r, licenseFile, metadata)
    return await getDownloadURL(r)
  }

  const onSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!user) {
      toast.warning("⚠️ يجب تسجيل الدخول أولاً")
      return
    }
    if (!form.name.trim()) {
      toast.warning("اكتب اسم المطعم")
      return
    }

    setSaving(true)
    try {
      let logoUrl = form.logoUrl
      let commercialLicenseUrl = form.commercialLicenseUrl
      let healthCertificateUrl = form.healthCertificateUrl
      let licenseStatus = form.licenseStatus

      if (file) {
        toast.info("⏳ جاري رفع الشعار …")
        const uploaded = await uploadLogoIfNeeded()
        if (uploaded) logoUrl = uploaded
      }

      // رفع الرخصة التجارية
      if (commercialFile) {
        toast.info("⏳ جاري رفع الرخصة التجارية …")
        const uploaded = await uploadLicenseFile(commercialFile, 'commercial')
        if (uploaded) {
          commercialLicenseUrl = uploaded
          licenseStatus = 'pending' // إعادة المراجعة عند تحديث الترخيص
        }
      }

      // رفع الشهادة الصحية
      if (healthFile) {
        toast.info("⏳ جاري رفع الشهادة الصحية …")
        const uploaded = await uploadLicenseFile(healthFile, 'health')
        if (uploaded) {
          healthCertificateUrl = uploaded
          licenseStatus = 'pending'
        }
      }

      await setDoc(
        doc(db, "restaurants", user.uid),
        { 
          ...form, 
          logoUrl,
          commercialLicenseUrl,
          healthCertificateUrl,
          licenseStatus,
        },
        { merge: true }
      )

      // تنظيف الملفات
      if (preview) URL.revokeObjectURL(preview)
      setPreview("")
      setFile(null)
      setCommercialFile(null)
      setHealthFile(null)

      toast.success("تم حفظ التعديلات بنجاح 🎉", { title: "تعديل المطعم" })
    } catch (err: any) {
      // أمور شائعة: App Check، قواعد Storage/Firestore، صلاحيات المستخدم
      toast.error(`فشل الحفظ: ${err?.message || "خطأ غير معروف"}`)
      // console.error("Save error:", err)
    } finally {
      setSaving(false)
    }
  }

  if (loading) return <div className="p-6 text-center">جارِ التحميل…</div>

  return (
    <div className="max-w-md mx-auto p-6 bg-white rounded-2xl shadow-lg mt-8 text-gray-900">
      <h1 className="text-2xl font-bold text-center mb-6">تعديل بيانات المطعم</h1>

      <form onSubmit={onSubmit} className="space-y-4">
        {/* Logo picker + tiny preview */}
        <div className="space-y-2">
          <label className="block font-semibold">شعار المطعم</label>

          <div className="flex items-center gap-3">
            {/* أيقونة معاينة صغيرة */}
            <div className="w-14 h-14 rounded-full overflow-hidden border bg-gray-100 shrink-0">
              {/* الأولوية: المعاينة • بعدها الشعار المحفوظ */}
              {(preview || form.logoUrl) ? (
                <img
                  src={preview || form.logoUrl}
                  className="w-full h-full object-cover"
                  onError={(e: any) => (e.currentTarget.style.display = "none")}
                  alt="logo"
                />
              ) : null}
            </div>

            <input type="file" accept="image/*" onChange={onPickLogo} />
          </div>

          {file && (
            <div className="text-xs text-gray-600">
              سيتم رفع: <span className="font-semibold">{file.name}</span>
            </div>
          )}
        </div>

        <input
          name="name"
          placeholder="اسم المطعم"
          value={form.name}
          onChange={onChange}
          className="w-full border p-3 rounded-xl"
        />
        <input
          name="phone"
          placeholder="رقم الجوال"
          value={form.phone}
          onChange={onChange}
          className="w-full border p-3 rounded-xl"
        />
        <div className="relative">
          <MapPin className="absolute right-3 top-1/2 -translate-y-1/2 w-5 h-5 text-sky-400 pointer-events-none" />
          <select
            name="city"
            value={form.city}
            onChange={(e) => setForm(p => ({ ...p, city: e.target.value }))}
            className="w-full border p-3 pr-10 rounded-xl bg-white appearance-none cursor-pointer focus:border-sky-400 focus:ring-2 focus:ring-sky-100"
          >
            <option value="">اختر المدينة</option>
            {SAUDI_CITIES.map(city => (
              <option key={city} value={city}>{city}</option>
            ))}
          </select>
        </div>
        <input
          name="location"
          placeholder="الموقع"
          value={form.location}
          onChange={onChange}
          className="w-full border p-3 rounded-xl"
        />

        {/* قسم التراخيص */}
        <div className="border-t pt-4 mt-4">
          <h2 className="text-lg font-bold mb-4 flex items-center gap-2">
            <FileText className="w-5 h-5 text-sky-500" />
            التراخيص والشهادات
          </h2>

          {/* حالة التراخيص */}
          {form.licenseStatus && (
            <div className={`mb-4 p-3 rounded-xl flex items-center gap-2 ${
              form.licenseStatus === 'approved' ? 'bg-green-50 text-green-700' :
              form.licenseStatus === 'rejected' ? 'bg-red-50 text-red-700' :
              'bg-yellow-50 text-yellow-700'
            }`}>
              {form.licenseStatus === 'approved' && <CheckCircle className="w-5 h-5" />}
              {form.licenseStatus === 'rejected' && <AlertCircle className="w-5 h-5" />}
              {form.licenseStatus === 'pending' && <Clock className="w-5 h-5" />}
              <span className="font-semibold">
                {form.licenseStatus === 'approved' && 'التراخيص موافق عليها ✓'}
                {form.licenseStatus === 'rejected' && 'التراخيص مرفوضة'}
                {form.licenseStatus === 'pending' && 'التراخيص قيد المراجعة...'}
              </span>
            </div>
          )}
          {form.licenseNotes && form.licenseStatus === 'rejected' && (
            <div className="mb-4 p-3 bg-red-50 rounded-xl text-red-600 text-sm">
              <strong>ملاحظات:</strong> {form.licenseNotes}
            </div>
          )}

          {/* الرخصة التجارية */}
          <div className="space-y-2 mb-4">
            <label className="block font-semibold text-gray-700 flex items-center gap-2">
              <ShieldCheck className="w-4 h-4 text-orange-500" />
              الرخصة التجارية
            </label>
            <div className="flex items-center gap-3">
              {form.commercialLicenseUrl && (
                <a 
                  href={form.commercialLicenseUrl} 
                  target="_blank" 
                  rel="noopener noreferrer"
                  className="text-sky-500 hover:text-sky-700 text-sm underline"
                >
                  عرض الملف الحالي
                </a>
              )}
              <input 
                type="file" 
                accept="image/*,.pdf" 
                onChange={(e) => setCommercialFile(e.target.files?.[0] || null)}
                className="text-sm"
              />
            </div>
            {commercialFile && (
              <div className="text-xs text-gray-600">
                سيتم رفع: <span className="font-semibold">{commercialFile.name}</span>
              </div>
            )}
          </div>

          {/* الشهادة الصحية */}
          <div className="space-y-2">
            <label className="block font-semibold text-gray-700 flex items-center gap-2">
              <ShieldCheck className="w-4 h-4 text-green-500" />
              الشهادة الصحية
            </label>
            <div className="flex items-center gap-3">
              {form.healthCertificateUrl && (
                <a 
                  href={form.healthCertificateUrl} 
                  target="_blank" 
                  rel="noopener noreferrer"
                  className="text-sky-500 hover:text-sky-700 text-sm underline"
                >
                  عرض الملف الحالي
                </a>
              )}
              <input 
                type="file" 
                accept="image/*,.pdf" 
                onChange={(e) => setHealthFile(e.target.files?.[0] || null)}
                className="text-sm"
              />
            </div>
            {healthFile && (
              <div className="text-xs text-gray-600">
                سيتم رفع: <span className="font-semibold">{healthFile.name}</span>
              </div>
            )}
          </div>
        </div>

        <button
          type="submit"
          disabled={!canSave}
          className="w-full bg-gray-900 hover:bg-gray-800 text-white py-3 rounded-xl font-semibold transition disabled:opacity-60"
        >
          {saving ? "جارٍ الحفظ…" : "حفظ"}
        </button>
      </form>
    </div>
  )
}

export default EditRestaurant

// src/pages/EditRestaurant.tsx
import React, { useEffect, useMemo, useState } from "react"
import { ref, uploadBytes, getDownloadURL } from "firebase/storage"
import { doc, getDoc, setDoc } from "firebase/firestore"
import { db, storage } from "@/firebase"
import { useAuth } from "@/auth"
import { useToast } from "@/components/ui/Toast"

type RestaurantForm = {
  name: string
  phone: string
  city: string
  location: string
  logoUrl?: string
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
  })

  const [file, setFile] = useState<File | null>(null)
  const [preview, setPreview] = useState<string>("")
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
      if (file) {
        toast.info("⏳ جاري رفع الشعار …")
        const uploaded = await uploadLogoIfNeeded()
        if (uploaded) logoUrl = uploaded
      }

      await setDoc(
        doc(db, "restaurants", user.uid),
        { ...form, logoUrl },
        { merge: true }
      )

      // تنظيف معاينة الملف
      if (preview) URL.revokeObjectURL(preview)
      setPreview("")
      setFile(null)

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
        <input
          name="city"
          placeholder="المدينة"
          value={form.city}
          onChange={onChange}
          className="w-full border p-3 rounded-xl"
        />
        <input
          name="location"
          placeholder="الموقع"
          value={form.location}
          onChange={onChange}
          className="w-full border p-3 rounded-xl"
        />

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

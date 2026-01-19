// src/pages/OwnerDashboard.tsx
import React from 'react'
import { Link } from 'react-router-dom'
import { Utensils, ClipboardList, Settings, Crown, Sparkles, Megaphone } from 'lucide-react'

export const OwnerDashboard: React.FC = () => {
  const cards = [
    {
      to: "/owner/packages",
      title: "باقات سفرة البيت",
      desc: "اختر الباقة المناسبة لأسرتك واستمتع بمزايا حصرية.",
      icon: <Crown className="w-8 h-8 text-amber-500" />,
      color: "from-amber-50 via-yellow-50 to-orange-50",
      featured: true,
    },
    {
      to: "/owner/promotion",
      title: "الإعلانات الممولة",
      desc: "أنشئ إعلان ممول (حالة) بصورة أو فيديو لجذب العملاء - بسعر رمزي!",
      icon: <Megaphone className="w-8 h-8 text-purple-500" />,
      color: "from-purple-50 to-pink-50",
    },
    {
      to: "/owner/menu",
      title: "إدارة القائمة",
      desc: "إضافة، تعديل أو إخفاء الأصناف والوجبات.",
      icon: <Utensils className="w-8 h-8 text-yellow-500" />,
      color: "from-yellow-50 to-white",
    },
    {
      to: "/owner/orders",
      title: "إدارة الطلبات",
      desc: "قبول الطلبات، تحديث الحالة، وتعيين المندوب.",
      icon: <ClipboardList className="w-8 h-8 text-green-500" />,
      color: "from-green-50 to-white",
    },
    {
      to: "/owner/edit",
      title: "تعديل بيانات المطعم",
      desc: "تغيير الاسم، رقم الجوال، المدينة والموقع.",
      icon: <Settings className="w-8 h-8 text-blue-500" />,
      color: "from-blue-50 to-white",
    },
  ]

  return (
    <div className="grid grid-cols-1 sm:grid-cols-2 gap-6">
      {cards.map((card, idx) => (
        <Link
          key={idx}
          to={card.to}
          className={`rounded-2xl shadow-lg hover:shadow-2xl transition transform hover:-translate-y-1 bg-gradient-to-br ${card.color} p-6 flex flex-col relative overflow-hidden ${
            (card as any).featured ? 'ring-2 ring-amber-300 sm:col-span-2' : ''
          }`}
        >
          {(card as any).featured && (
            <>
              <div className="absolute top-0 left-0 right-0 bg-gradient-to-r from-amber-500 via-yellow-400 to-orange-500 py-1.5 text-center">
                <div className="flex items-center justify-center gap-2 text-white text-sm font-bold">
                  <Sparkles className="w-4 h-4" />
                  <span>اكتشف الباقات</span>
                  <Sparkles className="w-4 h-4" />
                </div>
              </div>
              <div className="h-8" />
            </>
          )}
          <div className="flex items-center gap-3 mb-3">
            {card.icon}
            <h3 className="text-lg font-extrabold text-gray-900">{card.title}</h3>
          </div>
          <p className="text-sm text-gray-600 flex-1">{card.desc}</p>
        </Link>
      ))}
    </div>
  )
}

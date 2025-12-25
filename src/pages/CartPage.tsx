// src/pages/CartPage.tsx
import React from "react"
import { useCart } from "@/hooks/useCart"
import { Link } from "react-router-dom"
import { Trash2, ShoppingBag, ArrowLeft, Minus, Plus } from "lucide-react"

export const CartPage: React.FC = () => {
  const { items, subtotal, remove, clear, changeQty } = useCart()

  if (items.length === 0) {
    return (
      <div className="flex flex-col items-center justify-center py-20 px-4">
        <div className="w-24 h-24 bg-gray-100 rounded-full flex items-center justify-center mb-6">
          <ShoppingBag className="w-12 h-12 text-gray-400" />
        </div>
        <h2 className="text-xl font-bold text-gray-700 mb-2">السلة فارغة</h2>
        <p className="text-gray-500 mb-6">أضف بعض الأصناف اللذيذة!</p>
        <Link 
          to="/restaurants" 
          className="flex items-center gap-2 bg-primary text-white px-6 py-3 rounded-xl font-bold hover:bg-sky-600 transition"
        >
          <ArrowLeft className="w-5 h-5" />
          تصفح المطاعم
        </Link>
      </div>
    )
  }

  return (
    <div className="max-w-3xl mx-auto space-y-4 px-2 sm:px-4">
      <div className="flex items-center justify-between">
        <h1 className="text-xl sm:text-2xl font-bold flex items-center gap-2">
          <ShoppingBag className="w-6 h-6 text-primary" />
          سلة المشتريات
          <span className="text-sm bg-primary text-white px-2 py-0.5 rounded-full">{items.length}</span>
        </h1>
      </div>

      {/* قائمة الأصناف */}
      <div className="space-y-3">
        {items.map((i) => (
          <div
            key={i.id}
            className="flex items-center gap-3 bg-white text-gray-900 p-3 sm:p-4 rounded-xl shadow-sm border border-gray-100"
          >
            {/* صورة الصنف (افتراضية) */}
            <div className="w-16 h-16 sm:w-20 sm:h-20 bg-gray-100 rounded-xl flex items-center justify-center flex-shrink-0">
              <span className="text-3xl">🍟</span>
            </div>
            
            {/* تفاصيل الصنف */}
            <div className="flex-1 min-w-0">
              <h3 className="font-bold text-sm sm:text-base truncate">{i.name}</h3>
              <p className="text-primary font-bold text-sm">{i.price.toFixed(2)} ر.س</p>
              
              {/* أزرار الكمية */}
              <div className="flex items-center gap-2 mt-2">
                <button
                  onClick={() => i.qty > 1 ? changeQty(i.id, i.qty - 1) : remove(i.id)}
                  className="w-7 h-7 sm:w-8 sm:h-8 rounded-lg bg-gray-100 hover:bg-gray-200 flex items-center justify-center transition"
                >
                  <Minus className="w-4 h-4" />
                </button>
                <span className="font-bold text-lg w-8 text-center">{i.qty}</span>
                <button
                  onClick={() => changeQty(i.id, i.qty + 1)}
                  className="w-7 h-7 sm:w-8 sm:h-8 rounded-lg bg-primary text-white hover:bg-sky-600 flex items-center justify-center transition"
                >
                  <Plus className="w-4 h-4" />
                </button>
              </div>
            </div>
            
            {/* السعر الإجمالي + حذف */}
            <div className="flex flex-col items-end gap-2">
              <span className="font-bold text-lg text-gray-900">{(i.price * i.qty).toFixed(2)} ر.س</span>
              <button
                onClick={() => remove(i.id)}
                className="p-2 rounded-lg bg-red-50 hover:bg-red-100 text-red-500 transition"
              >
                <Trash2 className="w-4 h-4" />
              </button>
            </div>
          </div>
        ))}
      </div>

      {/* ملخص السلة */}
      <div className="bg-white rounded-xl p-4 shadow-sm border border-gray-100 space-y-3">
        <div className="flex justify-between text-gray-600">
          <span>المجموع الفرعي</span>
          <span className="font-bold">{subtotal.toFixed(2)} ر.س</span>
        </div>
        <div className="flex justify-between text-gray-600">
          <span>رسوم التوصيل</span>
          <span className="font-bold">7.00 ر.س</span>
        </div>
        <div className="h-px bg-gray-200"></div>
        <div className="flex justify-between">
          <span className="font-bold text-lg">الإجمالي</span>
          <span className="font-bold text-xl text-primary">{(subtotal + 7).toFixed(2)} ر.س</span>
        </div>
      </div>

      {/* أزرار الإجراءات */}
      <div className="flex flex-col sm:flex-row gap-3 pb-6">
        <button
          onClick={clear}
          className="flex-1 flex items-center justify-center gap-2 px-5 py-3 rounded-xl bg-gray-100 text-gray-700 font-semibold hover:bg-gray-200 transition"
        >
          <Trash2 className="w-5 h-5" />
          تفريغ السلة
        </button>
        <Link
          to="/checkout"
          className="flex-1 flex items-center justify-center gap-2 px-5 py-3 rounded-xl bg-gradient-to-r from-green-500 to-green-600 text-white font-bold shadow-lg hover:shadow-xl hover:scale-[1.02] transition"
        >
          ✅ إتمام الطلب
        </Link>
      </div>
    </div>
  )
}

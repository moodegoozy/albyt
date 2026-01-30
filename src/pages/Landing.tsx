// src/pages/Landing.tsx
import React from "react";
import { Link } from "react-router-dom";
import { useAuth } from "@/auth";
import { 
  Store, ShoppingCart, Package, User, Truck, Shield, Code2, 
  ChefHat, ClipboardList, Settings, LogIn, UserPlus, Phone, Loader2
} from "lucide-react";

// مربع القسم - محسن للجوال
const SectionCard: React.FC<{
  to: string;
  icon: React.ReactNode;
  label: string;
  color: string;
  emoji?: string;
}> = ({ to, icon, label, color, emoji }) => (
  <Link
    to={to}
    className={`flex flex-col items-center justify-center gap-2 p-4 sm:p-5 rounded-2xl bg-gradient-to-br ${color} text-white shadow-lg shadow-sky-200/30 active:scale-95 transition-all duration-200 backdrop-blur-sm`}
  >
    <div className="w-12 h-12 sm:w-14 sm:h-14 bg-white/25 backdrop-blur rounded-xl flex items-center justify-center">
      {emoji ? <span className="text-2xl sm:text-3xl">{emoji}</span> : icon}
    </div>
    <span className="font-bold text-sm sm:text-base text-center leading-tight">{label}</span>
  </Link>
);

export const Landing: React.FC = () => {
  const { user, role, loading, logout } = useAuth();

  // حالة التحميل - منع ظهور صفحة الزائر أثناء التحقق من الجلسة
  if (loading) {
    return (
      <div className="min-h-screen flex flex-col items-center justify-center bg-gradient-to-br from-sky-50 via-white to-sky-100">
        <div className="w-20 h-20 mb-6 bg-gradient-to-br from-sky-500 to-sky-600 rounded-3xl flex items-center justify-center shadow-2xl animate-pulse">
          <span className="text-5xl">🍗</span>
        </div>
        <Loader2 className="w-8 h-8 text-sky-500 animate-spin mb-3" />
        <p className="text-sky-600 font-semibold">جارِ التحميل...</p>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-sky-50 via-white to-sky-100 px-3 py-4 sm:px-4 sm:py-6">
      
      {/* الشعار والترحيب - أصغر للجوال */}
      <div className="text-center mb-6">
        <div className="w-16 h-16 sm:w-20 sm:h-20 mx-auto mb-3 bg-gradient-to-br from-sky-500 to-sky-600 rounded-2xl sm:rounded-3xl flex items-center justify-center shadow-xl">
          <span className="text-4xl sm:text-5xl">🍗</span>
        </div>
        <h1 className="text-2xl sm:text-3xl font-black text-transparent bg-clip-text bg-gradient-to-r from-sky-600 to-sky-500 mb-1">
          سفرة البيت
        </h1>
        {user && (
          <p className="text-sky-600/80 text-sm">
            أهلاً {user.displayName || user.email?.split('@')[0]} 👋
          </p>
        )}
      </div>

      {/* ===== أقسام الزائر (غير مسجل) ===== */}
      {!user && (
        <div className="max-w-sm mx-auto space-y-4">
          <div className="grid grid-cols-2 gap-3">
            <SectionCard
              to="/restaurants"
              emoji="🍴"
              icon={<Store className="w-6 h-6" />}
              label="تصفح المطاعم"
              color="from-sky-500 to-sky-600"
            />
            <SectionCard
              to="/customer-login"
              emoji="📱"
              icon={<Phone className="w-6 h-6" />}
              label="دخول بالجوال"
              color="from-green-500 to-green-600"
            />
            <SectionCard
              to="/login"
              emoji="🔑"
              icon={<LogIn className="w-6 h-6" />}
              label="دخول بالإيميل"
              color="from-amber-500 to-orange-500"
            />
            <SectionCard
              to="/register"
              emoji="✨"
              icon={<UserPlus className="w-6 h-6" />}
              label="حساب جديد"
              color="from-purple-500 to-purple-600"
            />
          </div>
          <p className="text-center text-sky-600/70 text-xs">
            أشهى الأكلات البيتية توصلك لين بابك 🚗
          </p>
        </div>
      )}

      {/* ===== أقسام العميل ===== */}
      {role === "customer" && (
        <div className="max-w-sm mx-auto space-y-4">
          <div className="grid grid-cols-2 gap-3">
            <SectionCard
              to="/restaurants"
              emoji="🍴"
              icon={<Store className="w-6 h-6" />}
              label="اطلب الآن"
              color="from-sky-500 to-sky-600"
            />
            <SectionCard
              to="/cart"
              emoji="🛒"
              icon={<ShoppingCart className="w-6 h-6" />}
              label="السلة"
              color="from-green-500 to-green-600"
            />
            <SectionCard
              to="/orders"
              emoji="📦"
              icon={<Package className="w-6 h-6" />}
              label="طلباتي"
              color="from-amber-500 to-orange-500"
            />
            <SectionCard
              to="/profile"
              emoji="👤"
              icon={<User className="w-6 h-6" />}
              label="بياناتي"
              color="from-purple-500 to-purple-600"
            />
          </div>
          <button
            onClick={logout}
            className="w-full py-3 rounded-xl glass-light text-sky-600 font-semibold text-sm active:bg-white/70 transition"
          >
            🚪 خروج
          </button>
        </div>
      )}

      {/* ===== أقسام صاحب المطعم ===== */}
      {role === "owner" && (
        <div className="max-w-sm mx-auto space-y-4">
          <div className="grid grid-cols-2 gap-3">
            <SectionCard
              to="/owner"
              emoji="📊"
              icon={<ChefHat className="w-6 h-6" />}
              label="لوحة التحكم"
              color="from-sky-500 to-sky-600"
            />
            <SectionCard
              to="/owner/orders"
              emoji="📋"
              icon={<ClipboardList className="w-6 h-6" />}
              label="الطلبات"
              color="from-green-500 to-green-600"
            />
            <SectionCard
              to="/owner/menu"
              emoji="🍽️"
              icon={<Store className="w-6 h-6" />}
              label="القائمة"
              color="from-amber-500 to-orange-500"
            />
            <SectionCard
              to="/owner/edit"
              emoji="⚙️"
              icon={<Settings className="w-6 h-6" />}
              label="بيانات المطعم"
              color="from-purple-500 to-purple-600"
            />
            <SectionCard
              to="/owner/courier-requests"
              emoji="🚗"
              icon={<Truck className="w-6 h-6" />}
              label="المندوبين"
              color="from-cyan-500 to-cyan-600"
            />
            <SectionCard
              to="/profile"
              emoji="👤"
              icon={<User className="w-6 h-6" />}
              label="حسابي"
              color="from-gray-500 to-gray-600"
            />
          </div>
          <button
            onClick={logout}
            className="w-full py-3 rounded-xl glass-light text-sky-600 font-semibold text-sm active:bg-white/70 transition"
          >
            🚪 خروج
          </button>
        </div>
      )}

      {/* ===== أقسام المندوب ===== */}
      {role === "courier" && (
        <div className="max-w-sm mx-auto space-y-4">
          <div className="grid grid-cols-2 gap-3">
            <SectionCard
              to="/courier"
              emoji="📦"
              icon={<Truck className="w-6 h-6" />}
              label="طلبات جاهزة"
              color="from-sky-500 to-sky-600"
            />
            <SectionCard
              to="/courier/hiring"
              emoji="🏪"
              icon={<Store className="w-6 h-6" />}
              label="انضم لمطعم"
              color="from-green-500 to-green-600"
            />
            <SectionCard
              to="/profile"
              emoji="👤"
              icon={<User className="w-6 h-6" />}
              label="حسابي"
              color="from-purple-500 to-purple-600"
            />
          </div>
          <button
            onClick={logout}
            className="w-full py-3 rounded-xl glass-light text-sky-600 font-semibold text-sm active:bg-white/70 transition"
          >
            🚪 خروج
          </button>
        </div>
      )}

      {/* ===== أقسام المشرف ===== */}
      {role === "admin" && (
        <div className="max-w-sm mx-auto space-y-4">
          <div className="grid grid-cols-2 gap-3">
            <SectionCard
              to="/admin"
              emoji="👑"
              icon={<Shield className="w-6 h-6" />}
              label="لوحة التحكم"
              color="from-sky-500 to-sky-600"
            />
            <SectionCard
              to="/admin/restaurants"
              emoji="🏪"
              icon={<Store className="w-6 h-6" />}
              label="المطاعم"
              color="from-green-500 to-green-600"
            />
            <SectionCard
              to="/admin/orders"
              emoji="📦"
              icon={<Package className="w-6 h-6" />}
              label="الطلبات"
              color="from-amber-500 to-orange-500"
            />
            <SectionCard
              to="/restaurants"
              emoji="🛒"
              icon={<ShoppingCart className="w-6 h-6" />}
              label="اطلب كعميل"
              color="from-purple-500 to-purple-600"
            />
            <SectionCard
              to="/profile"
              emoji="👤"
              icon={<User className="w-6 h-6" />}
              label="حسابي"
              color="from-gray-500 to-gray-600"
            />
          </div>
          <button
            onClick={logout}
            className="w-full py-3 rounded-xl glass-light text-sky-600 font-semibold text-sm active:bg-white/70 transition"
          >
            🚪 خروج
          </button>
        </div>
      )}

      {/* ===== أقسام المطور ===== */}
      {role === "developer" && (
        <div className="max-w-sm mx-auto space-y-4">
          <div className="grid grid-cols-2 gap-3">
            <SectionCard
              to="/developer"
              emoji="💻"
              icon={<Code2 className="w-6 h-6" />}
              label="لوحة التحكم"
              color="from-sky-500 to-sky-600"
            />
            <SectionCard
              to="/restaurants"
              emoji="🍴"
              icon={<Store className="w-6 h-6" />}
              label="المطاعم"
              color="from-green-500 to-green-600"
            />
            <SectionCard
              to="/admin/orders"
              emoji="📦"
              icon={<Package className="w-6 h-6" />}
              label="الطلبات"
              color="from-amber-500 to-orange-500"
            />
            <SectionCard
              to="/profile"
              emoji="👤"
              icon={<User className="w-6 h-6" />}
              label="حسابي"
              color="from-purple-500 to-purple-600"
            />
          </div>
          <button
            onClick={logout}
            className="w-full py-3 rounded-xl glass-light text-sky-600 font-semibold text-sm active:bg-white/70 transition"
          >
            🚪 خروج
          </button>
        </div>
      )}

    </div>
  );
};

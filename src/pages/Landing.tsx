// src/pages/Landing.tsx
import React from "react";
import { Link } from "react-router-dom";
import { useAuth } from "@/auth";
import { 
  Store, ShoppingCart, Package, User, Truck, Shield, Code2, 
  ChefHat, ClipboardList, Users, MapPin, FileText, Settings,
  LogIn, UserPlus, Phone
} from "lucide-react";

// مربع القسم
const SectionCard: React.FC<{
  to: string;
  icon: React.ReactNode;
  label: string;
  color: string;
  description?: string;
}> = ({ to, icon, label, color, description }) => (
  <Link
    to={to}
    className={`flex flex-col items-center justify-center gap-3 p-6 rounded-3xl bg-gradient-to-br ${color} text-white shadow-xl hover:shadow-2xl hover:scale-105 transition-all duration-300 min-h-[140px]`}
  >
    <div className="w-14 h-14 bg-white/20 rounded-2xl flex items-center justify-center backdrop-blur-sm">
      {icon}
    </div>
    <span className="font-bold text-lg text-center">{label}</span>
    {description && <span className="text-xs text-white/80 text-center">{description}</span>}
  </Link>
);

export const Landing: React.FC = () => {
  const { user, role, logout } = useAuth();

  return (
    <div className="min-h-screen bg-gradient-to-br from-sky-50 via-white to-sky-100 px-4 py-6">
      
      {/* الشعار والترحيب */}
      <div className="text-center mb-8">
        <div className="w-20 h-20 mx-auto mb-4 bg-gradient-to-br from-sky-500 to-sky-600 rounded-3xl flex items-center justify-center shadow-2xl shadow-sky-300/50">
          <span className="text-5xl">🍗</span>
        </div>
        <h1 className="text-3xl sm:text-4xl font-black text-transparent bg-clip-text bg-gradient-to-r from-sky-600 to-sky-500 mb-2">
          سفرة البيت
        </h1>
        <p className="text-sky-600/80 text-sm sm:text-base">
          {user ? `أهلاً ${user.email?.split('@')[0]} 👋` : 'أشهى الأكلات البيتية توصلك لين بابك 🚗'}
        </p>
      </div>

      {/* ===== أقسام الزائر (غير مسجل) ===== */}
      {!user && (
        <div className="max-w-lg mx-auto space-y-6">
          {/* الأقسام الرئيسية */}
          <div className="grid grid-cols-2 gap-4">
            <SectionCard
              to="/restaurants"
              icon={<Store className="w-7 h-7" />}
              label="المطاعم"
              color="from-sky-500 to-sky-600"
              description="تصفح القائمة"
            />
            <SectionCard
              to="/customer-login"
              icon={<Phone className="w-7 h-7" />}
              label="دخول بالجوال"
              color="from-green-500 to-green-600"
              description="للعملاء"
            />
            <SectionCard
              to="/login"
              icon={<LogIn className="w-7 h-7" />}
              label="تسجيل دخول"
              color="from-amber-500 to-orange-500"
              description="بالإيميل"
            />
            <SectionCard
              to="/register"
              icon={<UserPlus className="w-7 h-7" />}
              label="حساب جديد"
              color="from-purple-500 to-purple-600"
              description="انضم الآن"
            />
          </div>
        </div>
      )}

      {/* ===== أقسام العميل ===== */}
      {role === "customer" && (
        <div className="max-w-lg mx-auto space-y-6">
          <h2 className="text-xl font-bold text-sky-700 text-center">🛍️ خدماتك</h2>
          <div className="grid grid-cols-2 gap-4">
            <SectionCard
              to="/restaurants"
              icon={<Store className="w-7 h-7" />}
              label="المطاعم"
              color="from-sky-500 to-sky-600"
              description="اطلب الآن"
            />
            <SectionCard
              to="/cart"
              icon={<ShoppingCart className="w-7 h-7" />}
              label="السلة"
              color="from-green-500 to-green-600"
            />
            <SectionCard
              to="/orders"
              icon={<Package className="w-7 h-7" />}
              label="طلباتي"
              color="from-amber-500 to-orange-500"
              description="تتبع طلباتك"
            />
            <SectionCard
              to="/profile"
              icon={<User className="w-7 h-7" />}
              label="بياناتي"
              color="from-purple-500 to-purple-600"
            />
          </div>
          
          {/* زر الخروج */}
          <button
            onClick={logout}
            className="w-full py-4 rounded-2xl bg-gray-100 text-gray-600 font-bold hover:bg-gray-200 transition"
          >
            🚪 تسجيل الخروج
          </button>
        </div>
      )}

      {/* ===== أقسام صاحب المطعم ===== */}
      {role === "owner" && (
        <div className="max-w-lg mx-auto space-y-6">
          <h2 className="text-xl font-bold text-sky-700 text-center">🍳 لوحة المطعم</h2>
          <div className="grid grid-cols-2 gap-4">
            <SectionCard
              to="/owner"
              icon={<ChefHat className="w-7 h-7" />}
              label="لوحة التحكم"
              color="from-sky-500 to-sky-600"
            />
            <SectionCard
              to="/owner/orders"
              icon={<ClipboardList className="w-7 h-7" />}
              label="الطلبات"
              color="from-green-500 to-green-600"
              description="إدارة الطلبات"
            />
            <SectionCard
              to="/owner/menu"
              icon={<Store className="w-7 h-7" />}
              label="القائمة"
              color="from-amber-500 to-orange-500"
              description="إدارة الأصناف"
            />
            <SectionCard
              to="/owner/edit"
              icon={<Settings className="w-7 h-7" />}
              label="بيانات المطعم"
              color="from-purple-500 to-purple-600"
            />
            <SectionCard
              to="/owner/courier-requests"
              icon={<Truck className="w-7 h-7" />}
              label="المندوبين"
              color="from-cyan-500 to-cyan-600"
            />
            <SectionCard
              to="/profile"
              icon={<User className="w-7 h-7" />}
              label="حسابي"
              color="from-gray-500 to-gray-600"
            />
          </div>
          
          <button
            onClick={logout}
            className="w-full py-4 rounded-2xl bg-gray-100 text-gray-600 font-bold hover:bg-gray-200 transition"
          >
            🚪 تسجيل الخروج
          </button>
        </div>
      )}

      {/* ===== أقسام المندوب ===== */}
      {role === "courier" && (
        <div className="max-w-lg mx-auto space-y-6">
          <h2 className="text-xl font-bold text-sky-700 text-center">🚗 واجهة المندوب</h2>
          <div className="grid grid-cols-2 gap-4">
            <SectionCard
              to="/courier"
              icon={<Truck className="w-7 h-7" />}
              label="الطلبات المتاحة"
              color="from-sky-500 to-sky-600"
              description="اقبل توصيلات"
            />
            <SectionCard
              to="/courier/hiring"
              icon={<MapPin className="w-7 h-7" />}
              label="التوظيف"
              color="from-green-500 to-green-600"
              description="انضم للمطاعم"
            />
            <SectionCard
              to="/profile"
              icon={<User className="w-7 h-7" />}
              label="حسابي"
              color="from-purple-500 to-purple-600"
            />
          </div>
          
          <button
            onClick={logout}
            className="w-full py-4 rounded-2xl bg-gray-100 text-gray-600 font-bold hover:bg-gray-200 transition"
          >
            🚪 تسجيل الخروج
          </button>
        </div>
      )}

      {/* ===== أقسام المشرف ===== */}
      {role === "admin" && (
        <div className="max-w-lg mx-auto space-y-6">
          <h2 className="text-xl font-bold text-sky-700 text-center">👑 لوحة المشرف</h2>
          <div className="grid grid-cols-2 gap-4">
            <SectionCard
              to="/admin"
              icon={<Shield className="w-7 h-7" />}
              label="لوحة التحكم"
              color="from-sky-500 to-sky-600"
            />
            <SectionCard
              to="/admin/restaurants"
              icon={<Store className="w-7 h-7" />}
              label="المطاعم"
              color="from-green-500 to-green-600"
              description="إدارة المطاعم"
            />
            <SectionCard
              to="/admin/orders"
              icon={<Package className="w-7 h-7" />}
              label="الطلبات"
              color="from-amber-500 to-orange-500"
            />
            <SectionCard
              to="/restaurants"
              icon={<ShoppingCart className="w-7 h-7" />}
              label="اطلب كعميل"
              color="from-purple-500 to-purple-600"
            />
            <SectionCard
              to="/profile"
              icon={<User className="w-7 h-7" />}
              label="حسابي"
              color="from-gray-500 to-gray-600"
            />
          </div>
          
          <button
            onClick={logout}
            className="w-full py-4 rounded-2xl bg-gray-100 text-gray-600 font-bold hover:bg-gray-200 transition"
          >
            🚪 تسجيل الخروج
          </button>
        </div>
      )}

      {/* ===== أقسام المطور ===== */}
      {role === "developer" && (
        <div className="max-w-lg mx-auto space-y-6">
          <h2 className="text-xl font-bold text-sky-700 text-center">👨‍💻 لوحة المطور</h2>
          <div className="grid grid-cols-2 gap-4">
            <SectionCard
              to="/developer"
              icon={<Code2 className="w-7 h-7" />}
              label="لوحة التحكم"
              color="from-sky-500 to-sky-600"
              description="إدارة شاملة"
            />
            <SectionCard
              to="/restaurants"
              icon={<Store className="w-7 h-7" />}
              label="المطاعم"
              color="from-green-500 to-green-600"
            />
            <SectionCard
              to="/admin/orders"
              icon={<Package className="w-7 h-7" />}
              label="الطلبات"
              color="from-amber-500 to-orange-500"
            />
            <SectionCard
              to="/profile"
              icon={<User className="w-7 h-7" />}
              label="حسابي"
              color="from-purple-500 to-purple-600"
            />
          </div>
          
          <button
            onClick={logout}
            className="w-full py-4 rounded-2xl bg-gray-100 text-gray-600 font-bold hover:bg-gray-200 transition"
          >
            🚪 تسجيل الخروج
          </button>
        </div>
      )}

    </div>
  );
};

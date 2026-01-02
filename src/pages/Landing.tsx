// src/pages/Landing.tsx
import React from "react";
import { Link } from "react-router-dom";
import { useAuth } from "@/auth";
import { Sparkles, ChefHat, Truck, Star, ArrowLeft } from "lucide-react";

export const Landing: React.FC = () => {
  const { user } = useAuth();

  return (
    <div className="min-h-screen flex flex-col items-center justify-center bg-gradient-to-br from-sky-50 via-white to-sky-100 text-center px-4 sm:px-6 relative overflow-hidden">
      
      {/* ✨ خلفية زخرفية فخمة */}
      <div className="absolute top-0 left-0 w-64 sm:w-96 h-64 sm:h-96 bg-gradient-to-br from-sky-400/20 to-sky-300/10 rounded-full blur-3xl animate-pulse"></div>
      <div className="absolute bottom-0 right-0 w-64 sm:w-96 h-64 sm:h-96 bg-gradient-to-tl from-sky-500/20 to-sky-400/10 rounded-full blur-3xl animate-pulse delay-1000"></div>
      <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[300px] sm:w-[600px] h-[300px] sm:h-[600px] bg-gradient-radial from-sky-200/30 to-transparent rounded-full blur-3xl"></div>
      
      {/* ⭐ نجوم متطايرة - مخفية على الجوال */}
      <div className="hidden sm:block absolute top-20 left-20 text-sky-300 float">
        <Sparkles className="w-8 h-8" />
      </div>
      <div className="hidden sm:block absolute top-40 right-32 text-sky-400 float delay-500">
        <Star className="w-6 h-6 fill-current" />
      </div>
      <div className="hidden sm:block absolute bottom-32 left-32 text-sky-300 float delay-1000">
        <Star className="w-5 h-5 fill-current" />
      </div>

      {/* المحتوى الرئيسي */}
      <div className="relative z-10 flex flex-col items-center max-w-3xl w-full">
        
        {/* 🍗 الشعار الفخم */}
        <div className="mb-6 sm:mb-8 relative">
          <div className="w-24 h-24 sm:w-32 sm:h-32 bg-gradient-to-br from-sky-500 to-sky-600 rounded-[2rem] sm:rounded-[2.5rem] flex items-center justify-center shadow-2xl shadow-sky-300/50 glow">
            <span className="text-5xl sm:text-7xl drop-shadow-lg">🍗</span>
          </div>
          <div className="absolute -top-1 -right-1 sm:-top-2 sm:-right-2 w-6 h-6 sm:w-8 sm:h-8 bg-gradient-to-br from-yellow-400 to-orange-400 rounded-full flex items-center justify-center shadow-lg">
            <Sparkles className="w-3 h-3 sm:w-4 sm:h-4 text-white" />
          </div>
        </div>

        {/* عنوان الموقع */}
        <h1 className="text-4xl sm:text-5xl md:text-6xl lg:text-7xl font-black text-transparent bg-clip-text bg-gradient-to-r from-sky-600 via-sky-500 to-sky-600 mb-4 sm:mb-6 drop-shadow-sm">
          سفرة البيت
        </h1>

        {/* وصف الموقع */}
        <p className="text-base sm:text-lg md:text-xl lg:text-2xl text-sky-700/80 max-w-2xl mb-6 sm:mb-10 leading-relaxed font-medium px-2">
          استمتع بأشهى الأكلات البيتية والبرست الطازج 😋
          <br className="hidden sm:block" />
          <span className="text-sky-500">اطلب وجبتك بكل سهولة، وخليها توصلك لين باب بيتك</span> 🚗💨
        </p>

        {/* ✨ ميزات سريعة */}
        <div className="flex flex-wrap justify-center gap-2 sm:gap-4 mb-6 sm:mb-10 px-2">
          <div className="flex items-center gap-1.5 sm:gap-2 bg-white/80 backdrop-blur-sm px-3 sm:px-5 py-2 sm:py-3 rounded-xl sm:rounded-2xl shadow-lg border border-sky-100">
            <ChefHat className="w-4 h-4 sm:w-5 sm:h-5 text-sky-500" />
            <span className="text-sky-700 font-semibold text-xs sm:text-base">أكل بيتي طازج</span>
          </div>
          <div className="flex items-center gap-1.5 sm:gap-2 bg-white/80 backdrop-blur-sm px-3 sm:px-5 py-2 sm:py-3 rounded-xl sm:rounded-2xl shadow-lg border border-sky-100">
            <Truck className="w-4 h-4 sm:w-5 sm:h-5 text-sky-500" />
            <span className="text-sky-700 font-semibold text-xs sm:text-base">توصيل سريع</span>
          </div>
          <div className="flex items-center gap-1.5 sm:gap-2 bg-white/80 backdrop-blur-sm px-3 sm:px-5 py-2 sm:py-3 rounded-xl sm:rounded-2xl shadow-lg border border-sky-100">
            <Star className="w-4 h-4 sm:w-5 sm:h-5 text-yellow-500 fill-yellow-500" />
            <span className="text-sky-700 font-semibold text-xs sm:text-base">جودة عالية</span>
          </div>
        </div>

        {/* صورة الواجهة */}
        <div className="relative mb-8 sm:mb-12">
          <div className="absolute inset-0 bg-gradient-to-br from-sky-400/30 to-sky-500/30 rounded-[1.5rem] sm:rounded-[2rem] blur-2xl scale-110"></div>
          <img
            src="/landing.png"
            alt="طبق سفرة البيت"
            className="relative w-56 sm:w-72 md:w-80 lg:w-96 rounded-[1.5rem] sm:rounded-[2rem] shadow-2xl shadow-sky-200/50 border-2 sm:border-4 border-white object-cover hover:scale-105 transition-transform duration-500"
          />
        </div>

        {/* الأزرار */}
        {user ? (
          <Link
            to="/restaurants"
            className="group flex items-center gap-2 sm:gap-3 px-8 sm:px-10 py-4 sm:py-5 rounded-full text-lg sm:text-xl font-bold text-white bg-gradient-to-r from-sky-500 via-sky-400 to-sky-500 shadow-2xl shadow-sky-300/50 hover:shadow-sky-400/60 hover:scale-105 transition-all duration-300"
          >
            🍴 تصفح المطاعم
            <ArrowLeft className="w-4 h-4 sm:w-5 sm:h-5 group-hover:-translate-x-1 transition-transform" />
          </Link>
        ) : (
          <div className="flex flex-col items-center gap-4 sm:gap-5 w-full px-4">
            {/* زر دخول العميل برقم الجوال - الأساسي */}
            <Link
              to="/customer-login"
              className="group flex items-center justify-center gap-2 sm:gap-3 w-full max-w-xs px-8 sm:px-12 py-4 sm:py-5 rounded-full text-lg sm:text-xl font-bold text-white bg-gradient-to-r from-green-500 via-green-400 to-green-500 shadow-2xl shadow-green-300/50 hover:shadow-green-400/60 hover:scale-105 transition-all duration-300"
            >
              📱 دخول برقم الجوال
              <ArrowLeft className="w-4 h-4 sm:w-5 sm:h-5 group-hover:-translate-x-1 transition-transform" />
            </Link>

            {/* رابط للمطاعم والمناديب */}
            <Link
              to="/login"
              className="text-sky-600 font-semibold hover:text-sky-700 hover:underline transition text-sm sm:text-base"
            >
              صاحب مطعم أو مندوب؟ سجل دخول بالإيميل →
            </Link>

            <p className="text-sky-600/80 text-base sm:text-lg">
              ماعندك حساب؟{" "}
              <Link
                to="/customer-login"
                className="text-green-600 font-bold hover:text-green-700 hover:underline transition"
              >
                سجل برقم جوالك ✨
              </Link>
            </p>
          </div>
        )}
      </div>
    </div>
  );
};

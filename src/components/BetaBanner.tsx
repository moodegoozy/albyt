// src/components/BetaBanner.tsx
import React from 'react'
import { FlaskConical } from 'lucide-react'

export const BetaBanner: React.FC = () => {
  return (
    <div className="w-full bg-gradient-to-r from-amber-500 via-orange-500 to-amber-500 text-white py-1.5 overflow-hidden relative z-50">
      <div className="flex items-center justify-center gap-2">
        <FlaskConical className="w-4 h-4 text-white animate-pulse flex-shrink-0" />
        <div className="beta-marquee whitespace-nowrap font-bold text-xs tracking-wide">
          🧪 التطبيق في المرحلة التجريبية (Beta) — نعمل على تحسينه باستمرار! 🚀
        </div>
        <FlaskConical className="w-4 h-4 text-white animate-pulse flex-shrink-0" />
      </div>
    </div>
  )
}

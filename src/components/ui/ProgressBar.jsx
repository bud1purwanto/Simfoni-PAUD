import React from 'react';
import { Loader2 } from 'lucide-react';

/**
 * Komponen Loading / Progress Bar Reusable dengan palet hangat SIMFONI PAUD
 * @param {number} progress - Persentase kemajuan (0 - 100)
 * @param {string} label - Judul atau status proses aktif (contoh: "Mengunggah Gambar...")
 * @param {string} detail - Informasi pendukung (contoh: "45% • Mengompresi ke < 300KB")
 * @param {boolean} indeterminate - Mode animasi bergerak jika persentase tidak diketahui
 * @param {string} size - 'sm' | 'md' | 'lg'
 */
export default function ProgressBar({
  progress = 0,
  label = '',
  detail = '',
  indeterminate = false,
  size = 'md',
  className = '',
}) {
  const clamped = Math.max(0, Math.min(100, Math.round(progress)));

  const heightClasses = {
    sm: 'h-1.5',
    md: 'h-2.5',
    lg: 'h-4',
  }[size] || 'h-2.5';

  return (
    <div className={`w-full space-y-1.5 ${className}`}>
      {(label || detail || indeterminate) && (
        <div className="flex items-center justify-between text-xs">
          <div className="flex items-center space-x-1.5 font-bold text-slate-700">
            <Loader2 className="w-3.5 h-3.5 text-orange-500 animate-spin" />
            <span>{label || 'Memproses...'}</span>
          </div>
          <span className="font-extrabold text-orange-600 font-mono text-[11px]">
            {indeterminate ? 'Mohon tunggu...' : `${clamped}%`}
          </span>
        </div>
      )}

      {/* Track bar */}
      <div className={`w-full bg-orange-100/80 rounded-full overflow-hidden ${heightClasses} border border-orange-200/50 relative shadow-inner`}>
        {indeterminate ? (
          <div className="h-full bg-gradient-to-r from-amber-400 via-orange-500 to-amber-500 rounded-full w-1/2 animate-[shimmer_1.5s_infinite_linear] bg-[length:200%_100%]" />
        ) : (
          <div
            className="h-full bg-gradient-to-r from-amber-400 via-orange-500 to-amber-500 rounded-full transition-all duration-300 ease-out shadow-sm"
            style={{ width: `${clamped}%` }}
          />
        )}
      </div>

      {detail && (
        <div className="text-[11px] text-slate-500 font-medium text-right">
          {detail}
        </div>
      )}
    </div>
  );
}


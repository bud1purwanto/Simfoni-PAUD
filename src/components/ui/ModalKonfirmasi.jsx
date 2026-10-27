import React from 'react';
import { createPortal } from 'react-dom';
import { AlertTriangle, AlertCircle, Info, CheckCircle2, X } from 'lucide-react';

/**
 * ModalKonfirmasi: Komponen modal konfirmasi kustom yang elegan dan ramah PAUD.
 * Menggantikan dialog native window.confirm & window.alert yang kaku.
 */
export default function ModalKonfirmasi({
  isOpen,
  title = 'Konfirmasi Tindakan',
  message,
  confirmText = 'Ya, Lanjutkan',
  cancelText = 'Batal',
  type = 'warning', // 'danger' | 'warning' | 'info' | 'success'
  onConfirm,
  onClose,
  loading = false,
}) {
  if (!isOpen) return null;

  // Konfigurasi ikon & warna berdasarkan tipe aksi
  const themeConfig = {
    danger: {
      badgeBg: 'bg-rose-100',
      badgeText: 'text-rose-600',
      badgeBorder: 'border-rose-200',
      icon: AlertCircle,
      confirmBtn: 'bg-rose-600 hover:bg-rose-700 text-white shadow-rose-500/25',
    },
    warning: {
      badgeBg: 'bg-amber-100',
      badgeText: 'text-amber-700',
      badgeBorder: 'border-amber-200',
      icon: AlertTriangle,
      confirmBtn: 'bg-gradient-to-r from-amber-500 to-orange-500 hover:from-amber-600 hover:to-orange-600 text-white shadow-orange-500/25',
    },
    info: {
      badgeBg: 'bg-blue-100',
      badgeText: 'text-blue-600',
      badgeBorder: 'border-blue-200',
      icon: Info,
      confirmBtn: 'bg-blue-600 hover:bg-blue-700 text-white shadow-blue-500/25',
    },
    success: {
      badgeBg: 'bg-emerald-100',
      badgeText: 'text-emerald-700',
      badgeBorder: 'border-emerald-200',
      icon: CheckCircle2,
      confirmBtn: 'bg-emerald-600 hover:bg-emerald-700 text-white shadow-emerald-500/25',
    },
  };

  const currentTheme = themeConfig[type] || themeConfig.warning;
  const IconComponent = currentTheme.icon;

  return createPortal(
    <div className="fixed inset-0 z-[120] bg-slate-900/60 backdrop-blur-sm flex items-center justify-center p-4 animate-in fade-in duration-200">
      <div 
        className="bg-white rounded-3xl max-w-sm w-full p-6 shadow-2xl border border-slate-100 relative overflow-hidden animate-in zoom-in-95 duration-200"
        role="dialog"
        aria-modal="true"
      >
        {/* Tombol X Tutup */}
        {onClose && !loading && (
          <button
            onClick={onClose}
            className="absolute top-4 right-4 p-1.5 rounded-xl text-slate-400 hover:text-slate-600 hover:bg-slate-100 transition"
            aria-label="Tutup"
          >
            <X className="w-4 h-4" />
          </button>
        )}

        {/* Header Ikon & Judul */}
        <div className="flex flex-col items-center text-center">
          <div className={`w-14 h-14 rounded-2xl ${currentTheme.badgeBg} ${currentTheme.badgeText} border ${currentTheme.badgeBorder} flex items-center justify-center mb-3 shadow-inner`}>
            <IconComponent className="w-7 h-7 stroke-[2.2]" />
          </div>

          <h3 className="text-base font-extrabold text-slate-800 font-brand">
            {title}
          </h3>

          <p className="mt-2 text-xs font-medium text-slate-500 leading-relaxed max-w-xs">
            {message}
          </p>
        </div>

        {/* Tombol Aksi */}
        <div className="mt-6 flex items-center space-x-2.5">
          {onClose && (
            <button
              type="button"
              disabled={loading}
              onClick={onClose}
              className="w-1/2 py-2.5 px-3 rounded-2xl text-xs font-bold text-slate-600 bg-slate-100 hover:bg-slate-200 active:scale-98 transition text-center"
            >
              {cancelText}
            </button>
          )}

          <button
            type="button"
            disabled={loading}
            onClick={onConfirm}
            className={`${onClose ? 'w-1/2' : 'w-full'} py-2.5 px-3 rounded-2xl text-xs font-extrabold shadow-md active:scale-98 transition flex items-center justify-center font-brand ${currentTheme.confirmBtn}`}
          >
            {loading ? (
              <span className="flex items-center space-x-1.5">
                <span className="w-3.5 h-3.5 border-2 border-white/30 border-t-white rounded-full animate-spin"></span>
                <span>Memproses...</span>
              </span>
            ) : (
              confirmText
            )}
          </button>
        </div>
      </div>
    </div>,
    document.body
  );
}


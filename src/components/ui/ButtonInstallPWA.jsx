import React, { useState, useEffect } from 'react';
import { createPortal } from 'react-dom';
import { Download, Smartphone, Share2, PlusSquare, CheckCircle2, X } from 'lucide-react';

export default function ButtonInstallPWA({ variant = 'header' }) {
  const [deferredPrompt, setDeferredPrompt] = useState(null);
  const [isStandalone, setIsStandalone] = useState(false);
  const [isIos, setIsIos] = useState(false);
  const [iosModalOpen, setIosModalOpen] = useState(false);
  const [installedSuccess, setInstalledSuccess] = useState(false);

  useEffect(() => {
    // 1. Cek apakah sudah berjalan di mode standalone (PWA terinstal)
    const checkStandalone = () => {
      const isStandaloneMode = 
        window.matchMedia('(display-mode: standalone)').matches ||
        window.navigator.standalone === true ||
        document.referrer.includes('android-app://');
      setIsStandalone(isStandaloneMode);
    };

    checkStandalone();
    window.matchMedia('(display-mode: standalone)').addEventListener('change', checkStandalone);

    // 2. Deteksi perangkat iOS (iPhone / iPad / iPod)
    const ua = window.navigator.userAgent.toLowerCase();
    const isIosDevice = /iphone|ipad|ipod/.test(ua) || (navigator.platform === 'MacIntel' && navigator.maxTouchPoints > 1);
    setIsIos(isIosDevice);

    // 3. Tangkap event beforeinstallprompt (Android Chrome, Edge, Chromium)
    const handleBeforeInstallPrompt = (e) => {
      e.preventDefault();
      setDeferredPrompt(e);
    };

    const handleAppInstalled = () => {
      setDeferredPrompt(null);
      setIsStandalone(true);
      setInstalledSuccess(true);
      setTimeout(() => setInstalledSuccess(false), 5000);
    };

    window.addEventListener('beforeinstallprompt', handleBeforeInstallPrompt);
    window.addEventListener('appinstalled', handleAppInstalled);

    return () => {
      window.removeEventListener('beforeinstallprompt', handleBeforeInstallPrompt);
      window.removeEventListener('appinstalled', handleAppInstalled);
    };
  }, []);

  // Jika sudah terinstal di mode standalone, tidak perlu tampilkan tombol pasang
  if (isStandalone) {
    return null;
  }

  const handleInstallClick = async () => {
    if (deferredPrompt) {
      // Android / Chromium Browser
      deferredPrompt.prompt();
      const choiceResult = await deferredPrompt.userChoice;
      if (choiceResult.outcome === 'accepted') {
        setDeferredPrompt(null);
      }
    } else {
      // iPhone / iPad Safari atau browser yang membutuhkan panduan manual
      setIosModalOpen(true);
    }
  };

  // Modal Dialog Panduan Instalasi (Rendered via createPortal langsung di document.body)
  const renderModal = () => {
    if (!iosModalOpen || typeof document === 'undefined') return null;

    const modalContent = (
      <div 
        className="fixed inset-0 z-[9999] bg-slate-900/60 backdrop-blur-sm flex items-center justify-center p-4 animate-in fade-in duration-200"
        onClick={() => setIosModalOpen(false)}
      >
        <div 
          className="bg-white rounded-3xl max-w-sm w-full p-6 shadow-2xl border border-slate-100 space-y-4 relative overflow-hidden animate-in zoom-in-95 duration-200"
          onClick={(e) => e.stopPropagation()}
          role="dialog"
          aria-modal="true"
        >
          {/* Header Modal */}
          <div className="flex items-center justify-between">
            <div className="flex items-center space-x-2.5">
              <div className="w-9 h-9 rounded-xl bg-amber-100 text-amber-700 flex items-center justify-center font-bold text-base shrink-0">
                📲
              </div>
              <div>
                <h3 className="font-extrabold text-slate-800 text-sm font-brand leading-tight">
                  {isIos ? 'Pasang di iPhone / iPad' : 'Pasang Aplikasi SIMFONI'}
                </h3>
                <span className="text-[10px] text-slate-400 font-semibold">Akses Cepat Layar Utama (PWA)</span>
              </div>
            </div>
            <button
              type="button"
              onClick={() => setIosModalOpen(false)}
              className="p-1.5 rounded-xl text-slate-400 hover:text-slate-600 hover:bg-slate-100 transition"
              aria-label="Tutup"
            >
              <X className="w-4 h-4" />
            </button>
          </div>

          {/* Panduan Langkah */}
          <div className="text-xs text-slate-600 space-y-3 font-medium leading-relaxed">
            {isIos ? (
              <>
                <p>Ikuti 2 langkah mudah untuk memasang SIMFONI di layar utama iPhone Anda:</p>
                <div className="p-3 bg-amber-50/70 border border-amber-200/60 rounded-2xl flex items-start space-x-2.5">
                  <span className="w-5 h-5 rounded-full bg-amber-200 text-amber-900 text-[10px] font-black flex items-center justify-center shrink-0 mt-0.5">1</span>
                  <div>
                    Ketuk tombol <strong className="text-slate-800 inline-flex items-center gap-1"><Share2 className="w-3.5 h-3.5 inline text-blue-600" /> Bagikan (Share)</strong> di bar bawah Safari.
                  </div>
                </div>
                <div className="p-3 bg-amber-50/70 border border-amber-200/60 rounded-2xl flex items-start space-x-2.5">
                  <span className="w-5 h-5 rounded-full bg-amber-200 text-amber-900 text-[10px] font-black flex items-center justify-center shrink-0 mt-0.5">2</span>
                  <div>
                    Gulir menu ke bawah lalu pilih <strong className="text-slate-800 inline-flex items-center gap-1"><PlusSquare className="w-3.5 h-3.5 inline text-emerald-600" /> Tambah ke Layar Utama (Add to Home Screen)</strong>.
                  </div>
                </div>
              </>
            ) : (
              <>
                <p>Pasang aplikasi ke Layar Utama HP / Komputer Anda untuk akses kilat:</p>
                <div className="p-3 bg-amber-50/70 border border-amber-200/60 rounded-2xl flex items-start space-x-2.5">
                  <span className="w-5 h-5 rounded-full bg-amber-200 text-amber-900 text-[10px] font-black flex items-center justify-center shrink-0 mt-0.5">💡</span>
                  <div>
                    Klik menu browser <strong>(⋮)</strong> di pojok kanan atas ➔ pilih <strong>"Instal aplikasi"</strong> atau <strong>"Tambahkan ke Layar Utama"</strong>.
                  </div>
                </div>
              </>
            )}
          </div>

          {/* Tombol Konfirmasi "Saya Mengerti" */}
          <button
            type="button"
            onClick={() => setIosModalOpen(false)}
            className="w-full py-3 bg-gradient-to-r from-amber-500 to-orange-500 hover:from-amber-600 hover:to-orange-600 text-white font-extrabold text-xs rounded-2xl shadow-md shadow-orange-500/20 active:scale-95 transition font-brand"
          >
            Saya Mengerti
          </button>
        </div>
      </div>
    );

    return createPortal(modalContent, document.body);
  };

  // Tampilan Versi Tombol di Halaman Login (Banner Card)
  if (variant === 'login') {
    return (
      <>
        <div className="mt-4 p-4 rounded-2xl bg-gradient-to-r from-amber-500/10 via-orange-500/10 to-amber-500/10 border border-orange-200/80 flex items-center justify-between gap-3 shadow-xs">
          <div className="flex items-center space-x-3">
            <div className="w-10 h-10 rounded-xl bg-gradient-to-tr from-amber-500 to-orange-500 text-white flex items-center justify-center shrink-0 shadow-sm shadow-orange-500/20">
              <Smartphone className="w-5 h-5 stroke-[2.2]" />
            </div>
            <div>
              <div className="text-xs font-black text-slate-800 font-brand">
                Pasang SIMFONI di HP Anda
              </div>
              <p className="text-[11px] text-slate-500 font-medium">
                Akses instan tanpa buka browser & hemat kuota internet.
              </p>
            </div>
          </div>
          <button
            type="button"
            onClick={handleInstallClick}
            className="px-3.5 py-2 bg-gradient-to-r from-amber-500 to-orange-500 hover:from-amber-600 hover:to-orange-600 text-white text-xs font-extrabold rounded-xl shadow-md shadow-orange-500/20 active:scale-95 transition flex items-center space-x-1.5 shrink-0 font-brand"
          >
            <Download className="w-3.5 h-3.5 stroke-[2.5]" />
            <span>Pasang App</span>
          </button>
        </div>

        {renderModal()}
      </>
    );
  }

  // Tampilan Versi Header (Kompak & Elegan)
  return (
    <>
      <button
        type="button"
        onClick={handleInstallClick}
        title="Download / Pasang Aplikasi ke HP"
        className="px-2.5 py-1.5 bg-gradient-to-r from-amber-500 to-orange-500 hover:from-amber-600 hover:to-orange-600 text-white rounded-xl shadow-sm shadow-orange-500/20 text-[11px] font-extrabold flex items-center space-x-1.5 active:scale-95 transition shrink-0 font-brand"
      >
        <Download className="w-3.5 h-3.5 stroke-[2.5]" />
        <span className="hidden sm:inline">Download App</span>
        <span className="sm:hidden">App</span>
      </button>

      {renderModal()}
    </>
  );
}

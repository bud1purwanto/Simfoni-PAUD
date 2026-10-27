import React, { useState, useEffect } from 'react';
import { WifiOff, Wifi } from 'lucide-react';

export default function NetworkStatusBanner() {
  const [isOnline, setIsOnline] = useState(
    typeof navigator !== 'undefined' ? navigator.onLine : true
  );
  const [showReconnected, setShowReconnected] = useState(false);

  useEffect(() => {
    let timer = null;

    const handleOnline = () => {
      setIsOnline(true);
      setShowReconnected(true);
      clearTimeout(timer);
      timer = setTimeout(() => setShowReconnected(false), 4000);
    };

    const handleOffline = () => {
      clearTimeout(timer);
      setIsOnline(false);
      setShowReconnected(false);
    };

    window.addEventListener('online', handleOnline);
    window.addEventListener('offline', handleOffline);

    return () => {
      clearTimeout(timer);
      window.removeEventListener('online', handleOnline);
      window.removeEventListener('offline', handleOffline);
    };
  }, []);

  if (!isOnline) {
    return (
      <div className="bg-amber-500 text-white px-4 py-2 text-xs font-medium flex items-center justify-center space-x-2 shadow-sm animate-fadeIn sticky top-0 z-50">
        <WifiOff className="w-4 h-4 flex-shrink-0 animate-pulse" />
        <span>
          <strong>Mode Offline:</strong> Koneksi terputus. Draf & presensi tersimpan aman di HP dan akan otomatis dikirim saat sinyal kembali.
        </span>
      </div>
    );
  }

  if (showReconnected) {
    return (
      <div className="bg-emerald-600 text-white px-4 py-1.5 text-xs font-medium flex items-center justify-center space-x-2 shadow-sm animate-fadeIn sticky top-0 z-50">
        <Wifi className="w-4 h-4 flex-shrink-0" />
        <span>Koneksi kembali terhubung. Data lokal sedang disinkronkan ke server.</span>
      </div>
    );
  }

  return null;
}


import React from 'react';
import ReactDOM from 'react-dom/client';
import App from './App';
import './index.css';

ReactDOM.createRoot(document.getElementById('root')).render(
  <React.StrictMode>
    <App />
  </React.StrictMode>
);

// PWA: daftarkan Service Worker hanya di build produksi/preview (bukan `npm run dev`)
// agar aplikasi tetap bisa dibuka saat sinyal sekolah hilang.
if (import.meta.env.PROD && 'serviceWorker' in navigator) {
  window.addEventListener('load', () => {
    navigator.serviceWorker.register('/sw.js').catch((err) => console.warn('Service Worker gagal didaftarkan:', err));
  });
}

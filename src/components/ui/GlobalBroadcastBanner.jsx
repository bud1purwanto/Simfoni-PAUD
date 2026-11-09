import React, { useState, useEffect } from 'react';
import { Megaphone, X, Info, AlertTriangle, Sparkles, CheckCircle2 } from 'lucide-react';
import { collection, query, where, orderBy, limit, onSnapshot } from 'firebase/firestore';
import { db } from '../../config/firebase';

/**
 * Komponen Banner Broadcast Pengumuman Global dari Superadmin
 * Tampil di bagian atas dashboard Guru dan Kepala Sekolah
 */
export default function GlobalBroadcastBanner({ role = 'all', schoolId = null }) {
  const [broadcast, setBroadcast] = useState(null);
  const [dismissed, setDismissed] = useState(false);

  useEffect(() => {
    try {
      // Ambil pengumuman yang aktif
      const q = query(
        collection(db, 'broadcasts'),
        where('status', '==', 'aktif'),
        orderBy('created_at', 'desc'),
        limit(1)
      );

      const unsub = onSnapshot(q, (snap) => {
        if (!snap.empty) {
          const docData = { id: snap.docs[0].id, ...snap.docs[0].data() };
          // Cek target audience ('all', 'kepsek', 'guru')
          if (!docData.target || docData.target === 'all' || docData.target === role) {
            setBroadcast(docData);
            // Cek apakah sudah pernah di-dismiss untuk ID broadcast ini di sessionStorage
            const isDismissed = sessionStorage.getItem(`broadcast_dismissed_${docData.id}`);
            if (isDismissed) setDismissed(true);
            else setDismissed(false);
          } else {
            setBroadcast(null);
          }
        } else {
          setBroadcast(null);
        }
      }, (err) => {
        // Fallback hening jika indeks sedang dibuat atau izin db
        console.warn('Gagal memuat broadcast global:', err);
      });

      return () => unsub();
    } catch (e) {
      console.warn('Error inisialisasi broadcast listener:', e);
    }
  }, [role]);

  if (!broadcast || dismissed) return null;

  const handleDismiss = () => {
    setDismissed(true);
    if (broadcast?.id) {
      sessionStorage.setItem(`broadcast_dismissed_${broadcast.id}`, 'true');
    }
  };

  const isImportant = broadcast.tipe === 'penting' || broadcast.tipe === 'darurat';
  const isInfo = broadcast.tipe === 'info';

  return (
    <div
      className={`rounded-3xl p-4 md:p-5 border transition-all duration-300 relative shadow-sm ${
        isImportant
          ? 'bg-rose-50 border-rose-200 text-rose-900 shadow-rose-500/10'
          : isInfo
          ? 'bg-blue-50 border-blue-200 text-blue-900 shadow-blue-500/10'
          : 'bg-amber-50 border-amber-200 text-amber-900 shadow-amber-500/10'
      }`}
    >
      <div className="flex items-start justify-between gap-3">
        <div className="flex items-start space-x-3.5">
          <div
            className={`w-10 h-10 rounded-2xl flex items-center justify-center shrink-0 mt-0.5 ${
              isImportant
                ? 'bg-rose-500 text-white shadow-md shadow-rose-500/20 animate-pulse'
                : isInfo
                ? 'bg-blue-600 text-white shadow-md shadow-blue-500/20'
                : 'bg-amber-500 text-white shadow-md shadow-amber-500/20'
            }`}
          >
            <Megaphone className="w-5 h-5" />
          </div>

          <div>
            <div className="flex items-center space-x-2">
              <span className="text-[10px] font-black uppercase tracking-wider px-2 py-0.5 rounded-full bg-white/80 border border-current">
                PENGUMUMAN PUSAT ({broadcast.tipe?.toUpperCase() || 'INFO'})
              </span>
              <span className="text-[11px] font-bold opacity-75">
                {broadcast.tanggal_teks || 'Hari ini'}
              </span>
            </div>

            <h4 className="font-extrabold text-sm md:text-base mt-1 font-brand leading-snug">
              {broadcast.judul}
            </h4>

            <p className="text-xs md:text-sm mt-1 opacity-90 whitespace-pre-line leading-relaxed font-medium">
              {broadcast.pesan}
            </p>

            {broadcast.link_url && (
              <div className="mt-2.5">
                <a
                  href={broadcast.link_url}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="inline-flex items-center space-x-1.5 px-3 py-1.5 rounded-xl bg-white shadow-xs font-bold text-xs hover:bg-slate-50 transition border border-current"
                >
                  <span>{broadcast.link_label || 'Buka Tautan Informasi'}</span>
                  <span>→</span>
                </a>
              </div>
            )}
          </div>
        </div>

        <button
          onClick={handleDismiss}
          className="p-1.5 rounded-xl bg-white/60 hover:bg-white text-slate-500 hover:text-slate-800 transition shrink-0"
          title="Tutup pengumuman ini untuk sesi ini"
        >
          <X className="w-4 h-4" />
        </button>
      </div>
    </div>
  );
}

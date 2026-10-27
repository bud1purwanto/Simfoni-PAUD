import React, { useState, useEffect } from 'react';
import { History, Search } from 'lucide-react';
import { collection, query, where, orderBy, limit, onSnapshot } from 'firebase/firestore';
import { db } from '../../config/firebase';
import { useAuth } from '../../context/AuthContext';
import { ACTION_LABELS } from '../../utils/auditLogger';
import { formatTanggalIndo, formatJamMenit } from '../../utils/formatters';

const LOG_LIMIT = 200;

const KATEGORI_FILTER = [
  { id: 'semua', label: 'Semua', match: () => true },
  { id: 'presensi', label: 'Presensi', match: (a) => /ABSEN|IZIN|SAKIT|CORRECTION|KOREKSI/.test(a) },
  { id: 'jurnal', label: 'Jurnal', match: (a) => /JURNAL|JOURNAL/.test(a) },
  { id: 'akun', label: 'Akun Guru', match: (a) => /GURU|KEPSEK/.test(a) },
  { id: 'lainnya', label: 'Lainnya', match: (a) => /JADWAL|JAM_SEKOLAH|TASK|SCHOOL/.test(a) },
];

/**
 * Audit trail sekolah untuk Kepala Sekolah (read-only, terisolasi school_id).
 * Menampilkan 200 aktivitas terbaru; log lama dibersihkan berkala oleh Superadmin.
 */
export default function RiwayatAktivitas() {
  const { userData } = useAuth();
  const [logs, setLogs] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [search, setSearch] = useState('');
  const [kategori, setKategori] = useState('semua');

  useEffect(() => {
    if (!userData?.school_id) return undefined;
    const q = query(
      collection(db, 'audit_logs'),
      where('school_id', '==', userData.school_id),
      orderBy('timestamp', 'desc'),
      limit(LOG_LIMIT)
    );
    const unsubscribe = onSnapshot(
      q,
      (snap) => {
        setLogs(snap.docs.map((d) => ({ id: d.id, ...d.data() })));
        setLoading(false);
      },
      (err) => {
        console.error('Gagal memuat riwayat aktivitas:', err);
        setError('Riwayat aktivitas belum dapat dimuat. Pastikan indeks Firestore sudah di-deploy.');
        setLoading(false);
      }
    );
    return () => unsubscribe();
  }, [userData?.school_id]);

  const filterFn = KATEGORI_FILTER.find((k) => k.id === kategori)?.match || (() => true);
  const keyword = search.trim().toLowerCase();
  const filtered = logs.filter((l) => {
    const label = (ACTION_LABELS[l.action] || l.action || '').toLowerCase();
    return filterFn(l.action || '') && (!keyword || label.includes(keyword) || (l.actor_nama || '').toLowerCase().includes(keyword));
  });

  // Kelompokkan per tanggal agar mudah dipindai di HP
  const groups = filtered.reduce((acc, l) => {
    const d = l.timestamp?.toDate?.();
    const key = d ? formatTanggalIndo(d) : 'Menunggu sinkronisasi';
    (acc[key] = acc[key] || []).push(l);
    return acc;
  }, {});

  return (
    <div className="space-y-5 max-w-4xl mx-auto pb-12">
      <div>
        <h1 className="text-xl md:text-2xl font-extrabold text-slate-900 font-brand flex items-center gap-2">
          <History className="w-6 h-6 text-orange-500" /> Riwayat Aktivitas Sekolah
        </h1>
        <p className="text-xs text-slate-500 mt-0.5 font-medium">
          Jejak {LOG_LIMIT} aktivitas terakhir guru dan Kepala Sekolah di {userData?.nama_sekolah || 'sekolah Anda'}.
        </p>
      </div>

      <div className="bg-white rounded-3xl p-4 border border-orange-200/70 shadow-sm space-y-3">
        <div className="relative">
          <Search className="w-4 h-4 text-slate-400 absolute left-3.5 top-1/2 -translate-y-1/2" />
          <input
            type="text"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Cari nama guru atau aktivitas..."
            className="w-full pl-10 pr-4 py-2.5 text-xs font-medium rounded-2xl border border-slate-200 focus:outline-none focus:ring-2 focus:ring-orange-500/20 focus:border-orange-500"
          />
        </div>
        <div className="flex gap-1.5 overflow-x-auto pb-1">
          {KATEGORI_FILTER.map((k) => (
            <button
              key={k.id}
              onClick={() => setKategori(k.id)}
              className={`px-3 py-1.5 rounded-xl text-xs font-bold whitespace-nowrap transition ${
                kategori === k.id ? 'bg-amber-100 text-amber-800 border border-amber-300' : 'bg-slate-100 text-slate-600 border border-transparent'
              }`}
            >
              {k.label}
            </button>
          ))}
        </div>
      </div>

      {loading ? (
        <div className="p-10 text-center text-xs text-slate-400">Memuat riwayat aktivitas...</div>
      ) : error ? (
        <div className="p-6 rounded-3xl bg-rose-50 border border-rose-200 text-rose-700 text-xs font-semibold">{error}</div>
      ) : filtered.length === 0 ? (
        <div className="p-10 text-center text-xs text-slate-400 bg-white rounded-3xl border border-orange-200/70">
          Belum ada aktivitas yang cocok.
        </div>
      ) : (
        Object.entries(groups).map(([tanggal, items]) => (
          <div key={tanggal} className="bg-white rounded-3xl border border-orange-200/70 shadow-sm overflow-hidden">
            <div className="px-5 py-3 bg-amber-50/60 border-b border-orange-100 text-[11px] font-extrabold text-orange-800 uppercase tracking-wider">
              {tanggal}
            </div>
            <ul className="divide-y divide-slate-100">
              {items.map((l) => (
                <li key={l.id} className="px-5 py-3 flex items-start justify-between gap-3">
                  <div className="min-w-0">
                    <p className="text-xs font-bold text-slate-800">{ACTION_LABELS[l.action] || l.action}</p>
                    <p className="text-[11px] text-slate-500 truncate">
                      {l.actor_nama || 'Pengguna'}
                      {l.detail && Object.keys(l.detail).length > 0 && (
                        <span className="text-slate-400"> • {Object.values(l.detail).join(' • ')}</span>
                      )}
                    </p>
                  </div>
                  <span className="text-[11px] font-semibold text-slate-400 shrink-0">
                    {l.timestamp ? formatJamMenit(l.timestamp) : '—'}
                  </span>
                </li>
              ))}
            </ul>
          </div>
        ))
      )}
    </div>
  );
}

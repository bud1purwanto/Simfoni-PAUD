import React, { useState, useEffect } from 'react';
import { createPortal } from 'react-dom';
import { 
  ShieldAlert, 
  Trash2, 
  Settings, 
  Search, 
  Clock, 
  CheckCircle2, 
  AlertCircle, 
  Calendar, 
  School, 
  User, 
  Activity, 
  Filter, 
  Sparkles,
  RefreshCw,
  HardDrive
} from 'lucide-react';
import {
  collection,
  onSnapshot,
  query,
  orderBy,
  limit,
  doc,
  setDoc,
  updateDoc,
  serverTimestamp
} from 'firebase/firestore';
import { db } from '../../config/firebase';
import { useAuth } from '../../context/AuthContext';
import { countLogsOlderThan, purgeLogsOlderThan, recordCleanup, runAutoRetentionIfDue } from '../../utils/logRetention';

const LOG_DISPLAY_LIMIT = 500;
const PURGE_OPTIONS = [
  { value: 30, label: 'Hapus log lebih lama dari 30 hari yang lalu' },
  { value: 60, label: 'Hapus log lebih lama dari 60 hari yang lalu' },
  { value: 90, label: 'Hapus log lebih lama dari 90 hari yang lalu' },
  { value: 'custom', label: 'Rentang kustom (hari)' },
  { value: 0, label: 'Hapus SELURUH catatan log (Reset Bersih)' },
];

export default function ManajemenLog() {
  const { userData } = useAuth();

  const [logs, setLogs] = useState([]);
  const [schools, setSchools] = useState([]);
  const [loading, setLoading] = useState(true);
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedSchoolFilter, setSelectedSchoolFilter] = useState('all');
  const [notification, setNotification] = useState(null);

  // Settings State (system_settings/general_config)
  const [systemConfig, setSystemConfig] = useState({
    log_retention_days: 60,
    auto_cleanup_enabled: true,
    last_cleanup_timestamp: null,
    last_cleanup_deleted_count: 0,
  });
  const [savingSettings, setSavingSettings] = useState(false);

  // Modal Purge
  const [purgeModalOpen, setPurgeModalOpen] = useState(false);
  const [purgeDaysOption, setPurgeDaysOption] = useState(60);
  const [customDays, setCustomDays] = useState(180);
  const [purgeCounts, setPurgeCounts] = useState({});
  const [isPurging, setIsPurging] = useState(false);

  // 1. Ambil Data Real-Time: Logs, Schools, dan System Settings
  useEffect(() => {
    setLoading(true);

    // Ambil Audit Logs terbaru saja (hemat kuota baca); pembersihan dihitung di server
    const qLogs = query(collection(db, 'audit_logs'), orderBy('timestamp', 'desc'), limit(LOG_DISPLAY_LIMIT));
    const unsubLogs = onSnapshot(qLogs, (snap) => {
      setLogs(snap.docs.map((d) => ({ id: d.id, ...d.data() })));
      setLoading(false);
    }, (err) => {
      console.error('Gagal memuat audit log:', err);
      setLoading(false);
    });

    // Ambil Data Schools untuk filter nama sekolah
    const unsubSchools = onSnapshot(collection(db, 'schools'), (snap) => {
      const list = snap.docs.map((d) => ({ id: d.id, ...d.data() }));
      setSchools(list);
    });

    // Ambil Data System Settings (general_config)
    const configDocRef = doc(db, 'system_settings', 'general_config');
    const unsubConfig = onSnapshot(configDocRef, (snap) => {
      if (snap.exists()) {
        setSystemConfig(snap.data());
      } else {
        // Inisialisasi default config jika belum ada
        setDoc(configDocRef, {
          platform_name: 'SIMFONI PAUD SaaS',
          log_retention_days: 60,
          auto_cleanup_enabled: true,
          last_cleanup_timestamp: null,
          last_cleanup_deleted_count: 0,
          updated_at: serverTimestamp(),
        }).catch(console.error);
      }
    });

    return () => {
      unsubLogs();
      unsubSchools();
      unsubConfig();
    };
  }, []);

  // Periodic Retention Job: jalan otomatis bila siklus terakhir > 24 jam
  useEffect(() => {
    if (!userData?.uid) return;
    runAutoRetentionIfDue(userData).then((deleted) => {
      if (deleted) showNotification('success', `Job retensi otomatis membersihkan ${deleted} log usang.`);
    });
  }, [userData?.uid]);

  const resolvePurgeDays = (option) => (option === 'custom' ? Math.max(1, Number(customDays) || 1) : option);

  // Hitung jumlah dokumen per opsi langsung di server saat modal dibuka
  useEffect(() => {
    if (!purgeModalOpen) return;
    let active = true;
    PURGE_OPTIONS.forEach((opt) => {
      const days = resolvePurgeDays(opt.value);
      countLogsOlderThan(days)
        .then((count) => active && setPurgeCounts((prev) => ({ ...prev, [opt.value]: count })))
        .catch(() => active && setPurgeCounts((prev) => ({ ...prev, [opt.value]: '?' })));
    });
    return () => { active = false; };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [purgeModalOpen, customDays]);

  const showNotification = (type, message) => {
    setNotification({ type, message });
    setTimeout(() => setNotification(null), 4000);
  };

  // Simpan Pengaturan Retensi Log Otomatis
  const handleSaveSettings = async (e) => {
    e.preventDefault();
    setSavingSettings(true);

    try {
      const configDocRef = doc(db, 'system_settings', 'general_config');
      await updateDoc(configDocRef, {
        log_retention_days: Number(systemConfig.log_retention_days),
        auto_cleanup_enabled: Boolean(systemConfig.auto_cleanup_enabled),
        updated_at: serverTimestamp(),
      });

      showNotification('success', 'Konfigurasi retensi log berhasil disimpan!');
    } catch (err) {
      console.error('Error saving settings:', err);
      showNotification('error', 'Gagal menyimpan konfigurasi: ' + err.message);
    } finally {
      setSavingSettings(false);
    }
  };

  // Eksekusi Pembersihan Log Manual (Manual Purge)
  const handleExecutePurge = async () => {
    const days = resolvePurgeDays(purgeDaysOption);
    const toDeleteCount = purgeCounts[purgeDaysOption];
    if (toDeleteCount === 0) {
      showNotification('error', 'Tidak ada dokumen log yang memenuhi kriteria untuk dihapus.');
      return;
    }

    const label = days === 0 ? 'SELURUH' : `lebih lama dari ${days} hari`;
    if (!window.confirm(`Yakin ingin menghapus permanen ${toDeleteCount ?? ''} dokumen log ${label}? Tindakan ini tidak dapat dibatalkan.`)) {
      return;
    }

    setIsPurging(true);

    try {
      const deletedCount = await purgeLogsOlderThan(days);
      await recordCleanup({ deletedCount, days, actor: userData, mode: 'manual' });

      showNotification('success', `Berhasil membersihkan ${deletedCount} dokumen log usang!`);
      setPurgeModalOpen(false);
      setPurgeCounts({});
    } catch (err) {
      console.error('Error purging logs:', err);
      showNotification('error', 'Gagal membersihkan log: ' + err.message);
    } finally {
      setIsPurging(false);
    }
  };

  // Filter Log berdasarkan input pencarian dan filter sekolah
  const filteredLogs = logs.filter((item) => {
    const q = searchQuery.toLowerCase();
    const matchSearch =
      (item.actor_nama || '').toLowerCase().includes(q) ||
      (item.action || '').toLowerCase().includes(q) ||
      (item.school_id || '').toLowerCase().includes(q) ||
      (item.record_type || '').toLowerCase().includes(q);

    const matchSchool =
      selectedSchoolFilter === 'all'
        ? true
        : selectedSchoolFilter === 'global'
        ? !item.school_id
        : item.school_id === selectedSchoolFilter;

    return matchSearch && matchSchool;
  });

  return (
    <div className="space-y-6 pb-20 md:pb-6">
      {/* Header Banner */}
      <div className="bg-gradient-to-r from-amber-500 via-orange-500 to-amber-600 rounded-3xl p-6 md:p-8 text-white shadow-lg shadow-orange-500/20 relative overflow-hidden">
        <div className="absolute right-0 top-0 translate-x-12 -translate-y-12 w-64 h-64 bg-white/10 rounded-full blur-3xl pointer-events-none" />
        <div className="relative z-10 flex flex-col md:flex-row md:items-center justify-between gap-4">
          <div>
            <div className="inline-flex items-center space-x-2 px-3 py-1 bg-white/20 backdrop-blur-md rounded-full text-xs font-bold text-amber-100 mb-3">
              <ShieldAlert className="w-3.5 h-3.5" />
              <span>Sistem Pengawasan & Kebijakan Retensi Data</span>
            </div>
            <h1 className="text-2xl md:text-3xl font-extrabold font-brand tracking-tight">
              Manajemen Log & Retensi Berkala
            </h1>
            <p className="text-amber-100 text-sm mt-1 max-w-xl font-medium">
              Pantau seluruh aktivitas mutasi sistem, jejak rekam audit, serta lakukan pembersihan data berkala untuk menjaga kuota Firestore tetap hemat.
            </p>
          </div>

          <div className="flex items-center space-x-2">
            <button
              onClick={() => setPurgeModalOpen(true)}
              className="px-4 py-2.5 bg-rose-500 hover:bg-rose-600 active:scale-95 text-white font-extrabold text-xs rounded-2xl shadow-sm transition flex items-center space-x-2 font-brand"
            >
              <Trash2 className="w-4 h-4 stroke-[2.5]" />
              <span>Bersihkan Log Lama</span>
            </button>
          </div>
        </div>
      </div>

      {/* Notifikasi Toast */}
      {notification && (
        <div
          className={`p-4 rounded-2xl flex items-center space-x-3 text-sm font-semibold transition animate-in fade-in slide-in-from-top-3 ${
            notification.type === 'success'
              ? 'bg-emerald-50 text-emerald-800 border border-emerald-200'
              : 'bg-rose-50 text-rose-800 border border-rose-200'
          }`}
        >
          {notification.type === 'success' ? (
            <CheckCircle2 className="w-5 h-5 text-emerald-600 flex-shrink-0" />
          ) : (
            <AlertCircle className="w-5 h-5 text-rose-600 flex-shrink-0" />
          )}
          <span>{notification.message}</span>
        </div>
      )}

      {/* PENGATURAN RETENSI LOG OTOMATIS */}
      <div className="bg-white rounded-3xl p-5 border border-slate-200/80 shadow-sm">
        <div className="flex items-center justify-between pb-3 border-b border-slate-100 mb-4">
          <div className="flex items-center space-x-2">
            <Settings className="w-4 h-4 text-amber-600" />
            <h3 className="text-xs font-extrabold text-slate-700 uppercase tracking-wider">
              Konfigurasi Kebijakan Retensi Otomatis (Periodic Auto-Cleanup)
            </h3>
          </div>
          {systemConfig.last_cleanup_timestamp && (
            <span className="text-[11px] text-slate-400 font-medium">
              Pembersihan terakhir: {systemConfig.last_cleanup_deleted_count || 0} log terhapus
            </span>
          )}
        </div>

        <form onSubmit={handleSaveSettings} className="flex flex-col md:flex-row md:items-center justify-between gap-4">
          <div className="flex flex-col sm:flex-row sm:items-center gap-4">
            <div>
              <label className="block text-[11px] font-bold text-slate-500 mb-1">
                Simpan Log Selama:
              </label>
              <select
                value={systemConfig.log_retention_days}
                onChange={(e) =>
                  setSystemConfig({ ...systemConfig, log_retention_days: Number(e.target.value) })
                }
                className="px-3 py-1.5 text-xs font-bold rounded-xl border border-slate-200 focus:outline-none focus:ring-2 focus:ring-amber-500/20 focus:border-amber-500 bg-slate-50 text-slate-800"
              >
                <option value={30}>30 Hari Terakhir</option>
                <option value={60}>60 Hari Terakhir (Rekomendasi)</option>
                <option value={90}>90 Hari Terakhir</option>
                <option value={180}>180 Hari Terakhir</option>
              </select>
            </div>

            <div className="flex items-center space-x-2 pt-4 sm:pt-4">
              <input
                type="checkbox"
                id="auto_cleanup"
                checked={systemConfig.auto_cleanup_enabled}
                onChange={(e) =>
                  setSystemConfig({ ...systemConfig, auto_cleanup_enabled: e.target.checked })
                }
                className="w-4 h-4 rounded text-amber-600 focus:ring-amber-500"
              />
              <label htmlFor="auto_cleanup" className="text-xs font-bold text-slate-700 cursor-pointer">
                Aktifkan Auto-Cleanup Periodik
              </label>
            </div>
          </div>

          <button
            type="submit"
            disabled={savingSettings}
            className="px-4 py-2 bg-amber-100 hover:bg-amber-200 active:scale-95 text-amber-800 font-extrabold text-xs rounded-xl transition font-brand self-start md:self-auto"
          >
            {savingSettings ? 'Menyimpan...' : 'Perbarui Konfigurasi'}
          </button>
        </form>
      </div>

      {/* FILTER & PENCARIAN LOG */}
      <div className="bg-white rounded-3xl p-4 border border-slate-200/80 shadow-sm flex flex-col md:flex-row items-center justify-between gap-3">
        <div className="relative w-full md:w-80">
          <div className="absolute inset-y-0 left-0 pl-3.5 flex items-center pointer-events-none text-slate-400">
            <Search className="w-4 h-4" />
          </div>
          <input
            type="text"
            placeholder="Cari nama aktor, aksi, atau jenis data..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="w-full pl-10 pr-4 py-2 text-xs font-medium rounded-xl border border-slate-200 focus:outline-none focus:ring-2 focus:ring-amber-500/20 focus:border-amber-500"
          />
        </div>

        <div className="flex items-center space-x-2 w-full md:w-auto">
          <span className="text-xs font-bold text-slate-500 uppercase tracking-wider hidden sm:inline">
            Tenant:
          </span>
          <select
            value={selectedSchoolFilter}
            onChange={(e) => setSelectedSchoolFilter(e.target.value)}
            className="px-3 py-2 text-xs font-bold rounded-xl border border-slate-200 focus:outline-none focus:ring-2 focus:ring-amber-500/20 focus:border-amber-500 bg-slate-50 text-slate-800 w-full md:w-auto"
          >
            <option value="all">Semua Tenant ({logs.length} Log)</option>
            <option value="global">Aksi Global Superadmin</option>
            {schools.map((s) => (
              <option key={s.id} value={s.id}>
                {s.nama_sekolah}
              </option>
            ))}
          </select>
        </div>
      </div>

      {/* TABEL AUDIT LOG GLOBAL */}
      <div className="bg-white rounded-3xl border border-slate-200/80 shadow-sm overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-left text-xs">
            <thead className="bg-slate-50 text-slate-500 font-bold uppercase tracking-wider border-b border-slate-100">
              <tr>
                <th className="py-3.5 px-4">Waktu</th>
                <th className="py-3.5 px-4">Aktor Pelaksana</th>
                <th className="py-3.5 px-4">Sekolah Mitra</th>
                <th className="py-3.5 px-4">Tindakan / Aksi</th>
                <th className="py-3.5 px-4">Kategori Data</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100 font-medium">
              {loading ? (
                <tr>
                  <td colSpan={5} className="py-8 text-center text-slate-400">
                    Memuat riwayat audit log...
                  </td>
                </tr>
              ) : filteredLogs.length === 0 ? (
                <tr>
                  <td colSpan={5} className="py-8 text-center text-slate-400">
                    Tidak ada catatan log pada filter ini.
                  </td>
                </tr>
              ) : (
                filteredLogs.map((item) => {
                  let timeStr = '-';
                  if (item.timestamp?.seconds) {
                    const d = new Date(item.timestamp.seconds * 1000);
                    timeStr = `${d.toLocaleDateString('id-ID')} ${d.toLocaleTimeString('id-ID')}`;
                  } else if (item.timestamp) {
                    const d = new Date(item.timestamp);
                    timeStr = `${d.toLocaleDateString('id-ID')} ${d.toLocaleTimeString('id-ID')}`;
                  }

                  const schoolName = schools.find((s) => s.id === item.school_id)?.nama_sekolah;

                  return (
                    <tr key={item.id} className="hover:bg-slate-50/80 transition">
                      <td className="py-3.5 px-4 text-slate-500 whitespace-nowrap font-mono text-[11px]">
                        <div className="flex items-center space-x-1.5">
                          <Clock className="w-3.5 h-3.5 text-slate-400" />
                          <span>{timeStr}</span>
                        </div>
                      </td>

                      <td className="py-3.5 px-4">
                        <div className="font-bold text-slate-800">{item.actor_nama || 'System'}</div>
                        <div className="text-[10px] text-slate-400 font-mono line-clamp-1">
                          UID: {item.actor_id ? item.actor_id.substring(0, 8) + '...' : '-'}
                        </div>
                      </td>

                      <td className="py-3.5 px-4 text-slate-600">
                        {item.school_id ? (
                          <span className="font-bold text-amber-800">
                            {schoolName || item.school_id}
                          </span>
                        ) : (
                          <span className="px-2 py-0.5 rounded-full text-[10px] font-bold bg-amber-50 text-amber-800">
                            Platform Global
                          </span>
                        )}
                      </td>

                      <td className="py-3.5 px-4 font-mono font-bold text-xs text-slate-700">
                        <span className="px-2 py-0.5 rounded-lg bg-slate-100 text-slate-700 border border-slate-200">
                          {item.action || 'ACTIVITY'}
                        </span>
                      </td>

                      <td className="py-3.5 px-4 text-slate-500 uppercase text-[11px] font-bold">
                        {item.record_type || 'system'}
                      </td>
                    </tr>
                  );
                })
              )}
            </tbody>
          </table>
        </div>
      </div>

      {/* MODAL BERSIHKAN LOG (MANUAL PURGE) */}
      {purgeModalOpen && createPortal(
        <div className="fixed inset-0 z-[100] bg-slate-900/60 backdrop-blur-sm flex items-center justify-center p-4 animate-in fade-in duration-200">
          <div className="bg-white rounded-3xl max-w-md w-full p-6 shadow-2xl border border-slate-100">
            <div className="w-12 h-12 bg-rose-100 text-rose-600 rounded-2xl flex items-center justify-center mx-auto mb-3">
              <Trash2 className="w-6 h-6" />
            </div>
            <h3 className="text-base font-extrabold text-slate-800 font-brand text-center">
              Pembersihan Audit Log Usang
            </h3>
            <p className="text-xs text-slate-500 mt-1 text-center">
              Pilih batas usia dokumen yang ingin dihapus untuk menghemat kuota Firestore.
            </p>

            <div className="mt-4 space-y-2">
              {PURGE_OPTIONS.map((opt) => {
                const count = purgeCounts[opt.value] ?? '…';
                const isSelected = purgeDaysOption === opt.value;

                return (
                  <button
                    type="button"
                    key={opt.value}
                    onClick={() => setPurgeDaysOption(opt.value)}
                    className={`w-full p-3 rounded-2xl border text-left text-xs font-bold transition flex items-center justify-between ${
                      isSelected
                        ? 'border-rose-400 bg-rose-50/50 text-rose-900'
                        : 'border-slate-200 hover:bg-slate-50 text-slate-700'
                    }`}
                  >
                    <span className="flex items-center gap-2">
                      {opt.label}
                      {opt.value === 'custom' && (
                        <input
                          type="number"
                          min={1}
                          max={3650}
                          value={customDays}
                          onClick={(e) => e.stopPropagation()}
                          onChange={(e) => { setCustomDays(e.target.value); setPurgeDaysOption('custom'); }}
                          className="w-16 px-2 py-1 rounded-lg border border-slate-200 text-xs font-bold"
                        />
                      )}
                    </span>
                    <span
                      className={`px-2 py-0.5 rounded-full text-[10px] font-extrabold ${
                        isSelected ? 'bg-rose-200 text-rose-800' : 'bg-slate-100 text-slate-500'
                      }`}
                    >
                      {count} Dokumen
                    </span>
                  </button>
                );
              })}
            </div>

            <div className="flex items-center justify-center space-x-2 mt-6">
              <button
                type="button"
                onClick={() => setPurgeModalOpen(false)}
                className="px-4 py-2 text-xs font-bold text-slate-600 hover:bg-slate-100 rounded-xl transition"
              >
                Batal
              </button>
              <button
                type="button"
                onClick={handleExecutePurge}
                disabled={isPurging}
                className="px-5 py-2 text-xs font-extrabold text-white bg-rose-500 hover:bg-rose-600 rounded-xl shadow-md shadow-rose-500/20 active:scale-95 transition disabled:opacity-50"
              >
                {isPurging ? 'Menghapus...' : 'Eksekusi Pembersihan'}
              </button>
            </div>
          </div>
        </div>,
        document.body
      )}
    </div>
  );
}


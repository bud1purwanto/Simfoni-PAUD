import React, { useState, useEffect, useMemo } from 'react';
import { useNavigate } from 'react-router-dom';
import { 
  Building2, 
  Users, 
  HardDrive, 
  AlertTriangle, 
  Plus, 
  ShieldCheck, 
  ArrowRight, 
  CheckCircle2, 
  Clock, 
  School, 
  Sparkles,
  ExternalLink,
  ChevronRight,
  Database,
  Search,
  Activity,
  Layers,
  GraduationCap,
  Calendar,
  CheckSquare,
  TrendingUp,
  Filter,
  RefreshCw,
  Award,
  BookOpen
} from 'lucide-react';
import { collection, onSnapshot, query, orderBy, limit, where } from 'firebase/firestore';
import { db } from '../../config/firebase';
import { useAuth } from '../../context/AuthContext';
import { formatTanggalIndo, formatJamMenit, getLocalDateString } from '../../utils/formatters';
import { runAutoRetentionIfDue } from '../../utils/logRetention';
import { syncGuruCounters } from '../../utils/quotaSync';
import { getPlan, formatRupiah, formatKuota } from '../../utils/planConfig';
import { sisaHariLangganan, isLanggananKedaluwarsa } from '../../utils/schoolConfig';

export default function DashboardSuperadmin() {
  const { userData } = useAuth();
  const navigate = useNavigate();

  const [schools, setSchools] = useState([]);
  const [users, setUsers] = useState([]);
  const [recentLogs, setRecentLogs] = useState([]);
  const [todayAttendance, setTodayAttendance] = useState([]);
  const [plansDb, setPlansDb] = useState({});
  const [loading, setLoading] = useState(true);

  // Filter & Search State untuk Guru
  const [activeTab, setActiveTab] = useState('overview'); // 'overview' | 'guru' | 'logs'
  const [searchGuru, setSearchGuru] = useState('');
  const [filterSchoolId, setFilterSchoolId] = useState('all');
  const [filterStatusAkun, setFilterStatusAkun] = useState('all');

  const todayStr = getLocalDateString();

  useEffect(() => {
    setLoading(true);

    // 1. Ambil Semua Sekolah Mitra (Tenants)
    const unsubSchools = onSnapshot(collection(db, 'schools'), (snap) => {
      const list = snap.docs.map((d) => ({ id: d.id, ...d.data() }));
      setSchools(list);
    });

    // 2. Ambil Semua Pengguna Global (Kepsek & Guru)
    const unsubUsers = onSnapshot(collection(db, 'users'), (snap) => {
      const list = snap.docs.map((d) => ({ id: d.id, ...d.data() }));
      setUsers(list);
      setLoading(false);
    });

    // 3. Ambil Koleksi Plans (Paket Langganan)
    const unsubPlans = onSnapshot(collection(db, 'plans'), (snap) => {
      const pMap = {};
      snap.docs.forEach((d) => { pMap[d.id] = { id: d.id, ...d.data() }; });
      setPlansDb(pMap);
    }, (err) => console.warn('Gagal memuat plans:', err));

    // 4. Ambil 15 Audit Log Terbaru (Live Activity Stream)
    const qLogs = query(collection(db, 'audit_logs'), orderBy('timestamp', 'desc'), limit(15));
    const unsubLogs = onSnapshot(qLogs, (snap) => {
      setRecentLogs(snap.docs.map((d) => ({ id: d.id, ...d.data() })));
    }, (err) => console.warn('Gagal memuat audit logs:', err));

    // 5. Ambil Rekapitulasi Presensi Hari Ini Lintas Tenant
    const qAttend = query(collection(db, 'attendance'), where('tanggal', '==', todayStr));
    const unsubAttend = onSnapshot(qAttend, (snap) => {
      setTodayAttendance(snap.docs.map((d) => ({ id: d.id, ...d.data() })));
    }, (err) => console.warn('Gagal memuat presensi hari ini:', err));

    return () => {
      unsubSchools();
      unsubUsers();
      unsubPlans();
      unsubLogs();
      unsubAttend();
    };
  }, [todayStr]);

  // Selaraskan counter kuota guru (dipakai Security Rules untuk menegakkan kuota)
  useEffect(() => {
    if (!loading && schools.length > 0) syncGuruCounters(schools, users);
  }, [loading, schools, users]);

  // Periodic Retention Job audit_logs (maks. sekali per sesi, hanya jika sudah > 24 jam)
  useEffect(() => {
    if (userData?.uid) runAutoRetentionIfDue(userData);
  }, [userData?.uid]);

  // Metrik Agregat Utama
  const totalSchools = schools.length;
  const activeSchools = schools.filter((s) => s.status_langganan !== 'nonaktif' && !isLanggananKedaluwarsa(s)).length;
  const suspendedSchools = schools.length - activeSchools;
  const totalKepsek = users.filter((u) => u.role === 'kepsek').length;
  const totalGuru = users.filter((u) => u.role === 'guru').length;
  const activeGuru = users.filter((u) => u.role === 'guru' && u.status_akun === 'aktif').length;

  // Agregat Murid Nasional
  const totalMuridNasional = schools.reduce((acc, s) => acc + (s.jumlah_murid_aktif || 0), 0);

  // Estimasi Presensi Hari Ini
  const totalHadirHariIni = todayAttendance.filter((a) => a.status === 'hadir').length;
  const totalTerlambatHariIni = todayAttendance.filter((a) => a.status === 'hadir' && a.terlambat).length;

  // Estimasi Storage (Akumulasi dari field estimasi_storage_mb atau total_foto_terunggah * 0.25 MB)
  const totalStorageMb = schools.reduce((acc, s) => {
    const mb = s.estimasi_storage_mb || (s.total_foto_terunggah ? s.total_foto_terunggah * 0.25 : 0);
    return acc + mb;
  }, 0);

  // Spark Plan 5GB = 5120 MB
  const maxStorageMb = 5120;
  const storagePercentage = Math.min(100, Math.round((totalStorageMb / maxStorageMb) * 100));

  // Distribusi Paket Langganan
  const planDistribution = useMemo(() => {
    const dist = {};
    schools.forEach((s) => {
      const pId = s.paket_langganan || 'trial';
      const pName = getPlan(pId, plansDb).nama;
      dist[pName] = (dist[pName] || 0) + 1;
    });
    return dist;
  }, [schools, plansDb]);

  // Deteksi Sekolah yang Masa Langganannya Berakhir dalam 30 Hari
  const expiringSchools = schools
    .filter((s) => {
      const sisa = sisaHariLangganan(s);
      return sisa !== null && sisa <= 30;
    })
    .sort((a, b) => (a.berlaku_hingga || '').localeCompare(b.berlaku_hingga || ''));

  // Filter Data Guru se-Nasional
  const filteredGuruList = useMemo(() => {
    const q = searchGuru.toLowerCase().trim();
    return users.filter((u) => {
      if (u.role !== 'guru') return false;
      if (filterSchoolId !== 'all' && u.school_id !== filterSchoolId) return false;
      if (filterStatusAkun !== 'all' && u.status_akun !== filterStatusAkun) return false;
      if (q) {
        const matchNama = (u.nama || '').toLowerCase().includes(q);
        const matchEmail = (u.email || '').toLowerCase().includes(q);
        const matchSekolah = (u.nama_sekolah || '').toLowerCase().includes(q);
        const matchKelompok = (u.kelompok_kelas || '').toLowerCase().includes(q);
        return matchNama || matchEmail || matchSekolah || matchKelompok;
      }
      return true;
    });
  }, [users, searchGuru, filterSchoolId, filterStatusAkun]);

  return (
    <div className="space-y-6 pb-20 md:pb-6">
      {/* Header Banner Eksekutif Superadmin */}
      <div className="bg-gradient-to-r from-amber-500 via-orange-500 to-amber-600 rounded-3xl p-6 md:p-8 text-white shadow-lg shadow-orange-500/20 relative overflow-hidden">
        <div className="absolute right-0 top-0 translate-x-12 -translate-y-12 w-64 h-64 bg-white/10 rounded-full blur-3xl pointer-events-none" />
        <div className="relative z-10 flex flex-col md:flex-row md:items-center justify-between gap-4">
          <div>
            <div className="inline-flex items-center space-x-2 px-3 py-1 bg-white/20 backdrop-blur-md rounded-full text-xs font-bold text-amber-100 mb-3">
              <ShieldCheck className="w-3.5 h-3.5" />
              <span>Pusat Kendali Eksekutif SaaS Multi-Tenant (Overkill Mode)</span>
            </div>
            <h1 className="text-2xl md:text-3xl font-extrabold font-brand tracking-tight">
              Selamat Datang, {userData?.nama || 'Superadmin'}! 👑
            </h1>
            <p className="text-amber-100 text-sm mt-1 max-w-2xl font-medium">
              Pantau seluruh aktivitas live platform, master data guru & murid nasional, rekapitulasi kehadiran serentak, serta utilisasi kuota cloud.
            </p>
          </div>

          <div className="flex flex-wrap items-center gap-2">
            <button
              onClick={() => navigate('/superadmin/paket')}
              className="px-3.5 py-2.5 bg-white/20 hover:bg-white/30 backdrop-blur-md text-white font-extrabold text-xs rounded-2xl shadow-sm transition flex items-center space-x-1.5 font-brand"
            >
              <Sparkles className="w-4 h-4 text-amber-200" />
              <span>Kelola Paket</span>
            </button>
            <button
              onClick={() => navigate('/superadmin/sekolah')}
              className="px-4 py-2.5 bg-white text-orange-600 hover:bg-orange-50 active:scale-95 font-extrabold text-xs rounded-2xl shadow-sm transition flex items-center space-x-2 font-brand"
            >
              <Plus className="w-4 h-4 stroke-[3]" />
              <span>Tambah Sekolah</span>
            </button>
          </div>
        </div>
      </div>

      {/* METRIK GLOBAL SAAS (6 KARTU STATISTIK EKSEKUTIF) */}
      <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-6 gap-3 md:gap-4">
        {/* Total Sekolah Mitra */}
        <div className="bg-white rounded-3xl p-4 border border-slate-200/80 shadow-xs flex flex-col justify-between">
          <div className="w-10 h-10 rounded-2xl bg-amber-100 text-amber-700 flex items-center justify-center font-bold mb-2">
            <School className="w-5 h-5" />
          </div>
          <div>
            <div className="text-2xl font-black text-slate-800 font-brand">
              {totalSchools}
            </div>
            <div className="text-[11px] text-slate-500 font-bold">
              Sekolah ({activeSchools} Aktif)
            </div>
          </div>
        </div>

        {/* Total Guru Terdaftar */}
        <div className="bg-white rounded-3xl p-4 border border-slate-200/80 shadow-xs flex flex-col justify-between">
          <div className="w-10 h-10 rounded-2xl bg-emerald-100 text-emerald-700 flex items-center justify-center font-bold mb-2">
            <Users className="w-5 h-5" />
          </div>
          <div>
            <div className="text-2xl font-black text-slate-800 font-brand">
              {totalGuru}
            </div>
            <div className="text-[11px] text-slate-500 font-bold">
              Guru ({activeGuru} Aktif)
            </div>
          </div>
        </div>

        {/* Total Kepala Sekolah */}
        <div className="bg-white rounded-3xl p-4 border border-slate-200/80 shadow-xs flex flex-col justify-between">
          <div className="w-10 h-10 rounded-2xl bg-blue-100 text-blue-700 flex items-center justify-center font-bold mb-2">
            <Building2 className="w-5 h-5" />
          </div>
          <div>
            <div className="text-2xl font-black text-slate-800 font-brand">
              {totalKepsek}
            </div>
            <div className="text-[11px] text-slate-500 font-bold">
              Kepala Sekolah
            </div>
          </div>
        </div>

        {/* Total Murid Aktif Se-Nasional */}
        <div className="bg-white rounded-3xl p-4 border border-slate-200/80 shadow-xs flex flex-col justify-between">
          <div className="w-10 h-10 rounded-2xl bg-orange-100 text-orange-700 flex items-center justify-center font-bold mb-2">
            <GraduationCap className="w-5 h-5" />
          </div>
          <div>
            <div className="text-2xl font-black text-slate-800 font-brand">
              {totalMuridNasional}
            </div>
            <div className="text-[11px] text-slate-500 font-bold">
              Murid Aktif Terdaftar
            </div>
          </div>
        </div>

        {/* Presensi Guru Hari Ini */}
        <div className="bg-white rounded-3xl p-4 border border-slate-200/80 shadow-xs flex flex-col justify-between">
          <div className="w-10 h-10 rounded-2xl bg-teal-100 text-teal-700 flex items-center justify-center font-bold mb-2">
            <CheckSquare className="w-5 h-5" />
          </div>
          <div>
            <div className="text-2xl font-black text-slate-800 font-brand">
              {totalHadirHariIni} <span className="text-xs font-semibold text-teal-600">({totalTerlambatHariIni} t/l)</span>
            </div>
            <div className="text-[11px] text-slate-500 font-bold">
              Absen Hadir Hari Ini
            </div>
          </div>
        </div>

        {/* Estimasi Storage Cloud */}
        <div className="bg-white rounded-3xl p-4 border border-slate-200/80 shadow-xs flex flex-col justify-between">
          <div className="w-10 h-10 rounded-2xl bg-purple-100 text-purple-700 flex items-center justify-center font-bold mb-2">
            <HardDrive className="w-5 h-5" />
          </div>
          <div>
            <div className="text-2xl font-black text-slate-800 font-brand">
              {totalStorageMb.toFixed(1)} <span className="text-[10px] font-bold text-slate-400">MB</span>
            </div>
            <div className="text-[11px] text-slate-500 font-bold">
              Storage Spark ({storagePercentage}%)
            </div>
          </div>
        </div>
      </div>

      {/* STORAGE & SEBARAN PAKET SAAS */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        {/* Storage Bar (2 Kolom) */}
        <div className="md:col-span-2 bg-white rounded-3xl p-5 border border-slate-200/80 shadow-xs flex flex-col justify-between">
          <div>
            <div className="flex items-center justify-between mb-2">
              <div className="flex items-center space-x-2">
                <HardDrive className="w-4 h-4 text-orange-500" />
                <h3 className="text-xs font-extrabold text-slate-700 uppercase tracking-wider">
                  Firebase Cloud Storage Tracker (Spark Limit 5.0 GB)
                </h3>
              </div>
              <span className="text-xs font-bold text-slate-500">
                {totalStorageMb.toFixed(1)} MB / 5,120 MB ({storagePercentage}%)
              </span>
            </div>
            <div className="w-full bg-slate-100 rounded-full h-3 overflow-hidden">
              <div
                className={`h-full rounded-full transition-all duration-500 ${
                  storagePercentage > 85
                    ? 'bg-rose-500'
                    : storagePercentage > 60
                    ? 'bg-amber-500'
                    : 'bg-gradient-to-r from-amber-500 to-orange-500'
                }`}
                style={{ width: `${Math.max(2, storagePercentage)}%` }}
              />
            </div>
          </div>
          <div className="mt-3 flex items-center justify-between text-[11px] text-slate-400 font-medium">
            <span>💡 Kompresi foto otomatis di HP guru menjamin kapasitas tampung s.d 15.000+ dokumentasi KBM.</span>
            <span className="font-bold text-slate-600">{activeSchools} Tenant Online</span>
          </div>
        </div>

        {/* Distribusi Paket Langganan (1 Kolom) */}
        <div className="bg-white rounded-3xl p-5 border border-slate-200/80 shadow-xs">
          <div className="flex items-center space-x-2 mb-3">
            <Sparkles className="w-4 h-4 text-amber-500" />
            <h3 className="text-xs font-extrabold text-slate-700 uppercase tracking-wider">
              Distribusi Paket Tenant
            </h3>
          </div>
          <div className="space-y-2">
            {Object.keys(planDistribution).length === 0 ? (
              <p className="text-xs text-slate-400">Belum ada data paket.</p>
            ) : (
              Object.entries(planDistribution).map(([pName, count]) => (
                <div key={pName} className="flex items-center justify-between text-xs">
                  <span className="font-bold text-slate-700">{pName}</span>
                  <span className="px-2.5 py-0.5 rounded-full font-extrabold bg-amber-50 text-amber-800 border border-amber-200/60 text-[11px]">
                    {count} Sekolah
                  </span>
                </div>
              ))
            )}
          </div>
        </div>
      </div>

      {/* PERINGATAN LANGGANAN JATUH TEMPO */}
      {expiringSchools.length > 0 && (
        <div className="bg-amber-50 rounded-3xl p-5 border border-amber-200/80 shadow-xs">
          <div className="flex items-center space-x-2.5 text-amber-900 font-extrabold text-sm mb-3 font-brand">
            <AlertTriangle className="w-5 h-5 text-amber-600 shrink-0" />
            <span>Pemberitahuan Langganan Sekolah Mendekati Jatuh Tempo ({expiringSchools.length})</span>
          </div>
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-3">
            {expiringSchools.map((s) => (
              <div
                key={s.id}
                className="bg-white p-3.5 rounded-2xl border border-amber-200/60 shadow-xs flex items-center justify-between text-xs"
              >
                <div>
                  <div className="font-bold text-slate-800 line-clamp-1">{s.nama_sekolah}</div>
                  <div className="text-[11px] text-amber-700 font-semibold mt-0.5">
                    Berakhir: {s.berlaku_hingga ? formatTanggalIndo(s.berlaku_hingga) : 'Segera'}
                  </div>
                </div>
                <button
                  onClick={() => navigate('/superadmin/sekolah')}
                  className="px-2.5 py-1 bg-amber-100 hover:bg-amber-200 text-amber-900 font-bold rounded-lg transition text-[11px]"
                >
                  Kelola
                </button>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* TABS KONTROL EKSEKUTIF (OVERKILL NAVIGATION) */}
      <div className="flex items-center space-x-2 border-b border-slate-200 pb-2 overflow-x-auto scrollbar-thin">
        <button
          type="button"
          onClick={() => setActiveTab('overview')}
          className={`px-4 py-2.5 rounded-2xl text-xs font-extrabold transition flex items-center space-x-2 shrink-0 ${
            activeTab === 'overview'
              ? 'bg-slate-900 text-white shadow-md shadow-slate-900/20'
              : 'bg-white text-slate-600 hover:bg-slate-100 border border-slate-200'
          }`}
        >
          <School className="w-4 h-4" />
          <span>Tenant & Presensi Hari Ini</span>
        </button>

        <button
          type="button"
          onClick={() => setActiveTab('guru')}
          className={`px-4 py-2.5 rounded-2xl text-xs font-extrabold transition flex items-center space-x-2 shrink-0 ${
            activeTab === 'guru'
              ? 'bg-slate-900 text-white shadow-md shadow-slate-900/20'
              : 'bg-white text-slate-600 hover:bg-slate-100 border border-slate-200'
          }`}
        >
          <Users className="w-4 h-4" />
          <span>Direktori Master Data Guru ({totalGuru})</span>
        </button>

        <button
          type="button"
          onClick={() => setActiveTab('logs')}
          className={`px-4 py-2.5 rounded-2xl text-xs font-extrabold transition flex items-center space-x-2 shrink-0 ${
            activeTab === 'logs'
              ? 'bg-slate-900 text-white shadow-md shadow-slate-900/20'
              : 'bg-white text-slate-600 hover:bg-slate-100 border border-slate-200'
          }`}
        >
          <Activity className="w-4 h-4" />
          <span>Live Activity Feed ({recentLogs.length})</span>
        </button>
      </div>

      {/* TAB 1: OVERVIEW TENANT & REKAPITULASI PRESENSI */}
      {activeTab === 'overview' && (
        <div className="space-y-6">
          {/* DAFTAR TENANT SEKOLAH MITRA AKTIF */}
          <div className="bg-white rounded-3xl border border-slate-200/80 shadow-xs overflow-hidden">
            <div className="p-5 border-b border-slate-100 flex items-center justify-between">
              <div className="flex items-center space-x-2">
                <School className="w-5 h-5 text-orange-500" />
                <h3 className="font-extrabold text-slate-800 text-base font-brand">
                  Daftar Sekolah Mitra Terdaftar ({schools.length})
                </h3>
              </div>
              <button
                onClick={() => navigate('/superadmin/sekolah')}
                className="text-xs font-bold text-orange-600 hover:text-orange-700 flex items-center space-x-1"
              >
                <span>Kelola Sekolah</span>
                <ChevronRight className="w-4 h-4" />
              </button>
            </div>

            <div className="overflow-x-auto">
              <table className="w-full text-left text-xs">
                <thead className="bg-slate-50 text-slate-500 font-bold uppercase tracking-wider border-b border-slate-100">
                  <tr>
                    <th className="py-3 px-4">Nama Sekolah</th>
                    <th className="py-3 px-4">Kota</th>
                    <th className="py-3 px-4 text-center">Paket</th>
                    <th className="py-3 px-4 text-center">Kuota Guru</th>
                    <th className="py-3 px-4 text-center">Kuota Murid</th>
                    <th className="py-3 px-4 text-center">Status</th>
                    <th className="py-3 px-4 text-center">Masa Berlaku</th>
                    <th className="py-3 px-4 text-right">Aksi</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100 font-medium">
                  {loading ? (
                    <tr>
                      <td colSpan={8} className="py-8 text-center text-slate-400">
                        Memuat data sekolah mitra...
                      </td>
                    </tr>
                  ) : schools.length === 0 ? (
                    <tr>
                      <td colSpan={8} className="py-8 text-center text-slate-400">
                        Belum ada sekolah mitra terdaftar.
                      </td>
                    </tr>
                  ) : (
                    schools.slice(0, 8).map((s) => {
                      const teachersInSchool = users.filter(
                        (u) => u.school_id === s.id && u.role === 'guru' && u.status_akun === 'aktif'
                      );
                      const isSuspended = s.status_langganan === 'nonaktif';
                      const planInfo = getPlan(s.paket_langganan, plansDb);

                      return (
                        <tr key={s.id} className="hover:bg-slate-50/80 transition">
                          <td className="py-3.5 px-4 font-bold text-slate-800">
                            <div className="flex items-center space-x-2.5">
                              {s.logo_url ? (
                                <img
                                  src={s.logo_url}
                                  alt="Logo"
                                  className="w-7 h-7 rounded-lg object-contain border border-slate-200"
                                />
                              ) : (
                                <div className="w-7 h-7 rounded-lg bg-amber-100 text-amber-700 flex items-center justify-center font-bold text-xs">
                                  {s.nama_sekolah?.charAt(0) || 'S'}
                                </div>
                              )}
                              <div>
                                <div>{s.nama_sekolah}</div>
                                <div className="text-[10px] text-slate-400 font-normal">
                                  NPSN: {s.npsn || '-'}
                                </div>
                              </div>
                            </div>
                          </td>
                          <td className="py-3.5 px-4 text-slate-600">
                            {s.kota || '-'}
                          </td>
                          <td className="py-3.5 px-4 text-center">
                            <span className="px-2 py-0.5 rounded-full text-[10px] font-extrabold uppercase bg-amber-50 text-amber-700 border border-amber-200/60">
                              {planInfo.nama}
                            </span>
                          </td>
                          <td className="py-3.5 px-4 text-center font-bold text-slate-700">
                            {teachersInSchool.length} / {s.kuota_guru || 5}
                          </td>
                          <td className="py-3.5 px-4 text-center font-bold text-slate-700">
                            {s.jumlah_murid_aktif ?? 0} / {formatKuota(s.kuota_murid !== undefined ? s.kuota_murid : planInfo.kuota_murid)}
                          </td>
                          <td className="py-3.5 px-4 text-center">
                            <span
                              className={`px-2 py-0.5 rounded-full text-[10px] font-extrabold ${
                                isSuspended
                                  ? 'bg-rose-100 text-rose-800'
                                  : 'bg-emerald-100 text-emerald-800'
                              }`}
                            >
                              {isSuspended ? 'NONAKTIF' : 'AKTIF'}
                            </span>
                          </td>
                          <td className="py-3.5 px-4 text-center text-slate-600">
                            {s.berlaku_hingga ? formatTanggalIndo(s.berlaku_hingga) : '-'}
                          </td>
                          <td className="py-3.5 px-4 text-right">
                            <button
                              onClick={() => navigate('/superadmin/sekolah')}
                              className="px-3 py-1 bg-slate-100 hover:bg-orange-100 hover:text-orange-700 font-bold rounded-xl transition text-[11px]"
                            >
                              Kelola
                            </button>
                          </td>
                        </tr>
                      );
                    })
                  )}
                </tbody>
              </table>
            </div>
          </div>
        </div>
      )}

      {/* TAB 2: DIREKTORI MASTER DATA GURU SE-NASIONAL */}
      {activeTab === 'guru' && (
        <div className="bg-white rounded-3xl border border-slate-200/80 shadow-xs overflow-hidden p-5 space-y-4">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
            <div>
              <h3 className="font-extrabold text-slate-800 text-base font-brand flex items-center space-x-2">
                <Users className="w-5 h-5 text-emerald-600" />
                <span>Direktori Master Data Guru PAUD ({filteredGuruList.length} Ditemukan)</span>
              </h3>
              <p className="text-xs text-slate-500 font-medium">
                Pencarian dan monitoring seluruh akun tenaga pendidik dari seluruh sekolah mitra.
              </p>
            </div>

            {/* Bilah Pencarian Cepat */}
            <div className="relative w-full sm:w-72">
              <Search className="w-4 h-4 text-slate-400 absolute left-3.5 top-1/2 -translate-y-1/2" />
              <input
                type="text"
                placeholder="Cari guru, email, sekolah..."
                value={searchGuru}
                onChange={(e) => setSearchGuru(e.target.value)}
                className="w-full pl-9 pr-4 py-2 rounded-2xl border border-slate-200 text-xs font-semibold focus:outline-none focus:ring-2 focus:ring-orange-500/20 focus:border-orange-500 transition"
              />
            </div>
          </div>

          {/* Filter Bar */}
          <div className="flex flex-wrap items-center gap-2 pt-2 border-t border-slate-100 text-xs">
            <span className="font-bold text-slate-500 text-[11px]">Filter Sekolah:</span>
            <select
              value={filterSchoolId}
              onChange={(e) => setFilterSchoolId(e.target.value)}
              className="px-3 py-1.5 rounded-xl border border-slate-200 text-xs font-bold text-slate-700 focus:outline-none"
            >
              <option value="all">Semua Sekolah ({schools.length})</option>
              {schools.map((s) => (
                <option key={s.id} value={s.id}>{s.nama_sekolah}</option>
              ))}
            </select>

            <span className="font-bold text-slate-500 text-[11px] ml-2">Status:</span>
            <select
              value={filterStatusAkun}
              onChange={(e) => setFilterStatusAkun(e.target.value)}
              className="px-3 py-1.5 rounded-xl border border-slate-200 text-xs font-bold text-slate-700 focus:outline-none"
            >
              <option value="all">Semua Status</option>
              <option value="aktif">Hanya Aktif</option>
              <option value="nonaktif">Nonaktif</option>
            </select>
          </div>

          {/* Tabel Master Guru */}
          <div className="overflow-x-auto border border-slate-100 rounded-2xl">
            <table className="w-full text-left text-xs">
              <thead className="bg-slate-50 text-slate-500 font-bold uppercase tracking-wider border-b border-slate-100">
                <tr>
                  <th className="py-3 px-4">Nama Lengkap Guru</th>
                  <th className="py-3 px-4">Email Login</th>
                  <th className="py-3 px-4">Asal Sekolah</th>
                  <th className="py-3 px-4 text-center">Kelompok</th>
                  <th className="py-3 px-4 text-center">Status Akun</th>
                  <th className="py-3 px-4 text-center">Wajib Ganti Sandi</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100 font-medium">
                {filteredGuruList.length === 0 ? (
                  <tr>
                    <td colSpan={6} className="py-8 text-center text-slate-400">
                      Tidak ada data guru yang cocok dengan kriteria pencarian.
                    </td>
                  </tr>
                ) : (
                  filteredGuruList.map((g) => {
                    const isAktif = g.status_akun === 'aktif';
                    return (
                      <tr key={g.id} className="hover:bg-slate-50/80 transition">
                        <td className="py-3 px-4 font-bold text-slate-800">
                          <div className="flex items-center space-x-2">
                            <div className="w-7 h-7 rounded-lg bg-emerald-100 text-emerald-800 flex items-center justify-center font-bold text-xs">
                              {g.nama?.charAt(0) || 'G'}
                            </div>
                            <span>{g.nama || '-'}</span>
                          </div>
                        </td>
                        <td className="py-3 px-4 text-slate-600 font-mono text-[11px]">
                          {g.email}
                        </td>
                        <td className="py-3 px-4 text-slate-700 font-semibold">
                          {g.nama_sekolah || '-'}
                        </td>
                        <td className="py-3 px-4 text-center">
                          <span className="px-2 py-0.5 rounded-full text-[10px] font-bold bg-slate-100 text-slate-600">
                            {g.kelompok_kelas || 'Umum'}
                          </span>
                        </td>
                        <td className="py-3 px-4 text-center">
                          <span
                            className={`px-2 py-0.5 rounded-full text-[10px] font-extrabold ${
                              isAktif
                                ? 'bg-emerald-100 text-emerald-800'
                                : 'bg-rose-100 text-rose-800'
                            }`}
                          >
                            {isAktif ? 'AKTIF' : 'NONAKTIF'}
                          </span>
                        </td>
                        <td className="py-3 px-4 text-center">
                          {g.wajib_ganti_password ? (
                            <span className="px-2 py-0.5 rounded-full text-[10px] font-bold bg-amber-100 text-amber-800">
                              Ya (Default)
                            </span>
                          ) : (
                            <span className="text-slate-400 text-[11px]">-</span>
                          )}
                        </td>
                      </tr>
                    );
                  })
                )}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* TAB 3: LIVE ACTIVITY STREAM (AUDIT FEED REALTIME) */}
      {activeTab === 'logs' && (
        <div className="bg-white rounded-3xl border border-slate-200/80 shadow-xs p-5 space-y-4">
          <div className="flex items-center justify-between">
            <div className="flex items-center space-x-2">
              <Activity className="w-5 h-5 text-orange-500" />
              <h3 className="font-extrabold text-slate-800 text-base font-brand">
                Live Audit Trail & Stream Aktivitas Realtime
              </h3>
            </div>
            <button
              onClick={() => navigate('/superadmin/logs')}
              className="text-xs font-bold text-orange-600 hover:text-orange-700 flex items-center space-x-1"
            >
              <span>Manajemen Log Lengkap</span>
              <ChevronRight className="w-4 h-4" />
            </button>
          </div>

          <div className="divide-y divide-slate-100">
            {recentLogs.length === 0 ? (
              <p className="text-xs text-slate-400 py-6 text-center">
                Belum ada rekaman audit log aktivitas.
              </p>
            ) : (
              recentLogs.map((log) => {
                const dateStr = log.timestamp?.toDate
                  ? formatTanggalIndo(log.timestamp.toDate()) + ' ' + formatJamMenit(log.timestamp.toDate())
                  : 'Baru saja';
                return (
                  <div key={log.id} className="py-3 flex items-start justify-between gap-3 text-xs">
                    <div className="flex items-start space-x-3">
                      <div className="w-8 h-8 rounded-xl bg-orange-50 text-orange-600 flex items-center justify-center font-bold shrink-0 mt-0.5">
                        ⚡
                      </div>
                      <div>
                        <div className="font-bold text-slate-800">
                          {log.actorNama || 'Pengguna'} <span className="font-normal text-slate-400">•</span> <span className="font-semibold text-orange-600">{log.action || 'ACTIVITY'}</span>
                        </div>
                        <div className="text-[11px] text-slate-500 mt-0.5">
                          Tipe: <span className="font-mono">{log.recordType || 'system'}</span> {log.detail ? `(${JSON.stringify(log.detail)})` : ''}
                        </div>
                      </div>
                    </div>
                    <span className="text-[10px] text-slate-400 font-medium shrink-0">
                      {dateStr}
                    </span>
                  </div>
                );
              })
            )}
          </div>
        </div>
      )}
    </div>
  );
}

import React, { useState, useEffect } from 'react';
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
  Database
} from 'lucide-react';
import { collection, onSnapshot, query } from 'firebase/firestore';
import { db } from '../../config/firebase';
import { useAuth } from '../../context/AuthContext';
import { formatTanggalIndo } from '../../utils/formatters';

export default function DashboardSuperadmin() {
  const { userData } = useAuth();
  const navigate = useNavigate();

  const [schools, setSchools] = useState([]);
  const [users, setUsers] = useState([]);
  const [loading, setLoading] = useState(true);

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

    return () => {
      unsubSchools();
      unsubUsers();
    };
  }, []);

  // Metrik Agregat
  const totalSchools = schools.length;
  const activeSchools = schools.filter((s) => s.status_langganan === 'aktif').length;
  const suspendedSchools = schools.filter((s) => s.status_langganan === 'nonaktif').length;
  const totalKepsek = users.filter((u) => u.role === 'kepsek').length;
  const totalGuru = users.filter((u) => u.role === 'guru').length;

  // Estimasi Storage (Akumulasi dari field estimasi_storage_mb atau total_foto_terunggah * 0.25 MB)
  const totalStorageMb = schools.reduce((acc, s) => {
    const mb = s.estimasi_storage_mb || (s.total_foto_terunggah ? s.total_foto_terunggah * 0.25 : 0);
    return acc + mb;
  }, 0);

  // Spark Plan 5GB = 5120 MB
  const maxStorageMb = 5120;
  const storagePercentage = Math.min(100, Math.round((totalStorageMb / maxStorageMb) * 100));

  // Deteksi Sekolah yang Masa Langganannya Berakhir dalam 30 Hari atau Sudah Berakhir
  const now = new Date();
  const thirtyDaysLater = new Date(now.getTime() + 30 * 24 * 60 * 60 * 1000);

  const expiringSchools = schools.filter((s) => {
    if (!s.berlaku_hingga) return false;
    const expiryDate = new Date(s.berlaku_hingga);
    return expiryDate <= thirtyDaysLater;
  });

  return (
    <div className="space-y-6 pb-20 md:pb-6">
      {/* Header Banner Eksekutif Superadmin */}
      <div className="bg-gradient-to-r from-purple-800 via-indigo-800 to-purple-900 rounded-3xl p-6 md:p-8 text-white shadow-xl shadow-purple-900/20 relative overflow-hidden">
        <div className="absolute right-0 top-0 translate-x-12 -translate-y-12 w-64 h-64 bg-white/10 rounded-full blur-3xl pointer-events-none" />
        <div className="relative z-10 flex flex-col md:flex-row md:items-center justify-between gap-4">
          <div>
            <div className="inline-flex items-center space-x-2 px-3 py-1 bg-white/20 backdrop-blur-md rounded-full text-xs font-bold text-purple-200 mb-3">
              <ShieldCheck className="w-3.5 h-3.5" />
              <span>Pusat Kendali Eksekutif SaaS Multi-Tenant</span>
            </div>
            <h1 className="text-2xl md:text-3xl font-extrabold font-brand tracking-tight">
              Selamat Datang, {userData?.nama || 'Superadmin'}!
            </h1>
            <p className="text-purple-200 text-sm mt-1 max-w-xl font-medium">
              Pantau seluruh operasional tenant PAUD mitra, alokasi kuota akun guru, dan utilisasi kapasitas penyimpanan cloud.
            </p>
          </div>

          <div className="flex items-center space-x-2">
            <button
              onClick={() => navigate('/superadmin/sekolah')}
              className="px-4 py-2.5 bg-white text-purple-900 hover:bg-purple-50 active:scale-95 font-extrabold text-xs rounded-2xl shadow-sm transition flex items-center space-x-2 font-brand"
            >
              <Plus className="w-4 h-4 stroke-[3]" />
              <span>Tambah Sekolah Baru</span>
            </button>
          </div>
        </div>
      </div>

      {/* METRIK GLOBAL SAAS */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-3 md:gap-4">
        {/* Total Sekolah Mitra */}
        <div className="bg-white rounded-3xl p-5 border border-slate-200/80 shadow-sm flex items-center space-x-3.5">
          <div className="w-12 h-12 rounded-2xl bg-purple-100 text-purple-700 flex items-center justify-center font-bold flex-shrink-0">
            <School className="w-6 h-6" />
          </div>
          <div>
            <div className="text-2xl font-black text-slate-800 font-brand">
              {totalSchools}
            </div>
            <div className="text-xs text-slate-500 font-bold">
              Sekolah Mitra ({activeSchools} Aktif)
            </div>
          </div>
        </div>

        {/* Total Guru Aktif */}
        <div className="bg-white rounded-3xl p-5 border border-slate-200/80 shadow-sm flex items-center space-x-3.5">
          <div className="w-12 h-12 rounded-2xl bg-emerald-100 text-emerald-700 flex items-center justify-center font-bold flex-shrink-0">
            <Users className="w-6 h-6" />
          </div>
          <div>
            <div className="text-2xl font-black text-slate-800 font-brand">
              {totalGuru}
            </div>
            <div className="text-xs text-slate-500 font-bold">
              Guru PAUD Terdaftar
            </div>
          </div>
        </div>

        {/* Total Kepala Sekolah */}
        <div className="bg-white rounded-3xl p-5 border border-slate-200/80 shadow-sm flex items-center space-x-3.5">
          <div className="w-12 h-12 rounded-2xl bg-blue-100 text-blue-700 flex items-center justify-center font-bold flex-shrink-0">
            <Building2 className="w-6 h-6" />
          </div>
          <div>
            <div className="text-2xl font-black text-slate-800 font-brand">
              {totalKepsek}
            </div>
            <div className="text-xs text-slate-500 font-bold">
              Kepala Sekolah (Admin)
            </div>
          </div>
        </div>

        {/* Estimasi Storage Cloud */}
        <div className="bg-white rounded-3xl p-5 border border-slate-200/80 shadow-sm flex items-center space-x-3.5">
          <div className="w-12 h-12 rounded-2xl bg-amber-100 text-amber-700 flex items-center justify-center font-bold flex-shrink-0">
            <HardDrive className="w-6 h-6" />
          </div>
          <div className="flex-1">
            <div className="text-2xl font-black text-slate-800 font-brand">
              {totalStorageMb.toFixed(1)} <span className="text-xs font-bold text-slate-400">MB</span>
            </div>
            <div className="text-xs text-slate-500 font-bold">
              Storage Spark ({storagePercentage}%)
            </div>
          </div>
        </div>
      </div>

      {/* STORAGE METER PROGRESS BAR */}
      <div className="bg-white rounded-3xl p-5 border border-slate-200/80 shadow-sm">
        <div className="flex items-center justify-between mb-2">
          <div className="flex items-center space-x-2">
            <HardDrive className="w-4 h-4 text-purple-600" />
            <h3 className="text-xs font-extrabold text-slate-700 uppercase tracking-wider">
              Firebase Storage Quota Tracker (Batas Spark 5.0 GB)
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
                : 'bg-gradient-to-r from-purple-500 to-indigo-600'
            }`}
            style={{ width: `${Math.max(2, storagePercentage)}%` }}
          />
        </div>
        <p className="text-[11px] text-slate-400 font-medium mt-2">
          💡 Kompresi foto otomatis di perangkat guru (&lt; 300 KB) memastikan kapasitas penyimpanan gratis Firebase dapat menampung hingga 15.000+ dokumentasi kegiatan KBM.
        </p>
      </div>

      {/* PERINGATAN LANGGANAN KEDALUWARSA / SUSPEND */}
      {expiringSchools.length > 0 && (
        <div className="bg-amber-50 rounded-3xl p-5 border border-amber-200/80 shadow-sm">
          <div className="flex items-center space-x-2.5 text-amber-900 font-extrabold text-sm mb-3 font-brand">
            <AlertTriangle className="w-5 h-5 text-amber-600 flex-shrink-0" />
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

      {/* DAFTAR TENANT SEKOLAH MITRA AKTIF */}
      <div className="bg-white rounded-3xl border border-slate-200/80 shadow-sm overflow-hidden">
        <div className="p-5 border-b border-slate-100 flex items-center justify-between">
          <div className="flex items-center space-x-2">
            <School className="w-5 h-5 text-purple-600" />
            <h3 className="font-extrabold text-slate-800 text-base font-brand">
              Daftar Sekolah Mitra Terdaftar
            </h3>
          </div>
          <button
            onClick={() => navigate('/superadmin/sekolah')}
            className="text-xs font-bold text-purple-600 hover:text-purple-700 flex items-center space-x-1"
          >
            <span>Lihat Semua</span>
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
                <th className="py-3 px-4 text-center">Status</th>
                <th className="py-3 px-4 text-center">Masa Berlaku</th>
                <th className="py-3 px-4 text-right">Aksi</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100 font-medium">
              {loading ? (
                <tr>
                  <td colSpan={7} className="py-8 text-center text-slate-400">
                    Memuat data sekolah mitra...
                  </td>
                </tr>
              ) : schools.length === 0 ? (
                <tr>
                  <td colSpan={7} className="py-8 text-center text-slate-400">
                    Belum ada sekolah mitra terdaftar.
                  </td>
                </tr>
              ) : (
                schools.slice(0, 5).map((s) => {
                  const teachersInSchool = users.filter(
                    (u) => u.school_id === s.id && u.role === 'guru' && u.status_akun === 'aktif'
                  );
                  const isSuspended = s.status_langganan === 'nonaktif';

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
                            <div className="w-7 h-7 rounded-lg bg-purple-100 text-purple-700 flex items-center justify-center font-bold text-xs">
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
                        <span className="px-2 py-0.5 rounded-full text-[10px] font-extrabold uppercase bg-indigo-50 text-indigo-700 border border-indigo-200/60">
                          {s.paket_langganan || 'trial'}
                        </span>
                      </td>
                      <td className="py-3.5 px-4 text-center font-bold text-slate-700">
                        {teachersInSchool.length} / {s.kuota_guru || 5}
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
                          className="px-3 py-1 bg-slate-100 hover:bg-purple-100 hover:text-purple-700 font-bold rounded-xl transition text-[11px]"
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
  );
}


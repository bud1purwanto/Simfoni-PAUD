import React, { useState } from 'react';
import { NavLink, Outlet, useNavigate } from 'react-router-dom';
import {
  Home,
  Clock,
  BookOpen,
  Calendar,
  AlertTriangle,
  Users,
  CheckSquare,
  FileText,
  School,
  ShieldAlert,
  LogOut,
  Building2,
  Menu,
  X,
  User,
  ShieldCheck,
  GraduationCap,
  Sparkles,
  KeyRound,
  History
} from 'lucide-react';
import { useAuth } from '../../context/AuthContext';
import NetworkStatusBanner from './NetworkStatusBanner';
import DevBadge from './DevBadge';
import ModalGantiPassword from '../ui/ModalGantiPassword';
import ModalKonfirmasi from '../ui/ModalKonfirmasi';
import { sisaHariLangganan } from '../../utils/schoolConfig';
import { formatTanggalIndo } from '../../utils/formatters';

export default function AppLayout() {
  const { userData, schoolData, logout, needsPasswordChange } = useAuth();
  const navigate = useNavigate();
  const [passwordModalOpen, setPasswordModalOpen] = useState(false);
  const [logoutModalOpen, setLogoutModalOpen] = useState(false);
  const [loggingOut, setLoggingOut] = useState(false);

  const role = userData?.role || 'guru';

  const handleLogoutClick = () => {
    setLogoutModalOpen(true);
  };

  const handleConfirmLogout = async () => {
    setLoggingOut(true);
    try {
      await logout();
      setLogoutModalOpen(false);
      navigate('/login');
    } catch (err) {
      console.error('Logout error:', err);
      setLoggingOut(false);
    }
  };

  // Navigasi Khusus Superadmin
  const superadminNavItems = [
    { label: 'Dashboard', path: '/superadmin/dashboard', icon: Home },
    { label: 'Sekolah Mitra', path: '/superadmin/sekolah', icon: School },
    { label: 'Akun Kepsek', path: '/superadmin/kepsek', icon: Users },
    { label: 'Audit Log & Retensi', path: '/superadmin/logs', icon: ShieldAlert },
  ];

  // Navigasi Khusus Kepala Sekolah
  const kepsekNavItems = [
    { label: 'Dashboard', path: '/kepsek/dashboard', icon: Home },
    { label: 'Kelola Guru', path: '/kepsek/guru', icon: Users },
    { label: 'Validasi KBM', path: '/kepsek/validasi', icon: CheckSquare },
    { label: 'Jadwal Sekolah', path: '/kepsek/jadwal', icon: Calendar },
    { label: 'Rekap & PDF/Excel', path: '/kepsek/rekap', icon: FileText },
    // Menu ke-6 hanya tampil di sidebar desktop; di HP diakses dari kartu Dashboard
    { label: 'Riwayat Aktivitas', path: '/kepsek/riwayat', icon: History, desktopOnly: true },
  ];

  // Navigasi Khusus Guru PAUD
  const guruNavItems = [
    { label: 'Beranda', path: '/guru/dashboard', icon: Home },
    { label: 'Presensi', path: '/guru/presensi', icon: Clock },
    { label: 'Jurnal KBM', path: '/guru/jurnal', icon: BookOpen },
    { label: 'Jadwal', path: '/guru/jadwal', icon: Calendar },
    { label: 'Tugas & Kendala', path: '/guru/laporan', icon: AlertTriangle },
  ];

  let currentNavItems = guruNavItems;
  if (role === 'superadmin') currentNavItems = superadminNavItems;
  if (role === 'kepsek') currentNavItems = kepsekNavItems;

  // Nama Sekolah & Branding Dinamis
  const dynamicSchoolName = role === 'superadmin' 
    ? 'SIMFONI PAUD SaaS Master'
    : (schoolData?.nama_sekolah || userData?.nama_sekolah || 'SIMFONI PAUD');

  // Pengingat masa langganan (trial / masa tenggang / segera berakhir)
  const sisaHari = role === 'superadmin' ? null : sisaHariLangganan(schoolData);
  const isTrial = schoolData?.paket_langganan === 'trial';
  const isMasaTenggang = schoolData?.status_langganan === 'masa_tenggang';
  const showLanggananBanner =
    role !== 'superadmin' && (isTrial || isMasaTenggang || (sisaHari !== null && sisaHari <= 14));
  const statusLabel = isMasaTenggang ? 'Masa Tenggang' : 'Aktif';

  const roleBadge = {
    superadmin: { label: 'SUPERADMIN', color: 'bg-amber-100 text-amber-800 border-amber-200' },
    kepsek: { label: 'KEPALA SEKOLAH', color: 'bg-blue-100 text-blue-800 border-blue-200' },
    guru: { label: 'GURU PAUD 🌸', color: 'bg-emerald-100 text-emerald-800 border-emerald-200' },
  }[role] || { label: 'USER', color: 'bg-slate-100 text-slate-700 border-slate-200' };

  return (
    <div className="min-h-screen bg-amber-50/30 flex flex-col antialiased">
      {/* 1. Indikator Status Jaringan Online/Offline */}
      <NetworkStatusBanner />

      {/* 2. Floating Dev Environment Badge */}
      <DevBadge />

      {/* 3. Header Atas Responsif */}
      <header className="sticky top-0 z-30 bg-white/95 backdrop-blur-md border-b border-orange-200/60 px-4 py-3 md:px-6 shadow-xs">
        <div className="max-w-7xl mx-auto flex items-center justify-between">
          
          {/* Identitas Sekolah Dinamis */}
          <div className="flex items-center space-x-3">
            {schoolData?.logo_url ? (
              <img
                src={schoolData.logo_url}
                alt="Logo Sekolah"
                className="w-10 h-10 rounded-2xl object-contain border border-orange-200 p-0.5 bg-white shadow-sm"
              />
            ) : (
              <div className="w-10 h-10 rounded-2xl bg-gradient-to-tr from-amber-400 via-orange-500 to-amber-500 text-white flex items-center justify-center font-bold text-lg shadow-md shadow-orange-500/20 font-brand">
                {role === 'superadmin' ? '👑' : '🎶'}
              </div>
            )}
            
            <div className="truncate max-w-[200px] sm:max-w-xs md:max-w-md">
              <h1 className="text-sm md:text-base font-extrabold text-slate-900 truncate tracking-tight font-brand">
                {dynamicSchoolName}
              </h1>
              <p className="text-[11px] text-slate-500 font-semibold truncate flex items-center space-x-1.5">
                <span>{role === 'superadmin' ? 'Project Owner Portal' : `Kelompok: ${userData?.kelompok_kelas || 'Umum'}`}</span>
                <span>•</span>
                <span className={isMasaTenggang ? 'text-amber-600 font-bold' : 'text-emerald-600 font-bold'}>{statusLabel}</span>
              </p>
            </div>
          </div>

          {/* User Profile & Logout Header */}
          <div className="flex items-center space-x-2 sm:space-x-3">
            <span className={`hidden sm:inline-flex items-center px-3 py-1 rounded-full text-[10px] font-extrabold border ${roleBadge.color}`}>
              {roleBadge.label}
            </span>

            <div className="hidden md:flex flex-col text-right">
              <span className="text-xs font-extrabold text-slate-800 leading-tight">
                {userData?.nama || 'Pengguna'}
              </span>
              <span className="text-[10px] text-slate-400">
                {userData?.email || ''}
              </span>
            </div>

            <button
              onClick={() => setPasswordModalOpen(true)}
              title="Ganti Kata Sandi"
              aria-label="Ganti Kata Sandi"
              className="p-2.5 rounded-2xl text-slate-400 hover:text-orange-600 hover:bg-orange-50 active:scale-95 transition"
            >
              <KeyRound className="w-4 h-4 md:w-5 md:h-5" />
            </button>

            <button
              onClick={handleLogoutClick}
              title="Keluar Akun"
              aria-label="Keluar Akun"
              className="p-2.5 rounded-2xl text-slate-400 hover:text-rose-600 hover:bg-rose-50 active:scale-95 transition"
            >
              <LogOut className="w-4 h-4 md:w-5 md:h-5" />
            </button>
          </div>
        </div>
      </header>

      {/* 4. Body Layout: Sidebar Desktop & Area Konten */}
      <div className="flex-1 flex max-w-7xl w-full mx-auto">
        
        {/* Desktop Sidebar (Hanya tampil di >= 768px) */}
        <aside className="hidden md:flex flex-col w-64 bg-transparent p-4 shrink-0">
          <div className="bg-white rounded-3xl border border-orange-200/60 p-4 shadow-sm sticky top-20 space-y-1.5">
            <div className="px-3 py-2 text-[11px] font-extrabold text-orange-400 uppercase tracking-wider font-brand">
              Menu Utama
            </div>

            {currentNavItems.map((item) => {
              const Icon = item.icon;
              return (
                <NavLink
                  key={item.path}
                  to={item.path}
                  className={({ isActive }) =>
                    `flex items-center space-x-3 px-3.5 py-3 rounded-2xl text-xs font-bold transition ${
                      isActive
                        ? 'bg-gradient-to-r from-amber-500 to-orange-500 text-white shadow-md shadow-orange-500/25'
                        : 'text-slate-600 hover:bg-amber-50/70 hover:text-orange-950'
                    }`
                  }
                >
                  <Icon className="w-4 h-4 stroke-[2.2]" />
                  <span>{item.label}</span>
                </NavLink>
              );
            })}

            <div className="pt-4 border-t border-orange-100 mt-4 px-3">
              <div className="text-[10px] text-slate-400 leading-relaxed">
                <span className="font-bold text-orange-900/60">SIMFONI PAUD v1.0</span><br />
                SaaS Multi-Tenant Edition
              </div>
            </div>
          </div>
        </aside>

        {/* Main Content Area (Responsif, ruang bawah disesuaikan untuk BottomNav mobile) */}
        <main className="flex-1 p-4 md:p-6 pb-28 md:pb-12 max-w-full overflow-x-hidden">
          {showLanggananBanner && (
            <div className="mb-4 p-3 bg-gradient-to-r from-amber-50 to-orange-50 border border-amber-200/80 rounded-2xl flex flex-col sm:flex-row sm:items-center justify-between gap-2 shadow-xs">
              <div className="flex items-center space-x-2 text-amber-950 text-xs font-semibold">
                <Sparkles className="w-4 h-4 text-amber-600 shrink-0" />
                <span>
                  {isMasaTenggang
                    ? <>Langganan sekolah dalam <strong>Masa Tenggang</strong>. Hubungi Administrator Sistem agar layanan tidak terhenti.</>
                    : isTrial
                    ? <>Sekolah Anda berada pada <strong>Masa Uji Coba (Trial)</strong> hingga {formatTanggalIndo(schoolData?.berlaku_hingga)}.</>
                    : <>Masa langganan berakhir pada <strong>{formatTanggalIndo(schoolData?.berlaku_hingga)}</strong>.</>}
                  {sisaHari !== null && sisaHari >= 0 && <> Sisa <strong>{sisaHari} hari</strong>.</>}
                </span>
              </div>
              <span className="px-2 py-0.5 bg-amber-200/80 text-amber-950 font-black text-[10px] rounded-lg shrink-0 self-start sm:self-auto font-brand">
                {isMasaTenggang ? 'MASA TENGGANG' : isTrial ? 'AKSES TRIAL' : 'PERPANJANG'}
              </span>
            </div>
          )}
          <Outlet />
        </main>
      </div>

      {/* 5. Bottom Navigation Bar Mobile (Floating Pill Ramah Jempol di < 768px) */}
      <nav className="md:hidden fixed bottom-3 left-4 right-4 bg-white/95 backdrop-blur-md border border-orange-200/70 shadow-2xl shadow-orange-950/10 rounded-3xl z-30 px-2 py-1.5">
        <div className="flex items-center justify-around">
          {currentNavItems.filter((item) => !item.desktopOnly).slice(0, 5).map((item) => {
            const Icon = item.icon;
            return (
              <NavLink
                key={item.path}
                to={item.path}
                className={({ isActive }) =>
                  `flex flex-col items-center justify-center py-1 px-2 rounded-2xl text-[10px] font-bold transition min-w-[56px] ${
                    isActive
                      ? 'text-orange-600'
                      : 'text-slate-400 hover:text-slate-600'
                  }`
                }
              >
                {({ isActive }) => (
                  <>
                    <div className={`p-1.5 rounded-xl transition ${isActive ? 'bg-orange-100 text-orange-600 shadow-xs' : ''}`}>
                      <Icon className={`w-5 h-5 ${isActive ? 'stroke-[2.5]' : 'stroke-[1.8]'}`} />
                    </div>
                    <span className="mt-0.5 truncate max-w-[64px] font-brand">{item.label}</span>
                  </>
                )}
              </NavLink>
            );
          })}
        </div>
      </nav>
            {/* Modal Peringatan Konfirmasi Logout Elegan */}
      <ModalKonfirmasi
        isOpen={logoutModalOpen}
        title="Konfirmasi Keluar Akun"
        message={`Apakah Anda yakin ingin keluar dari akun ${userData?.nama ? `"${userData.nama}"` : ''}? Anda harus memasukkan kembali email dan kata sandi untuk mengakses sistem SIMFONI PAUD.`}
        confirmText="Ya, Keluar Akun"
        cancelText="Batal"
        type="warning"
        loading={loggingOut}
        onConfirm={handleConfirmLogout}
        onClose={() => setLogoutModalOpen(false)}
      />

      {/* Modal Wajib Ganti Sandi (akun baru / baru di-reset) atau ganti sandi sukarela */}
      <ModalGantiPassword
        isOpen={needsPasswordChange || passwordModalOpen}
        isMandatory={needsPasswordChange}
        onClose={() => setPasswordModalOpen(false)}
      />
    </div>
  );
}


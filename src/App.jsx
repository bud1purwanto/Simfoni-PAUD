import React from 'react';
import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom';
import { AuthProvider } from './context/AuthContext';
import ProtectedRoute from './components/layout/ProtectedRoute';
import AppLayout from './components/layout/AppLayout';
import Login from './pages/auth/Login';
import SuspendedSchool from './pages/auth/SuspendedSchool';

// Modul Guru PAUD (Fase 5)
import DashboardGuru from './pages/guru/DashboardGuru';
import PresensiGuru from './pages/guru/PresensiGuru';
import JurnalGuru from './pages/guru/JurnalGuru';
import JadwalGuru from './pages/guru/JadwalGuru';
import LaporanLainGuru from './pages/guru/LaporanLainGuru';

// Helper view untuk preview rute yang akan dibangun di Fase 5, 6, dan 7
function PlaceholderView({ title, description, badgeText, badgeColor }) {
  return (
    <div className="bg-white rounded-3xl p-6 md:p-8 border border-slate-200/80 shadow-sm">
      <div className="flex items-center space-x-3 mb-2">
        <span className={`px-2.5 py-0.5 rounded-full text-xs font-bold ${badgeColor}`}>
          {badgeText}
        </span>
      </div>
      <h2 className="text-xl font-bold text-slate-800">{title}</h2>
      <p className="text-sm text-slate-500 mt-1">{description}</p>
      <div className="mt-6 p-4 rounded-2xl bg-slate-50 border border-slate-200/60 text-xs text-slate-600">
        ✨ Modul ini siap diisi dengan logika spesifik pada fase pengembangan berikutnya.
      </div>
    </div>
  );
}

export default function App() {
  return (
    <BrowserRouter>
      <AuthProvider>
        <Routes>
          {/* Public Routes */}
          <Route path="/" element={<Navigate to="/login" replace />} />
          <Route path="/login" element={<Login />} />
          <Route path="/suspended" element={<SuspendedSchool />} />

          {/* 1. Rute Khusus SUPERADMIN */}
          <Route element={<ProtectedRoute allowedRoles={['superadmin']} />}>
            <Route element={<AppLayout />}>
              <Route
                path="/superadmin/dashboard"
                element={
                  <PlaceholderView
                    title="Dashboard Analitik SaaS Global"
                    description="Monitoring seluruh mitra sekolah, kuota guru, dan estimasi storage."
                    badgeText="SUPERADMIN"
                    badgeColor="bg-purple-100 text-purple-700"
                  />
                }
              />
              <Route
                path="/superadmin/sekolah"
                element={
                  <PlaceholderView
                    title="Kelola Mitra Sekolah (Tenants)"
                    description="CRUD data sekolah, alokasi kuota guru, paket langganan, dan status suspend."
                    badgeText="SUPERADMIN"
                    badgeColor="bg-purple-100 text-purple-700"
                  />
                }
              />
              <Route
                path="/superadmin/kepsek"
                element={
                  <PlaceholderView
                    title="Kelola Akun Kepala Sekolah"
                    description="Pembuatan akun Kepsek via Secondary Auth dan reset password default."
                    badgeText="SUPERADMIN"
                    badgeColor="bg-purple-100 text-purple-700"
                  />
                }
              />
              <Route
                path="/superadmin/logs"
                element={
                  <PlaceholderView
                    title="Audit Log & Retensi Periodik"
                    description="Pemantauan log sistem, tombol manual purge 30/60/90 hari, dan auto-cleanup."
                    badgeText="SUPERADMIN"
                    badgeColor="bg-purple-100 text-purple-700"
                  />
                }
              />
            </Route>
          </Route>

          {/* 2. Rute Khusus KEPALA SEKOLAH */}
          <Route element={<ProtectedRoute allowedRoles={['kepsek']} />}>
            <Route element={<AppLayout />}>
              <Route
                path="/kepsek/dashboard"
                element={
                  <PlaceholderView
                    title="Dashboard Monitoring Live KBM"
                    description="Pantauan presensi harian guru, antrean validasi jurnal, dan kendala sekolah."
                    badgeText="KEPALA SEKOLAH"
                    badgeColor="bg-blue-100 text-blue-700"
                  />
                }
              />
              <Route
                path="/kepsek/guru"
                element={
                  <PlaceholderView
                    title="Kelola Guru & Kuota"
                    description="Daftar guru aktif, validasi kuota sekolah, dan tombol reset password default Guru1234!."
                    badgeText="KEPALA SEKOLAH"
                    badgeColor="bg-blue-100 text-blue-700"
                  />
                }
              />
              <Route
                path="/kepsek/validasi"
                element={
                  <PlaceholderView
                    title="Validasi Jurnal KBM & Koreksi Absen"
                    description="Pemeriksaan jurnal mengajar, catatan revisi, dan fitur Setujui Sekaligus (Bulk Approval)."
                    badgeText="KEPALA SEKOLAH"
                    badgeColor="bg-blue-100 text-blue-700"
                  />
                }
              />
              <Route
                path="/kepsek/jadwal"
                element={
                  <PlaceholderView
                    title="Jadwal Mengajar Sekolah"
                    description="Penataan jadwal kelas TK A, TK B, dan Kelompok Bermain."
                    badgeText="KEPALA SEKOLAH"
                    badgeColor="bg-blue-100 text-blue-700"
                  />
                }
              />
              <Route
                path="/kepsek/rekap"
                element={
                  <PlaceholderView
                    title="Rekapitulasi & Ekspor Dokumen"
                    description="Unduh PDF Ringkas, PDF Portofolio, Ekspor Excel Honor Guru, dan Share WhatsApp."
                    badgeText="KEPALA SEKOLAH"
                    badgeColor="bg-blue-100 text-blue-700"
                  />
                }
              />
            </Route>
          </Route>

          {/* 3. Rute Khusus GURU PAUD */}
          <Route element={<ProtectedRoute allowedRoles={['guru']} />}>
            <Route element={<AppLayout />}>
              <Route path="/guru/dashboard" element={<DashboardGuru />} />
              <Route path="/guru/presensi" element={<PresensiGuru />} />
              <Route path="/guru/jurnal" element={<JurnalGuru />} />
              <Route path="/guru/jadwal" element={<JadwalGuru />} />
              <Route path="/guru/laporan" element={<LaporanLainGuru />} />
            </Route>
          </Route>

          {/* Fallback Catch-All */}
          <Route path="*" element={<Navigate to="/login" replace />} />
        </Routes>
      </AuthProvider>
    </BrowserRouter>
  );
}

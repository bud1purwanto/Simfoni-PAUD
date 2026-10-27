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

// Modul Superadmin (Fase 7)
import DashboardSuperadmin from './pages/superadmin/DashboardSuperadmin';
import KelolaSekolah from './pages/superadmin/KelolaSekolah';
import KelolaAkunKepsek from './pages/superadmin/KelolaAkunKepsek';
import ManajemenLog from './pages/superadmin/ManajemenLog';

// Modul Kepala Sekolah (Fase 6)
import DashboardKepsek from './pages/kepsek/DashboardKepsek';
import KelolaGuru from './pages/kepsek/KelolaGuru';
import ValidasiLaporan from './pages/kepsek/ValidasiLaporan';
import KelolaJadwal from './pages/kepsek/KelolaJadwal';
import RekapDanPdf from './pages/kepsek/RekapDanPdf';

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
              <Route path="/superadmin/dashboard" element={<DashboardSuperadmin />} />
              <Route path="/superadmin/sekolah" element={<KelolaSekolah />} />
              <Route path="/superadmin/kepsek" element={<KelolaAkunKepsek />} />
              <Route path="/superadmin/logs" element={<ManajemenLog />} />
            </Route>
          </Route>

          {/* 2. Rute Khusus KEPALA SEKOLAH */}
          <Route element={<ProtectedRoute allowedRoles={['kepsek']} />}>
            <Route element={<AppLayout />}>
              <Route path="/kepsek/dashboard" element={<DashboardKepsek />} />
              <Route path="/kepsek/guru" element={<KelolaGuru />} />
              <Route path="/kepsek/validasi" element={<ValidasiLaporan />} />
              <Route path="/kepsek/jadwal" element={<KelolaJadwal />} />
              <Route path="/kepsek/rekap" element={<RekapDanPdf />} />
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

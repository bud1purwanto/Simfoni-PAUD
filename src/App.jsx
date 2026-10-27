import React from 'react';
import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom';
import { AuthProvider, useAuth } from './context/AuthContext';
import Login from './pages/auth/Login';
import SuspendedSchool from './pages/auth/SuspendedSchool';

// Komponen placeholder sementara untuk memverifikasi auto-routing Fase 3
function DashboardPlaceholder({ roleTitle, roleBadgeColor }) {
  const { userData, schoolData, logout } = useAuth();
  return (
    <div className="min-h-screen bg-slate-50 flex items-center justify-center p-4">
      <div className="max-w-md w-full bg-white rounded-3xl p-6 shadow-sm border border-slate-200 text-center">
        <span className={`inline-block px-3 py-1 rounded-full text-xs font-bold mb-3 ${roleBadgeColor}`}>
          {roleTitle}
        </span>
        <h2 className="text-xl font-bold text-slate-800">
          Selamat Datang, {userData?.nama || 'Pengguna'}!
        </h2>
        <p className="text-sm text-slate-500 mt-1">
          {schoolData?.nama_sekolah || userData?.nama_sekolah || 'SIMFONI PAUD Platform'}
        </p>
        <div className="mt-4 p-3 bg-slate-50 rounded-2xl text-xs text-slate-600 border border-slate-100">
          Status Akun: <strong className="text-emerald-600">Aktif</strong> | Role: <strong>{userData?.role}</strong>
        </div>
        <button
          onClick={logout}
          className="mt-6 w-full py-2.5 px-4 rounded-xl text-sm font-semibold text-rose-600 bg-rose-50 hover:bg-rose-100 transition"
        >
          Keluar (Logout)
        </button>
      </div>
    </div>
  );
}

export default function App() {
  return (
    <BrowserRouter>
      <AuthProvider>
        <Routes>
          <Route path="/" element={<Navigate to="/login" replace />} />
          <Route path="/login" element={<Login />} />
          <Route path="/suspended" element={<SuspendedSchool />} />
          
          {/* Rute Sementara Fase 3 untuk memvalidasi auto-routing login */}
          <Route
            path="/superadmin/dashboard"
            element={
              <DashboardPlaceholder
                roleTitle="👑 Superadmin Portal"
                roleBadgeColor="bg-purple-100 text-purple-700"
              />
            }
          />
          <Route
            path="/kepsek/dashboard"
            element={
              <DashboardPlaceholder
                roleTitle="🏫 Dashboard Kepala Sekolah"
                roleBadgeColor="bg-blue-100 text-blue-700"
              />
            }
          />
          <Route
            path="/guru/dashboard"
            element={
              <DashboardPlaceholder
                roleTitle="👩‍🏫 Dashboard Guru PAUD"
                roleBadgeColor="bg-emerald-100 text-emerald-700"
              />
            }
          />

          <Route path="*" element={<Navigate to="/login" replace />} />
        </Routes>
      </AuthProvider>
    </BrowserRouter>
  );
}

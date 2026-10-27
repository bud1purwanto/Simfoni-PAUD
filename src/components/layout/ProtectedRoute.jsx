import React from 'react';
import { Navigate, Outlet } from 'react-router-dom';
import { useAuth } from '../../context/AuthContext';

export const getDashboardPath = (role) => {
  if (role === 'superadmin') return '/superadmin/dashboard';
  if (role === 'kepsek') return '/kepsek/dashboard';
  return '/guru/dashboard';
};

const LoadingScreen = () => (
  <div className="min-h-screen bg-amber-50/30 flex flex-col items-center justify-center p-4">
    <div className="w-12 h-12 rounded-2xl bg-amber-50 border border-amber-200/60 flex items-center justify-center text-xl animate-pulse mb-3">
      🎶
    </div>
    <p className="text-xs font-semibold text-slate-500 tracking-wider animate-pulse">
      MEMUAT SIMFONI PAUD...
    </p>
  </div>
);

export default function ProtectedRoute({ allowedRoles = [] }) {
  const { currentUser, userData, loading, isSuspended, authError, reloadUserData, logout } = useAuth();

  if (loading) return <LoadingScreen />;

  // Jika belum login, alihkan ke halaman login
  if (!currentUser) {
    return <Navigate to="/login" replace />;
  }

  // Sesi Auth ada tetapi profil Firestore gagal dimuat (mis. sinyal putus saat membuka aplikasi).
  // Jangan render halaman apa pun tanpa role yang tervalidasi.
  if (!userData) {
    return (
      <div className="min-h-screen bg-amber-50/30 flex items-center justify-center p-4">
        <div className="max-w-sm w-full bg-white rounded-3xl border border-orange-200/70 p-6 text-center space-y-4 shadow-sm">
          <div className="text-3xl">📡</div>
          <p className="text-sm font-bold text-slate-800 font-brand">
            {authError || 'Profil akun belum dapat dimuat.'}
          </p>
          <div className="flex gap-2">
            <button
              onClick={() => reloadUserData()}
              className="flex-1 py-3 rounded-2xl bg-gradient-to-r from-amber-500 to-orange-500 text-white text-xs font-extrabold"
            >
              Coba Lagi
            </button>
            <button
              onClick={() => logout()}
              className="flex-1 py-3 rounded-2xl border border-slate-200 text-slate-600 text-xs font-bold"
            >
              Keluar
            </button>
          </div>
        </div>
      </div>
    );
  }

  // Jika sekolah dalam status suspend dan bukan superadmin, alihkan ke layar penangguhan
  if (isSuspended && userData.role !== 'superadmin') {
    return <Navigate to="/suspended" replace />;
  }

  // Jika role pengguna tidak sesuai dengan hak akses rute
  if (allowedRoles.length > 0 && !allowedRoles.includes(userData.role)) {
    return <Navigate to={getDashboardPath(userData.role)} replace />;
  }

  return <Outlet />;
}

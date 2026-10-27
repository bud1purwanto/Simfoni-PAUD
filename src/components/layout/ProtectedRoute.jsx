import React from 'react';
import { Navigate, Outlet } from 'react-router-dom';
import { useAuth } from '../../context/AuthContext';

export default function ProtectedRoute({ allowedRoles = [] }) {
  const { currentUser, userData, loading, isSuspended } = useAuth();

  if (loading) {
    return (
      <div className="min-h-screen bg-slate-50 flex flex-col items-center justify-center p-4">
        <div className="w-12 h-12 rounded-2xl bg-indigo-50 border border-indigo-100 flex items-center justify-center text-xl animate-pulse mb-3">
          🎶
        </div>
        <p className="text-xs font-semibold text-slate-500 tracking-wider animate-pulse">
          MEMUAT SIMFONI PAUD...
        </p>
      </div>
    );
  }

  // Jika belum login, alihkan ke halaman login
  if (!currentUser) {
    return <Navigate to="/login" replace />;
  }

  // Jika sekolah dalam status suspend dan bukan superadmin, alihkan ke layar penangguhan
  if (isSuspended && userData?.role !== 'superadmin') {
    return <Navigate to="/suspended" replace />;
  }

  // Jika role pengguna tidak sesuai dengan hak akses rute
  if (allowedRoles.length > 0 && userData && !allowedRoles.includes(userData.role)) {
    if (userData.role === 'superadmin') {
      return <Navigate to="/superadmin/dashboard" replace />;
    } else if (userData.role === 'kepsek') {
      return <Navigate to="/kepsek/dashboard" replace />;
    } else {
      return <Navigate to="/guru/dashboard" replace />;
    }
  }

  return <Outlet />;
}


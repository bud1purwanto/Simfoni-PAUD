import React from 'react';
import { ShieldAlert, LogOut, PhoneCall } from 'lucide-react';
import { useAuth } from '../../context/AuthContext';
import { useNavigate, Navigate } from 'react-router-dom';
import { getDashboardPath } from '../../components/layout/ProtectedRoute';
import { isLanggananKedaluwarsa } from '../../utils/schoolConfig';
import { formatTanggalIndo } from '../../utils/formatters';

export default function SuspendedSchool() {
  const { currentUser, userData, schoolData, isSuspended, loading, logout } = useAuth();
  const navigate = useNavigate();

  if (!loading && !currentUser) return <Navigate to="/login" replace />;
  if (!loading && userData && !isSuspended) return <Navigate to={getDashboardPath(userData.role)} replace />;

  const isExpired = isLanggananKedaluwarsa(schoolData);

  const handleLogout = async () => {
    await logout();
    navigate('/login');
  };

  return (
    <div className="min-h-screen bg-slate-50 flex items-center justify-center p-4">
      <div className="max-w-md w-full bg-white rounded-3xl shadow-sm border border-slate-200 p-8 text-center animate-fadeIn">
        <div className="w-16 h-16 rounded-2xl bg-rose-50 text-rose-600 flex items-center justify-center mx-auto mb-4">
          <ShieldAlert className="w-8 h-8" />
        </div>

        <h1 className="text-xl font-bold text-slate-900 mb-2">Layanan Ditangguhkan</h1>
        
        <div className="inline-block px-3 py-1 bg-slate-100 rounded-full text-xs font-semibold text-slate-600 mb-4">
          {schoolData?.nama_sekolah || 'Sekolah Mitra'}
        </div>

        <p className="text-sm text-slate-600 leading-relaxed mb-6">
          {isExpired ? (
            <>Masa aktif layanan <strong>SIMFONI PAUD</strong> untuk sekolah Anda telah berakhir pada <strong>{formatTanggalIndo(schoolData?.berlaku_hingga)}</strong>. Silakan hubungi Administrator Sistem.</>
          ) : (
            <>Masa aktif langganan aplikasi <strong>SIMFONI PAUD</strong> untuk sekolah Anda sedang tidak aktif atau ditangguhkan sementara.</>
          )}
        </p>

        <div className="bg-amber-50 border border-amber-200 rounded-2xl p-4 text-left text-xs text-amber-800 space-y-2 mb-6">
          <div className="flex items-start space-x-2">
            <PhoneCall className="w-4 h-4 text-amber-600 flex-shrink-0 mt-0.5" />
            <div>
              <p className="font-semibold text-amber-900">Petunjuk Tindak Lanjut:</p>
              <p className="mt-0.5">
                Silakan hubungi Pengelola Sistem (Superadmin SIMFONI) untuk memperpanjang paket langganan dan membuka kembali akses guru.
              </p>
            </div>
          </div>
        </div>

        <button
          onClick={handleLogout}
          className="w-full py-3 px-4 rounded-xl font-medium text-sm text-slate-700 bg-slate-100 hover:bg-slate-200 active:bg-slate-300 transition flex items-center justify-center space-x-2"
        >
          <LogOut className="w-4 h-4" />
          <span>Keluar ke Halaman Login</span>
        </button>
      </div>
    </div>
  );
}


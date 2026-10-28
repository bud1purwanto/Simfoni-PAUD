import React, { useState } from 'react';
import { createPortal } from 'react-dom';
import { KeyRound, Eye, EyeOff, Lock, AlertCircle, ShieldCheck, X } from 'lucide-react';

export default function ModalResetPassword({
  isOpen,
  targetUser,
  defaultPassword = 'User1234!',
  onClose,
  onConfirm,
  loading = false,
}) {
  const [newPassword, setNewPassword] = useState(defaultPassword);
  const [showPassword, setShowPassword] = useState(false);
  const [error, setError] = useState('');

  // Update default password saat targetUser berganti
  React.useEffect(() => {
    setNewPassword(defaultPassword);
    setError('');
    setShowPassword(false);
  }, [isOpen, defaultPassword, targetUser]);

  if (!isOpen || !targetUser) return null;

  const handleSubmit = (e) => {
    e.preventDefault();
    if (!newPassword || newPassword.length < 6) {
      setError('Kata sandi sementara minimal 6 karakter.');
      return;
    }
    setError('');
    onConfirm(newPassword);
  };

  return createPortal(
    <div className="fixed inset-0 z-[120] flex items-center justify-center p-4 bg-slate-900/60 backdrop-blur-sm animate-fadeIn">
      <div className="bg-white rounded-3xl w-full max-w-md p-6 sm:p-7 shadow-2xl border border-orange-200/80 space-y-5 animate-scaleUp">
        
        {/* Header Modal */}
        <div className="flex items-start justify-between border-b border-orange-100 pb-4">
          <div className="flex items-center space-x-3">
            <div className="w-12 h-12 rounded-2xl bg-amber-100 text-amber-700 flex items-center justify-center shadow-xs">
              <KeyRound className="w-6 h-6 stroke-[2.2]" />
            </div>
            <div>
              <h3 className="text-base font-extrabold text-slate-900 font-brand">
                Reset Kata Sandi {targetUser.role === 'kepsek' ? 'Kepala Sekolah' : 'Guru'}
              </h3>
              <p className="text-xs text-slate-500 font-semibold">
                Tentukan kata sandi baru untuk akun pengguna
              </p>
            </div>
          </div>
          <button
            onClick={onClose}
            disabled={loading}
            className="p-1.5 text-slate-400 hover:text-slate-600 rounded-xl hover:bg-slate-100 transition"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Info Pengguna */}
        <div className="p-3.5 bg-amber-50/60 rounded-2xl border border-amber-200/70 text-xs space-y-1">
          <div className="flex justify-between">
            <span className="text-slate-500 font-semibold">Nama Pengguna:</span>
            <span className="font-bold text-slate-900">{targetUser.nama}</span>
          </div>
          <div className="flex justify-between">
            <span className="text-slate-500 font-semibold">Email Login:</span>
            <span className="font-bold text-slate-900">{targetUser.email}</span>
          </div>
          <div className="flex justify-between">
            <span className="text-slate-500 font-semibold">Peran Akun:</span>
            <span className="font-extrabold text-orange-700 uppercase tracking-wide">
              {targetUser.role === 'kepsek' ? 'Kepala Sekolah' : 'Guru PAUD'}
            </span>
          </div>
        </div>

        {error && (
          <div className="p-3 rounded-2xl bg-rose-50 border border-rose-200 text-rose-700 text-xs font-bold flex items-center space-x-2">
            <AlertCircle className="w-4 h-4 flex-shrink-0" />
            <span>{error}</span>
          </div>
        )}

        {/* Form Set Password Baru */}
        <form onSubmit={handleSubmit} className="space-y-4">
          <div>
            <label className="block text-xs font-bold text-slate-700 mb-1.5 uppercase tracking-wide">
              Kata Sandi Sementara Baru
            </label>
            <div className="relative">
              <div className="absolute inset-y-0 left-0 pl-3.5 flex items-center pointer-events-none text-slate-400">
                <Lock className="w-4 h-4" />
              </div>
              <input
                type={showPassword ? 'text' : 'password'}
                required
                value={newPassword}
                onChange={(e) => setNewPassword(e.target.value)}
                placeholder="Minimal 6 karakter"
                className="w-full pl-10 pr-10 py-3 text-sm rounded-2xl border border-slate-200 bg-slate-50/50 focus:bg-white focus:outline-none focus:ring-2 focus:ring-orange-500/20 focus:border-orange-500 font-semibold transition"
              />
              <button
                type="button"
                onClick={() => setShowPassword(!showPassword)}
                className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600 p-1 rounded-lg"
              >
                {showPassword ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
              </button>
            </div>
            <p className="text-[11px] text-slate-400 mt-1 font-medium">
              Berikan kata sandi ini kepada pengguna untuk digunakan login pertama kali.
            </p>
          </div>

          {/* Badge Status Wajib Ganti Password Tetap Aktif */}
          <div className="p-3 rounded-2xl bg-emerald-50 border border-emerald-200 flex items-start space-x-2.5">
            <ShieldCheck className="w-4 h-4 text-emerald-600 flex-shrink-0 mt-0.5" />
            <div className="text-xs text-emerald-900 leading-relaxed">
              <span className="font-extrabold text-emerald-800">Status Wajib Ganti Password: AKTIF</span>
              <p className="text-[11px] text-emerald-700 mt-0.5 font-medium">
                Saat login dengan sandi ini, pengguna otomatis diwajibkan membuat kata sandi pribadi baru sebelum dapat mengakses dashboard.
              </p>
            </div>
          </div>

          {/* Tombol Aksi */}
          <div className="pt-2 flex items-center space-x-2.5">
            <button
              type="button"
              onClick={onClose}
              disabled={loading}
              className="w-1/2 py-3 px-4 rounded-2xl border border-slate-200 text-slate-700 font-bold text-xs hover:bg-slate-50 transition"
            >
              Batal
            </button>
            <button
              type="submit"
              disabled={loading}
              className="w-1/2 py-3 px-4 rounded-2xl font-extrabold text-xs text-white bg-gradient-to-r from-amber-500 via-orange-500 to-amber-600 hover:from-amber-600 hover:to-orange-600 active:scale-98 shadow-md shadow-orange-500/25 transition flex items-center justify-center space-x-1.5 font-brand disabled:opacity-50"
            >
              {loading ? (
                <span>Menyimpan...</span>
              ) : (
                <span>Simpan & Reset</span>
              )}
            </button>
          </div>
        </form>

      </div>
    </div>,
    document.body
  );
}


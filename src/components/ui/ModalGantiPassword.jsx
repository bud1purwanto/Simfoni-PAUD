import React, { useState } from 'react';
import { createPortal } from 'react-dom';
import { KeyRound, Eye, EyeOff, AlertCircle, CheckCircle2 } from 'lucide-react';
import { useAuth } from '../../context/AuthContext';

export default function ModalGantiPassword({ isOpen, isMandatory = true, onClose }) {
  const { changePassword, logout, finishPasswordChange } = useAuth();
  const [passwordLama, setPasswordLama] = useState('');
  const [passwordBaru, setPasswordBaru] = useState('');
  const [konfirmasiPassword, setKonfirmasiPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [error, setError] = useState(null);
  const [loading, setLoading] = useState(false);
  const [success, setSuccess] = useState(false);

  if (!isOpen) return null;

  const handleSubmit = async (e) => {
    e.preventDefault();
    setError(null);

    if (passwordBaru.length < 6) {
      setError('Kata sandi baru minimal 6 karakter.');
      return;
    }

    if (passwordBaru !== konfirmasiPassword) {
      setError('Konfirmasi kata sandi tidak cocok.');
      return;
    }

    // Untuk ganti sandi sukarela, pastikan sandi baru beda dari sandi lama
    if (!isMandatory && passwordLama && passwordBaru === passwordLama) {
      setError('Kata sandi baru harus berbeda dari kata sandi saat ini.');
      return;
    }

    if (['Guru1234!', 'Kepsek1234!'].includes(passwordBaru)) {
      setError('Jangan gunakan kata sandi default. Buat sandi pribadi Anda.');
      return;
    }

    setLoading(true);
    try {
      // Saat mandatory (baru login awal), sesi masih fresh sehingga tidak perlu passwordLama
      await changePassword(passwordBaru, isMandatory ? undefined : passwordLama);
      setSuccess(true);
      setPasswordLama('');
      setPasswordBaru('');
      setKonfirmasiPassword('');
      setTimeout(() => {
        if (finishPasswordChange) finishPasswordChange();
        setSuccess(false);
        if (onClose) onClose();
      }, 1400);
    } catch (err) {
      console.error(err);
      if (err.code === 'auth/wrong-password' || err.code === 'auth/invalid-credential') {
        setError('Kata sandi saat ini salah.');
      } else if (err.code === 'auth/weak-password') {
        setError('Kata sandi baru terlalu lemah. Gunakan minimal 6 karakter kombinasi huruf & angka.');
      } else if (err.code === 'auth/requires-recent-login') {
        setError('Sesi login sudah terlalu lama. Silakan keluar, login ulang, lalu ganti kata sandi.');
      } else if (err.code === 'auth/too-many-requests') {
        setError('Terlalu banyak percobaan. Tunggu beberapa menit lalu coba lagi.');
      } else if (err.code === 'auth/network-request-failed') {
        setError('Tidak ada koneksi internet. Penggantian sandi memerlukan sinyal.');
      } else {
        setError('Gagal memperbarui kata sandi. Silakan coba kembali.');
      }
    } finally {
      setLoading(false);
    }
  };

  return createPortal(
    <div className="fixed inset-0 z-[100] flex items-center justify-center p-4 bg-slate-900/60 backdrop-blur-sm animate-fadeIn">
      <div className="bg-white w-full max-w-md rounded-3xl shadow-2xl border border-orange-200/80 p-6 sm:p-7 overflow-hidden animate-scaleUp">
        <div className="flex items-center space-x-3 mb-4">
          <div className="w-12 h-12 rounded-2xl bg-amber-100 text-amber-700 flex items-center justify-center shrink-0 shadow-xs">
            <KeyRound className="w-6 h-6 stroke-[2.2]" />
          </div>
          <div>
            <h3 className="text-base sm:text-lg font-extrabold text-slate-900 font-brand">
              {isMandatory ? 'Wajib Perbarui Kata Sandi' : 'Ganti Kata Sandi'}
            </h3>
            <p className="text-xs text-slate-500 font-medium">
              {isMandatory
                ? 'Akun Anda baru saja di-reset atau pertama kali aktif. Silakan buat sandi pribadi.'
                : 'Perbarui kata sandi login Anda secara berkala.'}
            </p>
          </div>
        </div>

        {error && (
          <div className="mb-4 p-3 rounded-2xl bg-rose-50 border border-rose-200 text-rose-700 text-xs font-bold flex items-center space-x-2">
            <AlertCircle className="w-4 h-4 flex-shrink-0" />
            <span>{error}</span>
          </div>
        )}

        {success && (
          <div className="mb-4 p-3 rounded-2xl bg-emerald-50 border border-emerald-200 text-emerald-700 text-xs font-bold flex items-center space-x-2">
            <CheckCircle2 className="w-4 h-4 flex-shrink-0" />
            <span>Kata sandi berhasil diperbarui! Mengalihkan ke Dashboard...</span>
          </div>
        )}

        <form onSubmit={handleSubmit} className="space-y-4">
          {/* Kolom Kata Sandi Saat Ini HANYA muncul saat ganti sandi sukarela dari profil (bukan mandatory akun baru) */}
          {!isMandatory && (
            <div>
              <label className="block text-xs font-bold text-slate-700 mb-1.5 uppercase tracking-wide">
                Kata Sandi Saat Ini
              </label>
              <input
                type={showPassword ? 'text' : 'password'}
                required
                autoComplete="current-password"
                value={passwordLama}
                onChange={(e) => setPasswordLama(e.target.value)}
                placeholder="Kata sandi lama"
                className="w-full px-3.5 py-3 text-sm rounded-2xl border border-slate-200 bg-slate-50/50 focus:bg-white focus:outline-none focus:ring-2 focus:ring-orange-500/20 focus:border-orange-500 transition font-medium"
              />
            </div>
          )}

          <div>
            <label className="block text-xs font-bold text-slate-700 mb-1.5 uppercase tracking-wide">
              Kata Sandi Baru Pribadi
            </label>
            <div className="relative">
              <input
                type={showPassword ? 'text' : 'password'}
                required
                autoComplete="new-password"
                value={passwordBaru}
                onChange={(e) => setPasswordBaru(e.target.value)}
                placeholder="Minimal 6 karakter"
                className="w-full pl-3.5 pr-10 py-3 text-sm rounded-2xl border border-slate-200 bg-slate-50/50 focus:bg-white focus:outline-none focus:ring-2 focus:ring-orange-500/20 focus:border-orange-500 transition font-medium"
              />
              <button
                type="button"
                aria-label={showPassword ? 'Sembunyikan kata sandi' : 'Tampilkan kata sandi'}
                onClick={() => setShowPassword(!showPassword)}
                className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600 p-1 rounded-lg"
              >
                {showPassword ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
              </button>
            </div>
          </div>

          <div>
            <label className="block text-xs font-bold text-slate-700 mb-1.5 uppercase tracking-wide">
              Ulangi Kata Sandi Baru
            </label>
            <input
              type={showPassword ? 'text' : 'password'}
              required
              autoComplete="new-password"
              value={konfirmasiPassword}
              onChange={(e) => setKonfirmasiPassword(e.target.value)}
              placeholder="Masukkan kembali sandi"
              className="w-full px-3.5 py-3 text-sm rounded-2xl border border-slate-200 bg-slate-50/50 focus:bg-white focus:outline-none focus:ring-2 focus:ring-orange-500/20 focus:border-orange-500 transition font-medium"
            />
          </div>

          <div className="pt-2 flex items-center space-x-2.5">
            {isMandatory && (
              <button
                type="button"
                onClick={() => logout()}
                className="w-1/2 py-3 rounded-2xl border border-slate-200 text-slate-600 font-bold text-xs hover:bg-slate-50 transition"
              >
                Keluar
              </button>
            )}
            {!isMandatory && onClose && (
              <button
                type="button"
                onClick={onClose}
                className="w-1/2 py-3 rounded-2xl border border-slate-200 text-slate-600 font-bold text-xs hover:bg-slate-50 transition"
              >
                Batal
              </button>
            )}
            <button
              type="submit"
              disabled={loading || success}
              className={`py-3 rounded-2xl font-extrabold text-xs text-white bg-gradient-to-r from-amber-500 via-orange-500 to-amber-600 hover:from-amber-600 hover:to-orange-600 active:scale-98 shadow-md shadow-orange-500/25 transition flex items-center justify-center font-brand disabled:opacity-50 ${
                isMandatory || onClose ? 'w-1/2' : 'w-full'
              }`}
            >
              {loading ? 'Menyimpan...' : 'Simpan Kata Sandi'}
            </button>
          </div>
        </form>
      </div>
    </div>,
    document.body
  );
}

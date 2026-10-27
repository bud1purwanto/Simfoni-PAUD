import React, { useState } from 'react';
import { createPortal } from 'react-dom';
import { KeyRound, Eye, EyeOff, AlertCircle, CheckCircle2 } from 'lucide-react';
import { useAuth } from '../../context/AuthContext';

export default function ModalGantiPassword({ isOpen, isMandatory = true, onClose }) {
  const { changePassword, logout } = useAuth();
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

    if (passwordBaru === passwordLama) {
      setError('Kata sandi baru harus berbeda dari kata sandi saat ini.');
      return;
    }

    if (['Guru1234!', 'Kepsek1234!'].includes(passwordBaru)) {
      setError('Jangan gunakan kata sandi default. Buat sandi pribadi Anda.');
      return;
    }

    setLoading(true);
    try {
      await changePassword(passwordBaru, passwordLama);
      setSuccess(true);
      setPasswordLama('');
      setPasswordBaru('');
      setKonfirmasiPassword('');
      setTimeout(() => {
        setSuccess(false);
        if (onClose) onClose();
      }, 1500);
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
      <div className="bg-white w-full max-w-md rounded-2xl shadow-xl border border-slate-100 p-6 overflow-hidden">
        <div className="flex items-center space-x-3 mb-4">
          <div className="w-10 h-10 rounded-xl bg-amber-50 text-amber-600 flex items-center justify-center">
            <KeyRound className="w-5 h-5" />
          </div>
          <div>
            <h3 className="text-lg font-bold text-slate-800">
              {isMandatory ? 'Wajib Perbarui Kata Sandi' : 'Ganti Kata Sandi'}
            </h3>
            <p className="text-xs text-slate-500">
              {isMandatory
                ? 'Akun Anda baru saja di-reset atau pertama kali aktif. Silakan buat sandi pribadi.'
                : 'Perbarui kata sandi login Anda secara berkala.'}
            </p>
          </div>
        </div>

        {error && (
          <div className="mb-4 p-3 rounded-xl bg-rose-50 border border-rose-200 text-rose-700 text-xs flex items-center space-x-2">
            <AlertCircle className="w-4 h-4 flex-shrink-0" />
            <span>{error}</span>
          </div>
        )}

        {success && (
          <div className="mb-4 p-3 rounded-xl bg-emerald-50 border border-emerald-200 text-emerald-700 text-xs flex items-center space-x-2">
            <CheckCircle2 className="w-4 h-4 flex-shrink-0" />
            <span>Kata sandi berhasil diperbarui!</span>
          </div>
        )}

        <form onSubmit={handleSubmit} className="space-y-4">
          <div>
            <label className="block text-xs font-semibold text-slate-700 mb-1.5">
              Kata Sandi Saat Ini
            </label>
            <input
              type={showPassword ? 'text' : 'password'}
              required
              autoComplete="current-password"
              value={passwordLama}
              onChange={(e) => setPasswordLama(e.target.value)}
              placeholder={isMandatory ? 'Sandi yang baru saja dipakai untuk login' : 'Kata sandi lama'}
              className="w-full px-3.5 py-2.5 text-sm rounded-xl border border-slate-300 focus:outline-none focus:ring-2 focus:ring-amber-500/20 focus:border-amber-500 transition"
            />
          </div>

          <div>
            <label className="block text-xs font-semibold text-slate-700 mb-1.5">
              Kata Sandi Baru
            </label>
            <div className="relative">
              <input
                type={showPassword ? 'text' : 'password'}
                required
                autoComplete="new-password"
                value={passwordBaru}
                onChange={(e) => setPasswordBaru(e.target.value)}
                placeholder="Minimal 6 karakter"
                className="w-full px-3.5 py-2.5 text-sm rounded-xl border border-slate-300 focus:outline-none focus:ring-2 focus:ring-amber-500/20 focus:border-amber-500 transition"
              />
              <button
                type="button"
                aria-label={showPassword ? 'Sembunyikan kata sandi' : 'Tampilkan kata sandi'}
                onClick={() => setShowPassword(!showPassword)}
                className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600"
              >
                {showPassword ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
              </button>
            </div>
          </div>

          <div>
            <label className="block text-xs font-semibold text-slate-700 mb-1.5">
              Ulangi Kata Sandi Baru
            </label>
            <input
              type={showPassword ? 'text' : 'password'}
              required
              autoComplete="new-password"
              value={konfirmasiPassword}
              onChange={(e) => setKonfirmasiPassword(e.target.value)}
              placeholder="Masukkan kembali sandi"
              className="w-full px-3.5 py-2.5 text-sm rounded-xl border border-slate-300 focus:outline-none focus:ring-2 focus:ring-amber-500/20 focus:border-amber-500 transition"
            />
          </div>

          <div className="pt-2 flex items-center space-x-2">
            {isMandatory && (
              <button
                type="button"
                onClick={() => logout()}
                className="w-1/2 py-2.5 rounded-xl border border-slate-200 text-slate-600 font-medium text-sm hover:bg-slate-50 transition"
              >
                Keluar
              </button>
            )}
            {!isMandatory && onClose && (
              <button
                type="button"
                onClick={onClose}
                className="w-1/2 py-2.5 rounded-xl border border-slate-200 text-slate-600 font-medium text-sm hover:bg-slate-50 transition"
              >
                Batal
              </button>
            )}
            <button
              type="submit"
              disabled={loading || success}
              className={`py-2.5 rounded-xl font-bold text-sm text-white bg-gradient-to-r from-amber-500 to-orange-500 hover:from-amber-600 hover:to-orange-600 shadow-md shadow-orange-500/20 transition flex items-center justify-center ${
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


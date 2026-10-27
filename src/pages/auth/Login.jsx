import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { Eye, EyeOff, Lock, Mail, AlertCircle, ArrowRight, User, Rocket } from 'lucide-react';
import { useAuth } from '../../context/AuthContext';
import { getDashboardPath } from '../../components/layout/ProtectedRoute';

export default function Login() {
  const {
    login,
    currentUser,
    userData,
    isSuspended,
    authError,
    clearAuthError,
    checkIfInitialSetupNeeded,
    runInitialSaaSSeeder,
  } = useAuth();
  
  const navigate = useNavigate();

  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);

  // Wizard Inisialisasi Sistem (hanya muncul jika database benar-benar kosong)
  const [setupNeeded, setSetupNeeded] = useState(false);
  const [setupMode, setSetupMode] = useState(false);
  const [setupNama, setSetupNama] = useState('');

  useEffect(() => {
    let active = true;
    checkIfInitialSetupNeeded().then((needed) => {
      if (active) setSetupNeeded(needed);
    });
    return () => { active = false; };
  }, []);

  // Auto-redirect jika pengguna sudah login dan akun valid.
  // Modal wajib ganti sandi ditampilkan oleh AppLayout setelah redirect.
  useEffect(() => {
    if (currentUser && userData) {
      if (isSuspended && userData.role !== 'superadmin') {
        navigate('/suspended', { replace: true });
        return;
      }
      navigate(getDashboardPath(userData.role), { replace: true });
    }
  }, [currentUser, userData, isSuspended, navigate]);

  const handleSetup = async (e) => {
    e.preventDefault();
    setError(null);
    if (password.length < 8) {
      setError('Kata sandi Superadmin minimal 8 karakter.');
      return;
    }
    setLoading(true);
    try {
      await runInitialSaaSSeeder({ email: email.trim(), password, nama: setupNama.trim() });
      setSetupNeeded(false);
      navigate('/superadmin/dashboard', { replace: true });
    } catch (err) {
      console.error('Seeder error:', err);
      setError(
        err.code === 'auth/email-already-in-use'
          ? 'Email ini sudah terdaftar. Silakan login biasa.'
          : 'Inisialisasi gagal: ' + (err.message || 'periksa konfigurasi Firebase.')
      );
    } finally {
      setLoading(false);
    }
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    setError(null);
    clearAuthError();
    setLoading(true);

    try {
      // Pengalihan dilakukan otomatis oleh useEffect berdasarkan role
      await login(email.trim(), password);
    } catch (err) {
      console.error('Login error:', err);
      let userFriendlyMessage = 'Email atau kata sandi tidak sesuai. Silakan coba kembali.';
      const message = err.message || '';
      if (message.includes('dinonaktifkan')) {
        userFriendlyMessage = message;
      } else if (message.includes('tidak terdaftar di basis data')) {
        userFriendlyMessage = 'Akun Anda belum memiliki data profil di SIMFONI PAUD. Silakan hubungi Administrator atau Kepala Sekolah.';
      } else if (message.includes('tidak terdaftar')) {
        userFriendlyMessage = message;
      } else if (err.code === 'auth/network-request-failed' || message.includes('offline') || message.includes('unavailable') || message.includes('PERMISSION_DENIED')) {
        userFriendlyMessage = 'Tidak dapat terhubung ke server. Periksa jaringan internet dan status database.';
      } else if (err.code === 'auth/user-not-found' || err.code === 'auth/wrong-password' || err.code === 'auth/invalid-credential') {
        userFriendlyMessage = 'Kombinasi email dan kata sandi salah.';
      } else if (err.code === 'auth/too-many-requests') {
        userFriendlyMessage = 'Terlalu banyak percobaan gagal. Silakan tunggu beberapa saat.';
      }
      setError(userFriendlyMessage);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen bg-gradient-to-br from-amber-50/80 via-orange-50/40 to-rose-50/30 flex flex-col justify-center py-12 sm:px-6 lg:px-8 px-4">
      <div className="sm:mx-auto sm:w-full sm:max-w-md text-center">
        <div className="inline-flex items-center justify-center w-16 h-16 rounded-3xl bg-gradient-to-tr from-amber-400 via-orange-500 to-amber-500 text-white shadow-lg shadow-orange-500/25 mb-4 animate-bounce font-brand">
          <span className="text-3xl">🎶</span>
        </div>
        <h2 className="text-2xl md:text-3xl font-extrabold tracking-tight text-slate-900 font-brand">
          SIMFONI PAUD 🌸
        </h2>
        <p className="mt-1 text-xs text-slate-600 font-semibold max-w-sm mx-auto">
          Sistem Informasi Monitoring & Pelaporan Terintegrasi PAUD
        </p>
      </div>

      <div className="mt-8 sm:mx-auto sm:w-full sm:max-w-md">
        <div className="bg-white py-8 px-6 shadow-xl shadow-orange-500/5 border border-orange-200/80 rounded-3xl sm:px-10">

          {(error || authError) && (
            <div className="mb-5 p-3.5 rounded-2xl bg-rose-50 border border-rose-200 text-rose-700 text-xs font-bold flex items-center space-x-2.5 animate-shake">
              <AlertCircle className="w-4 h-4 flex-shrink-0" />
              <span>{error || authError}</span>
            </div>
          )}

          {setupMode && (
            <div className="mb-5 p-3.5 rounded-2xl bg-amber-50 border border-amber-200 text-amber-900 text-xs font-semibold leading-relaxed">
              <strong className="font-brand">Inisialisasi Sistem SaaS.</strong> Akun Superadmin pertama dan sekolah pilot
              <em> TK Dharma Wanita Persatuan 8</em> akan dibuat. Lengkapi profil sekolah pilot setelah masuk.
            </div>
          )}

          <form onSubmit={setupMode ? handleSetup : handleSubmit} className="space-y-4">
            {setupMode && (
              <div>
                <label className="block text-xs font-bold text-slate-700 mb-1.5 uppercase tracking-wide">
                  Nama Lengkap Superadmin
                </label>
                <div className="relative">
                  <div className="absolute inset-y-0 left-0 pl-3.5 flex items-center pointer-events-none text-slate-400">
                    <User className="w-4 h-4" />
                  </div>
                  <input
                    type="text"
                    required
                    value={setupNama}
                    onChange={(e) => setSetupNama(e.target.value)}
                    placeholder="Nama pemilik platform"
                    className="w-full pl-10 pr-3.5 py-3 text-sm rounded-2xl border border-slate-200 focus:outline-none focus:ring-2 focus:ring-orange-500/20 focus:border-orange-500 transition font-medium"
                  />
                </div>
              </div>
            )}

            <div>
              <label className="block text-xs font-bold text-slate-700 mb-1.5 uppercase tracking-wide">
                Alamat Email
              </label>
              <div className="relative">
                <div className="absolute inset-y-0 left-0 pl-3.5 flex items-center pointer-events-none text-slate-400">
                  <Mail className="w-4 h-4" />
                </div>
                <input
                  type="email"
                  autoComplete="username"
                  required
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  placeholder="nama@sekolah.sch.id"
                  className="w-full pl-10 pr-3.5 py-3 text-sm rounded-2xl border border-slate-200 focus:outline-none focus:ring-2 focus:ring-orange-500/20 focus:border-orange-500 transition font-medium"
                />
              </div>
            </div>

            <div>
              <label className="block text-xs font-bold text-slate-700 mb-1.5 uppercase tracking-wide">
                Kata Sandi
              </label>
              <div className="relative">
                <div className="absolute inset-y-0 left-0 pl-3.5 flex items-center pointer-events-none text-slate-400">
                  <Lock className="w-4 h-4" />
                </div>
                <input
                  type={showPassword ? 'text' : 'password'}
                  autoComplete={setupMode ? 'new-password' : 'current-password'}
                  required
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  placeholder="••••••••"
                  className="w-full pl-10 pr-10 py-3 text-sm rounded-2xl border border-slate-200 focus:outline-none focus:ring-2 focus:ring-orange-500/20 focus:border-orange-500 transition font-medium"
                />
                <button
                  type="button"
                  aria-label={showPassword ? 'Sembunyikan kata sandi' : 'Tampilkan kata sandi'}
                  onClick={() => setShowPassword(!showPassword)}
                  className="absolute inset-y-0 right-0 pr-3.5 flex items-center text-slate-400 hover:text-slate-600"
                >
                  {showPassword ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                </button>
              </div>
            </div>

            <button
              type="submit"
              disabled={loading}
              className="w-full mt-2 py-3.5 px-4 rounded-2xl font-extrabold text-sm text-white bg-gradient-to-r from-amber-500 via-orange-500 to-amber-600 hover:from-amber-600 hover:to-orange-600 active:scale-98 shadow-md shadow-orange-500/25 transition flex items-center justify-center space-x-2 font-brand"
            >
              {loading ? (
                <span>{setupMode ? 'Menyiapkan Sistem...' : 'Memverifikasi Akun...'}</span>
              ) : (
                <>
                  <span>{setupMode ? 'Buat Superadmin & Sekolah Pilot' : 'Masuk ke SIMFONI'}</span>
                  <ArrowRight className="w-4 h-4 stroke-[2.5]" />
                </>
              )}
            </button>
          </form>

          {setupNeeded && (
            <button
              type="button"
              onClick={() => { setSetupMode(!setupMode); setError(null); }}
              className="mt-4 w-full py-3 rounded-2xl border border-dashed border-amber-300 text-amber-800 bg-amber-50/60 hover:bg-amber-100 text-xs font-extrabold flex items-center justify-center space-x-2 transition"
            >
              <Rocket className="w-4 h-4" />
              <span>{setupMode ? 'Kembali ke Form Login' : 'Inisialisasi Sistem SaaS (Setup Superadmin & Sekolah Pertama)'}</span>
            </button>
          )}

          <div className="mt-6 text-center text-xs text-slate-400 font-medium">
            Jika lupa kata sandi, hubungi Kepala Sekolah di sekolah Anda.
          </div>
        </div>
      </div>
    </div>
  );
}


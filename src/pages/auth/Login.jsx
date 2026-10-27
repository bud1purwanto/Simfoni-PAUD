import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { Eye, EyeOff, Lock, Mail, Sparkles, AlertCircle, ArrowRight, CheckCircle2 } from 'lucide-react';
import { useAuth } from '../../context/AuthContext';
import ModalGantiPassword from '../../components/ui/ModalGantiPassword';

export default function Login() {
  const {
    login,
    currentUser,
    userData,
    isSuspended,
    needsPasswordChange,
    checkIfInitialSetupNeeded,
    runInitialSaaSSeeder,
  } = useAuth();
  
  const navigate = useNavigate();

  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);

  // State untuk Initial Setup Seeder jika database masih kosong
  const [isInitialSetup, setIsInitialSetup] = useState(false);
  const [setupModalOpen, setSetupModalOpen] = useState(false);
  const [adminNama, setAdminNama] = useState('Baginda Superadmin');
  const [adminEmail, setAdminEmail] = useState('');
  const [adminPassword, setAdminPassword] = useState('');
  const [setupLoading, setSetupLoading] = useState(false);
  const [setupSuccess, setSetupSuccess] = useState(false);

  // Periksa apakah database memerlukan initial setup
  useEffect(() => {
    let isMounted = true;
    checkIfInitialSetupNeeded().then((needed) => {
      if (isMounted) setIsInitialSetup(needed);
    });
    return () => { isMounted = false; };
  }, [checkIfInitialSetupNeeded]);

  // Auto-redirect jika pengguna sudah login dan akun valid
  useEffect(() => {
    if (currentUser && userData && !needsPasswordChange) {
      if (isSuspended && userData.role !== 'superadmin') {
        navigate('/suspended');
        return;
      }

      if (userData.role === 'superadmin') {
        navigate('/superadmin/dashboard');
      } else if (userData.role === 'kepsek') {
        navigate('/kepsek/dashboard');
      } else {
        navigate('/guru/dashboard');
      }
    }
  }, [currentUser, userData, isSuspended, needsPasswordChange, navigate]);

  const handleSubmit = async (e) => {
    e.preventDefault();
    setError(null);
    setLoading(true);

    try {
      const user = await login(email.trim(), password);
      // Pengalihan dilakukan otomatis oleh useEffect berdasarkan user.role
      if (user.role === 'superadmin') {
        navigate('/superadmin/dashboard');
      } else if (user.role === 'kepsek') {
        navigate('/kepsek/dashboard');
      } else {
        navigate('/guru/dashboard');
      }
    } catch (err) {
      console.error('Login error:', err);
      let userFriendlyMessage = 'Email atau kata sandi tidak sesuai. Silakan coba kembali.';
      if (err.message.includes('dinonaktifkan')) {
        userFriendlyMessage = err.message;
      } else if (err.message.includes('offline') || err.message.includes('unavailable') || err.message.includes('PERMISSION_DENIED')) {
        userFriendlyMessage = 'Koneksi ke Cloud Firestore gagal. Pastikan database Cloud Firestore sudah dibuat (Create Database) di Firebase Console project simfoni-paud-dev.';
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

  const handleRunSeeder = async (e) => {
    e.preventDefault();
    setError(null);
    setSetupLoading(true);

    try {
      await runInitialSaaSSeeder({
        nama: adminNama.trim(),
        email: adminEmail.trim(),
        password: adminPassword,
      });
      setSetupSuccess(true);
      setTimeout(() => {
        setSetupModalOpen(false);
        navigate('/superadmin/dashboard');
      }, 1500);
    } catch (err) {
      console.error('Seeder error:', err);
      setError('Gagal menginisialisasi sistem: ' + (err.message || 'Kesalahan jaringan.'));
    } finally {
      setSetupLoading(false);
    }
  };

  return (
    <div className="min-h-screen bg-slate-50 flex flex-col justify-center py-12 sm:px-6 lg:px-8 px-4">
      <div className="sm:mx-auto sm:w-full sm:max-w-md text-center">
        <div className="inline-flex items-center justify-center w-16 h-16 rounded-2xl bg-indigo-600 text-white shadow-lg shadow-indigo-600/30 mb-4 animate-bounce">
          <span className="text-3xl">🎶</span>
        </div>
        <h2 className="text-2xl font-bold tracking-tight text-slate-900">SIMFONI PAUD</h2>
        <p className="mt-1 text-xs text-slate-500 font-medium">
          Sistem Informasi Monitoring & Pelaporan Terintegrasi PAUD
        </p>
      </div>

      <div className="mt-8 sm:mx-auto sm:w-full sm:max-w-md">
        <div className="bg-white py-8 px-6 shadow-sm border border-slate-200/80 rounded-3xl sm:px-10">
          
          {/* Banner Initial Setup jika database baru kosong */}
          {isInitialSetup && (
            <div className="mb-6 p-4 rounded-2xl bg-gradient-to-r from-indigo-50 to-purple-50 border border-indigo-200 text-indigo-950">
              <div className="flex items-start space-x-3">
                <Sparkles className="w-5 h-5 text-indigo-600 flex-shrink-0 mt-0.5" />
                <div className="text-xs">
                  <p className="font-bold text-sm text-indigo-900">Basis Data Masih Kosong</p>
                  <p className="text-slate-600 mt-1">
                    Sistem mendeteksi instalasi pertama. Klik tombol di bawah untuk menginisialisasi Superadmin & Sekolah Pilot.
                  </p>
                  <button
                    type="button"
                    onClick={() => setSetupModalOpen(true)}
                    className="mt-3 inline-flex items-center space-x-1.5 px-3 py-1.5 rounded-xl bg-indigo-600 hover:bg-indigo-700 text-white font-medium text-xs transition"
                  >
                    <span>Inisialisasi Sistem Sekarang</span>
                    <ArrowRight className="w-3.5 h-3.5" />
                  </button>
                </div>
              </div>
            </div>
          )}

          {error && (
            <div className="mb-5 p-3.5 rounded-2xl bg-rose-50 border border-rose-200 text-rose-700 text-xs flex items-center space-x-2.5 animate-shake">
              <AlertCircle className="w-4 h-4 flex-shrink-0" />
              <span>{error}</span>
            </div>
          )}

          <form onSubmit={handleSubmit} className="space-y-4">
            <div>
              <label className="block text-xs font-semibold text-slate-700 mb-1.5">
                Alamat Email
              </label>
              <div className="relative">
                <div className="absolute inset-y-0 left-0 pl-3.5 flex items-center pointer-events-none text-slate-400">
                  <Mail className="w-4 h-4" />
                </div>
                <input
                  type="email"
                  required
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  placeholder="nama@sekolah.sch.id"
                  className="w-full pl-10 pr-3.5 py-2.5 text-sm rounded-xl border border-slate-300 focus:outline-none focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-600 transition"
                />
              </div>
            </div>

            <div>
              <label className="block text-xs font-semibold text-slate-700 mb-1.5">
                Kata Sandi
              </label>
              <div className="relative">
                <div className="absolute inset-y-0 left-0 pl-3.5 flex items-center pointer-events-none text-slate-400">
                  <Lock className="w-4 h-4" />
                </div>
                <input
                  type={showPassword ? 'text' : 'password'}
                  required
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  placeholder="••••••••"
                  className="w-full pl-10 pr-10 py-2.5 text-sm rounded-xl border border-slate-300 focus:outline-none focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-600 transition"
                />
                <button
                  type="button"
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
              className="w-full mt-2 py-3 px-4 rounded-xl font-semibold text-sm text-white bg-indigo-600 hover:bg-indigo-700 active:bg-indigo-800 shadow-sm shadow-indigo-600/30 transition flex items-center justify-center space-x-2"
            >
              {loading ? (
                <span>Memverifikasi Akun...</span>
              ) : (
                <>
                  <span>Masuk ke SIMFONI</span>
                  <ArrowRight className="w-4 h-4" />
                </>
              )}
            </button>
          </form>

          <div className="mt-6 text-center text-xs text-slate-400">
            Jika lupa kata sandi, hubungi Kepala Sekolah di sekolah Anda.
          </div>
        </div>
      </div>

      {/* Modal Wajib Ganti Password jika akun baru direset */}
      <ModalGantiPassword
        isOpen={needsPasswordChange}
        isMandatory={true}
        onClose={() => {}}
      />

      {/* Modal Initial SaaS Seeder Wizard */}
      {setupModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/60 backdrop-blur-sm animate-fadeIn">
          <div className="bg-white w-full max-w-md rounded-3xl shadow-xl border border-slate-100 p-6">
            <div className="flex items-center space-x-3 mb-4">
              <div className="w-10 h-10 rounded-xl bg-indigo-50 text-indigo-600 flex items-center justify-center">
                <Sparkles className="w-5 h-5" />
              </div>
              <div>
                <h3 className="text-base font-bold text-slate-900">Setup Awal SaaS SIMFONI</h3>
                <p className="text-xs text-slate-500">Buat akun Superadmin & Sekolah Pilot TK DWP 8</p>
              </div>
            </div>

            {setupSuccess && (
              <div className="mb-4 p-3 rounded-xl bg-emerald-50 border border-emerald-200 text-emerald-700 text-xs flex items-center space-x-2">
                <CheckCircle2 className="w-4 h-4 flex-shrink-0" />
                <span>Inisialisasi berhasil! Mengarahkan ke Dashboard...</span>
              </div>
            )}

            <form onSubmit={handleRunSeeder} className="space-y-3.5">
              <div>
                <label className="block text-xs font-semibold text-slate-700 mb-1">
                  Nama Superadmin
                </label>
                <input
                  type="text"
                  required
                  value={adminNama}
                  onChange={(e) => setAdminNama(e.target.value)}
                  className="w-full px-3.5 py-2.5 text-sm rounded-xl border border-slate-300 focus:outline-none focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-600"
                />
              </div>

              <div>
                <label className="block text-xs font-semibold text-slate-700 mb-1">
                  Email Superadmin
                </label>
                <input
                  type="email"
                  required
                  value={adminEmail}
                  onChange={(e) => setAdminEmail(e.target.value)}
                  placeholder="admin@simfoni-paud.id"
                  className="w-full px-3.5 py-2.5 text-sm rounded-xl border border-slate-300 focus:outline-none focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-600"
                />
              </div>

              <div>
                <label className="block text-xs font-semibold text-slate-700 mb-1">
                  Kata Sandi Superadmin
                </label>
                <input
                  type="password"
                  required
                  value={adminPassword}
                  onChange={(e) => setAdminPassword(e.target.value)}
                  placeholder="Minimal 6 karakter"
                  className="w-full px-3.5 py-2.5 text-sm rounded-xl border border-slate-300 focus:outline-none focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-600"
                />
              </div>

              <div className="p-3 bg-slate-50 rounded-xl text-[11px] text-slate-500 border border-slate-200">
                ⭐ Otomatis membuat Sekolah Pilot: <strong>TK Dharma Wanita Persatuan 8</strong> (Kuota: 5 Guru).
              </div>

              <div className="pt-2 flex items-center space-x-2">
                <button
                  type="button"
                  onClick={() => setSetupModalOpen(false)}
                  className="w-1/2 py-2.5 rounded-xl border border-slate-200 text-slate-600 font-medium text-xs hover:bg-slate-50 transition"
                >
                  Tutup
                </button>
                <button
                  type="submit"
                  disabled={setupLoading || setupSuccess}
                  className="w-1/2 py-2.5 rounded-xl font-medium text-xs text-white bg-indigo-600 hover:bg-indigo-700 shadow-sm transition flex items-center justify-center"
                >
                  {setupLoading ? 'Memproses...' : 'Jalankan Seeder'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}


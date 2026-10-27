import React, { useState, useEffect } from 'react';
import { createPortal } from 'react-dom';
import { 
  Users, 
  UserPlus, 
  Edit, 
  KeyRound, 
  UserX, 
  UserCheck, 
  AlertCircle, 
  CheckCircle2, 
  X, 
  Search, 
  ShieldAlert,
  Sparkles,
  Lock,
  Mail,
  GraduationCap
} from 'lucide-react';
import { collection, query, where, onSnapshot } from 'firebase/firestore';
import { db, createGuruAccountByKepsek, updateGuruByKepsek, toggleStatusGuruByKepsek } from '../../config/firebase';
import { useAuth } from '../../context/AuthContext';
import { logActivity } from '../../utils/auditLogger';
import { resetPasswordAkun } from '../../utils/adminApi';
import { getKelompokOptions, normalizeKelompok, DEFAULT_PASSWORD, KELOMPOK_SEMUA } from '../../utils/schoolConfig';

export default function KelolaGuru() {
  const { userData, schoolData } = useAuth();
  const kelompokOptions = getKelompokOptions(schoolData);

  const [teachers, setTeachers] = useState([]);
  const [loading, setLoading] = useState(true);
  const [searchQuery, setSearchQuery] = useState('');
  const [notification, setNotification] = useState(null);

  // Modal States
  const [addModalOpen, setAddModalOpen] = useState(false);
  const [editModalOpen, setEditModalOpen] = useState(false);
  const [quotaExceededModalOpen, setQuotaExceededModalOpen] = useState(false);
  const [selectedTeacher, setSelectedTeacher] = useState(null);

  // Form Tambah Guru
  const [namaGuru, setNamaGuru] = useState('');
  const [emailGuru, setEmailGuru] = useState('');
  const [passwordGuru, setPasswordGuru] = useState(DEFAULT_PASSWORD.guru);
  const [kelompokKelas, setKelompokKelas] = useState(kelompokOptions[0] || '');
  const [formSubmitting, setFormSubmitting] = useState(false);
  const [formError, setFormError] = useState('');

  // Form Edit Guru
  const [editNama, setEditNama] = useState('');
  const [editKelompok, setEditKelompok] = useState(kelompokOptions[0] || '');
  const [resettingUid, setResettingUid] = useState(null);

  // Ambil Data Guru dari Firestore
  useEffect(() => {
    if (!userData?.school_id) {
      setLoading(false);
      return;
    }

    setLoading(true);
    const q = query(
      collection(db, 'users'),
      where('school_id', '==', userData.school_id),
      where('role', '==', 'guru')
    );

    const unsubscribe = onSnapshot(
      q,
      (snapshot) => {
        const list = snapshot.docs.map((docSnap) => ({
          id: docSnap.id,
          ...docSnap.data(),
        }));
        // Urutkan nama abjad
        list.sort((a, b) => (a.nama || '').localeCompare(b.nama || ''));
        setTeachers(list);
        setLoading(false);
      },
      (error) => {
        console.warn('Gagal memuat data guru:', error);
        setLoading(false);
      }
    );

    return () => unsubscribe();
  }, [userData?.school_id]);

  const activeTeachers = teachers.filter((t) => t.status_akun === 'aktif');
  const maxQuota = schoolData?.kuota_guru || 5;
  const isQuotaFull = activeTeachers.length >= maxQuota;

  // Handler Buka Modal Tambah Guru dengan Validasi Kuota
  const handleOpenAddModal = () => {
    if (isQuotaFull) {
      setQuotaExceededModalOpen(true);
    } else {
      setNamaGuru('');
      setEmailGuru('');
      setPasswordGuru(DEFAULT_PASSWORD.guru);
      setKelompokKelas(kelompokOptions[0] || '');
      setFormError('');
      setAddModalOpen(true);
    }
  };

  // Simpan Guru Baru via Secondary Auth
  const handleCreateGuru = async (e) => {
    e.preventDefault();
    // Cek ulang kuota (data guru bisa berubah realtime selama modal terbuka)
    if (isQuotaFull) {
      setAddModalOpen(false);
      setQuotaExceededModalOpen(true);
      return;
    }
    if (!namaGuru.trim() || !emailGuru.trim()) {
      setFormError('Harap lengkapi nama dan email guru.');
      return;
    }
    if (passwordGuru.length < 6) {
      setFormError('Kata sandi minimal 6 karakter.');
      return;
    }

    setFormSubmitting(true);
    setFormError('');

    try {
      const newUid = await createGuruAccountByKepsek(
        emailGuru.trim(),
        passwordGuru,
        namaGuru.trim(),
        userData.school_id,
        schoolData?.nama_sekolah || userData.nama_sekolah || 'PAUD',
        kelompokKelas
      );

      // Audit Log
      logActivity({
        schoolId: userData.school_id,
        actorId: userData.uid,
        actorNama: userData.nama,
        action: 'ADD_GURU',
        recordType: 'users',
        recordId: newUid,
      });

      setNotification({
        type: 'success',
        text: `Akun Guru "${namaGuru}" berhasil dibuat dengan password awal "${passwordGuru}". Guru wajib membuat password baru saat login pertama.`,
      });

      setAddModalOpen(false);
    } catch (err) {
      console.error('Gagal membuat akun guru:', err);
      let errMsg = 'Gagal membuat akun guru.';
      if (err.code === 'auth/email-already-in-use') {
        errMsg = 'Alamat email ini sudah terdaftar di SIMFONI PAUD.';
      } else if (err.code === 'auth/invalid-email') {
        errMsg = 'Format alamat email tidak valid.';
      } else if (err.code === 'auth/weak-password') {
        errMsg = 'Kata sandi awal terlalu lemah (minimal 6 karakter).';
      } else if (err.code === 'auth/network-request-failed') {
        errMsg = 'Pendaftaran akun memerlukan koneksi internet.';
      } else if (err.code === 'permission-denied') {
        errMsg = 'Pendaftaran ditolak server: kuota guru penuh atau data kuota sekolah belum disinkronkan Superadmin.';
      }
      setFormError(errMsg);
    } finally {
      setFormSubmitting(false);
    }
  };

  // Edit Profil Guru
  const handleOpenEdit = (teacher) => {
    setSelectedTeacher(teacher);
    setEditNama(teacher.nama || '');
    setEditKelompok(normalizeKelompok(teacher.kelompok_kelas) || kelompokOptions[0] || '');
    setEditModalOpen(true);
  };

  const handleUpdateGuru = async (e) => {
    e.preventDefault();
    if (!editNama.trim() || !selectedTeacher) return;

    try {
      await updateGuruByKepsek(selectedTeacher.uid || selectedTeacher.id, {
        nama: editNama.trim(),
        kelompok_kelas: editKelompok,
      });

      logActivity({
        schoolId: userData.school_id,
        actorId: userData.uid,
        actorNama: userData.nama,
        action: 'EDIT_GURU',
        recordType: 'users',
        recordId: selectedTeacher.uid || selectedTeacher.id,
      });

      setNotification({
        type: 'success',
        text: `Data guru "${editNama}" berhasil diperbarui.`,
      });
      setEditModalOpen(false);
    } catch (err) {
      alert('Gagal memperbarui profil guru: ' + err.message);
    }
  };

  // Toggle Status Akun (Aktif vs Nonaktif)
  const handleToggleStatus = async (teacher) => {
    const isCurrentlyActive = teacher.status_akun === 'aktif';
    const newStatus = isCurrentlyActive ? 'nonaktif' : 'aktif';
    const actionDesc = isCurrentlyActive ? 'menonaktifkan' : 'mengaktifkan kembali';

    // Jika ingin mengaktifkan tapi kuota sudah penuh
    if (newStatus === 'aktif' && isQuotaFull) {
      setQuotaExceededModalOpen(true);
      return;
    }

    if (!window.confirm(`Apakah Anda yakin ingin ${actionDesc} akun "${teacher.nama}"?`)) return;

    try {
      await toggleStatusGuruByKepsek(teacher.uid || teacher.id, newStatus, userData.school_id);

      logActivity({
        schoolId: userData.school_id,
        actorId: userData.uid,
        actorNama: userData.nama,
        action: 'TOGGLE_STATUS_GURU',
        recordType: 'users',
        recordId: teacher.uid || teacher.id,
      });

      setNotification({
        type: 'success',
        text: `Status akun guru "${teacher.nama}" diubah menjadi ${newStatus}.`,
      });
    } catch (err) {
      alert(err.code === 'permission-denied'
        ? 'Ditolak server: kuota guru aktif sudah penuh.'
        : 'Gagal mengubah status guru: ' + err.message);
    }
  };

  // Reset Password Guru ke Default (Guru1234!) tanpa perlu membuka email
  const handleResetPassword = async (teacher) => {
    const targetUid = teacher.uid || teacher.id;
    if (!window.confirm(
      `Reset kata sandi guru "${teacher.nama}" ke password default "${DEFAULT_PASSWORD.guru}"?\n\nGuru wajib membuat sandi baru saat login berikutnya.`
    )) return;

    setResettingUid(targetUid);
    try {
      const result = await resetPasswordAkun({ targetUid, targetEmail: teacher.email });

      logActivity({
        schoolId: userData.school_id,
        actorId: userData.uid,
        actorNama: userData.nama,
        action: 'RESET_PASSWORD_GURU',
        recordType: 'users',
        recordId: targetUid,
        detail: { mode: result.mode },
      });

      setNotification({
        type: 'success',
        text: result.mode === 'default'
          ? `Kata sandi "${teacher.nama}" telah direset ke "${result.defaultPassword}". Sampaikan langsung ke guru; sandi wajib diganti saat login.`
          : `Layanan reset instan belum aktif di server, sehingga tautan reset sandi dikirim ke ${teacher.email} dan akun ditandai wajib ganti sandi.`,
      });
    } catch (err) {
      console.warn('Gagal reset sandi:', err);
      setNotification({ type: 'error', text: `Gagal mereset sandi: ${err.message}` });
    } finally {
      setResettingUid(null);
    }
  };

  // Filter Search
  const filteredTeachers = teachers.filter((t) => {
    const q = searchQuery.toLowerCase();
    return (t.nama || '').toLowerCase().includes(q) || (t.email || '').toLowerCase().includes(q);
  });

  return (
    <div className="space-y-6 max-w-6xl mx-auto pb-12">
      
      {/* Header Banner */}
      <div className="bg-gradient-to-r from-amber-500 via-orange-400 to-amber-600 rounded-3xl p-6 md:p-8 text-white shadow-xl shadow-orange-500/15 relative overflow-hidden">
        <div className="absolute right-2 -bottom-4 opacity-20 text-8xl md:text-9xl pointer-events-none select-none font-brand">
          👩‍🏫
        </div>
        <div className="relative z-10 flex flex-col md:flex-row md:items-center md:justify-between gap-4">
          <div>
            <div className="inline-flex items-center space-x-2 px-3.5 py-1 bg-white/20 backdrop-blur-md rounded-full text-xs font-bold mb-3 border border-white/20">
              <Users className="w-3.5 h-3.5" />
              <span>Manajemen Pendidik & Kuota Sekolah</span>
            </div>
            <h1 className="text-2xl md:text-3xl font-extrabold tracking-tight font-brand">
              Kelola Akun Guru PAUD 🌸
            </h1>
            <p className="text-amber-50 text-sm mt-1 font-medium">
              Pengaturan akun pendidik, penugasan kelompok kelas, dan solusi reset sandi
            </p>
          </div>

          <button
            onClick={handleOpenAddModal}
            className="inline-flex items-center justify-center space-x-2 px-5 py-3.5 bg-white text-orange-700 hover:bg-orange-50 active:scale-95 rounded-2xl text-xs font-extrabold transition-all shadow-md shadow-black/10 shrink-0 font-brand"
          >
            <UserPlus className="w-4 h-4 text-orange-600 stroke-[3]" />
            <span>Tambah Guru Baru</span>
          </button>
        </div>
      </div>

      {notification && (
        <div className={`p-4 rounded-3xl text-xs font-bold flex items-center space-x-2.5 animate-fadeIn shadow-sm ${
          notification.type === 'success' 
            ? 'bg-emerald-50 text-emerald-800 border-2 border-emerald-200' 
            : 'bg-rose-50 text-rose-800 border-2 border-rose-200'
        }`}>
          {notification.type === 'success' ? <CheckCircle2 className="w-4 h-4 text-emerald-600 shrink-0" /> : <AlertCircle className="w-4 h-4 text-rose-600 shrink-0" />}
          <span>{notification.text}</span>
        </div>
      )}

      {/* Meteran Kuota Guru & Bar Pencarian */}
      <div className="bg-white rounded-3xl p-5 border border-orange-200/70 shadow-sm space-y-4">
        <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
          {/* Status Kuota Sekolah */}
          <div className="flex items-center space-x-3">
            <div className={`w-10 h-10 rounded-2xl flex items-center justify-center text-lg font-bold ${
              isQuotaFull ? 'bg-rose-100 text-rose-700' : 'bg-emerald-100 text-emerald-700'
            }`}>
              {isQuotaFull ? '⚠️' : '✅'}
            </div>
            <div>
              <div className="flex items-center space-x-2">
                <span className="text-xs font-extrabold text-slate-800 font-brand uppercase tracking-wider">
                  Pemakaian Kuota Guru:
                </span>
                <span className={`px-2.5 py-0.5 rounded-full text-xs font-black ${
                  isQuotaFull ? 'bg-rose-100 text-rose-700' : 'bg-emerald-100 text-emerald-700'
                }`}>
                  {activeTeachers.length} / {maxQuota} Guru Aktif
                </span>
              </div>
              <p className="text-[11px] text-slate-400 mt-0.5 font-medium">
                {isQuotaFull 
                  ? 'Batas paket sekolah tercapai. Hubungi Superadmin untuk menambah kuota.' 
                  : `Tersedia ${maxQuota - activeTeachers.length} slot penambahan guru baru.`}
              </p>
            </div>
          </div>

          {/* Kolom Pencarian */}
          <div className="relative min-w-[240px]">
            <Search className="w-4 h-4 text-slate-400 absolute left-3.5 top-1/2 -translate-y-1/2" />
            <input
              type="text"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              placeholder="Cari nama atau email guru..."
              className="w-full pl-9 pr-4 py-2.5 text-xs font-semibold bg-amber-50/40 border border-orange-200/80 rounded-2xl focus:outline-none focus:bg-white focus:ring-2 focus:ring-orange-400/20"
            />
          </div>
        </div>
      </div>

      {/* Tabel / Daftar Guru */}
      <div className="bg-white rounded-3xl border border-orange-200/70 shadow-sm overflow-hidden">
        <div className="p-5 border-b border-orange-100 flex items-center justify-between">
          <h3 className="text-sm font-extrabold text-slate-900 font-brand">
            Daftar Pendidik ({filteredTeachers.length})
          </h3>
          <span className="text-xs text-slate-400 font-medium">
            Paket: <strong className="text-orange-950 uppercase">{schoolData?.paket_langganan || 'Basic'}</strong>
          </span>
        </div>

        {loading ? (
          <div className="p-12 text-center text-xs text-slate-400">
            <div className="w-8 h-8 border-4 border-orange-500 border-t-transparent rounded-full animate-spin mx-auto mb-2" />
            Memuat daftar guru...
          </div>
        ) : filteredTeachers.length === 0 ? (
          <div className="p-10 text-center text-xs text-slate-400">
            Tidak ada data guru yang cocok dengan pencarian Anda.
          </div>
        ) : (
          <div className="divide-y divide-orange-100/80">
            {filteredTeachers.map((teacher) => {
              const isActive = teacher.status_akun === 'aktif';

              return (
                <div key={teacher.id} className="p-5 hover:bg-amber-50/40 transition flex flex-col md:flex-row md:items-center justify-between gap-4">
                  <div className="flex items-center space-x-3.5">
                    <div className="w-11 h-11 rounded-2xl bg-gradient-to-tr from-amber-400 to-orange-400 text-white flex items-center justify-center text-lg font-bold shadow-xs">
                      👩‍🏫
                    </div>
                    <div>
                      <div className="flex items-center space-x-2">
                        <span className="text-sm font-extrabold text-slate-900 font-brand">
                          {teacher.nama}
                        </span>
                        <span className="px-2.5 py-0.5 rounded-lg bg-orange-50 text-orange-800 text-[10px] font-extrabold border border-orange-200 font-brand">
                          {teacher.kelompok_kelas || 'TK'}
                        </span>
                        <span className={`px-2 py-0.5 rounded-full text-[10px] font-bold ${
                          isActive ? 'bg-emerald-50 text-emerald-700 border border-emerald-200' : 'bg-slate-100 text-slate-500'
                        }`}>
                          {isActive ? 'Aktif' : 'Nonaktif'}
                        </span>
                      </div>
                      <div className="text-xs text-slate-400 flex items-center space-x-2 mt-1">
                        <span>{teacher.email}</span>
                        {teacher.wajib_ganti_password && (
                          <span className="text-amber-600 font-bold bg-amber-50 px-1.5 py-0.5 rounded-md text-[10px]">
                            ⚠️ Wajib Ganti Password
                          </span>
                        )}
                      </div>
                    </div>
                  </div>

                  {/* Tombol Aksi */}
                  <div className="flex items-center space-x-2 self-end md:self-auto">
                    <button
                      onClick={() => handleResetPassword(teacher)}
                      disabled={resettingUid === (teacher.uid || teacher.id)}
                      title="Reset Kata Sandi Guru"
                      className="inline-flex items-center space-x-1.5 px-3 py-2 bg-amber-50 hover:bg-amber-100 text-amber-900 rounded-xl text-xs font-bold transition border border-amber-200 disabled:opacity-60"
                    >
                      <KeyRound className="w-3.5 h-3.5" />
                      <span>{resettingUid === (teacher.uid || teacher.id) ? 'Mereset...' : 'Reset Sandi'}</span>
                    </button>

                    <button
                      onClick={() => handleOpenEdit(teacher)}
                      title="Edit Profil Guru"
                      className="inline-flex items-center space-x-1.5 px-3 py-2 bg-slate-50 hover:bg-slate-100 text-slate-700 rounded-xl text-xs font-bold transition border border-slate-200"
                    >
                      <Edit className="w-3.5 h-3.5" />
                      <span>Edit</span>
                    </button>

                    <button
                      onClick={() => handleToggleStatus(teacher)}
                      title={isActive ? 'Nonaktifkan Akun' : 'Aktifkan Akun'}
                      className={`inline-flex items-center space-x-1 px-3 py-2 rounded-xl text-xs font-bold transition border ${
                        isActive
                          ? 'bg-rose-50 text-rose-700 hover:bg-rose-100 border-rose-200'
                          : 'bg-emerald-50 text-emerald-700 hover:bg-emerald-100 border-emerald-200'
                      }`}
                    >
                      {isActive ? <UserX className="w-3.5 h-3.5" /> : <UserCheck className="w-3.5 h-3.5" />}
                      <span>{isActive ? 'Nonaktifkan' : 'Aktifkan'}</span>
                    </button>
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </div>

      {/* MODAL 1: Tambah Guru Baru via Secondary Auth */}
      {addModalOpen && createPortal(
        <div className="fixed inset-0 z-[100] flex items-center justify-center p-4 bg-slate-900/60 backdrop-blur-sm animate-in fade-in duration-200">
          <div className="bg-white rounded-3xl w-full max-w-md p-6 shadow-2xl border border-orange-200/80 space-y-4">
            <div className="flex items-center justify-between border-b border-orange-100 pb-3">
              <div className="flex items-center space-x-2.5">
                <div className="w-9 h-9 rounded-2xl bg-orange-100 text-orange-700 flex items-center justify-center font-bold">
                  <UserPlus className="w-5 h-5" />
                </div>
                <div>
                  <h3 className="text-base font-extrabold text-slate-900 font-brand">
                    Tambah Akun Guru Baru
                  </h3>
                  <p className="text-xs text-slate-400">Pendaftaran via Secondary Auth (Sesi Aman)</p>
                </div>
              </div>
              <button onClick={() => setAddModalOpen(false)} className="p-1.5 text-slate-400 hover:text-slate-600 rounded-xl">
                <X className="w-5 h-5" />
              </button>
            </div>

            {formError && (
              <div className="p-3 bg-rose-50 border border-rose-200 text-rose-700 rounded-2xl text-xs font-bold flex items-center space-x-2">
                <AlertCircle className="w-4 h-4 shrink-0 text-rose-600" />
                <span>{formError}</span>
              </div>
            )}

            <form onSubmit={handleCreateGuru} className="space-y-3.5">
              <div>
                <label className="block text-xs font-bold text-slate-700 mb-1 uppercase tracking-wide">
                  Nama Lengkap Guru <span className="text-rose-500">*</span>
                </label>
                <input
                  type="text"
                  required
                  value={namaGuru}
                  onChange={(e) => setNamaGuru(e.target.value)}
                  placeholder="Contoh: Bu Siti Rahayu, S.Pd."
                  className="w-full px-3.5 py-2.5 text-xs font-semibold bg-amber-50/30 border border-slate-200 rounded-xl focus:outline-none focus:bg-white focus:ring-2 focus:ring-orange-400/20"
                />
              </div>

              <div>
                <label className="block text-xs font-bold text-slate-700 mb-1 uppercase tracking-wide">
                  Alamat Email Guru <span className="text-rose-500">*</span>
                </label>
                <input
                  type="email"
                  required
                  value={emailGuru}
                  onChange={(e) => setEmailGuru(e.target.value)}
                  placeholder="guru@sekolah.sch.id"
                  className="w-full px-3.5 py-2.5 text-xs font-semibold bg-amber-50/30 border border-slate-200 rounded-xl focus:outline-none focus:bg-white focus:ring-2 focus:ring-orange-400/20"
                />
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-bold text-slate-700 mb-1 uppercase tracking-wide">
                    Kelompok Kelas
                  </label>
                  <select
                    value={kelompokKelas}
                    onChange={(e) => setKelompokKelas(e.target.value)}
                    className="w-full px-3 py-2.5 text-xs font-bold text-slate-800 bg-amber-50/30 border border-slate-200 rounded-xl focus:outline-none focus:bg-white"
                  >
                    {kelompokOptions.map((k) => (
                      <option key={k} value={k}>{k}</option>
                    ))}
                    <option value={KELOMPOK_SEMUA}>Semua Kelas (Guru Pendamping)</option>
                  </select>
                </div>

                <div>
                  <label className="block text-xs font-bold text-slate-700 mb-1 uppercase tracking-wide">
                    Sandi Awal
                  </label>
                  <input
                    type="text"
                    required
                    value={passwordGuru}
                    onChange={(e) => setPasswordGuru(e.target.value)}
                    className="w-full px-3.5 py-2.5 text-xs font-bold text-orange-950 bg-orange-50 border border-orange-200 rounded-xl focus:outline-none"
                  />
                </div>
              </div>

              <div className="p-3 bg-amber-50/60 rounded-2xl border border-amber-200/70 text-[11px] text-amber-900 leading-relaxed">
                💡 <strong>Solusi Lupa Sandi:</strong> Password awal diatur ke <code>{DEFAULT_PASSWORD.guru}</code>. Guru wajib memperbarui password pribadi saat login pertama kali.
              </div>

              <div className="pt-2 flex justify-end space-x-2">
                <button
                  type="button"
                  onClick={() => setAddModalOpen(false)}
                  className="px-4 py-2.5 text-xs font-bold text-slate-600 hover:bg-slate-100 rounded-xl transition"
                >
                  Batal
                </button>
                <button
                  type="submit"
                  disabled={formSubmitting}
                  className="px-5 py-2.5 text-xs font-extrabold text-white bg-gradient-to-r from-amber-500 to-orange-500 hover:from-amber-600 hover:to-orange-600 rounded-xl transition shadow-md shadow-orange-500/20 disabled:opacity-50"
                >
                  {formSubmitting ? 'Mendaftarkan...' : 'Daftarkan Guru'}
                </button>
              </div>
            </form>
          </div>
        </div>,
        document.body
      )}

      {/* MODAL 2: Peringatan Kuota Guru Penuh */}
      {quotaExceededModalOpen && createPortal(
        <div className="fixed inset-0 z-[100] flex items-center justify-center p-4 bg-slate-900/60 backdrop-blur-sm animate-in fade-in duration-200">
          <div className="bg-white rounded-3xl w-full max-w-md p-6 shadow-2xl border border-rose-200 text-center space-y-4">
            <div className="w-14 h-14 rounded-3xl bg-rose-100 text-rose-700 flex items-center justify-center text-2xl mx-auto shadow-xs">
              ⚠️
            </div>
            <div>
              <h3 className="text-base font-extrabold text-slate-900 font-brand">
                Batas Kuota Guru Tercapai!
              </h3>
              <p className="text-xs text-slate-600 mt-2 leading-relaxed">
                Sekolah Anda telah menggunakan <strong>{activeTeachers.length} dari {maxQuota}</strong> kuota akun guru aktif pada paket <strong>{schoolData?.paket_langganan || 'Basic'}</strong>.
              </p>
            </div>

            <div className="p-3.5 bg-amber-50 rounded-2xl border border-amber-200 text-xs text-amber-900 text-left space-y-1">
              <span className="font-bold">Langkah Tindak Lanjut:</span>
              <p className="text-[11px] text-amber-800">
                Silakan hubungi Administrator Sistem (Superadmin SIMFONI) untuk memperluas kuota guru sekolah Anda, atau nonaktifkan guru yang sudah mutasi/berhenti.
              </p>
            </div>

            <button
              onClick={() => setQuotaExceededModalOpen(false)}
              className="w-full py-3 bg-slate-100 hover:bg-slate-200 text-slate-800 rounded-xl text-xs font-bold transition"
            >
              Mengerti & Tutup
            </button>
          </div>
        </div>,
        document.body
      )}

      {/* MODAL 3: Edit Profil Guru */}
      {editModalOpen && selectedTeacher && createPortal(
        <div className="fixed inset-0 z-[100] flex items-center justify-center p-4 bg-slate-900/60 backdrop-blur-sm animate-in fade-in duration-200">
          <div className="bg-white rounded-3xl w-full max-w-md p-6 shadow-2xl border border-orange-200/80 space-y-4">
            <div className="flex items-center justify-between border-b border-orange-100 pb-3">
              <h3 className="text-base font-extrabold text-slate-900 font-brand">
                Edit Profil Guru
              </h3>
              <button onClick={() => setEditModalOpen(false)} className="p-1.5 text-slate-400 hover:text-slate-600 rounded-xl">
                <X className="w-5 h-5" />
              </button>
            </div>

            <form onSubmit={handleUpdateGuru} className="space-y-3.5">
              <div>
                <label className="block text-xs font-bold text-slate-700 mb-1 uppercase tracking-wide">
                  Nama Lengkap
                </label>
                <input
                  type="text"
                  required
                  value={editNama}
                  onChange={(e) => setEditNama(e.target.value)}
                  className="w-full px-3.5 py-2.5 text-xs font-semibold bg-amber-50/30 border border-slate-200 rounded-xl focus:outline-none focus:bg-white focus:ring-2 focus:ring-orange-400/20"
                />
              </div>

              <div>
                <label className="block text-xs font-bold text-slate-700 mb-1 uppercase tracking-wide">
                  Kelompok Kelas Diampu
                </label>
                <select
                  value={editKelompok}
                  onChange={(e) => setEditKelompok(e.target.value)}
                  className="w-full px-3 py-2.5 text-xs font-bold text-slate-800 bg-amber-50/30 border border-slate-200 rounded-xl focus:outline-none focus:bg-white"
                >
                  {!kelompokOptions.includes(editKelompok) && editKelompok !== KELOMPOK_SEMUA && editKelompok && (
                    <option value={editKelompok}>{editKelompok}</option>
                  )}
                  {kelompokOptions.map((k) => (
                    <option key={k} value={k}>{k}</option>
                  ))}
                  <option value={KELOMPOK_SEMUA}>Semua Kelas (Guru Pendamping)</option>
                </select>
              </div>

              <div className="pt-2 flex justify-end space-x-2">
                <button
                  type="button"
                  onClick={() => setEditModalOpen(false)}
                  className="px-4 py-2.5 text-xs font-bold text-slate-600 hover:bg-slate-100 rounded-xl transition"
                >
                  Batal
                </button>
                <button
                  type="submit"
                  className="px-5 py-2.5 text-xs font-extrabold text-white bg-gradient-to-r from-amber-500 to-orange-500 hover:from-amber-600 hover:to-orange-600 rounded-xl transition shadow-md shadow-orange-500/20"
                >
                  Simpan Perubahan
                </button>
              </div>
            </form>
          </div>
        </div>,
        document.body
      )}

    </div>
  );
}


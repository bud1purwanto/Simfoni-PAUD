import React, { useState, useEffect } from 'react';
import { createPortal } from 'react-dom';
import { 
  Users, 
  UserPlus, 
  KeyRound, 
  Edit, 
  Search, 
  ShieldAlert, 
  ShieldCheck, 
  CheckCircle2, 
  AlertCircle, 
  X, 
  School, 
  Building2, 
  Lock, 
  Mail, 
  UserCheck, 
  UserX,
  Sparkles
} from 'lucide-react';
import { 
  collection, 
  onSnapshot, 
  doc, 
  updateDoc, 
  serverTimestamp 
} from 'firebase/firestore';
import {
  db,
  createKepsekAccountBySuperadmin
} from '../../config/firebase';
import { useAuth } from '../../context/AuthContext';
import { formatTanggalIndo } from '../../utils/formatters';
import { logActivity } from '../../utils/auditLogger';
import ModalKonfirmasi from '../../components/ui/ModalKonfirmasi';
import { resetPasswordAkun } from '../../utils/adminApi';
import { DEFAULT_PASSWORD } from '../../utils/schoolConfig';
import ModalResetPassword from '../../components/ui/ModalResetPassword';

export default function KelolaAkunKepsek() {
  const { userData } = useAuth();

  const [kepsekList, setKepsekList] = useState([]);
  const [schools, setSchools] = useState([]);
  const [loading, setLoading] = useState(true);
  const [searchQuery, setSearchQuery] = useState('');
  const [notification, setNotification] = useState(null);

  // Modal States
  const [addModalOpen, setAddModalOpen] = useState(false);
  const [editModalOpen, setEditModalOpen] = useState(false);
  const [selectedKepsek, setSelectedKepsek] = useState(null);
  const [resetModalOpen, setResetModalOpen] = useState(false);
  const [targetKepsekForReset, setTargetKepsekForReset] = useState(null);
  const [resetLoading, setResetLoading] = useState(false);

  // Form Tambah Kepsek
  const [formSchoolId, setFormSchoolId] = useState('');
  const [formNama, setFormNama] = useState('');
  const [formEmail, setFormEmail] = useState('');
  const [formPassword, setFormPassword] = useState(DEFAULT_PASSWORD.kepsek);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [formError, setFormError] = useState('');

  // Form Edit Kepsek
  const [editNama, setEditNama] = useState('');

  // Modal Konfirmasi Kustom Elegan
  const [confirmModal, setConfirmModal] = useState({ isOpen: false, title: '', message: '', confirmText: 'Ya, Lanjutkan', type: 'warning', onConfirm: () => {}, loading: false });

  // 1. Ambil Data Real-Time
  useEffect(() => {
    setLoading(true);

    const unsubSchools = onSnapshot(collection(db, 'schools'), (snap) => {
      const list = snap.docs.map((d) => ({ id: d.id, ...d.data() }));
      list.sort((a, b) => (a.nama_sekolah || '').localeCompare(b.nama_sekolah || ''));
      setSchools(list);
    });

    const unsubUsers = onSnapshot(collection(db, 'users'), (snap) => {
      const list = snap.docs
        .map((d) => ({ id: d.id, ...d.data() }))
        .filter((u) => u.role === 'kepsek');
      setKepsekList(list);
      setLoading(false);
    });

    return () => {
      unsubSchools();
      unsubUsers();
    };
  }, []);

  const showNotification = (type, message) => {
    setNotification({ type, message });
    setTimeout(() => setNotification(null), 4000);
  };

  const handleOpenAddModal = () => {
    setFormEmail('');
    setFormPassword(DEFAULT_PASSWORD.kepsek);
    setFormError('');
    // Prioritaskan sekolah yang belum memiliki Kepala Sekolah aktif
    const schoolsWithKepsek = new Set(kepsekList.filter((k) => k.status_akun === 'aktif').map((k) => k.school_id));
    const firstSchool = schools.find((s) => !schoolsWithKepsek.has(s.id)) || schools[0];
    if (firstSchool) {
      setFormSchoolId(firstSchool.id);
      setFormNama(firstSchool.nama_kepsek_resmi || '');
    } else {
      setFormNama('');
    }
    setAddModalOpen(true);
  };

  const handleOpenEditModal = (k) => {
    setSelectedKepsek(k);
    setEditNama(k.nama || '');
    setEditModalOpen(true);
  };

  // Buat Akun Kepsek via Secondary Auth (Tanpa Ter-Logout)
  const handleCreateKepsek = async (e) => {
    e.preventDefault();
    setFormError('');

    if (!formNama.trim() || !formEmail.trim() || !formPassword.trim()) {
      setFormError('Seluruh kolom pendaftaran wajib diisi.');
      return;
    }

    if (formPassword.length < 6) {
      setFormError('Kata sandi minimal 6 karakter.');
      return;
    }

    if (!formSchoolId || !schools.some((s) => s.id === formSchoolId)) {
      setFormError('Pilih sekolah mitra terlebih dahulu.');
      return;
    }

    const existingKepsek = kepsekList.find((k) => k.school_id === formSchoolId && k.status_akun === 'aktif');
    if (existingKepsek && !window.confirm(
      `Sekolah ini sudah memiliki Kepala Sekolah aktif (${existingKepsek.nama}). Tetap tambahkan akun Kepsek kedua?`
    )) {
      return;
    }

    setIsSubmitting(true);

    try {
      const selectedSchool = schools.find((s) => s.id === formSchoolId);
      const namaSekolah = selectedSchool?.nama_sekolah || 'Sekolah Mitra';

      const newUid = await createKepsekAccountBySuperadmin(
        formEmail.trim(),
        formPassword,
        formNama.trim(),
        formSchoolId,
        namaSekolah
      );

      // Sinkronkan nama_kepsek_resmi di dokumen sekolah jika sekolah belum memiliki atau berbeda
      if (selectedSchool && selectedSchool.nama_kepsek_resmi !== formNama.trim()) {
        await updateDoc(doc(db, 'schools', formSchoolId), {
          nama_kepsek_resmi: formNama.trim(),
          updated_at: serverTimestamp(),
        });
      }

      logActivity({
        schoolId: formSchoolId,
        actorId: userData.uid,
        actorNama: userData.nama,
        action: 'ADD_KEPSEK',
        recordType: 'users',
        recordId: newUid,
        detail: { nama: formNama.trim(), email: formEmail.trim() },
      });

      showNotification('success', `Akun Kepala Sekolah "${formNama}" berhasil dibuat!`);
      setAddModalOpen(false);
    } catch (err) {
      console.error('Error creating kepsek account:', err);
      if (err.code === 'auth/email-already-in-use') {
        setFormError('Alamat email ini sudah terdaftar di sistem.');
      } else {
        setFormError('Gagal membuat akun: ' + err.message);
      }
    } finally {
      setIsSubmitting(false);
    }
  };

  // Simpan Edit Nama Kepsek
  const handleSaveEdit = async (e) => {
    e.preventDefault();
    if (!editNama.trim() || !selectedKepsek) return;

    try {
      await updateDoc(doc(db, 'users', selectedKepsek.id), {
        nama: editNama.trim(),
        updated_at: serverTimestamp(),
      });

      // Sinkronkan ke profil sekolah penandatangan resmi
      if (selectedKepsek.school_id) {
        await updateDoc(doc(db, 'schools', selectedKepsek.school_id), {
          nama_kepsek_resmi: editNama.trim(),
          updated_at: serverTimestamp(),
        });
      }

      logActivity({
        schoolId: selectedKepsek.school_id,
        actorId: userData.uid,
        actorNama: userData.nama,
        action: 'EDIT_KEPSEK',
        recordType: 'users',
        recordId: selectedKepsek.id,
        detail: { nama: editNama.trim() },
      });

      showNotification('success', 'Profil Kepala Sekolah berhasil diperbarui!');
      setEditModalOpen(false);
    } catch (err) {
      console.error('Error updating kepsek:', err);
      showNotification('error', 'Gagal memperbarui profil: ' + err.message);
    }
  };

  // Buka Modal Reset Password Kepsek (Admin tentukan sandi baru)
  const handleResetPassword = (k) => {
    setTargetKepsekForReset(k);
    setResetModalOpen(true);
  };

  const handleConfirmResetPassword = async (newPassword) => {
    if (!targetKepsekForReset) return;
    setResetLoading(true);
    try {
      const result = await resetPasswordAkun({
        targetUid: targetKepsekForReset.id,
        targetEmail: targetKepsekForReset.email,
        newPassword,
      });

      await logActivity({
        schoolId: targetKepsekForReset.school_id,
        actorId: userData.uid,
        actorNama: userData.nama,
        action: 'RESET_PASSWORD_KEPSEK',
        recordType: 'users',
        recordId: targetKepsekForReset.id,
        detail: { mode: result.mode, sandiSementara: newPassword },
      });

      setResetModalOpen(false);
      showNotification(
        'success',
        result.mode === 'default'
          ? `Kata sandi ${targetKepsekForReset.nama} disetel ke "${newPassword}". Akun ditandai wajib ganti kata sandi.`
          : `Layanan reset instan belum aktif di server. Tautan reset sandi dikirim ke ${targetKepsekForReset.email} dan akun ditandai wajib ganti sandi.`
      );
    } catch (err) {
      console.error('Error resetting password:', err);
      showNotification('error', 'Gagal mereset kata sandi: ' + err.message);
    } finally {
      setResetLoading(false);
    }
  };

  // Toggle Status Akun (Aktif vs Nonaktif)
  const handleToggleStatus = (k) => {
    const nextStatus = k.status_akun === 'aktif' ? 'nonaktif' : 'aktif';
    const isDeactivating = nextStatus === 'nonaktif';
    const actionLabel = isDeactivating ? 'menonaktifkan' : 'mengaktifkan kembali';

    setConfirmModal({
      isOpen: true,
      title: `${isDeactivating ? 'Nonaktifkan' : 'Aktifkan'} Akun Kepala Sekolah`,
      message: `Apakah Anda yakin ingin ${actionLabel} akun "${k.nama}"? ${isDeactivating ? 'Kepala Sekolah tidak akan dapat mengakses sistem sekolah hingga diaktifkan kembali.' : 'Kepala Sekolah akan dapat kembali mengakses sistem sekolah.'}`,
      confirmText: isDeactivating ? 'Ya, Nonaktifkan' : 'Ya, Aktifkan',
      type: isDeactivating ? 'danger' : 'success',
      loading: false,
      onConfirm: async () => {
        setConfirmModal((prev) => ({ ...prev, loading: true }));
        try {
          await updateDoc(doc(db, 'users', k.id), {
            status_akun: nextStatus,
            updated_at: serverTimestamp(),
          });

          await logActivity({
            schoolId: k.school_id,
            actorId: userData.uid,
            actorNama: userData.nama,
            action: 'TOGGLE_STATUS_KEPSEK',
            recordType: 'users',
            recordId: k.id,
            detail: { status: nextStatus },
          });

          setConfirmModal((prev) => ({ ...prev, isOpen: false, loading: false }));
          showNotification('success', `Status akun "${k.nama}" berhasil diubah ke: ${nextStatus.toUpperCase()}`);
        } catch (err) {
          console.error('Error toggling kepsek status:', err);
          setConfirmModal((prev) => ({ ...prev, isOpen: false, loading: false }));
          showNotification('error', 'Gagal mengubah status: ' + err.message);
        }
      },
    });
  };

  // Filter Data
  const filteredKepsek = kepsekList.filter((k) => {
    const q = searchQuery.toLowerCase();
    return (
      (k.nama || '').toLowerCase().includes(q) ||
      (k.email || '').toLowerCase().includes(q) ||
      (k.nama_sekolah || '').toLowerCase().includes(q)
    );
  });

  return (
    <div className="space-y-6 pb-20 md:pb-6">
      {/* Header Banner */}
      <div className="bg-gradient-to-r from-amber-500 via-orange-500 to-amber-600 rounded-3xl p-6 md:p-8 text-white shadow-lg shadow-orange-500/20 relative overflow-hidden">
        <div className="absolute right-0 top-0 translate-x-12 -translate-y-12 w-64 h-64 bg-white/10 rounded-full blur-3xl pointer-events-none" />
        <div className="relative z-10 flex flex-col md:flex-row md:items-center justify-between gap-4">
          <div>
            <div className="inline-flex items-center space-x-2 px-3 py-1 bg-white/20 backdrop-blur-md rounded-full text-xs font-bold text-amber-100 mb-3">
              <Building2 className="w-3.5 h-3.5" />
              <span>School Administrators Gateway</span>
            </div>
            <h1 className="text-2xl md:text-3xl font-extrabold font-brand tracking-tight">
              Kelola Akun Kepala Sekolah
            </h1>
            <p className="text-amber-100 text-sm mt-1 max-w-xl font-medium">
              Pendaftaran akun pimpinan PAUD mitra via Secondary Auth (tanpa me-logout sesi aktif), reset password cepat, dan kontrol hak akses.
            </p>
          </div>

          <button
            onClick={handleOpenAddModal}
            className="self-start md:self-auto px-5 py-3 bg-white text-orange-600 hover:bg-orange-50 active:scale-95 font-extrabold text-xs rounded-2xl shadow-sm transition flex items-center space-x-2 font-brand"
          >
            <UserPlus className="w-4 h-4 stroke-[3]" />
            <span>Buat Akun Kepsek Baru</span>
          </button>
        </div>
      </div>

      {/* Notifikasi Toast */}
      {notification && (
        <div
          className={`p-4 rounded-2xl flex items-center space-x-3 text-sm font-semibold transition animate-in fade-in slide-in-from-top-3 ${
            notification.type === 'success'
              ? 'bg-emerald-50 text-emerald-800 border border-emerald-200'
              : 'bg-rose-50 text-rose-800 border border-rose-200'
          }`}
        >
          {notification.type === 'success' ? (
            <CheckCircle2 className="w-5 h-5 text-emerald-600 flex-shrink-0" />
          ) : (
            <AlertCircle className="w-5 h-5 text-rose-600 flex-shrink-0" />
          )}
          <span>{notification.message}</span>
        </div>
      )}

      {/* SEARCH BAR */}
      <div className="bg-white rounded-3xl p-4 border border-slate-200/80 shadow-sm flex items-center justify-between">
        <div className="relative w-full md:w-80">
          <div className="absolute inset-y-0 left-0 pl-3.5 flex items-center pointer-events-none text-slate-400">
            <Search className="w-4 h-4" />
          </div>
          <input
            type="text"
            placeholder="Cari nama, email, atau sekolah..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="w-full pl-10 pr-4 py-2 text-xs font-medium rounded-xl border border-slate-200 focus:outline-none focus:ring-2 focus:ring-amber-500/20 focus:border-amber-500"
          />
        </div>

        <span className="text-xs text-slate-400 font-bold hidden md:inline">
          {filteredKepsek.length} Kepala Sekolah Terdaftar
        </span>
      </div>

      {/* TABEL DAFTAR KEPALA SEKOLAH */}
      <div className="bg-white rounded-3xl border border-slate-200/80 shadow-sm overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-left text-xs">
            <thead className="bg-slate-50 text-slate-500 font-bold uppercase tracking-wider border-b border-slate-100">
              <tr>
                <th className="py-3.5 px-4">Kepala Sekolah</th>
                <th className="py-3.5 px-4">Sekolah Binaan</th>
                <th className="py-3.5 px-4 text-center">Status Akun</th>
                <th className="py-3.5 px-4 text-center">Wajib Ganti Password</th>
                <th className="py-3.5 px-4 text-right">Tindakan</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100 font-medium">
              {loading ? (
                <tr>
                  <td colSpan={5} className="py-8 text-center text-slate-400">
                    Memuat data akun Kepala Sekolah...
                  </td>
                </tr>
              ) : filteredKepsek.length === 0 ? (
                <tr>
                  <td colSpan={5} className="py-8 text-center text-slate-400">
                    Belum ada akun Kepala Sekolah terdaftar.
                  </td>
                </tr>
              ) : (
                filteredKepsek.map((k) => {
                  const isAktif = k.status_akun === 'aktif';

                  return (
                    <tr key={k.id} className="hover:bg-slate-50/80 transition">
                      <td className="py-3.5 px-4">
                        <div className="flex items-center space-x-3">
                          <div className="w-9 h-9 rounded-2xl bg-amber-100 text-amber-800 flex items-center justify-center font-bold text-xs flex-shrink-0">
                            {k.nama ? k.nama.charAt(0).toUpperCase() : 'K'}
                          </div>
                          <div>
                            <div className="font-bold text-slate-800 text-xs">{k.nama}</div>
                            <div className="text-[11px] text-slate-400 font-normal">{k.email}</div>
                          </div>
                        </div>
                      </td>

                      <td className="py-3.5 px-4 text-slate-700 font-bold">
                        <div className="flex items-center space-x-1.5">
                          <School className="w-3.5 h-3.5 text-amber-600" />
                          <span>{k.nama_sekolah || k.school_id || '-'}</span>
                        </div>
                      </td>

                      <td className="py-3.5 px-4 text-center">
                        <span
                          className={`px-2.5 py-0.5 rounded-full text-[10px] font-extrabold ${
                            isAktif
                              ? 'bg-emerald-100 text-emerald-800'
                              : 'bg-rose-100 text-rose-800'
                          }`}
                        >
                          {isAktif ? 'AKTIF' : 'NONAKTIF'}
                        </span>
                      </td>

                      <td className="py-3.5 px-4 text-center">
                        {k.wajib_ganti_password ? (
                          <span className="px-2 py-0.5 rounded-full text-[10px] font-bold bg-amber-100 text-amber-800 border border-amber-200">
                            Ya (Baru Direset)
                          </span>
                        ) : (
                          <span className="text-slate-400 text-[11px]">Normal</span>
                        )}
                      </td>

                      <td className="py-3.5 px-4 text-right">
                        <div className="flex items-center justify-end space-x-1.5">
                          <button
                            onClick={() => handleResetPassword(k)}
                            title={`Reset Kata Sandi ke Default (${DEFAULT_PASSWORD.kepsek})`}
                            className="px-2.5 py-1.5 bg-amber-50 hover:bg-amber-100 text-amber-700 font-bold rounded-xl transition text-[11px] flex items-center space-x-1"
                          >
                            <KeyRound className="w-3.5 h-3.5" />
                            <span>Reset Sandi</span>
                          </button>

                          <button
                            onClick={() => handleOpenEditModal(k)}
                            title="Edit Profil"
                            className="p-1.5 text-slate-400 hover:text-amber-600 hover:bg-amber-50 rounded-lg transition"
                          >
                            <Edit className="w-4 h-4" />
                          </button>

                          <button
                            onClick={() => handleToggleStatus(k)}
                            title={isAktif ? 'Nonaktifkan Akun' : 'Aktifkan Akun'}
                            className={`p-1.5 rounded-lg transition ${
                              isAktif
                                ? 'text-slate-400 hover:text-rose-600 hover:bg-rose-50'
                                : 'text-emerald-600 hover:bg-emerald-50'
                            }`}
                          >
                            {isAktif ? <UserX className="w-4 h-4" /> : <UserCheck className="w-4 h-4" />}
                          </button>
                        </div>
                      </td>
                    </tr>
                  );
                })
              )}
            </tbody>
          </table>
        </div>
      </div>

      {/* MODAL BUAT AKUN KEPALA SEKOLAH */}
      {addModalOpen && createPortal(
        <div className="fixed inset-0 z-[100] bg-slate-900/60 backdrop-blur-sm flex items-center justify-center p-4 animate-in fade-in duration-200">
          <div className="bg-white rounded-3xl max-w-md w-full p-6 shadow-2xl border border-slate-100">
            <div className="flex items-center justify-between pb-4 border-b border-slate-100">
              <div className="flex items-center space-x-2">
                <div className="w-9 h-9 rounded-xl bg-amber-100 text-amber-700 flex items-center justify-center">
                  <UserPlus className="w-5 h-5" />
                </div>
                <div>
                  <h2 className="text-base font-extrabold text-slate-800 font-brand">
                    Buat Akun Kepala Sekolah
                  </h2>
                  <p className="text-[11px] text-slate-400 font-medium">
                    Daftarkan akun login via Secondary Auth.
                  </p>
                </div>
              </div>
              <button
                onClick={() => setAddModalOpen(false)}
                className="p-1.5 text-slate-400 hover:text-slate-600 rounded-lg hover:bg-slate-100 transition"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            {formError && (
              <div className="mt-4 p-3 bg-rose-50 border border-rose-200 rounded-2xl text-rose-700 text-xs font-semibold flex items-center space-x-2">
                <AlertCircle className="w-4 h-4 flex-shrink-0" />
                <span>{formError}</span>
              </div>
            )}

            <form onSubmit={handleCreateKepsek} className="mt-4 space-y-3.5">
              {/* Pilih Sekolah */}
              <div>
                <label className="block text-xs font-bold text-slate-700 mb-1">
                  Sekolah Binaan <span className="text-rose-500">*</span>
                </label>
                {schools.length === 0 ? (
                  <p className="text-xs text-rose-500">
                    Belum ada sekolah terdaftar. Silakan buat sekolah terlebih dahulu.
                  </p>
                ) : (
                  <select
                    value={formSchoolId}
                    onChange={(e) => {
                      const selectedId = e.target.value;
                      setFormSchoolId(selectedId);
                      const targetSchool = schools.find((s) => s.id === selectedId);
                      if (targetSchool?.nama_kepsek_resmi) {
                        setFormNama(targetSchool.nama_kepsek_resmi);
                      }
                    }}
                    className="w-full px-3 py-2 text-xs font-bold rounded-xl border border-slate-200 focus:outline-none focus:ring-2 focus:ring-orange-500/20 focus:border-orange-500"
                  >
                    {schools.map((s) => (
                      <option key={s.id} value={s.id}>
                        {s.nama_sekolah} ({s.kota || 'Umum'})
                      </option>
                    ))}
                  </select>
                )}
              </div>

              {/* Nama Lengkap */}
              <div>
                <label className="block text-xs font-bold text-slate-700 mb-1">
                  Nama Lengkap Kepala Sekolah <span className="text-rose-500">*</span>
                </label>
                <input
                  type="text"
                  required
                  placeholder="Contoh: Hj. Siti Nurjanah, S.Pd"
                  value={formNama}
                  onChange={(e) => setFormNama(e.target.value)}
                  className="w-full px-3 py-2 text-xs font-medium rounded-xl border border-slate-200 focus:outline-none focus:ring-2 focus:ring-orange-500/20 focus:border-orange-500"
                />
              </div>

              {/* Email Login */}
              <div>
                <label className="block text-xs font-bold text-slate-700 mb-1">
                  Email Login <span className="text-rose-500">*</span>
                </label>
                <input
                  type="email"
                  required
                  placeholder="kepsek.dwp8@gmail.com"
                  value={formEmail}
                  onChange={(e) => setFormEmail(e.target.value)}
                  className="w-full px-3 py-2 text-xs font-medium rounded-xl border border-slate-200 focus:outline-none focus:ring-2 focus:ring-orange-500/20 focus:border-orange-500"
                />
              </div>

              {/* Password Default */}
              <div>
                <label className="block text-xs font-bold text-slate-700 mb-1">
                  Kata Sandi Awal
                </label>
                <input
                  type="text"
                  required
                  value={formPassword}
                  onChange={(e) => setFormPassword(e.target.value)}
                  className="w-full px-3 py-2 text-xs font-mono font-bold rounded-xl border border-slate-200 focus:outline-none focus:ring-2 focus:ring-orange-500/20 focus:border-orange-500 bg-slate-50"
                />
                <span className="text-[10px] text-slate-400 mt-1 block">
                  Kepsek wajib mengganti sandi ini saat pertama kali berhasil login.
                </span>
              </div>

              <div className="flex items-center justify-end space-x-2 pt-3 border-t border-slate-100">
                <button
                  type="button"
                  onClick={() => setAddModalOpen(false)}
                  className="px-4 py-2 text-xs font-bold text-slate-600 hover:bg-slate-100 rounded-xl transition"
                >
                  Batal
                </button>
                <button
                  type="submit"
                  disabled={isSubmitting || schools.length === 0}
                  className="px-5 py-2 text-xs font-extrabold text-white bg-gradient-to-r from-amber-500 to-orange-500 hover:from-amber-600 hover:to-orange-600 rounded-xl shadow-md shadow-orange-500/20 active:scale-95 transition disabled:opacity-50"
                >
                  {isSubmitting ? 'Memproses Akun...' : 'Daftarkan Kepsek'}
                </button>
              </div>
            </form>
          </div>
        </div>,
        document.body
      )}

      {/* MODAL EDIT PROFIL KEPSEK */}
      {editModalOpen && createPortal(
        <div className="fixed inset-0 z-[100] bg-slate-900/60 backdrop-blur-sm flex items-center justify-center p-4 animate-in fade-in duration-200">
          <div className="bg-white rounded-3xl max-w-sm w-full p-6 shadow-2xl border border-slate-100">
            <div className="flex items-center justify-between pb-4 border-b border-slate-100">
              <h2 className="text-base font-extrabold text-slate-800 font-brand">
                Edit Profil Kepala Sekolah
              </h2>
              <button
                onClick={() => setEditModalOpen(false)}
                className="p-1.5 text-slate-400 hover:text-slate-600 rounded-lg hover:bg-slate-100 transition"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <form onSubmit={handleSaveEdit} className="mt-4 space-y-3">
              <div>
                <label className="block text-xs font-bold text-slate-700 mb-1">
                  Nama Lengkap
                </label>
                <input
                  type="text"
                  required
                  value={editNama}
                  onChange={(e) => setEditNama(e.target.value)}
                  className="w-full px-3 py-2 text-xs font-medium rounded-xl border border-slate-200 focus:outline-none focus:ring-2 focus:ring-orange-500/20 focus:border-orange-500"
                />
              </div>

              <div className="flex items-center justify-end space-x-2 pt-3 border-t border-slate-100">
                <button
                  type="button"
                  onClick={() => setEditModalOpen(false)}
                  className="px-4 py-2 text-xs font-bold text-slate-600 hover:bg-slate-100 rounded-xl transition"
                >
                  Batal
                </button>
                <button
                  type="submit"
                  className="px-4 py-2 text-xs font-extrabold text-white bg-orange-600 hover:bg-orange-700 rounded-xl transition"
                >
                  Simpan
                </button>
              </div>
            </form>
          </div>
        </div>,
        document.body
      )}

      {/* MODAL RESET KATA SANDI (ADMIN TENTUKAN SANDI) */}
      <ModalResetPassword
        isOpen={resetModalOpen}
        targetUser={targetKepsekForReset}
        defaultPassword="Kepsek1234!"
        loading={resetLoading}
        onClose={() => setResetModalOpen(false)}
        onConfirm={handleConfirmResetPassword}
      />

      {/* MODAL KONFIRMASI ELEGAN */}
      <ModalKonfirmasi
        isOpen={confirmModal.isOpen}
        title={confirmModal.title}
        message={confirmModal.message}
        confirmText={confirmModal.confirmText}
        type={confirmModal.type}
        loading={confirmModal.loading}
        onConfirm={confirmModal.onConfirm}
        onClose={() => setConfirmModal((prev) => ({ ...prev, isOpen: false }))}
      />
    </div>
  );
}


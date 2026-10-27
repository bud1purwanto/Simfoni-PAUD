import React, { useState, useEffect } from 'react';
import { createPortal } from 'react-dom';
import { 
  School, 
  Plus, 
  Search, 
  Edit, 
  Trash2, 
  ShieldAlert, 
  ShieldCheck, 
  CheckCircle2, 
  AlertCircle, 
  X, 
  Building2, 
  Upload, 
  Calendar, 
  Users, 
  Phone, 
  MapPin, 
  FileText,
  Sparkles,
  ExternalLink
} from 'lucide-react';
import { 
  collection, 
  onSnapshot, 
  doc, 
  setDoc, 
  updateDoc, 
  deleteDoc, 
  serverTimestamp 
} from 'firebase/firestore';
import { ref, uploadBytes, getDownloadURL } from 'firebase/storage';
import { db, storage } from '../../config/firebase';
import { useAuth } from '../../context/AuthContext';
import { formatTanggalIndo } from '../../utils/formatters';
import { logActivity } from '../../utils/auditLogger';

export default function KelolaSekolah() {
  const { userData } = useAuth();

  const [schools, setSchools] = useState([]);
  const [users, setUsers] = useState([]);
  const [loading, setLoading] = useState(true);
  const [searchQuery, setSearchQuery] = useState('');
  const [statusFilter, setStatusFilter] = useState('semua');
  const [notification, setNotification] = useState(null);

  // Modal States
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [editingSchoolId, setEditingSchoolId] = useState(null);
  const [deleteConfirmSchool, setDeleteConfirmSchool] = useState(null);
  const [submitting, setSubmitting] = useState(false);

  // Form Fields
  const [formId, setFormId] = useState('');
  const [formNama, setFormNama] = useState('');
  const [formNpsn, setFormNpsn] = useState('');
  const [formAlamat, setFormAlamat] = useState('');
  const [formKota, setFormKota] = useState('Surabaya');
  const [formTelepon, setFormTelepon] = useState('');
  const [formNamaKepsek, setFormNamaKepsek] = useState('');
  const [formNipKepsek, setFormNipKepsek] = useState('');
  const [formPaket, setFormPaket] = useState('basic');
  const [formKuotaGuru, setFormKuotaGuru] = useState(5);
  const [formBerlakuHingga, setFormBerlakuHingga] = useState('2027-12-31');
  const [formStatus, setFormStatus] = useState('aktif');

  // File Upload States
  const [logoFile, setLogoFile] = useState(null);
  const [logoPreview, setLogoPreview] = useState('');
  const [stempelFile, setStempelFile] = useState(null);
  const [stempelPreview, setStempelPreview] = useState('');

  // 1. Ambil Data Real-Time
  useEffect(() => {
    setLoading(true);

    const unsubSchools = onSnapshot(collection(db, 'schools'), (snap) => {
      const list = snap.docs.map((d) => ({ id: d.id, ...d.data() }));
      setSchools(list);
    });

    const unsubUsers = onSnapshot(collection(db, 'users'), (snap) => {
      const list = snap.docs.map((d) => ({ id: d.id, ...d.data() }));
      setUsers(list);
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
    setEditingSchoolId(null);
    const randomSlug = 'sch_paud_' + Math.random().toString(36).substring(2, 7);
    setFormId(randomSlug);
    setFormNama('');
    setFormNpsn('');
    setFormAlamat('');
    setFormKota('Surabaya');
    setFormTelepon('');
    setFormNamaKepsek('');
    setFormNipKepsek('');
    setFormPaket('basic');
    setFormKuotaGuru(5);
    setFormBerlakuHingga('2027-12-31');
    setFormStatus('aktif');
    setLogoFile(null);
    setLogoPreview('');
    setStempelFile(null);
    setStempelPreview('');
    setIsModalOpen(true);
  };

  const handleOpenEditModal = (s) => {
    setEditingSchoolId(s.id);
    setFormId(s.id);
    setFormNama(s.nama_sekolah || '');
    setFormNpsn(s.npsn || '');
    setFormAlamat(s.alamat || '');
    setFormKota(s.kota || 'Surabaya');
    setFormTelepon(s.telepon || '');
    setFormNamaKepsek(s.nama_kepsek_resmi || '');
    setFormNipKepsek(s.nip_kepsek || '');
    setFormPaket(s.paket_langganan || 'basic');
    setFormKuotaGuru(s.kuota_guru || 5);
    setFormBerlakuHingga(s.berlaku_hingga || '2027-12-31');
    setFormStatus(s.status_langganan || 'aktif');
    setLogoFile(null);
    setLogoPreview(s.logo_url || '');
    setStempelFile(null);
    setStempelPreview(s.stempel_url || '');
    setIsModalOpen(true);
  };

  const handleLogoChange = (e) => {
    const file = e.target.files[0];
    if (file) {
      setLogoFile(file);
      setLogoPreview(URL.createObjectURL(file));
    }
  };

  const handleStempelChange = (e) => {
    const file = e.target.files[0];
    if (file) {
      setStempelFile(file);
      setStempelPreview(URL.createObjectURL(file));
    }
  };

  // Simpan Sekolah (Tambah / Edit)
  const handleSubmitForm = async (e) => {
    e.preventDefault();
    if (!formNama.trim()) {
      showNotification('error', 'Nama sekolah wajib diisi');
      return;
    }

    setSubmitting(true);

    try {
      let finalLogoUrl = logoPreview;
      let finalStempelUrl = stempelPreview;

      const schoolId = editingSchoolId || formId.trim().toLowerCase().replace(/[^a-z0-9_]/g, '_');

      // Upload Logo jika ada file baru
      if (logoFile) {
        const logoRef = ref(storage, `schools/${schoolId}/branding/logo_${Date.now()}`);
        const snap = await uploadBytes(logoRef, logoFile);
        finalLogoUrl = await getDownloadURL(snap.ref);
      }

      // Upload Stempel jika ada file baru
      if (stempelFile) {
        const stempelRef = ref(storage, `schools/${schoolId}/branding/stempel_${Date.now()}`);
        const snap = await uploadBytes(stempelRef, stempelFile);
        finalStempelUrl = await getDownloadURL(snap.ref);
      }

      const payload = {
        id: schoolId,
        nama_sekolah: formNama.trim(),
        npsn: formNpsn.trim(),
        alamat: formAlamat.trim(),
        kota: formKota.trim(),
        telepon: formTelepon.trim(),
        nama_kepsek_resmi: formNamaKepsek.trim(),
        nip_kepsek: formNipKepsek.trim(),
        paket_langganan: formPaket,
        kuota_guru: Number(formKuotaGuru) || 5,
        berlaku_hingga: formBerlakuHingga,
        status_langganan: formStatus,
        logo_url: finalLogoUrl || null,
        stempel_url: finalStempelUrl || null,
        updated_at: serverTimestamp(),
      };

      if (editingSchoolId) {
        await updateDoc(doc(db, 'schools', editingSchoolId), payload);
        await logActivity(schoolId, userData.uid, userData.nama, 'update_sekolah', {
          namaSekolah: formNama,
        });
        showNotification('success', 'Profil sekolah mitra berhasil diperbarui!');
      } else {
        payload.created_at = serverTimestamp();
        payload.total_foto_terunggah = 0;
        payload.estimasi_storage_mb = 0;
        await setDoc(doc(db, 'schools', schoolId), payload);
        await logActivity(schoolId, userData.uid, userData.nama, 'tambah_sekolah', {
          namaSekolah: formNama,
        });
        showNotification('success', 'Sekolah mitra baru berhasil didaftarkan!');
      }

      setIsModalOpen(false);
    } catch (err) {
      console.error('Error saving school:', err);
      showNotification('error', 'Gagal menyimpan sekolah: ' + err.message);
    } finally {
      setSubmitting(false);
    }
  };

  // Toggle Suspend Langganan Sekolah
  const handleToggleSuspend = async (s) => {
    const nextStatus = s.status_langganan === 'aktif' ? 'nonaktif' : 'aktif';
    const actionLabel = nextStatus === 'nonaktif' ? 'menonaktifkan (suspend)' : 'mengaktifkan kembali';

    if (!window.confirm(`Apakah Anda yakin ingin ${actionLabel} layanan untuk "${s.nama_sekolah}"?`)) {
      return;
    }

    try {
      await updateDoc(doc(db, 'schools', s.id), {
        status_langganan: nextStatus,
        updated_at: serverTimestamp(),
      });

      await logActivity(s.id, userData.uid, userData.nama, 'toggle_suspend_sekolah', {
        statusBaru: nextStatus,
        namaSekolah: s.nama_sekolah,
      });

      showNotification('success', `Status langganan ${s.nama_sekolah} berhasil diubah ke: ${nextStatus.toUpperCase()}`);
    } catch (err) {
      console.error('Error toggling suspend:', err);
      showNotification('error', 'Gagal mengubah status: ' + err.message);
    }
  };

  // Hapus Sekolah (Hard Delete)
  const handleDeleteSchool = async (s) => {
    try {
      await deleteDoc(doc(db, 'schools', s.id));
      await logActivity(s.id, userData.uid, userData.nama, 'hapus_sekolah', {
        namaSekolah: s.nama_sekolah,
      });
      showNotification('success', `Sekolah "${s.nama_sekolah}" berhasil dihapus.`);
      setDeleteConfirmSchool(null);
    } catch (err) {
      console.error('Error deleting school:', err);
      showNotification('error', 'Gagal menghapus sekolah: ' + err.message);
    }
  };

  // Filter Data
  const filteredSchools = schools.filter((s) => {
    const q = searchQuery.toLowerCase();
    const matchSearch =
      (s.nama_sekolah || '').toLowerCase().includes(q) ||
      (s.kota || '').toLowerCase().includes(q) ||
      (s.npsn || '').toLowerCase().includes(q) ||
      (s.id || '').toLowerCase().includes(q);

    const matchStatus =
      statusFilter === 'semua'
        ? true
        : statusFilter === 'aktif'
        ? s.status_langganan === 'aktif'
        : s.status_langganan === 'nonaktif';

    return matchSearch && matchStatus;
  });

  return (
    <div className="space-y-6 pb-20 md:pb-6">
      {/* Header Banner */}
      <div className="bg-gradient-to-r from-amber-500 via-orange-500 to-amber-600 rounded-3xl p-6 md:p-8 text-white shadow-lg shadow-orange-500/20 relative overflow-hidden">
        <div className="absolute right-0 top-0 translate-x-12 -translate-y-12 w-64 h-64 bg-white/10 rounded-full blur-3xl pointer-events-none" />
        <div className="relative z-10 flex flex-col md:flex-row md:items-center justify-between gap-4">
          <div>
            <div className="inline-flex items-center space-x-2 px-3 py-1 bg-white/20 backdrop-blur-md rounded-full text-xs font-bold text-amber-100 mb-3">
              <School className="w-3.5 h-3.5" />
              <span>Multi-Tenant Governance</span>
            </div>
            <h1 className="text-2xl md:text-3xl font-extrabold font-brand tracking-tight">
              Kelola Sekolah Mitra (Tenants)
            </h1>
            <p className="text-amber-100 text-sm mt-1 max-w-xl font-medium">
              Atur entitas PAUD/TK, alokasi kuota akun guru, masa aktif paket, serta unggah logo dan stempel resmi transparan.
            </p>
          </div>

          <button
            onClick={handleOpenAddModal}
            className="self-start md:self-auto px-5 py-3 bg-white text-orange-600 hover:bg-orange-50 active:scale-95 font-extrabold text-xs rounded-2xl shadow-sm transition flex items-center space-x-2 font-brand"
          >
            <Plus className="w-4 h-4 stroke-[3]" />
            <span>Daftarkan Sekolah Baru</span>
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

      {/* BAR PENCARIAN & FILTER STATUS */}
      <div className="bg-white rounded-3xl p-4 border border-slate-200/80 shadow-sm flex flex-col md:flex-row items-center justify-between gap-3">
        <div className="relative w-full md:w-80">
          <div className="absolute inset-y-0 left-0 pl-3.5 flex items-center pointer-events-none text-slate-400">
            <Search className="w-4 h-4" />
          </div>
          <input
            type="text"
            placeholder="Cari nama sekolah, NPSN, atau kota..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="w-full pl-10 pr-4 py-2 text-xs font-medium rounded-xl border border-slate-200 focus:outline-none focus:ring-2 focus:ring-orange-500/20 focus:border-orange-500"
          />
        </div>

        <div className="flex items-center space-x-1.5 w-full md:w-auto">
          {[
            { id: 'semua', label: 'Semua Status' },
            { id: 'aktif', label: 'Aktif' },
            { id: 'nonaktif', label: 'Suspend / Nonaktif' },
          ].map((tab) => (
            <button
              key={tab.id}
              onClick={() => setStatusFilter(tab.id)}
              className={`px-3 py-1.5 rounded-xl text-xs font-bold transition ${
                statusFilter === tab.id
                  ? 'bg-amber-100 text-amber-800 border border-amber-300'
                  : 'bg-slate-100 text-slate-600 hover:bg-slate-200 border border-transparent'
              }`}
            >
              {tab.label}
            </button>
          ))}
        </div>
      </div>

      {/* GRID KARTU SEKOLAH MITRA */}
      {loading ? (
        <div className="p-12 text-center text-slate-400 font-medium">
          <div className="inline-block animate-spin w-6 h-6 border-2 border-amber-500 border-t-transparent rounded-full mb-2" />
          <p className="text-xs">Memuat daftar sekolah mitra...</p>
        </div>
      ) : filteredSchools.length === 0 ? (
        <div className="bg-white rounded-3xl p-12 text-center border border-dashed border-slate-300 shadow-sm">
          <School className="w-12 h-12 text-amber-300 mx-auto mb-3" />
          <h3 className="text-base font-extrabold text-slate-700 font-brand">
            Tidak Ada Sekolah Ditemukan
          </h3>
          <p className="text-xs text-slate-400 max-w-sm mx-auto mt-1">
            Silakan ubah kata kunci pencarian atau daftarkan sekolah mitra baru.
          </p>
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          {filteredSchools.map((s) => {
            const teachersInSchool = users.filter(
              (u) => u.school_id === s.id && u.role === 'guru' && u.status_akun === 'aktif'
            );
            const kepsekInSchool = users.find(
              (u) => u.school_id === s.id && u.role === 'kepsek'
            );
            const isSuspended = s.status_langganan === 'nonaktif';
            const kuota = s.kuota_guru || 5;
            const terpakai = teachersInSchool.length;
            const kuotaPersen = Math.min(100, Math.round((terpakai / kuota) * 100));

            return (
              <div
                key={s.id}
                className={`bg-white rounded-3xl p-5 border shadow-sm transition flex flex-col justify-between relative group ${
                  isSuspended
                    ? 'border-rose-200 bg-rose-50/10'
                    : 'border-slate-200/80 hover:shadow-md hover:border-amber-200'
                }`}
              >
                <div>
                  {/* Header Kartu */}
                  <div className="flex items-start justify-between gap-3 mb-3">
                    <div className="flex items-center space-x-3">
                      {s.logo_url ? (
                        <img
                          src={s.logo_url}
                          alt="Logo"
                          className="w-11 h-11 rounded-2xl object-contain border border-slate-200 p-1 bg-white shadow-xs"
                        />
                      ) : (
                        <div className="w-11 h-11 rounded-2xl bg-amber-100 text-amber-700 flex items-center justify-center font-black text-base shadow-xs">
                          {s.nama_sekolah?.charAt(0) || 'P'}
                        </div>
                      )}
                      <div>
                        <span className="text-[10px] font-extrabold px-2 py-0.5 rounded-full uppercase bg-amber-50 text-amber-800 border border-amber-200/60">
                          {s.paket_langganan || 'trial'}
                        </span>
                        <h3 className="font-extrabold text-slate-800 text-sm leading-tight font-brand mt-1 line-clamp-1">
                          {s.nama_sekolah}
                        </h3>
                        <div className="text-[11px] text-slate-400 font-medium">
                          NPSN: {s.npsn || '-'} • {s.kota || 'Kota'}
                        </div>
                      </div>
                    </div>

                    <div className="flex items-center space-x-1">
                      <button
                        onClick={() => handleOpenEditModal(s)}
                        title="Edit Profil Sekolah"
                        className="p-1.5 text-slate-400 hover:text-amber-600 hover:bg-amber-50 rounded-lg transition"
                      >
                        <Edit className="w-4 h-4" />
                      </button>
                      <button
                        onClick={() => setDeleteConfirmSchool(s)}
                        title="Hapus Sekolah"
                        className="p-1.5 text-slate-400 hover:text-rose-600 hover:bg-rose-50 rounded-lg transition"
                      >
                        <Trash2 className="w-4 h-4" />
                      </button>
                    </div>
                  </div>

                  {/* Informasi Detail */}
                  <div className="space-y-2 text-xs py-3 border-y border-slate-100">
                    <div className="flex items-center justify-between">
                      <span className="text-slate-400">Kepala Sekolah:</span>
                      <span className="font-bold text-slate-700 line-clamp-1">
                        {kepsekInSchool?.nama || s.nama_kepsek_resmi || 'Belum Dibuat'}
                      </span>
                    </div>
                    <div className="flex items-center justify-between">
                      <span className="text-slate-400">Masa Berlaku:</span>
                      <span className="font-bold text-slate-700">
                        {s.berlaku_hingga ? formatTanggalIndo(s.berlaku_hingga) : '-'}
                      </span>
                    </div>
                    <div className="flex items-center justify-between">
                      <span className="text-slate-400">Stempel Resmi:</span>
                      <span className="font-bold">
                        {s.stempel_url ? (
                          <span className="text-emerald-600 font-extrabold">Tersedia (PNG)</span>
                        ) : (
                          <span className="text-slate-400 font-normal">Belum diunggah</span>
                        )}
                      </span>
                    </div>
                  </div>

                  {/* Kuota Guru Progress */}
                  <div className="mt-3">
                    <div className="flex items-center justify-between text-[11px] font-bold text-slate-600 mb-1">
                      <span>Kapasitas Akun Guru:</span>
                      <span>
                        {terpakai} / {kuota} Guru ({kuotaPersen}%)
                      </span>
                    </div>
                    <div className="w-full bg-slate-100 rounded-full h-2 overflow-hidden">
                      <div
                        className={`h-full rounded-full transition-all ${
                          kuotaPersen >= 100
                            ? 'bg-rose-500'
                            : kuotaPersen >= 80
                            ? 'bg-amber-500'
                            : 'bg-emerald-500'
                        }`}
                        style={{ width: `${kuotaPersen}%` }}
                      />
                    </div>
                  </div>
                </div>

                {/* Footer Kartu & Toggle Suspend */}
                <div className="pt-4 mt-3 border-t border-slate-100 flex items-center justify-between">
                  <span
                    className={`px-2.5 py-1 rounded-full text-[10px] font-extrabold ${
                      isSuspended
                        ? 'bg-rose-100 text-rose-800'
                        : 'bg-emerald-100 text-emerald-800'
                    }`}
                  >
                    {isSuspended ? 'LAYANAN DISUSPEND' : 'AKTIF'}
                  </span>

                  <button
                    onClick={() => handleToggleSuspend(s)}
                    className={`px-3 py-1.5 rounded-xl text-xs font-bold transition flex items-center space-x-1.5 ${
                      isSuspended
                        ? 'bg-emerald-50 text-emerald-700 hover:bg-emerald-100'
                        : 'bg-rose-50 text-rose-700 hover:bg-rose-100'
                    }`}
                  >
                    {isSuspended ? (
                      <>
                        <ShieldCheck className="w-3.5 h-3.5" />
                        <span>Aktifkan</span>
                      </>
                    ) : (
                      <>
                        <ShieldAlert className="w-3.5 h-3.5" />
                        <span>Suspend</span>
                      </>
                    )}
                  </button>
                </div>
              </div>
            );
          })}
        </div>
      )}

      {/* MODAL TAMBAH / EDIT SEKOLAH MITRA */}
      {isModalOpen && createPortal(
        <div className="fixed inset-0 z-[100] bg-slate-900/60 backdrop-blur-sm flex items-center justify-center p-4 overflow-y-auto animate-in fade-in duration-200">
          <div className="bg-white rounded-3xl max-w-2xl w-full p-6 shadow-2xl border border-slate-100 my-8">
            <div className="flex items-center justify-between pb-4 border-b border-slate-100">
              <div className="flex items-center space-x-2">
                <div className="w-9 h-9 rounded-xl bg-amber-100 text-amber-700 flex items-center justify-center">
                  <School className="w-5 h-5" />
                </div>
                <div>
                  <h2 className="text-base font-extrabold text-slate-800 font-brand">
                    {editingSchoolId ? 'Edit Profil Sekolah Mitra' : 'Pendaftaran Sekolah Mitra Baru'}
                  </h2>
                  <p className="text-[11px] text-slate-400 font-medium">
                    Atribut Kop Surat resmi, alokasi kuota, dan branding sekolah.
                  </p>
                </div>
              </div>
              <button
                onClick={() => setIsModalOpen(false)}
                className="p-1.5 text-slate-400 hover:text-slate-600 rounded-lg hover:bg-slate-100 transition"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <form onSubmit={handleSubmitForm} className="mt-4 space-y-4 max-h-[75vh] overflow-y-auto pr-1">
              {/* Baris 1: ID & Nama Sekolah */}
              <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-bold text-slate-700 mb-1">
                    ID Tenant (school_id) <span className="text-rose-500">*</span>
                  </label>
                  <input
                    type="text"
                    required
                    disabled={!!editingSchoolId}
                    value={formId}
                    onChange={(e) => setFormId(e.target.value)}
                    placeholder="Contoh: sch_tkdwp8_sby"
                    className="w-full px-3 py-2 text-xs font-mono font-bold rounded-xl border border-slate-200 focus:outline-none focus:ring-2 focus:ring-orange-500/20 focus:border-orange-500 disabled:bg-slate-100"
                  />
                  <span className="text-[10px] text-slate-400">ID unik permanen tenant.</span>
                </div>

                <div>
                  <label className="block text-xs font-bold text-slate-700 mb-1">
                    Nama Resmi Sekolah <span className="text-rose-500">*</span>
                  </label>
                  <input
                    type="text"
                    required
                    value={formNama}
                    onChange={(e) => setFormNama(e.target.value)}
                    placeholder="Contoh: TK Dharma Wanita Persatuan 8"
                    className="w-full px-3 py-2 text-xs font-bold rounded-xl border border-slate-200 focus:outline-none focus:ring-2 focus:ring-orange-500/20 focus:border-orange-500"
                  />
                </div>
              </div>

              {/* Baris 2: NPSN & Kota */}
              <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-bold text-slate-700 mb-1">NPSN</label>
                  <input
                    type="text"
                    value={formNpsn}
                    onChange={(e) => setFormNpsn(e.target.value)}
                    placeholder="Contoh: 20539123"
                    className="w-full px-3 py-2 text-xs font-medium rounded-xl border border-slate-200 focus:outline-none focus:ring-2 focus:ring-orange-500/20 focus:border-orange-500"
                  />
                </div>

                <div>
                  <label className="block text-xs font-bold text-slate-700 mb-1">Kota / Kabupaten</label>
                  <input
                    type="text"
                    value={formKota}
                    onChange={(e) => setFormKota(e.target.value)}
                    placeholder="Contoh: Surabaya"
                    className="w-full px-3 py-2 text-xs font-medium rounded-xl border border-slate-200 focus:outline-none focus:ring-2 focus:ring-orange-500/20 focus:border-orange-500"
                  />
                </div>
              </div>

              {/* Alamat & Telepon */}
              <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
                <div className="md:col-span-2">
                  <label className="block text-xs font-bold text-slate-700 mb-1">Alamat Lengkap</label>
                  <input
                    type="text"
                    value={formAlamat}
                    onChange={(e) => setFormAlamat(e.target.value)}
                    placeholder="Jl. Pagesangan Asri No. 12"
                    className="w-full px-3 py-2 text-xs font-medium rounded-xl border border-slate-200 focus:outline-none focus:ring-2 focus:ring-orange-500/20 focus:border-orange-500"
                  />
                </div>

                <div>
                  <label className="block text-xs font-bold text-slate-700 mb-1">No. Telepon / WA</label>
                  <input
                    type="text"
                    value={formTelepon}
                    onChange={(e) => setFormTelepon(e.target.value)}
                    placeholder="08123456789"
                    className="w-full px-3 py-2 text-xs font-medium rounded-xl border border-slate-200 focus:outline-none focus:ring-2 focus:ring-orange-500/20 focus:border-orange-500"
                  />
                </div>
              </div>

              {/* Penandatangan PDF: Nama Kepsek & NIP */}
              <div className="grid grid-cols-1 md:grid-cols-2 gap-3 p-3 bg-amber-50/50 rounded-2xl border border-amber-200/60">
                <div>
                  <label className="block text-xs font-bold text-slate-700 mb-1">
                    Nama Kepala Sekolah (Tanda Tangan PDF)
                  </label>
                  <input
                    type="text"
                    value={formNamaKepsek}
                    onChange={(e) => setFormNamaKepsek(e.target.value)}
                    placeholder="Contoh: Hj. Siti Nurjanah, S.Pd"
                    className="w-full px-3 py-2 text-xs font-medium rounded-xl border border-slate-200 focus:outline-none focus:ring-2 focus:ring-orange-500/20 focus:border-orange-500 bg-white"
                  />
                </div>

                <div>
                  <label className="block text-xs font-bold text-slate-700 mb-1">
                    NIP / NUPTK Kepala Sekolah
                  </label>
                  <input
                    type="text"
                    value={formNipKepsek}
                    onChange={(e) => setFormNipKepsek(e.target.value)}
                    placeholder="Contoh: 19780512 200501 2 004"
                    className="w-full px-3 py-2 text-xs font-medium rounded-xl border border-slate-200 focus:outline-none focus:ring-2 focus:ring-orange-500/20 focus:border-orange-500 bg-white"
                  />
                </div>
              </div>

              {/* Paket, Kuota & Masa Berlaku */}
              <div className="grid grid-cols-3 gap-3">
                <div>
                  <label className="block text-xs font-bold text-slate-700 mb-1">Paket</label>
                  <select
                    value={formPaket}
                    onChange={(e) => setFormPaket(e.target.value)}
                    className="w-full px-3 py-2 text-xs font-bold rounded-xl border border-slate-200 focus:outline-none focus:ring-2 focus:ring-orange-500/20 focus:border-orange-500"
                  >
                    <option value="trial">Trial (Uji Coba)</option>
                    <option value="basic">Basic (Standard)</option>
                    <option value="pro">Pro (Full Akreditasi)</option>
                  </select>
                </div>

                <div>
                  <label className="block text-xs font-bold text-slate-700 mb-1">Batas Kuota Guru</label>
                  <input
                    type="number"
                    min="1"
                    max="100"
                    required
                    value={formKuotaGuru}
                    onChange={(e) => setFormKuotaGuru(e.target.value)}
                    className="w-full px-3 py-2 text-xs font-bold rounded-xl border border-slate-200 focus:outline-none focus:ring-2 focus:ring-orange-500/20 focus:border-orange-500"
                  />
                </div>

                <div>
                  <label className="block text-xs font-bold text-slate-700 mb-1">Masa Berlaku</label>
                  <input
                    type="date"
                    required
                    value={formBerlakuHingga}
                    onChange={(e) => setFormBerlakuHingga(e.target.value)}
                    className="w-full px-3 py-2 text-xs font-bold rounded-xl border border-slate-200 focus:outline-none focus:ring-2 focus:ring-orange-500/20 focus:border-orange-500"
                  />
                </div>
              </div>

              {/* Upload Logo & Stempel PNG Transparan */}
              <div className="grid grid-cols-1 md:grid-cols-2 gap-3 pt-2">
                {/* Logo Sekolah */}
                <div className="p-3 border border-dashed border-slate-200 rounded-2xl">
                  <label className="block text-xs font-bold text-slate-700 mb-1">Logo Sekolah</label>
                  <div className="flex items-center space-x-3 mt-1">
                    {logoPreview ? (
                      <img
                        src={logoPreview}
                        alt="Logo Preview"
                        className="w-12 h-12 rounded-xl object-contain border border-slate-200 p-0.5 bg-white"
                      />
                    ) : (
                      <div className="w-12 h-12 rounded-xl bg-slate-100 flex items-center justify-center text-slate-400">
                        <Upload className="w-5 h-5" />
                      </div>
                    )}
                    <input
                      type="file"
                      accept="image/*"
                      onChange={handleLogoChange}
                      className="text-xs text-slate-500 file:mr-2 file:py-1 file:px-2.5 file:rounded-lg file:border-0 file:text-[11px] file:font-bold file:bg-orange-100 file:text-orange-700 hover:file:bg-orange-200"
                    />
                  </div>
                </div>

                {/* Stempel Cap Digital Transparan */}
                <div className="p-3 border border-dashed border-slate-200 rounded-2xl">
                  <label className="block text-xs font-bold text-slate-700 mb-1">
                    Stempel Cap Resmi (PNG Transparan)
                  </label>
                  <div className="flex items-center space-x-3 mt-1">
                    {stempelPreview ? (
                      <img
                        src={stempelPreview}
                        alt="Stempel Preview"
                        className="w-12 h-12 rounded-xl object-contain border border-slate-200 p-0.5 bg-white shadow-xs"
                      />
                    ) : (
                      <div className="w-12 h-12 rounded-xl bg-slate-100 flex items-center justify-center text-slate-400">
                        <Upload className="w-5 h-5" />
                      </div>
                    )}
                    <input
                      type="file"
                      accept="image/png"
                      onChange={handleStempelChange}
                      className="text-xs text-slate-500 file:mr-2 file:py-1 file:px-2.5 file:rounded-lg file:border-0 file:text-[11px] file:font-bold file:bg-amber-100 file:text-amber-700 hover:file:bg-amber-200"
                    />
                  </div>
                  <span className="text-[10px] text-slate-400 block mt-1">
                    Direkomendasikan format PNG transparan agar stempel menimpa tanda tangan PDF secara elegan.
                  </span>
                </div>
              </div>

              {/* Tombol Simpan */}
              <div className="flex items-center justify-end space-x-2 pt-3 border-t border-slate-100">
                <button
                  type="button"
                  onClick={() => setIsModalOpen(false)}
                  className="px-4 py-2 text-xs font-bold text-slate-600 hover:bg-slate-100 rounded-xl transition"
                >
                  Batal
                </button>
                <button
                  type="submit"
                  disabled={submitting}
                  className="px-5 py-2 text-xs font-extrabold text-white bg-gradient-to-r from-amber-500 to-orange-500 hover:from-amber-600 hover:to-orange-600 rounded-xl shadow-md shadow-orange-500/20 active:scale-95 transition disabled:opacity-50"
                >
                  {submitting ? 'Menyimpan...' : editingSchoolId ? 'Simpan Perubahan' : 'Daftarkan Sekolah'}
                </button>
              </div>
            </form>
          </div>
        </div>,
        document.body
      )}

      {/* MODAL KONFIRMASI HAPUS SEKOLAH */}
      {deleteConfirmSchool && createPortal(
        <div className="fixed inset-0 z-[100] bg-slate-900/60 backdrop-blur-sm flex items-center justify-center p-4 animate-in fade-in duration-200">
          <div className="bg-white rounded-3xl max-w-sm w-full p-6 shadow-2xl border border-slate-100 text-center">
            <div className="w-12 h-12 bg-rose-100 text-rose-600 rounded-2xl flex items-center justify-center mx-auto mb-3">
              <Trash2 className="w-6 h-6" />
            </div>
            <h3 className="text-base font-extrabold text-slate-800 font-brand">
              Hapus Sekolah Mitra?
            </h3>
            <p className="text-xs text-slate-500 mt-1">
              Menghapus entitas <strong>"{deleteConfirmSchool.nama_sekolah}"</strong> akan menghapus konfigurasi tenant. Seluruh akun guru & kepsek di bawah sekolah ini akan kehilangan relasi tenant.
            </p>

            <div className="flex items-center justify-center space-x-2 mt-5">
              <button
                onClick={() => setDeleteConfirmSchool(null)}
                className="px-4 py-2 text-xs font-bold text-slate-600 hover:bg-slate-100 rounded-xl transition"
              >
                Batal
              </button>
              <button
                onClick={() => handleDeleteSchool(deleteConfirmSchool)}
                className="px-4 py-2 text-xs font-extrabold text-white bg-rose-500 hover:bg-rose-600 rounded-xl shadow-md shadow-rose-500/20 active:scale-95 transition"
              >
                Ya, Hapus Permanen
              </button>
            </div>
          </div>
        </div>,
        document.body
      )}
    </div>
  );
}


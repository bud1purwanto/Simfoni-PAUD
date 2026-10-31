import React, { useState, useEffect } from 'react';
import {
  Users,
  UserPlus,
  Search,
  Phone,
  Calendar,
  AlertCircle,
  Edit2,
  Trash2,
  Filter,
  GraduationCap,
  Sparkles,
  Heart,
  Baby
} from 'lucide-react';
import {
  collection,
  query,
  where,
  getDocs,
  addDoc,
  updateDoc,
  deleteDoc,
  doc,
  serverTimestamp
} from 'firebase/firestore';
import { db } from '../../config/firebase';
import { useAuth } from '../../context/AuthContext';
import ModalFormSiswa from '../../components/ui/ModalFormSiswa';
import ModalKonfirmasi from '../../components/ui/ModalKonfirmasi';
import { logActivity } from '../../utils/auditLogger';
import { commitWrite, QUEUED_SUFFIX } from '../../utils/offlineWrite';
import { getKelompokOptions, normalizeKelompok } from '../../utils/schoolConfig';
import { formatTanggalIndo } from '../../utils/formatters';

export default function KelolaSiswaGuru() {
  const { userData, schoolData } = useAuth();
  const [siswaList, setSiswaList] = useState([]);
  const [loading, setLoading] = useState(true);
  const [searchQuery, setSearchQuery] = useState('');
  const [filterKelompok, setFilterKelompok] = useState('semua');
  const [actionLoading, setActionLoading] = useState(false);
  const [notification, setNotification] = useState(null);

  // Modal State
  const [modalFormOpen, setModalFormOpen] = useState(false);
  const [selectedSiswa, setSelectedSiswa] = useState(null);
  const [deleteModalOpen, setDeleteModalOpen] = useState(false);
  const [siswaToDelete, setSiswaToDelete] = useState(null);

  const daftarKelompok = getKelompokOptions(schoolData).filter(k => k !== 'Semua');
  const kelasSaya = normalizeKelompok(userData?.kelompok_kelas);

  // Set default filter kelompok ke kelas guru jika bukan 'Semua'
  useEffect(() => {
    if (kelasSaya && daftarKelompok.includes(kelasSaya)) {
      setFilterKelompok(kelasSaya);
    }
  }, [kelasSaya]);

  // Load Data Siswa
  const fetchSiswa = async () => {
    if (!userData?.school_id) return;
    try {
      setLoading(true);
      const q = query(
        collection(db, 'students'),
        where('school_id', '==', userData.school_id)
      );
      const snap = await getDocs(q);
      const docs = snap.docs.map(d => ({ id: d.id, ...d.data() }));
      // Sort abjad nama lengkap
      docs.sort((a, b) => (a.nama_lengkap || '').localeCompare(b.nama_lengkap || ''));
      setSiswaList(docs);
    } catch (err) {
      console.error('Error fetching students:', err);
      setNotification({
        type: 'error',
        text: 'Gagal memuat data siswa. Periksa koneksi internet Anda.'
      });
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchSiswa();
  }, [userData?.school_id]);

  // Handler Simpan / Update
  const handleSaveSiswa = async (formData) => {
    setActionLoading(true);
    try {
      if (selectedSiswa) {
        // Update
        const docRef = doc(db, 'students', selectedSiswa.id);
        const updatePayload = {
          ...formData,
          updated_at: serverTimestamp(),
          updated_by: userData.uid
        };
        const { queued } = await commitWrite(updateDoc(docRef, updatePayload));

        logActivity({
          schoolId: userData.school_id,
          actorId: userData.uid,
          actorNama: userData.nama,
          action: 'UPDATE_STUDENT',
          recordType: 'students',
          recordId: selectedSiswa.id,
          detail: { nama: formData.nama_lengkap, kelompok: formData.kelompok }
        });

        setNotification({
          type: 'success',
          text: `Data ${formData.nama_panggilan} berhasil diperbarui!${queued ? QUEUED_SUFFIX : ''}`
        });
      } else {
        // Create Baru
        const createPayload = {
          ...formData,
          school_id: userData.school_id,
          created_by: userData.uid,
          created_at: serverTimestamp(),
          updated_at: serverTimestamp()
        };
        const { queued } = await commitWrite(addDoc(collection(db, 'students'), createPayload));

        logActivity({
          schoolId: userData.school_id,
          actorId: userData.uid,
          actorNama: userData.nama,
          action: 'ADD_STUDENT',
          recordType: 'students',
          recordId: 'new',
          detail: { nama: formData.nama_lengkap, kelompok: formData.kelompok }
        });

        setNotification({
          type: 'success',
          text: `Murid baru "${formData.nama_panggilan}" berhasil didaftarkan!${queued ? QUEUED_SUFFIX : ''}`
        });
      }

      setModalFormOpen(false);
      setSelectedSiswa(null);
      await fetchSiswa();
    } catch (err) {
      console.error('Gagal menyimpan data siswa:', err);
      setNotification({
        type: 'error',
        text: 'Terjadi kesalahan saat menyimpan data murid. Silakan coba lagi.'
      });
    } finally {
      setActionLoading(false);
    }
  };

  // Handler Hapus Siswa
  const handleConfirmDelete = async () => {
    if (!siswaToDelete) return;
    setActionLoading(true);
    try {
      await commitWrite(deleteDoc(doc(db, 'students', siswaToDelete.id)));

      logActivity({
        schoolId: userData.school_id,
        actorId: userData.uid,
        actorNama: userData.nama,
        action: 'DELETE_STUDENT',
        recordType: 'students',
        recordId: siswaToDelete.id,
        detail: { nama: siswaToDelete.nama_lengkap }
      });

      setNotification({
        type: 'success',
        text: `Data murid "${siswaToDelete.nama_panggilan}" telah dihapus.`
      });
      setDeleteModalOpen(false);
      setSiswaToDelete(null);
      await fetchSiswa();
    } catch (err) {
      console.error('Gagal menghapus siswa:', err);
      setNotification({
        type: 'error',
        text: 'Gagal menghapus murid. Silakan periksa kembali.'
      });
    } finally {
      setActionLoading(false);
    }
  };

  // Filter & Search
  const filteredSiswa = siswaList.filter((s) => {
    const matchKelompok = filterKelompok === 'semua' || s.kelompok === filterKelompok;
    const matchSearch = (s.nama_lengkap || '').toLowerCase().includes(searchQuery.toLowerCase()) ||
                        (s.nama_panggilan || '').toLowerCase().includes(searchQuery.toLowerCase()) ||
                        (s.nama_orang_tua || '').toLowerCase().includes(searchQuery.toLowerCase());
    return matchKelompok && matchSearch;
  });

  return (
    <div className="max-w-6xl mx-auto space-y-5 animate-in fade-in duration-200">
      {/* Header Halaman */}
      <div className="bg-gradient-to-r from-orange-500 via-amber-500 to-amber-600 rounded-3xl p-5 md:p-7 text-white shadow-lg shadow-orange-500/20 relative overflow-hidden">
        <div className="absolute right-0 top-0 bottom-0 opacity-10 pointer-events-none flex items-center pr-6">
          <Baby className="w-48 h-48" />
        </div>
        <div className="relative z-10 flex flex-col md:flex-row md:items-center justify-between gap-4">
          <div>
            <div className="inline-flex items-center space-x-1.5 px-3 py-1 rounded-xl bg-white/20 backdrop-blur-md text-[11px] font-bold tracking-wide uppercase mb-2">
              <Sparkles className="w-3.5 h-3.5" />
              <span>Master Data Murid Dinamis</span>
            </div>
            <h1 className="text-xl md:text-2xl font-black font-brand">
              Daftar Murid Kelas 🌸
            </h1>
            <p className="text-xs md:text-sm text-orange-100 max-w-xl mt-1 leading-relaxed">
              Kelola data 21 anak didik secara mandiri. Guru kelas dapat langsung menambah anak baru, memperbarui kontak orang tua, atau mencatat kebutuhan khusus anak.
            </p>
          </div>

          <button
            onClick={() => {
              setSelectedSiswa(null);
              setModalFormOpen(true);
            }}
            className="px-4 py-3 rounded-2xl bg-white text-orange-600 hover:bg-orange-50 font-bold text-xs shadow-md transition flex items-center justify-center space-x-2 shrink-0"
          >
            <UserPlus className="w-4 h-4 stroke-[2.5]" />
            <span>Tambah Murid Baru</span>
          </button>
        </div>
      </div>

      {/* Banner Notifikasi */}
      {notification && (
        <div className={`p-4 rounded-2xl border text-xs font-semibold flex items-center justify-between shadow-xs ${
          notification.type === 'error'
            ? 'bg-rose-50 border-rose-200 text-rose-700'
            : 'bg-emerald-50 border-emerald-200 text-emerald-800'
        }`}>
          <span>{notification.text}</span>
          <button
            onClick={() => setNotification(null)}
            className="text-slate-400 hover:text-slate-600 font-bold ml-3"
          >
            ✕
          </button>
        </div>
      )}

      {/* Filter & Toolbar Pencarian */}
      <div className="bg-white rounded-3xl p-4 border border-orange-100 shadow-xs flex flex-col sm:flex-row gap-3 items-center justify-between">
        {/* Input Cari */}
        <div className="relative w-full sm:w-72">
          <Search className="w-4 h-4 absolute left-3.5 top-3 text-slate-400" />
          <input
            type="text"
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            placeholder="Cari nama anak / orang tua..."
            className="w-full pl-10 pr-4 py-2 rounded-2xl border border-slate-200 text-xs focus:ring-2 focus:ring-orange-400 focus:outline-none"
          />
        </div>

        {/* Tab Filter Kelompok */}
        <div className="flex items-center space-x-1.5 overflow-x-auto w-full sm:w-auto pb-1 sm:pb-0">
          <button
            onClick={() => setFilterKelompok('semua')}
            className={`px-3 py-1.5 rounded-xl text-xs font-bold transition shrink-0 ${
              filterKelompok === 'semua'
                ? 'bg-orange-500 text-white shadow-xs'
                : 'text-slate-600 hover:bg-slate-100'
            }`}
          >
            Semua ({siswaList.length})
          </button>
          {daftarKelompok.map((klp) => {
            const count = siswaList.filter(s => s.kelompok === klp).length;
            return (
              <button
                key={klp}
                onClick={() => setFilterKelompok(klp)}
                className={`px-3 py-1.5 rounded-xl text-xs font-bold transition shrink-0 ${
                  filterKelompok === klp
                    ? 'bg-orange-500 text-white shadow-xs'
                    : 'text-slate-600 hover:bg-slate-100'
                }`}
              >
                {klp} ({count})
              </button>
            );
          })}
        </div>
      </div>

      {/* Grid Kartu Siswa */}
      {loading ? (
        <div className="py-16 text-center text-slate-400 space-y-2">
          <div className="w-8 h-8 border-3 border-orange-500 border-t-transparent rounded-full animate-spin mx-auto" />
          <p className="text-xs font-medium">Memuat data murid tercinta...</p>
        </div>
      ) : filteredSiswa.length === 0 ? (
        <div className="bg-white rounded-3xl p-10 border border-dashed border-orange-200 text-center space-y-3">
          <div className="w-14 h-14 rounded-2xl bg-orange-50 text-orange-500 flex items-center justify-center mx-auto">
            <Baby className="w-7 h-7" />
          </div>
          <h3 className="text-sm font-bold text-slate-700 font-brand">
            {searchQuery ? 'Murid Tidak Ditemukan' : 'Belum Ada Data Murid'}
          </h3>
          <p className="text-xs text-slate-400 max-w-sm mx-auto">
            {searchQuery
              ? `Tidak ada murid yang cocok dengan kata kunci "${searchQuery}".`
              : 'Mulai daftarkan murid kelompok kelas Anda dengan menekan tombol Tambah Murid Baru di atas.'}
          </p>
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          {filteredSiswa.map((siswa) => {
            const isLaki = siswa.jenis_kelamin === 'L';
            return (
              <div
                key={siswa.id}
                className="bg-white rounded-3xl p-5 border border-orange-100 shadow-xs hover:shadow-md transition flex flex-col justify-between space-y-3 relative overflow-hidden group"
              >
                {/* Header Kartu: Avatar & Nama */}
                <div className="flex items-start justify-between">
                  <div className="flex items-center space-x-3">
                    <div className={`w-11 h-11 rounded-2xl flex items-center justify-center font-black text-sm shrink-0 shadow-inner ${
                      isLaki ? 'bg-blue-100 text-blue-700' : 'bg-pink-100 text-pink-700'
                    }`}>
                      {isLaki ? '👦' : '👧'}
                    </div>
                    <div>
                      <div className="flex items-center space-x-1.5">
                        <h4 className="text-sm font-bold text-slate-800 font-brand">
                          {siswa.nama_panggilan}
                        </h4>
                        <span className={`text-[10px] px-1.5 py-0.5 rounded-md font-bold uppercase ${
                          siswa.status === 'aktif'
                            ? 'bg-emerald-100 text-emerald-800'
                            : 'bg-slate-100 text-slate-600'
                        }`}>
                          {siswa.status || 'aktif'}
                        </span>
                      </div>
                      <p className="text-xs text-slate-500 line-clamp-1 font-medium">
                        {siswa.nama_lengkap}
                      </p>
                    </div>
                  </div>

                  <span className="text-[10px] font-bold px-2 py-0.5 rounded-lg bg-orange-100 text-orange-800">
                    {siswa.kelompok}
                  </span>
                </div>

                {/* Info Detail */}
                <div className="space-y-1.5 text-[11px] text-slate-600 border-t border-slate-50 pt-2.5">
                  {siswa.tanggal_lahir && (
                    <div className="flex items-center space-x-2 text-slate-500">
                      <Calendar className="w-3.5 h-3.5 text-slate-400 shrink-0" />
                      <span>Lahir: {formatTanggalIndo(siswa.tanggal_lahir)}</span>
                    </div>
                  )}
                  {siswa.nama_orang_tua && (
                    <div className="flex items-center space-x-2 text-slate-500">
                      <Heart className="w-3.5 h-3.5 text-rose-400 shrink-0" />
                      <span>Ortu: <strong className="text-slate-700">{siswa.nama_orang_tua}</strong></span>
                    </div>
                  )}
                  {siswa.kontak_orang_tua && (
                    <div className="flex items-center justify-between text-slate-500 pt-0.5">
                      <span className="flex items-center space-x-2">
                        <Phone className="w-3.5 h-3.5 text-emerald-500 shrink-0" />
                        <span>{siswa.kontak_orang_tua}</span>
                      </span>
                      <a
                        href={`https://wa.me/${siswa.kontak_orang_tua.replace(/\D/g, '')}`}
                        target="_blank"
                        rel="noreferrer"
                        className="text-[10px] font-bold text-emerald-600 hover:text-emerald-700 bg-emerald-50 px-2 py-0.5 rounded-md"
                      >
                        Chat WA 💬
                      </a>
                    </div>
                  )}
                  {siswa.catatan_khusus && (
                    <div className="p-2 rounded-xl bg-amber-50/70 border border-amber-200/60 text-amber-900 text-[10px] leading-relaxed mt-1">
                      <strong>Catatan:</strong> {siswa.catatan_khusus}
                    </div>
                  )}
                </div>

                {/* Footer Kartu: Aksi Guru */}
                <div className="pt-2 border-t border-orange-100 flex items-center justify-end space-x-1">
                  <button
                    onClick={() => {
                      setSelectedSiswa(siswa);
                      setModalFormOpen(true);
                    }}
                    className="p-1.5 rounded-xl text-slate-400 hover:text-orange-600 hover:bg-orange-50 transition"
                    title="Edit Profil Murid"
                  >
                    <Edit2 className="w-4 h-4" />
                  </button>
                  <button
                    onClick={() => {
                      setSiswaToDelete(siswa);
                      setDeleteModalOpen(true);
                    }}
                    className="p-1.5 rounded-xl text-slate-400 hover:text-rose-600 hover:bg-rose-50 transition"
                    title="Hapus Data Murid"
                  >
                    <Trash2 className="w-4 h-4" />
                  </button>
                </div>
              </div>
            );
          })}
        </div>
      )}

      {/* Modal Form Tambah/Edit */}
      <ModalFormSiswa
        isOpen={modalFormOpen}
        initialData={selectedSiswa}
        onClose={() => {
          setModalFormOpen(false);
          setSelectedSiswa(null);
        }}
        onSubmit={handleSaveSiswa}
        loading={actionLoading}
        schoolData={schoolData}
        currentUser={userData}
      />

      {/* Modal Konfirmasi Hapus */}
      <ModalKonfirmasi
        isOpen={deleteModalOpen}
        title="Hapus Data Murid?"
        message={`Apakah Anda yakin ingin menghapus data murid "${siswaToDelete?.nama_lengkap}"? Data yang dihapus tidak dapat dipulihkan.`}
        confirmText="Ya, Hapus Murid"
        cancelText="Batal"
        type="danger"
        loading={actionLoading}
        onConfirm={handleConfirmDelete}
        onClose={() => {
          setDeleteModalOpen(false);
          setSiswaToDelete(null);
        }}
      />
    </div>
  );
}

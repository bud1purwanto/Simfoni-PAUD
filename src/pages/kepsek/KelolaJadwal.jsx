import React, { useState, useEffect } from 'react';
import { 
  Calendar, 
  Clock, 
  Plus, 
  Edit, 
  Trash2, 
  Sparkles, 
  Users, 
  CheckCircle2, 
  AlertCircle, 
  X, 
  BookOpen, 
  BookmarkCheck,
  GraduationCap
} from 'lucide-react';
import { 
  collection, 
  query, 
  where, 
  onSnapshot, 
  addDoc, 
  updateDoc, 
  deleteDoc, 
  doc, 
  serverTimestamp 
} from 'firebase/firestore';
import { db } from '../../config/firebase';
import { useAuth } from '../../context/AuthContext';
import { logActivity } from '../../utils/auditLogger';

const DAYS = ['Senin', 'Selasa', 'Rabu', 'Kamis', 'Jumat', 'Sabtu'];
const KELOMPOK_OPTIONS = ['Semua Kelompok', 'TK A', 'TK B', 'Kelompok Bermain (KB)'];

// Template Aktivitas Khas PAUD untuk Cepat Isi
const TEMPLATE_AKTIVITAS = [
  { nama: 'Sambut Pagi & Motorik Kasar', jamMulai: '07:30', jamSelesai: '08:00', ket: 'Menyambut anak di gerbang, senam irama ceria' },
  { nama: 'Ikrar, Doa & Pembiasaan Karakter', jamMulai: '08:00', jamSelesai: '08:30', ket: 'Doa harian, surah pendek, hafalan asmaul husna / lagu kebangsaan' },
  { nama: 'Sentra Seni & Kreativitas', jamMulai: '08:30', jamSelesai: '09:30', ket: 'Finger painting, kolase daun kering, membentuk playdough' },
  { nama: 'Sentra Balok & Pembangunan', jamMulai: '08:30', jamSelesai: '09:30', ket: 'Rancang bangun mini kota, jembatan kayu, kerja sama tim' },
  { nama: 'Projek P5 (Profil Pelajar Pancasila)', jamMulai: '08:30', jamSelesai: '09:30', ket: 'Tema Aku Sayang Bumi: memilah sampah & menanam bunga' },
  { nama: 'Istirahat, Makan Sehat & Toilet Training', jamMulai: '09:30', jamSelesai: '10:00', ket: 'Cuci tangan 6 langkah, doa makan, pembiasaan mandiri' },
  { nama: 'Refleksi, Dongeng & Penutup', jamMulai: '10:00', jamSelesai: '10:30', ket: 'Mendengarkan dongeng fabel berkarakter, doa pulang' },
];

export default function KelolaJadwal() {
  const { userData } = useAuth();

  const [schedules, setSchedules] = useState([]);
  const [teachers, setTeachers] = useState([]);
  const [loading, setLoading] = useState(true);
  const [selectedDay, setSelectedDay] = useState('Senin');
  const [filterKelompok, setFilterKelompok] = useState('Semua');
  const [notification, setNotification] = useState(null);

  // Modal State
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [editingId, setEditingId] = useState(null);
  const [deleteConfirmId, setDeleteConfirmId] = useState(null);

  // Form State
  const [formHari, setFormHari] = useState('Senin');
  const [formJamMulai, setFormJamMulai] = useState('07:30');
  const [formJamSelesai, setFormJamSelesai] = useState('09:30');
  const [formKelompok, setFormKelompok] = useState('TK A');
  const [formKegiatan, setFormKegiatan] = useState('');
  const [formPicId, setFormPicId] = useState('');
  const [formKeterangan, setFormKeterangan] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);

  // 1. Ambil Data Jadwal & Guru dari Firestore
  useEffect(() => {
    if (!userData?.school_id) {
      setLoading(false);
      return;
    }

    setLoading(true);

    // Ambil Guru Aktif untuk Dropdown PIC
    const qTeachers = query(
      collection(db, 'users'),
      where('school_id', '==', userData.school_id),
      where('role', '==', 'guru')
    );

    const unsubTeachers = onSnapshot(qTeachers, (snap) => {
      const list = snap.docs
        .map((d) => ({ id: d.id, ...d.data() }))
        .filter((t) => t.status_akun === 'aktif');
      setTeachers(list);
      if (list.length > 0 && !formPicId) {
        setFormPicId(list[0].id);
      }
    });

    // Ambil Jadwal Sekolah
    const qSchedules = query(
      collection(db, 'schedules'),
      where('school_id', '==', userData.school_id)
    );

    const unsubSchedules = onSnapshot(qSchedules, (snap) => {
      const list = snap.docs.map((d) => ({ id: d.id, ...d.data() }));
      // Urutkan berdasarkan jam mulai
      list.sort((a, b) => (a.jam_mulai || '').localeCompare(b.jam_mulai || ''));
      setSchedules(list);
      setLoading(false);
    });

    return () => {
      unsubTeachers();
      unsubSchedules();
    };
  }, [userData?.school_id]);

  const showNotification = (type, message) => {
    setNotification({ type, message });
    setTimeout(() => setNotification(null), 4000);
  };

  const handleOpenAddModal = () => {
    setEditingId(null);
    setFormHari(selectedDay);
    setFormJamMulai('07:30');
    setFormJamSelesai('09:30');
    setFormKelompok('TK A');
    setFormKegiatan('');
    setFormKeterangan('');
    if (teachers.length > 0) {
      setFormPicId(teachers[0].id);
    }
    setIsModalOpen(true);
  };

  const handleOpenEditModal = (item) => {
    setEditingId(item.id);
    setFormHari(item.hari || 'Senin');
    setFormJamMulai(item.jam_mulai || '07:30');
    setFormJamSelesai(item.jam_selesai || '09:30');
    setFormKelompok(item.kelompok || 'TK A');
    setFormKegiatan(item.kegiatan || '');
    setFormPicId(item.pic_guru_id || (teachers[0]?.id || ''));
    setFormKeterangan(item.keterangan || '');
    setIsModalOpen(true);
  };

  const handleApplyTemplate = (tpl) => {
    setFormKegiatan(tpl.nama);
    setFormJamMulai(tpl.jamMulai);
    setFormJamSelesai(tpl.jamSelesai);
    setFormKeterangan(tpl.ket);
  };

  const handleSubmitForm = async (e) => {
    e.preventDefault();
    if (!formKegiatan.trim()) {
      showNotification('error', 'Nama kegiatan wajib diisi');
      return;
    }

    setIsSubmitting(true);

    try {
      const selectedTeacherObj = teachers.find((t) => t.id === formPicId);
      const picNama = selectedTeacherObj?.nama || 'Guru Pengampu';

      const payload = {
        school_id: userData.school_id,
        hari: formHari,
        jam_mulai: formJamMulai,
        jam_selesai: formJamSelesai,
        kelompok: formKelompok,
        kegiatan: formKegiatan.trim(),
        pic_guru_id: formPicId,
        pic_nama: picNama,
        keterangan: formKeterangan.trim(),
        updated_at: serverTimestamp(),
      };

      if (editingId) {
        await updateDoc(doc(db, 'schedules', editingId), payload);
        await logActivity(userData.school_id, userData.uid, userData.nama, 'update_jadwal', {
          jadwalId: editingId,
          kegiatan: formKegiatan,
        });
        showNotification('success', 'Jadwal berhasil diperbarui!');
      } else {
        payload.created_at = serverTimestamp();
        const docRef = await addDoc(collection(db, 'schedules'), payload);
        await logActivity(userData.school_id, userData.uid, userData.nama, 'tambah_jadwal', {
          jadwalId: docRef.id,
          kegiatan: formKegiatan,
        });
        showNotification('success', 'Jadwal baru berhasil ditambahkan!');
      }

      setIsModalOpen(false);
    } catch (err) {
      console.error('Error saving schedule:', err);
      showNotification('error', 'Gagal menyimpan jadwal: ' + err.message);
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleDeleteSchedule = async (id) => {
    try {
      await deleteDoc(doc(db, 'schedules', id));
      await logActivity(userData.school_id, userData.uid, userData.nama, 'hapus_jadwal', {
        jadwalId: id,
      });
      showNotification('success', 'Jadwal berhasil dihapus!');
      setDeleteConfirmId(null);
    } catch (err) {
      console.error('Error deleting schedule:', err);
      showNotification('error', 'Gagal menghapus jadwal: ' + err.message);
    }
  };

  // Filter Jadwal berdasarkan Hari & Kelompok
  const filteredSchedules = schedules.filter((s) => {
    const matchDay = selectedDay === 'Semua' ? true : s.hari === selectedDay;
    const matchKelompok = filterKelompok === 'Semua' ? true : s.kelompok === filterKelompok;
    return matchDay && matchKelompok;
  });

  return (
    <div className="space-y-6 pb-20 md:pb-6">
      {/* Banner / Header */}
      <div className="bg-gradient-to-r from-amber-500 via-orange-500 to-amber-600 rounded-3xl p-6 md:p-8 text-white shadow-lg shadow-orange-500/20 relative overflow-hidden">
        <div className="absolute right-0 top-0 translate-x-8 -translate-y-8 w-48 h-48 bg-white/10 rounded-full blur-2xl pointer-events-none" />
        <div className="relative z-10 flex flex-col md:flex-row md:items-center justify-between gap-4">
          <div>
            <div className="inline-flex items-center space-x-2 px-3 py-1 bg-white/20 backdrop-blur-md rounded-full text-xs font-bold text-amber-100 mb-3">
              <Calendar className="w-3.5 h-3.5" />
              <span>Kelola Roster Mengajar PAUD</span>
            </div>
            <h1 className="text-2xl md:text-3xl font-extrabold font-brand tracking-tight">
              Jadwal Pembelajaran Kelas
            </h1>
            <p className="text-amber-100 text-sm mt-1 max-w-xl font-medium">
              Atur alur kegiatan harian, sentra bermain, dan penugasan guru pengampu untuk setiap rombongan belajar.
            </p>
          </div>

          <button
            onClick={handleOpenAddModal}
            className="self-start md:self-auto px-5 py-3 bg-white text-orange-600 font-extrabold text-sm rounded-2xl shadow-sm hover:bg-orange-50 active:scale-95 transition flex items-center space-x-2 font-brand"
          >
            <Plus className="w-4 h-4 stroke-[3]" />
            <span>Tambah Jadwal</span>
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

      {/* Tab Navigasi Hari */}
      <div className="flex items-center space-x-2 overflow-x-auto pb-2 scrollbar-none">
        {DAYS.map((day) => {
          const count = schedules.filter((s) => s.hari === day).length;
          const isSelected = selectedDay === day;
          return (
            <button
              key={day}
              onClick={() => setSelectedDay(day)}
              className={`px-4 py-2.5 rounded-2xl font-bold text-xs md:text-sm whitespace-nowrap transition flex items-center space-x-2 ${
                isSelected
                  ? 'bg-orange-500 text-white shadow-md shadow-orange-500/20'
                  : 'bg-white text-slate-600 border border-slate-200/80 hover:bg-slate-50'
              }`}
            >
              <span>{day}</span>
              <span
                className={`text-[10px] px-2 py-0.5 rounded-full font-bold ${
                  isSelected ? 'bg-orange-600 text-orange-100' : 'bg-slate-100 text-slate-500'
                }`}
              >
                {count}
              </span>
            </button>
          );
        })}
        <button
          onClick={() => setSelectedDay('Semua')}
          className={`px-4 py-2.5 rounded-2xl font-bold text-xs md:text-sm whitespace-nowrap transition ${
            selectedDay === 'Semua'
              ? 'bg-orange-500 text-white shadow-md shadow-orange-500/20'
              : 'bg-white text-slate-600 border border-slate-200/80 hover:bg-slate-50'
          }`}
        >
          Semua Hari ({schedules.length})
        </button>
      </div>

      {/* Filter Kelompok */}
      <div className="bg-white rounded-3xl p-4 border border-slate-200/80 shadow-sm flex flex-col md:flex-row items-center justify-between gap-3">
        <div className="flex items-center space-x-2 w-full md:w-auto">
          <BookOpen className="w-4 h-4 text-orange-500" />
          <span className="text-xs font-bold text-slate-700 uppercase tracking-wider">
            Saring Kelompok:
          </span>
        </div>
        <div className="flex items-center space-x-1.5 w-full md:w-auto overflow-x-auto scrollbar-none">
          {['Semua', 'TK A', 'TK B', 'Kelompok Bermain (KB)'].map((klp) => (
            <button
              key={klp}
              onClick={() => setFilterKelompok(klp)}
              className={`px-3 py-1.5 rounded-xl text-xs font-bold transition whitespace-nowrap ${
                filterKelompok === klp
                  ? 'bg-amber-100 text-amber-800 border border-amber-300'
                  : 'bg-slate-100 text-slate-600 hover:bg-slate-200 border border-transparent'
              }`}
            >
              {klp}
            </button>
          ))}
        </div>
      </div>

      {/* Konten Jadwal */}
      {loading ? (
        <div className="p-12 text-center text-slate-400 font-medium">
          <div className="inline-block animate-spin w-6 h-6 border-2 border-orange-500 border-t-transparent rounded-full mb-2" />
          <p className="text-xs">Memuat daftar jadwal mengajar...</p>
        </div>
      ) : filteredSchedules.length === 0 ? (
        <div className="bg-white rounded-3xl p-12 text-center border border-dashed border-slate-300 shadow-sm">
          <Calendar className="w-12 h-12 text-orange-300 mx-auto mb-3" />
          <h3 className="text-base font-extrabold text-slate-700 font-brand">
            Belum Ada Jadwal untuk {selectedDay === 'Semua' ? 'Kategori Ini' : `Hari ${selectedDay}`}
          </h3>
          <p className="text-xs text-slate-400 max-w-sm mx-auto mt-1">
            Klik tombol "Tambah Jadwal" di atas untuk menambahkan sesi sentra, pembiasaan pagi, atau projek P5.
          </p>
          <button
            onClick={handleOpenAddModal}
            className="mt-4 px-4 py-2 bg-orange-50 text-orange-600 hover:bg-orange-100 font-bold text-xs rounded-xl transition inline-flex items-center space-x-1.5"
          >
            <Plus className="w-3.5 h-3.5" />
            <span>Buat Jadwal Pertama</span>
          </button>
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          {filteredSchedules.map((item) => (
            <div
              key={item.id}
              className="bg-white rounded-3xl p-5 border border-slate-200/80 shadow-sm hover:shadow-md transition flex flex-col justify-between relative group"
            >
              <div>
                {/* Header Jadwal Card */}
                <div className="flex items-start justify-between gap-2 mb-3">
                  <div className="flex items-center space-x-1.5 flex-wrap gap-y-1">
                    <span className="px-2.5 py-0.5 rounded-full text-[11px] font-extrabold bg-orange-100 text-orange-700">
                      {item.hari}
                    </span>
                    <span className="px-2.5 py-0.5 rounded-full text-[11px] font-extrabold bg-blue-100 text-blue-700">
                      {item.kelompok}
                    </span>
                  </div>

                  <div className="flex items-center space-x-1 opacity-90 group-hover:opacity-100 transition">
                    <button
                      onClick={() => handleOpenEditModal(item)}
                      title="Edit Jadwal"
                      className="p-1.5 text-slate-400 hover:text-amber-600 hover:bg-amber-50 rounded-lg transition"
                    >
                      <Edit className="w-4 h-4" />
                    </button>
                    <button
                      onClick={() => setDeleteConfirmId(item.id)}
                      title="Hapus Jadwal"
                      className="p-1.5 text-slate-400 hover:text-rose-600 hover:bg-rose-50 rounded-lg transition"
                    >
                      <Trash2 className="w-4 h-4" />
                    </button>
                  </div>
                </div>

                {/* Jam Sesi */}
                <div className="flex items-center space-x-1.5 text-xs font-bold text-slate-500 mb-2">
                  <Clock className="w-3.5 h-3.5 text-orange-500" />
                  <span>
                    {item.jam_mulai} - {item.jam_selesai} WIB
                  </span>
                </div>

                {/* Judul Kegiatan */}
                <h3 className="font-extrabold text-slate-800 text-base leading-snug font-brand mb-2">
                  {item.kegiatan}
                </h3>

                {/* Keterangan / Deskripsi */}
                {item.keterangan && (
                  <p className="text-xs text-slate-500 font-medium line-clamp-2 mb-3 bg-slate-50 p-2 rounded-xl border border-slate-100">
                    {item.keterangan}
                  </p>
                )}
              </div>

              {/* Footer: PIC Guru */}
              <div className="pt-3 border-t border-slate-100 flex items-center justify-between text-xs">
                <div className="flex items-center space-x-2">
                  <div className="w-7 h-7 rounded-full bg-emerald-100 text-emerald-700 flex items-center justify-center font-bold text-xs">
                    {item.pic_nama ? item.pic_nama.charAt(0).toUpperCase() : 'G'}
                  </div>
                  <div>
                    <div className="font-bold text-slate-700 line-clamp-1">{item.pic_nama}</div>
                    <div className="text-[10px] text-slate-400 font-medium">Guru Pengampu</div>
                  </div>
                </div>
              </div>
            </div>
          ))}
        </div>
      )}

      {/* MODAL TAMBAH / EDIT JADWAL */}
      {isModalOpen && (
        <div className="fixed inset-0 z-50 bg-slate-900/40 backdrop-blur-sm flex items-center justify-center p-4 overflow-y-auto">
          <div className="bg-white rounded-3xl max-w-lg w-full p-6 shadow-2xl border border-slate-100 my-8">
            <div className="flex items-center justify-between pb-4 border-b border-slate-100">
              <div className="flex items-center space-x-2">
                <div className="w-8 h-8 rounded-xl bg-orange-100 text-orange-600 flex items-center justify-center">
                  <Calendar className="w-4 h-4" />
                </div>
                <h2 className="text-base font-extrabold text-slate-800 font-brand">
                  {editingId ? 'Edit Jadwal Pembelajaran' : 'Tambah Jadwal Pembelajaran Baru'}
                </h2>
              </div>
              <button
                onClick={() => setIsModalOpen(false)}
                className="p-1.5 text-slate-400 hover:text-slate-600 rounded-lg hover:bg-slate-100 transition"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            {/* Quick Templates PAUD */}
            {!editingId && (
              <div className="mt-4 p-3 bg-amber-50/80 rounded-2xl border border-amber-200/60">
                <div className="flex items-center space-x-1.5 text-xs font-bold text-amber-800 mb-2">
                  <Sparkles className="w-3.5 h-3.5 text-amber-600" />
                  <span>Pilihan Cepat Template Kegiatan PAUD:</span>
                </div>
                <div className="flex items-center gap-1.5 flex-wrap">
                  {TEMPLATE_AKTIVITAS.map((tpl, i) => (
                    <button
                      type="button"
                      key={i}
                      onClick={() => handleApplyTemplate(tpl)}
                      className="px-2.5 py-1 bg-white hover:bg-amber-100 text-amber-900 rounded-lg text-[11px] font-semibold border border-amber-200 transition"
                    >
                      {tpl.nama.split('&')[0]}
                    </button>
                  ))}
                </div>
              </div>
            )}

            <form onSubmit={handleSubmitForm} className="mt-4 space-y-4">
              {/* Baris 1: Hari & Kelompok */}
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-bold text-slate-700 mb-1">Hari</label>
                  <select
                    value={formHari}
                    onChange={(e) => setFormHari(e.target.value)}
                    className="w-full px-3 py-2 text-xs font-semibold rounded-xl border border-slate-200 focus:outline-none focus:ring-2 focus:ring-orange-500/20 focus:border-orange-500"
                  >
                    {DAYS.map((d) => (
                      <option key={d} value={d}>
                        {d}
                      </option>
                    ))}
                  </select>
                </div>

                <div>
                  <label className="block text-xs font-bold text-slate-700 mb-1">Rombongan Belajar</label>
                  <select
                    value={formKelompok}
                    onChange={(e) => setFormKelompok(e.target.value)}
                    className="w-full px-3 py-2 text-xs font-semibold rounded-xl border border-slate-200 focus:outline-none focus:ring-2 focus:ring-orange-500/20 focus:border-orange-500"
                  >
                    <option value="TK A">TK A (4-5 Tahun)</option>
                    <option value="TK B">TK B (5-6 Tahun)</option>
                    <option value="Kelompok Bermain (KB)">Kelompok Bermain (KB)</option>
                    <option value="Semua Kelompok">Semua Rombel</option>
                  </select>
                </div>
              </div>

              {/* Baris 2: Jam Mulai & Selesai */}
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-bold text-slate-700 mb-1">Jam Mulai</label>
                  <input
                    type="time"
                    required
                    value={formJamMulai}
                    onChange={(e) => setFormJamMulai(e.target.value)}
                    className="w-full px-3 py-2 text-xs font-semibold rounded-xl border border-slate-200 focus:outline-none focus:ring-2 focus:ring-orange-500/20 focus:border-orange-500"
                  />
                </div>

                <div>
                  <label className="block text-xs font-bold text-slate-700 mb-1">Jam Selesai</label>
                  <input
                    type="time"
                    required
                    value={formJamSelesai}
                    onChange={(e) => setFormJamSelesai(e.target.value)}
                    className="w-full px-3 py-2 text-xs font-semibold rounded-xl border border-slate-200 focus:outline-none focus:ring-2 focus:ring-orange-500/20 focus:border-orange-500"
                  />
                </div>
              </div>

              {/* Nama Kegiatan */}
              <div>
                <label className="block text-xs font-bold text-slate-700 mb-1">
                  Nama Kegiatan / Sentra / P5 <span className="text-rose-500">*</span>
                </label>
                <input
                  type="text"
                  required
                  placeholder="Contoh: Sentra Bahan Alam - Eksplorasi Daun Kering"
                  value={formKegiatan}
                  onChange={(e) => setFormKegiatan(e.target.value)}
                  className="w-full px-3 py-2 text-xs font-medium rounded-xl border border-slate-200 focus:outline-none focus:ring-2 focus:ring-orange-500/20 focus:border-orange-500"
                />
              </div>

              {/* Guru Pengampu (PIC) */}
              <div>
                <label className="block text-xs font-bold text-slate-700 mb-1">
                  Guru Pengampu (PIC)
                </label>
                {teachers.length === 0 ? (
                  <p className="text-xs text-rose-500 font-medium">
                    Belum ada guru aktif. Daftarkan guru terlebih dahulu di menu Kelola Guru.
                  </p>
                ) : (
                  <select
                    value={formPicId}
                    onChange={(e) => setFormPicId(e.target.value)}
                    className="w-full px-3 py-2 text-xs font-semibold rounded-xl border border-slate-200 focus:outline-none focus:ring-2 focus:ring-orange-500/20 focus:border-orange-500"
                  >
                    {teachers.map((t) => (
                      <option key={t.id} value={t.id}>
                        {t.nama} ({t.kelompok_kelas || 'Umum'})
                      </option>
                    ))}
                  </select>
                )}
              </div>

              {/* Keterangan / Catatan Perlengkapan */}
              <div>
                <label className="block text-xs font-bold text-slate-700 mb-1">
                  Keterangan / Perlengkapan (Opsional)
                </label>
                <textarea
                  rows={2}
                  placeholder="Catatan alat bermain, APE yang disiapkan, atau lokasi kegiatan..."
                  value={formKeterangan}
                  onChange={(e) => setFormKeterangan(e.target.value)}
                  className="w-full px-3 py-2 text-xs font-medium rounded-xl border border-slate-200 focus:outline-none focus:ring-2 focus:ring-orange-500/20 focus:border-orange-500 resize-none"
                />
              </div>

              {/* Tombol Aksi */}
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
                  disabled={isSubmitting || teachers.length === 0}
                  className="px-5 py-2 text-xs font-extrabold text-white bg-gradient-to-r from-amber-500 to-orange-500 hover:from-amber-600 hover:to-orange-600 rounded-xl shadow-md shadow-orange-500/20 active:scale-95 transition disabled:opacity-50"
                >
                  {isSubmitting ? 'Menyimpan...' : editingId ? 'Simpan Perubahan' : 'Buat Jadwal'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* MODAL KONFIRMASI HAPUS JADWAL */}
      {deleteConfirmId && (
        <div className="fixed inset-0 z-50 bg-slate-900/40 backdrop-blur-sm flex items-center justify-center p-4">
          <div className="bg-white rounded-3xl max-w-sm w-full p-6 shadow-2xl border border-slate-100 text-center">
            <div className="w-12 h-12 bg-rose-100 text-rose-600 rounded-2xl flex items-center justify-center mx-auto mb-3">
              <Trash2 className="w-6 h-6" />
            </div>
            <h3 className="text-base font-extrabold text-slate-800 font-brand">
              Hapus Sesi Jadwal?
            </h3>
            <p className="text-xs text-slate-500 mt-1">
              Jadwal yang dihapus tidak dapat dipulihkan kembali. Guru pengampu tidak akan melihat jadwal ini lagi di dashboard.
            </p>

            <div className="flex items-center justify-center space-x-2 mt-5">
              <button
                onClick={() => setDeleteConfirmId(null)}
                className="px-4 py-2 text-xs font-bold text-slate-600 hover:bg-slate-100 rounded-xl transition"
              >
                Batal
              </button>
              <button
                onClick={() => handleDeleteSchedule(deleteConfirmId)}
                className="px-4 py-2 text-xs font-extrabold text-white bg-rose-500 hover:bg-rose-600 rounded-xl shadow-md shadow-rose-500/20 active:scale-95 transition"
              >
                Ya, Hapus
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}


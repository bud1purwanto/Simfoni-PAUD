import React, { useState, useEffect } from 'react';
import { createPortal } from 'react-dom';
import { 
  FileText, 
  Plus, 
  Clock, 
  CheckCircle2, 
  AlertCircle, 
  AlertTriangle, 
  BookOpen, 
  Briefcase, 
  Wrench, 
  Camera, 
  Mic, 
  MicOff, 
  Trash2, 
  Eye, 
  X, 
  Check, 
  MessageSquare,
  Sparkles,
  Calendar,
  Layers
} from 'lucide-react';
import { 
  collection, 
  query, 
  where, 
 onSnapshot,
  setDoc,
  deleteDoc,
  doc, 
  serverTimestamp 
} from 'firebase/firestore';
import { format } from 'date-fns';
import { id } from 'date-fns/locale';
import { db } from '../../config/firebase';
import { useAuth } from '../../context/AuthContext';
import { useSpeechToText } from '../../hooks/useSpeechToText';
import { uploadCompressedImage } from '../../utils/imageCompressor';
import { logActivity } from '../../utils/auditLogger';
import ModalKonfirmasi from '../../components/ui/ModalKonfirmasi';
import { commitWrite, QUEUED_SUFFIX } from '../../utils/offlineWrite';

const KATEGORI_OPTIONS = [
  { 
    id: 'laporan_kegiatan', 
    label: 'Tugas Tambahan & Rapat', 
    shortLabel: 'Tugas Tambahan',
    icon: Briefcase, 
    color: 'text-amber-700 bg-amber-50 border-amber-200/80',
    description: 'Rapat Gugus/IGTKI, Pelatihan, Pendampingan Lomba, Parenting, dll.' 
  },
  { 
    id: 'administrasi_guru', 
    label: 'Kelengkapan Administrasi', 
    shortLabel: 'Administrasi',
    icon: BookOpen, 
    color: 'text-emerald-600 bg-emerald-50 border-emerald-200',
    description: 'Penyusunan RPPH/Modul Ajar, Asesmen Anak, Raport, Inventaris Kelas, dll.' 
  },
  { 
    id: 'laporan_kendala', 
    label: 'Laporan Kendala Sarpras', 
    shortLabel: 'Kendala Sarpras',
    icon: Wrench, 
    color: 'text-amber-600 bg-amber-50 border-amber-200',
    description: 'Kerusakan mainan, fasilitas kelas, atap bocor, sanitasi, alat peraga, dll.' 
  },
];

export default function LaporanLainGuru() {
  const { userData, schoolData } = useAuth();

  const [reports, setReports] = useState([]);
  const [loading, setLoading] = useState(true);
  const [filterKategori, setFilterKategori] = useState('all');
  const [modalOpen, setModalOpen] = useState(false);
  const [selectedDetail, setSelectedDetail] = useState(null);

  // Form State
  const [kategori, setKategori] = useState('laporan_kegiatan');
  const [tanggal, setTanggal] = useState(format(new Date(), 'yyyy-MM-dd'));
  const [judul, setJudul] = useState('');
  const [deskripsi, setDeskripsi] = useState('');
  const [hasil, setHasil] = useState('');
  const [photoFile, setPhotoFile] = useState(null);
  const [photoPreview, setPhotoPreview] = useState(null);
  const [submitting, setSubmitting] = useState(false);
  const [submitError, setSubmitError] = useState('');
  const [activeSpeechField, setActiveSpeechField] = useState(null); // 'deskripsi' | 'hasil'
  const [deleteConfirmId, setDeleteConfirmId] = useState(null);
  const [isDeleting, setIsDeleting] = useState(false);

  // Speech to Text hook
  const { isListening, transcript, error: speechError, startListening, stopListening, resetTranscript } = useSpeechToText();

  // Sinkronisasi ucapan suara ke field aktif
  useEffect(() => {
    if (transcript && activeSpeechField) {
      if (activeSpeechField === 'deskripsi') {
        setDeskripsi((prev) => (prev ? `${prev} ${transcript}` : transcript));
      } else if (activeSpeechField === 'hasil') {
        setHasil((prev) => (prev ? `${prev} ${transcript}` : transcript));
      }
      resetTranscript();
    }
  }, [transcript, activeSpeechField, resetTranscript]);

  // Listener data laporan
  useEffect(() => {
    if (!userData?.school_id || !userData?.uid) {
      setLoading(false);
      return;
    }

    setLoading(true);
    const reportsRef = collection(db, 'tasks_and_issues');
    const q = query(
      reportsRef,
      where('school_id', '==', userData.school_id),
      where('user_id', '==', userData.uid)
    );

    const unsubscribe = onSnapshot(
      q,
      (snapshot) => {
        const list = snapshot.docs.map((docSnap) => ({
          id: docSnap.id,
          ...docSnap.data(),
        }));

        // Urutkan tanggal terbaru di memori
        list.sort((a, b) => (b.tanggal || '').localeCompare(a.tanggal || ''));
        setReports(list);
        setLoading(false);
      },
      (error) => {
        console.warn('Gagal mengambil laporan tugas & kendala:', error);
        setLoading(false);
      }
    );

    return () => unsubscribe();
  }, [userData?.school_id, userData?.uid]);

  // Handle upload foto preview
  const handlePhotoChange = (e) => {
    const file = e.target.files[0];
    if (file) {
      if (photoPreview) URL.revokeObjectURL(photoPreview);
      setPhotoFile(file);
      setPhotoPreview(URL.createObjectURL(file));
    }
  };

  const removePhoto = () => {
    if (photoPreview) URL.revokeObjectURL(photoPreview);
    setPhotoFile(null);
    setPhotoPreview(null);
  };

  // Toggle Voice to Text
  const toggleSpeech = (field) => {
    if (isListening && activeSpeechField === field) {
      stopListening();
      setActiveSpeechField(null);
    } else {
      setActiveSpeechField(field);
      resetTranscript();
      startListening();
    }
  };

  // Reset form
  const resetForm = () => {
    setKategori('laporan_kegiatan');
    setTanggal(format(new Date(), 'yyyy-MM-dd'));
    setJudul('');
    setDeskripsi('');
    setHasil('');
    removePhoto();
    setSubmitError('');
    setActiveSpeechField(null);
  };

  // Simpan Laporan
  const handleSubmit = async (e) => {
    e.preventDefault();
    if (!judul.trim()) {
      setSubmitError('Harap masukkan judul kegiatan atau kendala.');
      return;
    }
    if (!deskripsi.trim()) {
      setSubmitError('Harap berikan deskripsi detail laporan.');
      return;
    }

    setSubmitting(true);
    setSubmitError('');

    try {
      let fotoUrl = null;
      if (photoFile && typeof navigator !== 'undefined' && navigator.onLine === false) {
        setSubmitError('Unggah foto memerlukan sinyal internet. Hapus foto atau coba lagi saat sinyal kembali.');
        return;
      }
      if (photoFile) {
        const uploadResult = await uploadCompressedImage(
          photoFile,
          userData.school_id,
          userData.uid,
          'tasks'
        );
        fotoUrl = uploadResult.url;
      }

      const docRef = doc(collection(db, 'tasks_and_issues'));
      const { queued } = await commitWrite(setDoc(docRef, {
        school_id: userData.school_id,
        user_id: userData.uid,
        nama_guru: userData.nama || 'Guru PAUD',
        tanggal: tanggal,
        kategori: kategori,
        judul: judul.trim(),
        deskripsi: deskripsi.trim(),
        hasil_atau_tindak_lanjut: hasil.trim() || '',
        foto_pendukung_url: fotoUrl,
        status: 'dilaporkan',
        tanggapan_kepsek: '',
        created_at: serverTimestamp(),
        updated_at: serverTimestamp(),
      }));

      // Audit Log
      logActivity({
        schoolId: userData.school_id,
        actorId: userData.uid,
        actorNama: userData.nama || 'Guru',
        action: 'ADD_TASK_OR_ISSUE',
        recordType: 'tasks_and_issues',
        recordId: docRef.id,
      });

      resetForm();
      setModalOpen(false);
      if (queued) window.alert(`Laporan dicatat${QUEUED_SUFFIX}.`);
    } catch (err) {
      console.error('Gagal menyimpan laporan:', err);
      setSubmitError(err.message || 'Terjadi kesalahan saat menyimpan laporan.');
    } finally {
      setSubmitting(false);
    }
  };

  // Hapus Laporan (hanya jika masih berstatus dilaporkan)
  const handleDelete = (reportId) => {
    setDeleteConfirmId(reportId);
  };

  const executeDelete = async () => {
    if (!deleteConfirmId) return;
    setIsDeleting(true);
    try {
      await deleteDoc(doc(db, 'tasks_and_issues', deleteConfirmId));
      setDeleteConfirmId(null);
    } catch (err) {
      console.error('Error deleting report:', err);
    } finally {
      setIsDeleting(false);
    }
  };

  // Filter list laporan
  const filteredReports = reports.filter((item) => {
    if (filterKategori === 'all') return true;
    return item.kategori === filterKategori;
  });

  return (
    <div className="space-y-6 max-w-5xl mx-auto pb-12">
      {/* Header Banner */}
      <div className="bg-gradient-to-r from-amber-400 via-orange-400 to-rose-400 rounded-3xl p-6 md:p-8 text-white shadow-xl shadow-orange-500/15 relative overflow-hidden">
        <div className="absolute right-2 -bottom-4 opacity-20 text-8xl md:text-9xl pointer-events-none select-none font-brand">
          📋
        </div>
        <div className="relative z-10 flex flex-col md:flex-row md:items-center md:justify-between gap-4">
          <div>
            <div className="inline-flex items-center space-x-2 px-3.5 py-1 bg-white/20 backdrop-blur-md rounded-full text-xs font-bold mb-3 border border-white/20">
              <Layers className="w-3.5 h-3.5" />
              <span>Aktivitas Non-KBM & Sarana Prasarana</span>
            </div>
            <h1 className="text-2xl md:text-3xl font-extrabold tracking-tight font-brand">
              Tugas Tambahan & Kendala 🌻
            </h1>
            <p className="text-amber-50 text-sm mt-1 font-medium">
              Catatan rapat dinas, administrasi guru, dan pelaporan sarana sekolah
            </p>
          </div>

          <button
            type="button"
            onClick={() => {
              resetForm();
              setModalOpen(true);
            }}
            className="inline-flex items-center justify-center space-x-2 px-5 py-3.5 bg-white text-orange-700 hover:bg-orange-50 active:scale-95 rounded-2xl text-xs font-extrabold transition-all shadow-md shadow-black/10 shrink-0 font-brand"
          >
            <Plus className="w-4 h-4 text-orange-600 stroke-[3]" />
            <span>Buat Laporan Baru</span>
          </button>
        </div>
      </div>

      {/* Tabs Filter Kategori */}
      <div className="bg-white rounded-3xl p-4 md:p-5 border border-slate-200/80 shadow-sm">
        <div className="flex items-center space-x-2 overflow-x-auto pb-1 scrollbar-thin">
          <button
            type="button"
            onClick={() => setFilterKategori('all')}
            className={`px-4 py-2 rounded-2xl text-xs font-bold transition-all whitespace-nowrap flex items-center space-x-2 ${
              filterKategori === 'all'
                ? 'bg-slate-800 text-white shadow-sm'
                : 'bg-slate-50 text-slate-600 hover:bg-slate-100 border border-slate-200/60'
            }`}
          >
            <span>Semua Laporan</span>
            <span className="px-1.5 py-0.5 rounded-full text-[10px] bg-white/20 text-white">
              {reports.length}
            </span>
          </button>

          {KATEGORI_OPTIONS.map((kat) => {
            const count = reports.filter((r) => r.kategori === kat.id).length;
            const Icon = kat.icon;
            const isActive = filterKategori === kat.id;

            return (
              <button
                key={kat.id}
                type="button"
                onClick={() => setFilterKategori(kat.id)}
                className={`px-4 py-2 rounded-2xl text-xs font-bold transition-all whitespace-nowrap flex items-center space-x-2 ${
                  isActive
                    ? 'bg-teal-700 text-white shadow-md shadow-teal-700/20'
                    : 'bg-slate-50 text-slate-600 hover:bg-slate-100 border border-slate-200/60'
                }`}
              >
                <Icon className="w-3.5 h-3.5" />
                <span>{kat.shortLabel}</span>
                <span
                  className={`px-1.5 py-0.5 rounded-full text-[10px] ${
                    isActive ? 'bg-white/20 text-white' : 'bg-slate-200 text-slate-600'
                  }`}
                >
                  {count}
                </span>
              </button>
            );
          })}
        </div>
      </div>

      {/* Daftar Laporan */}
      {loading ? (
        <div className="flex flex-col items-center justify-center p-12 bg-white rounded-3xl border border-slate-200/80">
          <div className="w-8 h-8 border-4 border-teal-600 border-t-transparent rounded-full animate-spin mb-3" />
          <p className="text-sm font-semibold text-slate-600">Memuat laporan...</p>
        </div>
      ) : filteredReports.length === 0 ? (
        <div className="bg-white rounded-3xl p-8 md:p-12 border border-slate-200/80 text-center shadow-sm">
          <div className="w-14 h-14 bg-teal-50 text-teal-600 rounded-2xl flex items-center justify-center mx-auto mb-4">
            <FileText className="w-7 h-7" />
          </div>
          <h3 className="text-base font-bold text-slate-800">Belum Ada Laporan</h3>
          <p className="text-xs text-slate-500 max-w-sm mx-auto mt-1">
            Anda belum pernah membuat laporan pada kategori ini. Klik tombol di bawah untuk membuat laporan baru.
          </p>
          <button
            type="button"
            onClick={() => {
              resetForm();
              setModalOpen(true);
            }}
            className="mt-6 inline-flex items-center space-x-2 px-5 py-2.5 bg-teal-600 hover:bg-teal-700 text-white rounded-xl text-xs font-bold transition-all shadow-md shadow-teal-600/20"
          >
            <Plus className="w-4 h-4 stroke-[3]" />
            <span>Tulis Laporan Sekarang</span>
          </button>
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          {filteredReports.map((item) => {
            const katConfig = KATEGORI_OPTIONS.find((k) => k.id === item.kategori) || KATEGORI_OPTIONS[0];
            const KatIcon = katConfig.icon;

            return (
              <div
                key={item.id}
                className="bg-white rounded-3xl p-5 border border-slate-200/80 shadow-sm hover:shadow-md transition-all flex flex-col justify-between"
              >
                <div>
                  {/* Top Bar: Kategori & Status */}
                  <div className="flex items-center justify-between gap-2 mb-3">
                    <span className={`inline-flex items-center space-x-1.5 px-2.5 py-1 rounded-xl text-[11px] font-bold border ${katConfig.color}`}>
                      <KatIcon className="w-3 h-3" />
                      <span>{katConfig.shortLabel}</span>
                    </span>

                    {/* Status Badge */}
                    {item.status === 'selesai' ? (
                      <span className="inline-flex items-center space-x-1 px-2.5 py-1 bg-emerald-50 text-emerald-700 border border-emerald-200 rounded-xl text-[11px] font-bold">
                        <CheckCircle2 className="w-3 h-3 text-emerald-600" />
                        <span>Selesai</span>
                      </span>
                    ) : item.status === 'diproses' ? (
                      <span className="inline-flex items-center space-x-1 px-2.5 py-1 bg-blue-50 text-blue-700 border border-blue-200 rounded-xl text-[11px] font-bold">
                        <Clock className="w-3 h-3 text-blue-600" />
                        <span>Diproses</span>
                      </span>
                    ) : (
                      <span className="inline-flex items-center space-x-1 px-2.5 py-1 bg-amber-50 text-amber-700 border border-amber-200 rounded-xl text-[11px] font-bold">
                        <AlertCircle className="w-3 h-3 text-amber-600" />
                        <span>Dilaporkan</span>
                      </span>
                    )}
                  </div>

                  {/* Judul & Tanggal */}
                  <h3 className="text-base font-bold text-slate-800 line-clamp-2">
                    {item.judul}
                  </h3>
                  <div className="flex items-center space-x-2 text-xs text-slate-400 mt-1">
                    <Calendar className="w-3.5 h-3.5" />
                    <span>
                      {item.tanggal
                        ? format(new Date(item.tanggal), 'EEEE, dd MMMM yyyy', { locale: id })
                        : '-'}
                    </span>
                  </div>

                  {/* Deskripsi Singkat */}
                  <p className="text-xs text-slate-600 mt-3 line-clamp-3 leading-relaxed">
                    {item.deskripsi}
                  </p>

                  {/* Lampiran Foto Mini */}
                  {item.foto_pendukung_url && (
                    <div className="mt-3">
                      <img
                        src={item.foto_pendukung_url}
                        alt="Foto Pendukung"
                        className="w-full h-32 object-cover rounded-2xl border border-slate-200"
                        loading="lazy"
                      />
                    </div>
                  )}

                  {/* Tanggapan Kepala Sekolah jika ada */}
                  {item.tanggapan_kepsek && (
                    <div className="mt-3 p-3 bg-blue-50/80 rounded-2xl border border-blue-200/80 text-xs">
                      <div className="flex items-center space-x-1.5 text-blue-700 font-bold mb-1">
                        <MessageSquare className="w-3.5 h-3.5" />
                        <span>Tanggapan Kepala Sekolah:</span>
                      </div>
                      <p className="text-slate-700 italic">
                        "{item.tanggapan_kepsek}"
                      </p>
                    </div>
                  )}
                </div>

                {/* Footer Actions */}
                <div className="mt-4 pt-3 border-t border-slate-100 flex items-center justify-between">
                  <button
                    type="button"
                    onClick={() => setSelectedDetail(item)}
                    className="inline-flex items-center space-x-1.5 text-xs font-bold text-teal-600 hover:text-teal-700"
                  >
                    <Eye className="w-3.5 h-3.5" />
                    <span>Lihat Selengkapnya</span>
                  </button>

                  {item.status === 'dilaporkan' && (
                    <button
                      type="button"
                      onClick={() => handleDelete(item.id)}
                      className="p-1.5 text-rose-500 hover:bg-rose-50 rounded-xl transition-all"
                      title="Hapus Laporan"
                    >
                      <Trash2 className="w-4 h-4" />
                    </button>
                  )}
                </div>
              </div>
            );
          })}
        </div>
      )}

      {/* MODAL: Buat Laporan Baru */}
      {modalOpen && createPortal(
        <div className="fixed inset-0 z-[100] flex items-center justify-center p-4 bg-slate-900/60 backdrop-blur-sm animate-fade-in">
          <div className="bg-white rounded-3xl w-full max-w-2xl max-h-[90vh] overflow-y-auto shadow-2xl border border-slate-200 flex flex-col">
            {/* Modal Header */}
            <div className="sticky top-0 bg-white px-6 py-4 border-b border-slate-200 flex items-center justify-between z-10">
              <div className="flex items-center space-x-3">
                <div className="w-9 h-9 bg-teal-50 text-teal-600 rounded-xl flex items-center justify-center font-bold">
                  <FileText className="w-5 h-5" />
                </div>
                <div>
                  <h3 className="text-base font-bold text-slate-800">
                    Form Pelaporan Tugas & Kendala
                  </h3>
                  <p className="text-xs text-slate-400">
                    Laporan kegiatan non-KBM atau fasilitas sekolah
                  </p>
                </div>
              </div>
              <button
                type="button"
                onClick={() => setModalOpen(false)}
                className="p-2 text-slate-400 hover:text-slate-600 rounded-xl hover:bg-slate-100"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            {/* Modal Body */}
            <form onSubmit={handleSubmit} className="p-6 space-y-5">
              {submitError && (
                <div className="p-3 bg-rose-50 border border-rose-200 rounded-2xl text-xs text-rose-700 font-semibold flex items-center space-x-2">
                  <AlertCircle className="w-4 h-4 shrink-0 text-rose-600" />
                  <span>{submitError}</span>
                </div>
              )}

              {/* Pilihan Kategori */}
              <div>
                <label className="block text-xs font-bold text-slate-700 uppercase tracking-wide mb-2">
                  Pilih Kategori Laporan <span className="text-rose-500">*</span>
                </label>
                <div className="grid grid-cols-1 sm:grid-cols-3 gap-2">
                  {KATEGORI_OPTIONS.map((kat) => {
                    const isSelected = kategori === kat.id;
                    const Icon = kat.icon;
                    return (
                      <button
                        key={kat.id}
                        type="button"
                        onClick={() => setKategori(kat.id)}
                        className={`p-3 rounded-2xl border text-left transition-all flex flex-col justify-between ${
                          isSelected
                            ? 'bg-teal-50 border-teal-500 ring-2 ring-teal-500/20 shadow-sm'
                            : 'bg-white border-slate-200 hover:bg-slate-50'
                        }`}
                      >
                        <div className="flex items-center justify-between mb-1.5">
                          <Icon className={`w-4 h-4 ${isSelected ? 'text-teal-600' : 'text-slate-400'}`} />
                          {isSelected && <Check className="w-3.5 h-3.5 text-teal-600 stroke-[3]" />}
                        </div>
                        <div>
                          <div className={`text-xs font-bold ${isSelected ? 'text-teal-900' : 'text-slate-800'}`}>
                            {kat.shortLabel}
                          </div>
                          <div className="text-[10px] text-slate-500 mt-0.5 line-clamp-2">
                            {kat.description}
                          </div>
                        </div>
                      </button>
                    );
                  })}
                </div>
              </div>

              {/* Tanggal & Judul */}
              <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                <div>
                  <label className="block text-xs font-bold text-slate-700 uppercase tracking-wide mb-1.5">
                    Tanggal <span className="text-rose-500">*</span>
                  </label>
                  <input
                    type="date"
                    value={tanggal}
                    onChange={(e) => setTanggal(e.target.value)}
                    required
                    className="w-full px-3.5 py-2.5 bg-slate-50 border border-slate-200 rounded-xl text-xs font-semibold text-slate-800 focus:bg-white focus:ring-2 focus:ring-teal-500/20 focus:border-teal-500"
                  />
                </div>
                <div className="sm:col-span-2">
                  <label className="block text-xs font-bold text-slate-700 uppercase tracking-wide mb-1.5">
                    Judul Kegiatan / Kendala <span className="text-rose-500">*</span>
                  </label>
                  <input
                    type="text"
                    value={judul}
                    onChange={(e) => setJudul(e.target.value)}
                    placeholder="Contoh: Rapat Koordinasi IGTKI / Kerusakan Ayunan Luar"
                    required
                    className="w-full px-3.5 py-2.5 bg-slate-50 border border-slate-200 rounded-xl text-xs font-semibold text-slate-800 focus:bg-white focus:ring-2 focus:ring-teal-500/20 focus:border-teal-500"
                  />
                </div>
              </div>

              {/* Deskripsi Detail + Voice to Text */}
              <div>
                <div className="flex items-center justify-between mb-1.5">
                  <label className="text-xs font-bold text-slate-700 uppercase tracking-wide">
                    Deskripsi Lengkap <span className="text-rose-500">*</span>
                  </label>
                  <button
                    type="button"
                    onClick={() => toggleSpeech('deskripsi')}
                    className={`inline-flex items-center space-x-1 px-2.5 py-1 rounded-xl text-[11px] font-bold transition-all ${
                      isListening && activeSpeechField === 'deskripsi'
                        ? 'bg-rose-500 text-white animate-pulse'
                        : 'bg-teal-50 text-teal-700 hover:bg-teal-100'
                    }`}
                  >
                    {isListening && activeSpeechField === 'deskripsi' ? (
                      <>
                        <MicOff className="w-3 h-3" />
                        <span>Mendengarkan...</span>
                      </>
                    ) : (
                      <>
                        <Mic className="w-3 h-3" />
                        <span>Dikte Suara (id-ID)</span>
                      </>
                    )}
                  </button>
                </div>
                <textarea
                  rows={4}
                  value={deskripsi}
                  onChange={(e) => setDeskripsi(e.target.value)}
                  placeholder="Ceritakan detail kegiatan yang dihadiri atau rincian kerusakan fasilitas..."
                  required
                  className="w-full px-3.5 py-2.5 bg-slate-50 border border-slate-200 rounded-2xl text-xs text-slate-800 focus:bg-white focus:ring-2 focus:ring-teal-500/20 focus:border-teal-500 resize-none leading-relaxed"
                />
              </div>

              {/* Hasil / Rencana Tindak Lanjut */}
              <div>
                <div className="flex items-center justify-between mb-1.5">
                  <label className="text-xs font-bold text-slate-700 uppercase tracking-wide">
                    Hasil Kegiatan / Rencana Tindak Lanjut
                  </label>
                  <button
                    type="button"
                    onClick={() => toggleSpeech('hasil')}
                    className={`inline-flex items-center space-x-1 px-2.5 py-1 rounded-xl text-[11px] font-bold transition-all ${
                      isListening && activeSpeechField === 'hasil'
                        ? 'bg-rose-500 text-white animate-pulse'
                        : 'bg-teal-50 text-teal-700 hover:bg-teal-100'
                    }`}
                  >
                    {isListening && activeSpeechField === 'hasil' ? (
                      <>
                        <MicOff className="w-3 h-3" />
                        <span>Mendengarkan...</span>
                      </>
                    ) : (
                      <>
                        <Mic className="w-3 h-3" />
                        <span>Dikte Suara</span>
                      </>
                    )}
                  </button>
                </div>
                <textarea
                  rows={2}
                  value={hasil}
                  onChange={(e) => setHasil(e.target.value)}
                  placeholder="Hasil keputusan rapat atau perbaikan yang dibutuhkan..."
                  className="w-full px-3.5 py-2.5 bg-slate-50 border border-slate-200 rounded-2xl text-xs text-slate-800 focus:bg-white focus:ring-2 focus:ring-teal-500/20 focus:border-teal-500 resize-none leading-relaxed"
                />
              </div>

              {/* Upload Foto Dokumentasi / Bukti */}
              <div>
                <label className="block text-xs font-bold text-slate-700 uppercase tracking-wide mb-1.5">
                  Foto Bukti / Dokumentasi (Opsional - Otomatis Terkompresi)
                </label>
                {photoPreview ? (
                  <div className="relative inline-block">
                    <img
                      src={photoPreview}
                      alt="Preview"
                      className="w-48 h-32 object-cover rounded-2xl border border-slate-200 shadow-sm"
                    />
                    <button
                      type="button"
                      onClick={removePhoto}
                      className="absolute -top-2 -right-2 p-1.5 bg-rose-600 text-white rounded-full shadow-md hover:bg-rose-700"
                    >
                      <X className="w-3.5 h-3.5" />
                    </button>
                  </div>
                ) : (
                  <label className="flex flex-col items-center justify-center p-6 border-2 border-dashed border-slate-200 hover:border-teal-400 bg-slate-50 rounded-2xl cursor-pointer transition-all">
                    <Camera className="w-7 h-7 text-teal-600 mb-1.5" />
                    <span className="text-xs font-bold text-slate-700">Pilih / Ambil Foto</span>
                    <span className="text-[10px] text-slate-400 mt-0.5">
                      Kamera HP atau Galeri (Otomatis &lt; 300 KB)
                    </span>
                    <input
                      type="file"
                      accept="image/*"
                      onChange={handlePhotoChange}
                      className="hidden"
                    />
                  </label>
                )}
              </div>

              {/* Submit Buttons */}
              <div className="pt-3 border-t border-slate-100 flex items-center justify-end space-x-3">
                <button
                  type="button"
                  onClick={() => setModalOpen(false)}
                  disabled={submitting}
                  className="px-4 py-2.5 text-xs font-bold text-slate-600 hover:bg-slate-100 rounded-xl transition-all"
                >
                  Batal
                </button>
                <button
                  type="submit"
                  disabled={submitting}
                  className="inline-flex items-center space-x-2 px-6 py-2.5 bg-teal-600 hover:bg-teal-700 active:scale-95 text-white rounded-xl text-xs font-bold transition-all shadow-md shadow-teal-600/25 disabled:opacity-50"
                >
                  {submitting ? (
                    <>
                      <div className="w-3.5 h-3.5 border-2 border-white border-t-transparent rounded-full animate-spin" />
                      <span>Mengunggah...</span>
                    </>
                  ) : (
                    <>
                      <Check className="w-4 h-4 stroke-[3]" />
                      <span>Kirim Laporan</span>
                    </>
                  )}
                </button>
              </div>
            </form>
          </div>
        </div>,
        document.body
      )}

      {/* MODAL: Detail Laporan */}
      {selectedDetail && createPortal(
        <div className="fixed inset-0 z-[100] flex items-center justify-center p-4 bg-slate-900/60 backdrop-blur-sm animate-fade-in">
          <div className="bg-white rounded-3xl w-full max-w-xl max-h-[90vh] overflow-y-auto shadow-2xl border border-slate-200 flex flex-col p-6 space-y-4">
            <div className="flex items-center justify-between border-b border-slate-100 pb-3">
              <div>
                <span className="text-xs font-bold text-teal-600 uppercase tracking-wide">
                  Detail Laporan
                </span>
                <h3 className="text-base font-bold text-slate-800">
                  {selectedDetail.judul}
                </h3>
              </div>
              <button
                type="button"
                onClick={() => setSelectedDetail(null)}
                className="p-1.5 text-slate-400 hover:text-slate-600 rounded-xl hover:bg-slate-100"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <div className="space-y-3 text-xs">
              <div className="flex items-center space-x-2 text-slate-500">
                <Calendar className="w-3.5 h-3.5" />
                <span>
                  {selectedDetail.tanggal
                    ? format(new Date(selectedDetail.tanggal), 'EEEE, dd MMMM yyyy', { locale: id })
                    : '-'}
                </span>
              </div>

              <div>
                <span className="font-bold text-slate-700 block mb-1">Deskripsi Kegiatan:</span>
                <p className="p-3 bg-slate-50 rounded-2xl border border-slate-200 text-slate-700 leading-relaxed whitespace-pre-wrap">
                  {selectedDetail.deskripsi}
                </p>
              </div>

              {selectedDetail.hasil_atau_tindak_lanjut && (
                <div>
                  <span className="font-bold text-slate-700 block mb-1">Hasil / Tindak Lanjut:</span>
                  <p className="p-3 bg-slate-50 rounded-2xl border border-slate-200 text-slate-700 leading-relaxed whitespace-pre-wrap">
                    {selectedDetail.hasil_atau_tindak_lanjut}
                  </p>
                </div>
              )}

              {selectedDetail.foto_pendukung_url && (
                <div>
                  <span className="font-bold text-slate-700 block mb-1">Foto Bukti:</span>
                  <img
                    src={selectedDetail.foto_pendukung_url}
                    alt="Foto Lampiran"
                    className="w-full max-h-72 object-cover rounded-2xl border border-slate-200"
                  />
                </div>
              )}

              {selectedDetail.tanggapan_kepsek && (
                <div className="p-3.5 bg-blue-50 border border-blue-200 rounded-2xl">
                  <span className="font-bold text-blue-800 block mb-0.5">Tanggapan Kepala Sekolah:</span>
                  <p className="text-slate-700 italic">"{selectedDetail.tanggapan_kepsek}"</p>
                </div>
              )}
            </div>

            <div className="pt-2 border-t border-slate-100 flex justify-end">
              <button
                type="button"
                onClick={() => setSelectedDetail(null)}
                className="px-5 py-2 bg-slate-100 hover:bg-slate-200 text-slate-700 rounded-xl text-xs font-bold transition-all"
              >
                Tutup
              </button>
            </div>
          </div>
        </div>,
        document.body
      )}

      {/* Modal Konfirmasi Hapus Laporan */}
      <ModalKonfirmasi
        isOpen={!!deleteConfirmId}
        title="Hapus Laporan Kegiatan"
        message="Apakah Anda yakin ingin menghapus laporan ini? Laporan yang dihapus tidak dapat dipulihkan kembali."
        confirmText="Ya, Hapus"
        type="danger"
        loading={isDeleting}
        onConfirm={executeDelete}
        onClose={() => setDeleteConfirmId(null)}
      />
    </div>
  );
}


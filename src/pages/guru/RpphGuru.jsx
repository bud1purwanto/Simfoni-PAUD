import React, { useState, useEffect } from 'react';
import {
  FileText,
  Upload,
  Calendar,
  CheckCircle2,
  AlertCircle,
  Clock,
  Send,
  Plus,
  Trash2,
  ExternalLink,
  BookOpen,
  Sparkles,
  Link as LinkIcon
} from 'lucide-react';
import {
  collection,
  query,
  where,
  getDocs,
  addDoc,
  deleteDoc,
  doc,
  serverTimestamp
} from 'firebase/firestore';
import { db } from '../../config/firebase';
import { useAuth } from '../../context/AuthContext';
import { formatTanggalIndo } from '../../utils/formatters';
import { getKelompokOptions, normalizeKelompok } from '../../utils/schoolConfig';
import { logActivity } from '../../utils/auditLogger';
import { commitWrite, QUEUED_SUFFIX } from '../../utils/offlineWrite';
import ModalKonfirmasi from '../../components/ui/ModalKonfirmasi';

export default function RpphGuru() {
  const { userData, schoolData } = useAuth();
  const daftarKelompok = getKelompokOptions(schoolData).filter(k => k !== 'Semua');
  const kelasSaya = normalizeKelompok(userData?.kelompok_kelas);

  const [rpphList, setRpphList] = useState([]);
  const [loading, setLoading] = useState(true);
  const [formOpen, setFormOpen] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [notification, setNotification] = useState(null);

  // Form State
  const [kelompok, setKelompok] = useState(
    kelasSaya && daftarKelompok.includes(kelasSaya) ? kelasSaya : (daftarKelompok[0] || 'TK A')
  );
  const [mingguKe, setMingguKe] = useState(1);
  const [semester, setSemester] = useState('1');
  const [tahunAjaran, setTahunAjaran] = useState('2026/2027');
  const [tema, setTema] = useState('');
  const [subtema, setSubtema] = useState('');
  const [ringkasanTujuan, setRingkasanTujuan] = useState('');
  const [fileUrl, setFileUrl] = useState('');

  // Delete State
  const [deleteModalOpen, setDeleteModalOpen] = useState(false);
  const [rpphToDelete, setRpphToDelete] = useState(null);

  // Fetch daftar RPPH guru ini
  const fetchRpph = async () => {
    if (!userData?.school_id || !userData?.uid) return;
    try {
      setLoading(true);
      const q = query(
        collection(db, 'rpph_submissions'),
        where('school_id', '==', userData.school_id),
        where('guru_id', '==', userData.uid)
      );
      const snap = await getDocs(q);
      const list = snap.docs.map(d => ({ id: d.id, ...d.data() }));
      list.sort((a, b) => (b.minggu_ke || 0) - (a.minggu_ke || 0));
      setRpphList(list);
    } catch (err) {
      console.error('Error fetching RPPH:', err);
      setNotification({ type: 'error', text: 'Gagal memuat daftar RPPH. Periksa jaringan Anda.' });
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchRpph();
  }, [userData?.school_id, userData?.uid]);

  // Submit RPPH
  const handleSubmitRpph = async (e, asDraft = false) => {
    e.preventDefault();
    if (!tema.trim()) {
      setNotification({ type: 'error', text: 'Tema pembelajaran wajib diisi.' });
      return;
    }
    if (!fileUrl.trim()) {
      setNotification({ type: 'error', text: 'Tautan Google Drive / dokumen modul ajar wajib diisi.' });
      return;
    }

    setSubmitting(true);
    try {
      const statusAwal = asDraft ? 'draf' : 'dikirim';
      const payload = {
        school_id: userData.school_id,
        guru_id: userData.uid,
        nama_guru: userData.nama,
        kelompok,
        minggu_ke: Number(mingguKe),
        semester: String(semester),
        tahun_ajaran: tahunAjaran.trim(),
        tema: tema.trim(),
        subtema: subtema.trim(),
        ringkasan_tujuan: ringkasanTujuan.trim(),
        file_url: fileUrl.trim(),
        status: statusAwal,
        catatan_kepsek: '',
        disetujui_at: null,
        disetujui_by: null,
        created_at: serverTimestamp(),
        updated_at: serverTimestamp()
      };

      const { queued } = await commitWrite(addDoc(collection(db, 'rpph_submissions'), payload));

      logActivity({
        schoolId: userData.school_id,
        actorId: userData.uid,
        actorNama: userData.nama,
        action: 'SUBMIT_RPPH',
        recordType: 'rpph_submissions',
        recordId: 'new',
        detail: { kelompok, minggu_ke: mingguKe, tema, status: statusAwal }
      });

      setNotification({
        type: 'success',
        text: `Modul ajar Minggu ke-${mingguKe} berhasil ${asDraft ? 'disimpan sebagai draf' : 'dikirim ke Kepala Sekolah'}!${queued ? QUEUED_SUFFIX : ''}`
      });

      // Reset form
      setTema('');
      setSubtema('');
      setRingkasanTujuan('');
      setFileUrl('');
      setFormOpen(false);
      await fetchRpph();
    } catch (err) {
      console.error('Error submitting RPPH:', err);
      setNotification({ type: 'error', text: 'Gagal mengirimkan RPPH. Silakan coba lagi.' });
    } finally {
      setSubmitting(false);
    }
  };

  // Hapus Draf RPPH
  const handleConfirmDelete = async () => {
    if (!rpphToDelete) return;
    setSubmitting(true);
    try {
      await commitWrite(deleteDoc(doc(db, 'rpph_submissions', rpphToDelete.id)));
      setNotification({ type: 'success', text: `RPPH Minggu ke-${rpphToDelete.minggu_ke} berhasil dihapus.` });
      setDeleteModalOpen(false);
      setRpphToDelete(null);
      await fetchRpph();
    } catch (err) {
      console.error('Error deleting RPPH:', err);
      setNotification({ type: 'error', text: 'Gagal menghapus RPPH.' });
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div className="max-w-5xl mx-auto space-y-5 animate-in fade-in duration-200">
      {/* Header Halaman Ceria */}
      <div className="bg-gradient-to-r from-blue-600 via-indigo-600 to-violet-600 rounded-3xl p-5 md:p-7 text-white shadow-lg shadow-indigo-600/20 relative overflow-hidden">
        <div className="absolute right-0 top-0 bottom-0 opacity-10 pointer-events-none flex items-center pr-6">
          <BookOpen className="w-48 h-48" />
        </div>
        <div className="relative z-10 flex flex-col md:flex-row md:items-center justify-between gap-4">
          <div>
            <div className="inline-flex items-center space-x-1.5 px-3 py-1 rounded-xl bg-white/20 backdrop-blur-md text-[11px] font-bold tracking-wide uppercase mb-2">
              <Sparkles className="w-3.5 h-3.5" />
              <span>Pilar 2 - Perangkat Ajar Kurikulum Merdeka</span>
            </div>
            <h1 className="text-xl md:text-2xl font-black font-brand">
              Modul Ajar & RPPH Mingguan 📚
            </h1>
            <p className="text-xs md:text-sm text-indigo-100 max-w-xl mt-1 leading-relaxed">
              Kumpulkan modul ajar dan rencana pelaksanaan pembelajaran mingguan untuk ditelaah dan disahkan oleh Kepala Sekolah.
            </p>
          </div>

          <button
            onClick={() => setFormOpen(!formOpen)}
            className="px-4 py-3 rounded-2xl bg-white text-indigo-700 hover:bg-indigo-50 font-bold text-xs shadow-md transition flex items-center justify-center space-x-2 shrink-0"
          >
            <Plus className="w-4 h-4 stroke-[2.5]" />
            <span>{formOpen ? 'Tutup Form' : 'Unggah Modul Ajar'}</span>
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
          <button onClick={() => setNotification(null)} className="text-slate-400 hover:text-slate-600 font-bold ml-3">✕</button>
        </div>
      )}

      {/* Form Input RPPH Baru (Collapsible) */}
      {formOpen && (
        <form onSubmit={(e) => handleSubmitRpph(e, false)} className="bg-white rounded-3xl p-6 border border-indigo-100 shadow-md space-y-4 animate-in slide-in-from-top-4 duration-200">
          <div className="flex items-center space-x-2 pb-2 border-b border-slate-100 text-indigo-900 font-bold text-sm font-brand">
            <FileText className="w-4 h-4 text-indigo-600" />
            <span>Form Pengumpulan Rencana Pembelajaran Mingguan</span>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-4 gap-3">
            <div>
              <label className="text-xs font-bold text-slate-700">Kelompok Rombel</label>
              <select
                value={kelompok}
                onChange={(e) => setKelompok(e.target.value)}
                className="w-full mt-1 px-3.5 py-2.5 rounded-2xl border border-slate-200 text-xs bg-white focus:ring-2 focus:ring-indigo-400 focus:outline-none"
              >
                {daftarKelompok.map(klp => <option key={klp} value={klp}>{klp}</option>)}
              </select>
            </div>
            <div>
              <label className="text-xs font-bold text-slate-700">Minggu Ke-</label>
              <input
                type="number"
                min="1"
                max="24"
                value={mingguKe}
                onChange={(e) => setMingguKe(e.target.value)}
                className="w-full mt-1 px-3.5 py-2.5 rounded-2xl border border-slate-200 text-xs focus:ring-2 focus:ring-indigo-400 focus:outline-none"
              />
            </div>
            <div>
              <label className="text-xs font-bold text-slate-700">Semester</label>
              <select
                value={semester}
                onChange={(e) => setSemester(e.target.value)}
                className="w-full mt-1 px-3.5 py-2.5 rounded-2xl border border-slate-200 text-xs bg-white focus:ring-2 focus:ring-indigo-400 focus:outline-none"
              >
                <option value="1">Semester 1 (Ganjil)</option>
                <option value="2">Semester 2 (Genap)</option>
              </select>
            </div>
            <div>
              <label className="text-xs font-bold text-slate-700">Tahun Ajaran</label>
              <input
                type="text"
                value={tahunAjaran}
                onChange={(e) => setTahunAjaran(e.target.value)}
                placeholder="2026/2027"
                className="w-full mt-1 px-3.5 py-2.5 rounded-2xl border border-slate-200 text-xs focus:ring-2 focus:ring-indigo-400 focus:outline-none"
              />
            </div>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <div>
              <label className="text-xs font-bold text-slate-700">Tema Pembelajaran <span className="text-rose-500">*</span></label>
              <input
                type="text"
                required
                value={tema}
                onChange={(e) => setTema(e.target.value)}
                placeholder="Contoh: Aku Sayang Bumi"
                className="w-full mt-1 px-3.5 py-2.5 rounded-2xl border border-slate-200 text-xs focus:ring-2 focus:ring-indigo-400 focus:outline-none"
              />
            </div>
            <div>
              <label className="text-xs font-bold text-slate-700">Subtema</label>
              <input
                type="text"
                value={subtema}
                onChange={(e) => setSubtema(e.target.value)}
                placeholder="Contoh: Tanaman Hias Ciptaan Tuhan"
                className="w-full mt-1 px-3.5 py-2.5 rounded-2xl border border-slate-200 text-xs focus:ring-2 focus:ring-indigo-400 focus:outline-none"
              />
            </div>
          </div>

          <div>
            <label className="text-xs font-bold text-slate-700">Tautan Dokumen Modul Ajar (Google Drive / Cloud PDF) <span className="text-rose-500">*</span></label>
            <div className="relative mt-1">
              <LinkIcon className="w-4 h-4 absolute left-3.5 top-3 text-slate-400" />
              <input
                type="url"
                required
                value={fileUrl}
                onChange={(e) => setFileUrl(e.target.value)}
                placeholder="https://drive.google.com/file/d/... atau https://..."
                className="w-full pl-10 pr-4 py-2.5 rounded-2xl border border-slate-200 text-xs focus:ring-2 focus:ring-indigo-400 focus:outline-none"
              />
            </div>
            <p className="text-[10px] text-slate-400 mt-1">Pastikan hak akses tautan Google Drive telah disetel ke "Siapa saja dengan link dapat melihat".</p>
          </div>

          <div>
            <label className="text-xs font-bold text-slate-700">Ringkasan Tujuan Pembelajaran</label>
            <textarea
              rows={2}
              value={ringkasanTujuan}
              onChange={(e) => setRingkasanTujuan(e.target.value)}
              placeholder="Contoh: Anak mengenal bagian tanaman, terbiasa merawat bunga, dan mengeksplorasi warna mahkota bunga."
              className="w-full mt-1 px-3.5 py-2 rounded-2xl border border-slate-200 text-xs focus:ring-2 focus:ring-indigo-400 focus:outline-none resize-none"
            />
          </div>

          <div className="pt-2 flex items-center justify-end space-x-2 border-t border-slate-100">
            <button
              type="button"
              disabled={submitting}
              onClick={(e) => handleSubmitRpph(e, true)}
              className="px-4 py-2.5 rounded-2xl border border-slate-200 text-slate-600 hover:bg-slate-50 text-xs font-bold transition"
            >
              Simpan Draf
            </button>
            <button
              type="submit"
              disabled={submitting}
              className="px-5 py-2.5 rounded-2xl bg-gradient-to-r from-blue-600 to-indigo-600 hover:from-blue-700 hover:to-indigo-700 text-white text-xs font-bold shadow-md shadow-indigo-500/20 transition flex items-center space-x-1.5"
            >
              <Send className="w-4 h-4" />
              <span>{submitting ? 'Mengirim...' : 'Kirim untuk Validasi'}</span>
            </button>
          </div>
        </form>
      )}

      {/* Daftar Pengajuan RPPH */}
      {loading ? (
        <div className="py-16 text-center text-slate-400 space-y-2">
          <div className="w-8 h-8 border-3 border-indigo-500 border-t-transparent rounded-full animate-spin mx-auto" />
          <p className="text-xs font-medium">Memuat berkas perangkat ajar...</p>
        </div>
      ) : rpphList.length === 0 ? (
        <div className="bg-white rounded-3xl p-10 border border-dashed border-indigo-200 text-center space-y-3">
          <div className="w-14 h-14 rounded-2xl bg-indigo-50 text-indigo-600 flex items-center justify-center mx-auto">
            <BookOpen className="w-7 h-7" />
          </div>
          <h3 className="text-sm font-bold text-slate-700 font-brand">Belum Ada Modul Ajar yang Diunggah</h3>
          <p className="text-xs text-slate-400 max-w-sm mx-auto leading-relaxed">
            Mulai unggah rencana pelaksanaan pembelajaran mingguan Anda dengan mengklik tombol "Unggah Modul Ajar" di atas.
          </p>
        </div>
      ) : (
        <div className="space-y-3">
          {rpphList.map((item) => {
            const statusConfig = {
              disetujui: { label: 'Disetujui', bg: 'bg-emerald-100 text-emerald-800 border-emerald-200', icon: CheckCircle2 },
              perlu_revisi: { label: 'Perlu Revisi', bg: 'bg-rose-100 text-rose-800 border-rose-200', icon: AlertCircle },
              dikirim: { label: 'Menunggu Validasi', bg: 'bg-amber-100 text-amber-800 border-amber-200', icon: Clock },
              draf: { label: 'Draf', bg: 'bg-slate-100 text-slate-700 border-slate-200', icon: FileText }
            }[item.status] || { label: item.status, bg: 'bg-slate-100 text-slate-700 border-slate-200', icon: FileText };

            const StatusIcon = statusConfig.icon;

            return (
              <div
                key={item.id}
                className="bg-white rounded-3xl p-5 border border-indigo-100/80 shadow-xs hover:shadow-md transition flex flex-col md:flex-row md:items-center justify-between gap-4"
              >
                <div className="space-y-1.5 flex-1">
                  <div className="flex flex-wrap items-center gap-2">
                    <span className="text-xs font-black px-2.5 py-0.5 rounded-lg bg-indigo-50 text-indigo-700 font-brand">
                      Minggu {item.minggu_ke}
                    </span>
                    <span className="text-[11px] font-bold px-2 py-0.5 rounded-md bg-slate-100 text-slate-600">
                      {item.kelompok}
                    </span>
                    <span className="text-[11px] text-slate-400">
                      Sem. {item.semester} ({item.tahun_ajaran})
                    </span>
                    <span className={`inline-flex items-center space-x-1 text-[10px] font-black px-2 py-0.5 rounded-md border ${statusConfig.bg}`}>
                      <StatusIcon className="w-3 h-3" />
                      <span>{statusConfig.label}</span>
                    </span>
                  </div>

                  <h3 className="text-sm font-bold text-slate-800 font-brand">
                    {item.tema} {item.subtema && <span className="text-slate-500 font-medium">({item.subtema})</span>}
                  </h3>

                  {item.ringkasan_tujuan && (
                    <p className="text-xs text-slate-500 line-clamp-2 leading-relaxed">
                      {item.ringkasan_tujuan}
                    </p>
                  )}

                  {/* Catatan Arahan Kepala Sekolah */}
                  {item.catatan_kepsek && (
                    <div className="p-3 bg-amber-50 rounded-2xl border border-amber-200/60 text-[11px] text-amber-900 mt-2">
                      <strong>Arahan Kepala Sekolah:</strong> {item.catatan_kepsek}
                    </div>
                  )}
                </div>

                {/* Aksi */}
                <div className="flex items-center gap-2 shrink-0 justify-end pt-2 md:pt-0 border-t md:border-t-0 border-slate-100">
                  <a
                    href={item.file_url}
                    target="_blank"
                    rel="noreferrer"
                    className="px-3.5 py-2 rounded-2xl border border-indigo-200 bg-indigo-50 text-indigo-700 hover:bg-indigo-100 text-xs font-bold transition flex items-center space-x-1.5"
                  >
                    <ExternalLink className="w-3.5 h-3.5" />
                    <span>Lihat Dokumen</span>
                  </a>

                  {item.status === 'draf' && (
                    <button
                      onClick={() => {
                        setRpphToDelete(item);
                        setDeleteModalOpen(true);
                      }}
                      className="p-2 rounded-2xl text-slate-400 hover:text-rose-600 hover:bg-rose-50 transition"
                      title="Hapus Draf"
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

      {/* Modal Konfirmasi Hapus */}
      <ModalKonfirmasi
        isOpen={deleteModalOpen}
        title="Hapus Draf RPPH?"
        message={`Apakah Anda yakin ingin menghapus draf RPPH Minggu ke-${rpphToDelete?.minggu_ke} ("${rpphToDelete?.tema}")?`}
        confirmText="Ya, Hapus"
        cancelText="Batal"
        type="danger"
        loading={submitting}
        onConfirm={handleConfirmDelete}
        onClose={() => {
          setDeleteModalOpen(false);
          setRpphToDelete(null);
        }}
      />
    </div>
  );
}

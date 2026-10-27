import React, { useState, useEffect, useCallback } from 'react';
import { useSearchParams } from 'react-router-dom';
import {
  BookOpen,
  Calendar,
  Sparkles,
  Mic,
  MicOff,
  Upload,
  Copy,
  Send,
  Save,
  Trash2,
  Share2,
  CheckCircle2,
  AlertCircle,
  FileText,
  Clock,
  Eye,
  Plus,
  Lock
} from 'lucide-react';
import {
  collection,
  query,
  where,
  getDocs,
  doc,
  setDoc,
  updateDoc,
  deleteDoc,
  increment,
  serverTimestamp
} from 'firebase/firestore';
import { ref as storageRef, deleteObject } from 'firebase/storage';
import { db, storage } from '../../config/firebase';
import { useAuth } from '../../context/AuthContext';
import { useSpeechToText } from '../../hooks/useSpeechToText';
import { uploadCompressedImage } from '../../utils/imageCompressor';
import { getKbmTemplates, getTemplateById } from '../../utils/kbmTemplates';
import { formatTanggalIndo, createWhatsAppShareUrl, formatKbmToWhatsAppMessage, getLocalDateString } from '../../utils/formatters';
import { logActivity } from '../../utils/auditLogger';
import { commitWrite, QUEUED_SUFFIX } from '../../utils/offlineWrite';
import { getKelompokOptions, normalizeKelompok, KELOMPOK_SEMUA } from '../../utils/schoolConfig';

const MAX_FOTO_PER_JURNAL = 6;
const CAPAIAN_OPTIONS = ['Nilai Agama & Budi Pekerti', 'Jati Diri', 'Dasar-dasar Literasi & STEAM'];
const STATUS_LABEL = { draf: 'Draf', dikirim: 'Dikirim', perlu_revisi: 'Perlu Revisi', disetujui: 'Disetujui' };

export default function JurnalGuru() {
  const { userData, schoolData } = useAuth();
  const [searchParams, setSearchParams] = useSearchParams();
  const kelompokOptions = getKelompokOptions(schoolData);
  const defaultKelompok = (() => {
    const own = normalizeKelompok(userData?.kelompok_kelas);
    return own && own !== KELOMPOK_SEMUA ? own : kelompokOptions[0] || '';
  })();

  // Mode Tampilan: 'list' | 'form'
  const [viewMode, setViewMode] = useState('list');
  const [journals, setJournals] = useState([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [notification, setNotification] = useState(null);

  // Form Fields
  const [editingId, setEditingId] = useState(null);
  const [editingStatus, setEditingStatus] = useState(null);
  const [tanggal, setTanggal] = useState(getLocalDateString());
  const [kelompok, setKelompok] = useState(defaultKelompok);
  const [topik, setTopik] = useState('');
  const [tujuan, setTujuan] = useState('');
  const [capaian, setCapaian] = useState(['Nilai Agama & Budi Pekerti']);
  const [kegiatanPembuka, setKegiatanPembuka] = useState('');
  const [kegiatanInti, setKegiatanInti] = useState('');
  const [kegiatanPenutup, setKegiatanPenutup] = useState('');
  const [refleksi, setRefleksi] = useState('');
  const [kendala, setKendala] = useState('');
  const [fotos, setFotos] = useState([]); // [{ url, storage_path, caption, izin_publikasi }]
  const [uploadingPhoto, setUploadingPhoto] = useState(false);
  const [sessionUploads, setSessionUploads] = useState([]); // storage_path foto yang diunggah sesi ini
  const isReadOnly = editingStatus === 'disetujui';

  // Voice-to-Text hooks untuk Kegiatan Inti & Refleksi
  const [activeVoiceField, setActiveVoiceField] = useState(null); // 'inti' | 'refleksi' | null
  const { isListening, transcript, interimTranscript, startListening, stopListening, resetTranscript, isSupported } = useSpeechToText();

  // Sinkronisasi teks suara ke input yang sedang aktif
  useEffect(() => {
    if (transcript && activeVoiceField === 'inti') {
      setKegiatanInti(prev => (prev ? `${prev} ${transcript}` : transcript));
      resetTranscript();
    } else if (transcript && activeVoiceField === 'refleksi') {
      setRefleksi(prev => (prev ? `${prev} ${transcript}` : transcript));
      resetTranscript();
    }
  }, [transcript, activeVoiceField, resetTranscript]);

  // Ambil daftar jurnal guru
  const fetchJournals = useCallback(async () => {
    if (!userData?.uid || !userData?.school_id) return;
    setLoading(true);
    try {
      const q = query(
        collection(db, 'journals'),
        where('school_id', '==', userData.school_id),
        where('user_id', '==', userData.uid)
      );
      const snap = await getDocs(q);
      const list = snap.docs.map(d => ({ id: d.id, ...d.data() }));
      list.sort((a, b) => (b.tanggal || '').localeCompare(a.tanggal || ''));
      setJournals(list);
    } catch (err) {
      console.error('Error fetching journals:', err);
    } finally {
      setLoading(false);
    }
  }, [userData?.uid, userData?.school_id]);

  useEffect(() => {
    fetchJournals();
  }, [fetchJournals]);

  // Reset form ke kondisi baru
  const handleNewJournal = (prefill = {}) => {
    stopVoice();
    setEditingId(null);
    setEditingStatus(null);
    setTanggal(getLocalDateString());
    setKelompok(prefill.kelompok || defaultKelompok);
    setTopik(prefill.topik || '');
    setTujuan('');
    setCapaian(['Nilai Agama & Budi Pekerti']);
    setKegiatanPembuka('');
    setKegiatanInti('');
    setKegiatanPenutup('');
    setRefleksi('');
    setKendala('');
    setFotos([]);
    setSessionUploads([]);
    setNotification(null);
    setViewMode('form');
  };

  // Pintasan dari halaman Jadwal: /guru/jurnal?kelompok=TK%20A&topik=...
  useEffect(() => {
    if (searchParams.get('topik') !== null || searchParams.get('kelompok') !== null) {
      const klp = normalizeKelompok(searchParams.get('kelompok'));
      handleNewJournal({
        kelompok: klp && klp !== KELOMPOK_SEMUA ? klp : undefined,
        topik: searchParams.get('topik') || '',
      });
      setSearchParams({}, { replace: true });
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // Muat jurnal untuk diedit
  const handleEditJournal = (j) => {
    stopVoice();
    setEditingId(j.id);
    setEditingStatus(j.status);
    setTanggal(j.tanggal || getLocalDateString());
    setKelompok(normalizeKelompok(j.kelompok) || defaultKelompok);
    setTopik(j.topik || '');
    setTujuan(j.tujuan || '');
    setCapaian(j.capaian_pembelajaran || []);
    setKegiatanPembuka(j.kegiatan_pembuka || '');
    setKegiatanInti(j.kegiatan_inti || '');
    setKegiatanPenutup(j.kegiatan_penutup || '');
    setRefleksi(j.refleksi || '');
    setKendala(j.kendala || '');
    setFotos(j.fotos || []);
    setSessionUploads([]);
    setNotification(null);
    setViewMode('form');
  };

  const stopVoice = () => {
    if (isListening) stopListening();
    setActiveVoiceField(null);
  };

  // Terapkan Template KBM Kurikulum Merdeka
  const handleApplyTemplate = (templateId) => {
    const t = getTemplateById(templateId);
    if (!t) return;
    setTopik(t.topik);
    setTujuan(t.tujuan);
    setCapaian(t.capaian_pembelajaran);
    setKegiatanPembuka(t.kegiatan_pembuka);
    setKegiatanInti(t.kegiatan_inti);
    setKegiatanPenutup(t.kegiatan_penutup);
    setRefleksi(t.refleksi);
    setNotification({ type: 'success', text: `Template "${t.judul}" berhasil diterapkan!` });
  };

  // Salin Jurnal Sebelumnya (Duplikasi)
  const handleCopyYesterdayJournal = () => {
    if (journals.length === 0) {
      setNotification({ type: 'error', text: 'Belum ada jurnal sebelumnya untuk disalin.' });
      return;
    }
    const last = journals.find((j) => j.id !== editingId) || journals[0];
    setTopik(last.topik || '');
    setTujuan(last.tujuan || '');
    setCapaian(last.capaian_pembelajaran || []);
    setKegiatanPembuka(last.kegiatan_pembuka || '');
    setKegiatanInti(last.kegiatan_inti || '');
    setKegiatanPenutup(last.kegiatan_penutup || '');
    setRefleksi(last.refleksi || '');
    setNotification({ type: 'success', text: 'Berhasil menyalin data dari jurnal tanggal ' + last.tanggal });
  };

  // Toggle Capaian Pembelajaran
  const toggleCapaian = (item) => {
    setCapaian(prev =>
      prev.includes(item) ? prev.filter(c => c !== item) : [...prev, item]
    );
  };

  // Toggle Voice Recording
  const handleToggleVoice = (field) => {
    if (isListening && activeVoiceField === field) {
      stopListening();
      setActiveVoiceField(null);
    } else {
      setActiveVoiceField(field);
      startListening();
    }
  };

  // Upload Foto dengan Kompresi Otomatis (< 300 KB)
  const handlePhotoUpload = async (e) => {
    const file = e.target.files?.[0];
    e.target.value = ''; // izinkan memilih file yang sama lagi
    if (!file) return;
    if (fotos.length >= MAX_FOTO_PER_JURNAL) {
      setNotification({ type: 'error', text: `Maksimal ${MAX_FOTO_PER_JURNAL} foto per jurnal.` });
      return;
    }
    if (typeof navigator !== 'undefined' && navigator.onLine === false) {
      setNotification({ type: 'error', text: 'Unggah foto memerlukan sinyal internet. Simpan draf dulu, tambahkan foto saat sinyal kembali.' });
      return;
    }

    setUploadingPhoto(true);
    try {
      const { url, storagePath, sizeKb } = await uploadCompressedImage(
        file,
        userData.school_id,
        userData.uid,
        'journals'
      );

      const newPhoto = {
        url,
        storage_path: storagePath,
        caption: 'Dokumentasi KBM',
        izin_publikasi: 'internal',
      };

      setFotos(prev => [...prev, newPhoto]);
      setSessionUploads(prev => [...prev, storagePath]);

      // Counter agregat untuk meteran storage Superadmin (best effort)
      updateDoc(doc(db, 'schools', userData.school_id), {
        total_foto_terunggah: increment(1),
        estimasi_storage_mb: increment(Math.round((sizeKb / 1024) * 1000) / 1000),
      }).catch((err) => console.warn('Gagal memperbarui counter storage:', err));

      setNotification({ type: 'success', text: `Foto berhasil dikompresi (${sizeKb} KB) dan diunggah!` });
    } catch (err) {
      console.error('Error uploading photo:', err);
      setNotification({ type: 'error', text: 'Gagal mengunggah foto. Pastikan format file sesuai.' });
    } finally {
      setUploadingPhoto(false);
    }
  };

  const handleRemovePhoto = (idx) => {
    const target = fotos[idx];
    setFotos(prev => prev.filter((_, i) => i !== idx));
    // Foto yang baru diunggah sesi ini dan belum tersimpan di jurnal langsung dihapus dari Storage
    if (target?.storage_path && sessionUploads.includes(target.storage_path)) {
      deleteObject(storageRef(storage, target.storage_path)).catch(() => {});
      setSessionUploads(prev => prev.filter((p) => p !== target.storage_path));
    }
  };

  // Hapus Draf Jurnal
  const handleDeleteDraft = async () => {
    if (!editingId || editingStatus !== 'draf') return;
    if (!window.confirm('Hapus draf jurnal ini? Tindakan tidak dapat dibatalkan.')) return;
    setSaving(true);
    try {
      await commitWrite(deleteDoc(doc(db, 'journals', editingId)));
      fotos.forEach((f) => f.storage_path && deleteObject(storageRef(storage, f.storage_path)).catch(() => {}));
      setNotification({ type: 'success', text: 'Draf jurnal dihapus.' });
      setJournals(prev => prev.filter((j) => j.id !== editingId));
      setViewMode('list');
    } catch (err) {
      console.error('Error deleting draft:', err);
      setNotification({ type: 'error', text: 'Gagal menghapus draf.' });
    } finally {
      setSaving(false);
    }
  };

  // Simpan Jurnal (Mode: 'draf' | 'dikirim')
  const handleSaveJournal = async (targetStatus) => {
    if (isReadOnly) return;
    if (!topik.trim()) {
      setNotification({ type: 'error', text: 'Topik pembelajaran wajib diisi.' });
      return;
    }
    if (targetStatus === 'dikirim' && !kegiatanInti.trim()) {
      setNotification({ type: 'error', text: 'Kegiatan inti wajib diisi sebelum dikirim ke Kepala Sekolah.' });
      return;
    }
    stopVoice();

    setSaving(true);
    setNotification(null);

    const payload = {
      school_id: userData.school_id,
      user_id: userData.uid,
      nama_guru: userData.nama,
      tanggal,
      kelompok,
      topik: topik.trim(),
      tujuan: tujuan.trim(),
      capaian_pembelajaran: capaian,
      kegiatan_pembuka: kegiatanPembuka.trim(),
      kegiatan_inti: kegiatanInti.trim(),
      kegiatan_penutup: kegiatanPenutup.trim(),
      refleksi: refleksi.trim(),
      kendala: kendala.trim(),
      fotos,
      status: targetStatus,
      updated_at: serverTimestamp(),
    };

    if (!editingId) {
      payload.review_note = '';
      payload.reviewed_at = null;
      payload.created_at = serverTimestamp();
    }

    try {
      // ID dibuat di klien agar tersedia seketika walau offline (addDoc menunggu server)
      const journalRef = editingId ? doc(db, 'journals', editingId) : doc(collection(db, 'journals'));
      const { queued } = await commitWrite(
        editingId ? updateDoc(journalRef, payload) : setDoc(journalRef, payload)
      );

      logActivity({
        schoolId: userData.school_id,
        actorId: userData.uid,
        actorNama: userData.nama,
        action: targetStatus === 'dikirim' ? 'KIRIM_JURNAL' : 'SIMPAN_DRAF_JURNAL',
        recordType: 'journals',
        recordId: journalRef.id,
      });

      setSessionUploads([]);
      setNotification({
        type: 'success',
        text: (targetStatus === 'dikirim'
          ? 'Jurnal berhasil dikirim ke Kepala Sekolah untuk diperiksa!'
          : 'Draf jurnal berhasil disimpan dengan aman.') + (queued ? QUEUED_SUFFIX : ''),
      });

      fetchJournals();
      setViewMode('list');
    } catch (err) {
      console.error('Error saving journal:', err);
      setNotification({ type: 'error', text: 'Gagal menyimpan jurnal. Periksa koneksi Anda.' });
    } finally {
      setSaving(false);
    }
  };

  // Bagikan ke WhatsApp
  const handleShareToWhatsApp = (journal) => {
    const textMsg = formatKbmToWhatsAppMessage({
      namaSekolah: schoolData?.nama_sekolah || 'PAUD',
      namaGuru: journal.nama_guru,
      kelompok: journal.kelompok,
      tanggal: journal.tanggal,
      topik: journal.topik,
      kegiatanInti: journal.kegiatan_inti,
      status: journal.status,
    });
    const waUrl = createWhatsAppShareUrl(textMsg);
    window.open(waUrl, '_blank');
  };

  return (
    <div className="space-y-6 max-w-5xl mx-auto pb-6">
      
      {/* Header Halaman */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <h1 className="text-xl md:text-2xl font-extrabold text-slate-900 font-brand">
            Jurnal Mengajar KBM 📖
          </h1>
          <p className="text-xs text-slate-500 mt-0.5 font-medium">
            Dokumentasi harian Kurikulum Merdeka PAUD dengan Voice-to-Text & Kompresi Foto Kamera.
          </p>
        </div>

        {viewMode === 'list' ? (
          <button
            onClick={() => handleNewJournal()}
            className="inline-flex items-center space-x-2 px-5 py-3 rounded-2xl bg-gradient-to-r from-amber-500 to-orange-500 hover:from-amber-600 hover:to-orange-600 text-white font-extrabold text-xs shadow-md shadow-orange-500/20 active:scale-98 transition self-start sm:self-auto font-brand"
          >
            <Plus className="w-4 h-4 stroke-[3]" />
            <span>Tulis Jurnal Ceria Baru</span>
          </button>
        ) : (
          <button
            onClick={() => { stopVoice(); setViewMode('list'); }}
            className="inline-flex items-center space-x-2 px-5 py-3 rounded-2xl border border-orange-200 text-slate-700 bg-white hover:bg-amber-50 font-extrabold text-xs transition self-start sm:self-auto"
          >
            <span>Kembali ke Riwayat</span>
          </button>
        )}
      </div>

      {notification && (
        <div className={`p-4 rounded-2xl text-xs flex items-center space-x-2.5 animate-fadeIn ${
          notification.type === 'success' 
            ? 'bg-emerald-50 text-emerald-800 border border-emerald-200' 
            : 'bg-rose-50 text-rose-800 border border-rose-200'
        }`}>
          {notification.type === 'success' ? <CheckCircle2 className="w-4 h-4 text-emerald-600 shrink-0" /> : <AlertCircle className="w-4 h-4 text-rose-600 shrink-0" />}
          <span>{notification.text}</span>
        </div>
      )}

      {/* TAMPILAN 1: DAFTAR JURNAL */}
      {viewMode === 'list' && (
        <div className="bg-white rounded-3xl border border-slate-200/80 shadow-sm overflow-hidden">
          <div className="p-4 md:p-6 border-b border-slate-100 flex items-center justify-between">
            <h3 className="text-sm font-bold text-slate-800">Riwayat Jurnal Mengajar</h3>
            <span className="text-xs text-slate-500 font-medium">Total: {journals.length} Entri</span>
          </div>

          {loading ? (
            <div className="p-12 text-center text-xs text-slate-400">Memuat jurnal...</div>
          ) : journals.length > 0 ? (
            <div className="divide-y divide-slate-100">
              {journals.map((j) => (
                <div key={j.id} className="p-4 md:p-6 hover:bg-slate-50/70 transition space-y-3">
                  <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2">
                    <div className="flex items-center space-x-2">
                      <span className="text-xs font-bold text-slate-800">
                        {formatTanggalIndo(j.tanggal)}
                      </span>
                      <span className="px-2 py-0.5 rounded-md text-[10px] font-bold bg-amber-50 text-amber-800 border border-amber-200/60">
                        {j.kelompok}
                      </span>
                      <span className={`px-2 py-0.5 rounded-full text-[10px] font-bold uppercase ${
                        j.status === 'disetujui'
                          ? 'bg-emerald-50 text-emerald-700 border border-emerald-200'
                          : j.status === 'perlu_revisi'
                          ? 'bg-rose-50 text-rose-700 border border-rose-200'
                          : j.status === 'dikirim'
                          ? 'bg-blue-50 text-blue-700 border border-blue-200'
                          : 'bg-slate-100 text-slate-600'
                      }`}>
                        {STATUS_LABEL[j.status] || j.status}
                      </span>
                    </div>

                    <div className="flex items-center space-x-2">
                      {/* Tombol Share WhatsApp */}
                      <button
                        onClick={() => handleShareToWhatsApp(j)}
                        title="Bagikan ke WhatsApp"
                        className="px-2.5 py-1.5 rounded-xl bg-emerald-50 text-emerald-700 hover:bg-emerald-100 text-xs font-semibold flex items-center space-x-1 transition"
                      >
                        <Share2 className="w-3.5 h-3.5" />
                        <span className="hidden sm:inline">Kirim ke WA</span>
                      </button>

                      <button
                        onClick={() => handleEditJournal(j)}
                        className="px-3 py-1.5 rounded-xl border border-slate-200 text-xs font-semibold text-slate-600 hover:bg-slate-100 transition"
                      >
                        {j.status === 'draf' ? 'Lanjutkan Draf' : j.status === 'disetujui' ? 'Lihat Detail' : j.status === 'perlu_revisi' ? 'Perbaiki' : 'Detail / Edit'}
                      </button>
                    </div>
                  </div>

                  <div>
                    <h4 className="text-sm font-bold text-slate-900">{j.topik}</h4>
                    <p className="text-xs text-slate-500 line-clamp-2 mt-0.5">
                      {j.kegiatan_inti || 'Belum ada uraian kegiatan.'}
                    </p>
                  </div>

                  {/* Foto Thumbnail Preview */}
                  {j.fotos && j.fotos.length > 0 && (
                    <div className="flex items-center space-x-2 pt-1 overflow-x-auto">
                      {j.fotos.map((f, i) => (
                        <img
                          key={i}
                          src={f.url}
                          alt={f.caption || 'Foto'}
                          className="w-12 h-12 rounded-xl object-cover border border-slate-200"
                        />
                      ))}
                      <span className="text-[10px] text-slate-400 pl-1">
                        {j.fotos.length} Dokumentasi Foto
                      </span>
                    </div>
                  )}

                  {/* Catatan Revisi dari Kepala Sekolah */}
                  {j.status === 'perlu_revisi' && j.review_note && (
                    <div className="p-3 rounded-2xl bg-rose-50 border border-rose-200 text-rose-800 text-xs space-y-1">
                      <p className="font-bold flex items-center space-x-1">
                        <AlertCircle className="w-3.5 h-3.5" />
                        <span>Catatan Perbaikan dari Kepala Sekolah:</span>
                      </p>
                      <p className="text-[11px] leading-relaxed">{j.review_note}</p>
                    </div>
                  )}
                </div>
              ))}
            </div>
          ) : (
            <div className="p-12 text-center text-xs text-slate-400">
              Belum ada jurnal mengajar yang tersimpan. Klik "Tulis Jurnal Baru" untuk memulai.
            </div>
          )}
        </div>
      )}

      {/* TAMPILAN 2: FORMULIR JURNAL KBM */}
      {viewMode === 'form' && (
        <fieldset disabled={isReadOnly} className="bg-white rounded-3xl p-6 md:p-8 border border-slate-200/80 shadow-sm space-y-6 min-w-0">

          {isReadOnly && (
            <div className="p-3 rounded-2xl bg-emerald-50 border border-emerald-200 text-emerald-800 text-xs font-semibold flex items-center space-x-2">
              <Lock className="w-4 h-4 shrink-0" />
              <span>Jurnal ini sudah disetujui Kepala Sekolah sehingga tidak dapat diubah lagi.</span>
            </div>
          )}

          {editingStatus === 'perlu_revisi' && (
            <div className="p-3 rounded-2xl bg-rose-50 border border-rose-200 text-rose-800 text-xs">
              <strong>Catatan revisi Kepala Sekolah:</strong>{' '}
              {journals.find((j) => j.id === editingId)?.review_note || '-'}
            </div>
          )}

          {/* Fitur Cepat: Bank Template & Salin Jurnal */}
          {!isReadOnly && <div className="p-4 rounded-2xl bg-gradient-to-r from-amber-50 to-orange-50 border border-amber-200/60 flex flex-col sm:flex-row sm:items-center justify-between gap-3">
            <div className="flex items-center space-x-2 text-amber-900 text-xs font-semibold">
              <Sparkles className="w-4 h-4 text-amber-600" />
              <span>Bantuan Pengisian Cepat:</span>
            </div>

            <div className="flex flex-wrap items-center gap-2">
              <select
                onChange={(e) => {
                  if (e.target.value) handleApplyTemplate(e.target.value);
                  e.target.value = '';
                }}
                defaultValue=""
                className="px-3 py-1.5 rounded-xl border border-amber-200 text-xs font-medium text-amber-900 bg-white focus:outline-none"
              >
                <option value="" disabled>Pilih dari Bank Template KBM...</option>
                {getKbmTemplates().map(t => (
                  <option key={t.id} value={t.id}>{t.judul}</option>
                ))}
              </select>

              <button
                type="button"
                onClick={handleCopyYesterdayJournal}
                className="px-3 py-1.5 rounded-xl border border-amber-200 bg-white hover:bg-amber-100/50 text-amber-800 text-xs font-semibold flex items-center space-x-1.5 transition"
              >
                <Copy className="w-3.5 h-3.5" />
                <span>Salin Jurnal Terakhir</span>
              </button>
            </div>
          </div>}

          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div>
              <label className="block text-xs font-semibold text-slate-700 mb-1">
                Tanggal Pembelajaran
              </label>
              <input
                type="date"
                required
                value={tanggal}
                onChange={(e) => setTanggal(e.target.value)}
                className="w-full px-3.5 py-2.5 text-xs rounded-xl border border-slate-300 focus:outline-none focus:ring-2 focus:ring-amber-500/20 focus:border-amber-500"
              />
            </div>

            <div>
              <label className="block text-xs font-semibold text-slate-700 mb-1">
                Kelompok Kelas
              </label>
              <select
                value={kelompok}
                onChange={(e) => setKelompok(e.target.value)}
                className="w-full px-3.5 py-2.5 text-xs rounded-xl border border-slate-300 focus:outline-none focus:ring-2 focus:ring-amber-500/20 focus:border-amber-500 bg-white"
              >
                {!kelompokOptions.includes(kelompok) && kelompok && (
                  <option value={kelompok}>{kelompok}</option>
                )}
                {kelompokOptions.map((k) => (
                  <option key={k} value={k}>{k}</option>
                ))}
              </select>
            </div>
          </div>

          <div>
            <label className="block text-xs font-semibold text-slate-700 mb-1">
              Topik / Tema Pembelajaran
            </label>
            <input
              type="text"
              required
              value={topik}
              onChange={(e) => setTopik(e.target.value)}
              placeholder="Contoh: Eksplorasi Tanaman Obat di Halaman Sekolah"
              className="w-full px-3.5 py-2.5 text-xs rounded-xl border border-slate-300 focus:outline-none focus:ring-2 focus:ring-amber-500/20 focus:border-amber-500 font-semibold"
            />
          </div>

          <div>
            <label className="block text-xs font-semibold text-slate-700 mb-1">
              Capaian Pembelajaran (Kurikulum Merdeka PAUD)
            </label>
            <div className="flex flex-wrap gap-2 pt-1">
              {CAPAIAN_OPTIONS.map((item) => {
                const checked = capaian.includes(item);
                return (
                  <button
                    key={item}
                    type="button"
                    onClick={() => toggleCapaian(item)}
                    className={`px-3 py-1.5 rounded-xl text-xs font-medium border transition ${
                      checked
                        ? 'bg-amber-500 text-white border-amber-500 shadow-sm shadow-amber-500/20'
                        : 'bg-slate-50 text-slate-600 border-slate-200 hover:bg-slate-100'
                    }`}
                  >
                    {item}
                  </button>
                );
              })}
            </div>
          </div>

          <div>
            <label className="block text-xs font-semibold text-slate-700 mb-1">
              Tujuan Pembelajaran
            </label>
            <textarea
              rows={2}
              value={tujuan}
              onChange={(e) => setTujuan(e.target.value)}
              placeholder="Contoh: Anak dapat menyebutkan nama-nama daun dan bersyukur atas tanaman ciptaan Tuhan."
              className="w-full px-3.5 py-2.5 text-xs rounded-xl border border-slate-300 focus:outline-none focus:ring-2 focus:ring-amber-500/20 focus:border-amber-500"
            />
          </div>

          {/* 3 Tahapan Kegiatan KBM */}
          <div className="space-y-4 pt-2 border-t border-slate-100">
            <h4 className="text-xs font-bold text-slate-400 uppercase tracking-wider">
              Tahapan Pelaksanaan KBM
            </h4>

            <div>
              <label className="block text-xs font-semibold text-slate-700 mb-1">
                1. Kegiatan Pembuka (Apersepsi)
              </label>
              <textarea
                rows={2}
                value={kegiatanPembuka}
                onChange={(e) => setKegiatanPembuka(e.target.value)}
                placeholder="Penyambutan, doa pembuka, bernyanyi bersama, apersepsi topik..."
                className="w-full px-3.5 py-2.5 text-xs rounded-xl border border-slate-300 focus:outline-none focus:ring-2 focus:ring-amber-500/20 focus:border-amber-500"
              />
            </div>

            <div>
              <div className="flex items-center justify-between mb-1">
                <label className="text-xs font-semibold text-slate-700">
                  2. Kegiatan Inti
                </label>
                {isSupported && (
                  <button
                    type="button"
                    onClick={() => handleToggleVoice('inti')}
                    className={`px-2.5 py-1 rounded-lg text-[11px] font-semibold flex items-center space-x-1 transition ${
                      isListening && activeVoiceField === 'inti'
                        ? 'bg-rose-100 text-rose-700 animate-pulse'
                        : 'bg-amber-50 text-amber-800 hover:bg-amber-100 border border-amber-200/60'
                    }`}
                  >
                    {isListening && activeVoiceField === 'inti' ? (
                      <>
                        <MicOff className="w-3.5 h-3.5" />
                        <span>Mendengarkan Suara...</span>
                      </>
                    ) : (
                      <>
                        <Mic className="w-3.5 h-3.5" />
                        <span>Dikte Suara (id-ID)</span>
                      </>
                    )}
                  </button>
                )}
              </div>
              <textarea
                rows={4}
                value={kegiatanInti}
                onChange={(e) => setKegiatanInti(e.target.value)}
                placeholder="Uraian langkah aktivitas utama anak, eksperimen, observasi, atau unjuk karya..."
                className="w-full px-3.5 py-2.5 text-xs rounded-xl border border-slate-300 focus:outline-none focus:ring-2 focus:ring-amber-500/20 focus:border-amber-500"
              />
              {isListening && activeVoiceField === 'inti' && interimTranscript && (
                <p className="mt-1 text-[11px] text-slate-400 italic">🎙️ {interimTranscript}</p>
              )}
            </div>

            <div>
              <label className="block text-xs font-semibold text-slate-700 mb-1">
                3. Kegiatan Penutup
              </label>
              <textarea
                rows={2}
                value={kegiatanPenutup}
                onChange={(e) => setKegiatanPenutup(e.target.value)}
                placeholder="Merapikan alat main, refleksi perasaan, doa penutup, pesan moral..."
                className="w-full px-3.5 py-2.5 text-xs rounded-xl border border-slate-300 focus:outline-none focus:ring-2 focus:ring-amber-500/20 focus:border-amber-500"
              />
            </div>
          </div>

          {/* Refleksi & Kendala Guru */}
          <div className="space-y-4 pt-2 border-t border-slate-100">
            <h4 className="text-xs font-bold text-slate-400 uppercase tracking-wider">
              Evaluasi Guru
            </h4>

            <div>
              <div className="flex items-center justify-between mb-1">
                <label className="text-xs font-semibold text-slate-700">
                  Refleksi Guru
                </label>
                {isSupported && (
                  <button
                    type="button"
                    onClick={() => handleToggleVoice('refleksi')}
                    className={`px-2.5 py-1 rounded-lg text-[11px] font-semibold flex items-center space-x-1 transition ${
                      isListening && activeVoiceField === 'refleksi'
                        ? 'bg-rose-100 text-rose-700 animate-pulse'
                        : 'bg-amber-50 text-amber-800 hover:bg-amber-100 border border-amber-200/60'
                    }`}
                  >
                    {isListening && activeVoiceField === 'refleksi' ? (
                      <>
                        <MicOff className="w-3.5 h-3.5" />
                        <span>Mendengarkan Suara...</span>
                      </>
                    ) : (
                      <>
                        <Mic className="w-3.5 h-3.5" />
                        <span>Dikte Suara (id-ID)</span>
                      </>
                    )}
                  </button>
                )}
              </div>
              <textarea
                rows={2}
                value={refleksi}
                onChange={(e) => setRefleksi(e.target.value)}
                placeholder="Catatan perkembangan ketercapaian anak, minat anak hari ini..."
                className="w-full px-3.5 py-2.5 text-xs rounded-xl border border-slate-300 focus:outline-none focus:ring-2 focus:ring-amber-500/20 focus:border-amber-500"
              />
              {isListening && activeVoiceField === 'refleksi' && interimTranscript && (
                <p className="mt-1 text-[11px] text-slate-400 italic">🎙️ {interimTranscript}</p>
              )}
            </div>

            <div>
              <label className="block text-xs font-semibold text-slate-700 mb-1">
                Kendala yang Dialami (Opsional)
              </label>
              <textarea
                rows={2}
                value={kendala}
                onChange={(e) => setKendala(e.target.value)}
                placeholder="Hambatan alat peraga, anak yang membutuhkan pendampingan ekstra..."
                className="w-full px-3.5 py-2.5 text-xs rounded-xl border border-slate-300 focus:outline-none focus:ring-2 focus:ring-amber-500/20 focus:border-amber-500"
              />
            </div>
          </div>

          {/* Unggah Dokumentasi Foto dengan Kompresi Otomatis */}
          <div className="space-y-3 pt-2 border-t border-slate-100">
            <div className="flex items-center justify-between">
              <div>
                <h4 className="text-xs font-bold text-slate-700">Dokumentasi Foto KBM ({fotos.length}/{MAX_FOTO_PER_JURNAL})</h4>
                <p className="text-[11px] text-slate-400">
                  Foto otomatis dikompresi menjadi &lt; 300 KB untuk menghemat kuota internet Anda.
                </p>
              </div>

              {!isReadOnly && fotos.length < MAX_FOTO_PER_JURNAL && <label className="cursor-pointer inline-flex items-center space-x-1.5 px-3 py-1.5 rounded-xl bg-slate-100 hover:bg-slate-200 text-slate-700 text-xs font-semibold transition">
                <Upload className="w-3.5 h-3.5" />
                <span>{uploadingPhoto ? 'Mengompresi...' : '+ Kamera / Galeri'}</span>
                <input
                  type="file"
                  accept="image/*"
                  disabled={uploadingPhoto}
                  onChange={handlePhotoUpload}
                  className="hidden"
                />
              </label>}
            </div>

            {fotos.length > 0 ? (
              <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 gap-3 pt-2">
                {fotos.map((f, idx) => (
                  <div key={idx} className="relative group rounded-2xl overflow-hidden border border-slate-200 bg-slate-50">
                    <img src={f.url} alt="Dokumentasi" className="w-full h-28 object-cover" />
                    {!isReadOnly && (
                      <button
                        type="button"
                        aria-label="Hapus foto"
                        onClick={() => handleRemovePhoto(idx)}
                        className="absolute top-1.5 right-1.5 p-1 rounded-full bg-slate-900/70 text-white hover:bg-rose-600 transition"
                      >
                        <Trash2 className="w-3.5 h-3.5" />
                      </button>
                    )}
                    <div className="p-1.5 text-[10px] text-slate-500 truncate">
                      {f.caption || 'Foto KBM'}
                    </div>
                  </div>
                ))}
              </div>
            ) : (
              <div className="p-6 border-2 border-dashed border-slate-200 rounded-2xl text-center text-xs text-slate-400">
                Belum ada foto dokumentasi yang dilampirkan.
              </div>
            )}
          </div>

          {/* Tombol Simpan Draf vs Kirim Laporan */}
          {!isReadOnly && <div className="pt-4 border-t border-slate-200 flex flex-col sm:flex-row items-center justify-end gap-3">
            {editingStatus === 'draf' && (
              <button
                type="button"
                disabled={saving}
                onClick={handleDeleteDraft}
                className="w-full sm:w-auto sm:mr-auto px-5 py-2.5 rounded-xl text-rose-600 hover:bg-rose-50 font-semibold text-xs transition flex items-center justify-center space-x-2"
              >
                <Trash2 className="w-4 h-4" />
                <span>Hapus Draf</span>
              </button>
            )}
            <button
              type="button"
              disabled={saving}
              onClick={() => handleSaveJournal('draf')}
              className="w-full sm:w-auto px-5 py-2.5 rounded-xl border border-slate-300 text-slate-700 hover:bg-slate-50 font-semibold text-xs transition flex items-center justify-center space-x-2"
            >
              <Save className="w-4 h-4 text-slate-500" />
              <span>Simpan sebagai Draf</span>
            </button>

            <button
              type="button"
              disabled={saving}
              onClick={() => handleSaveJournal('dikirim')}
              className="w-full sm:w-auto px-5 py-2.5 rounded-xl bg-gradient-to-r from-amber-500 to-orange-500 hover:from-amber-600 hover:to-orange-600 text-white font-bold text-xs shadow-md shadow-orange-500/20 transition flex items-center justify-center space-x-2"
            >
              <Send className="w-4 h-4" />
              <span>{saving ? 'Mengirim...' : editingStatus === 'perlu_revisi' ? 'Kirim Ulang Revisi' : 'Kirim ke Kepala Sekolah'}</span>
            </button>
          </div>}
        </fieldset>
      )}
    </div>
  );
}


import React, { useState, useEffect } from 'react';
import { createPortal } from 'react-dom';
import { 
  CheckSquare, 
  Clock, 
  CheckCircle2, 
  AlertCircle, 
  AlertTriangle, 
  Eye, 
  Check, 
  X, 
  MessageSquare, 
  Sparkles, 
  Camera, 
  Calendar,
  Layers,
  ArrowRight,
  Send,
  Lock
} from 'lucide-react';
import { 
  collection, 
  query, 
  where, 
  onSnapshot, 
  doc, 
  updateDoc, 
  serverTimestamp,
  writeBatch
} from 'firebase/firestore';
import { db } from '../../config/firebase';
import { useAuth } from '../../context/AuthContext';
import { formatTanggalIndo, formatJamMenit } from '../../utils/formatters';
import { logActivity } from '../../utils/auditLogger';

export default function ValidasiLaporan() {
  const { userData, schoolData } = useAuth();
  const isProPlan = schoolData?.paket_langganan === 'pro';

  const [activeTab, setActiveTab] = useState('jurnal'); // 'jurnal' | 'koreksi'
  const [journals, setJournals] = useState([]);
  const [corrections, setCorrections] = useState([]);
  const [loading, setLoading] = useState(true);
  const [notification, setNotification] = useState(null);

  // Filter Status Jurnal
  const [journalStatusFilter, setJournalStatusFilter] = useState('dikirim'); // 'dikirim' | 'semua' | 'perlu_revisi' | 'disetujui'

  // Multi-Select Bulk Approval
  const [selectedJournalIds, setSelectedJournalIds] = useState([]);
  const [bulkProcessing, setBulkProcessing] = useState(false);

  // Modal Review Jurnal
  const [reviewModalOpen, setReviewModalOpen] = useState(false);
  const [selectedJournal, setSelectedJournal] = useState(null);
  const [revisionNote, setRevisionNote] = useState('');
  const [submittingReview, setSubmittingReview] = useState(false);

  // Modal Verifikasi Koreksi Presensi
  const [correctionModalOpen, setCorrectionModalOpen] = useState(false);
  const [selectedCorrection, setSelectedCorrection] = useState(null);
  const [correctionNote, setCorrectionNote] = useState('');

  // Listener Real-Time Jurnal & Presensi
  useEffect(() => {
    if (!userData?.school_id) {
      setLoading(false);
      return;
    }

    setLoading(true);

    // 1. Ambil Jurnal KBM
    const qJournals = query(
      collection(db, 'journals'),
      where('school_id', '==', userData.school_id)
    );

    const unsubJournals = onSnapshot(qJournals, (snap) => {
      const list = snap.docs.map((d) => ({ id: d.id, ...d.data() }));
      list.sort((a, b) => (b.tanggal || '').localeCompare(a.tanggal || ''));
      setJournals(list);
    });

    // 2. Ambil Riwayat Presensi dengan Pengajuan Koreksi
    const qAttendance = query(
      collection(db, 'attendance'),
      where('school_id', '==', userData.school_id)
    );

    const unsubAttendance = onSnapshot(qAttendance, (snap) => {
      const list = snap.docs
        .map((d) => ({ id: d.id, ...d.data() }))
        .filter((a) => a.koreksi?.diajukan === true);
      list.sort((a, b) => (b.tanggal || '').localeCompare(a.tanggal || ''));
      setCorrections(list);
      setLoading(false);
    });

    return () => {
      unsubJournals();
      unsubAttendance();
    };
  }, [userData?.school_id]);

  // Filter Daftar Jurnal
  const filteredJournals = journals.filter((j) => {
    if (journalStatusFilter === 'semua') return true;
    return j.status === journalStatusFilter;
  });

  // Antrean Jurnal yang Siap di-Bulk Approve ('dikirim')
  const pendingJournals = journals.filter((j) => j.status === 'dikirim');

  // Toggle Checkbox Bulk Select
  const toggleSelectJournal = (id) => {
    setSelectedJournalIds((prev) =>
      prev.includes(id) ? prev.filter((item) => item !== id) : [...prev, id]
    );
  };

  const handleSelectAllPending = () => {
    if (selectedJournalIds.length === pendingJournals.length) {
      setSelectedJournalIds([]);
    } else {
      setSelectedJournalIds(pendingJournals.map((j) => j.id));
    }
  };

  // EKSEKUSI BULK APPROVAL (Setujui Sekaligus)
  const handleBulkApprove = async () => {
    if (selectedJournalIds.length === 0) return;
    if (!window.confirm(`Setujui sekaligus ${selectedJournalIds.length} jurnal KBM terpilih?`)) return;

    setBulkProcessing(true);
    try {
      const batch = writeBatch(db);

      selectedJournalIds.forEach((id) => {
        const ref = doc(db, 'journals', id);
        batch.update(ref, {
          status: 'disetujui',
          review_note: '',
          reviewed_at: serverTimestamp(),
          updated_at: serverTimestamp(),
        });
      });

      await batch.commit();

      await logActivity({
        schoolId: userData.school_id,
        actorId: userData.uid,
        actorNama: userData.nama,
        action: 'BULK_APPROVE_JOURNALS',
        recordType: 'journals',
        recordId: `${selectedJournalIds.length}_DOCS`,
      });

      setNotification({
        type: 'success',
        text: `Berhasil menyetujui ${selectedJournalIds.length} jurnal mengajar secara serentak!`,
      });

      setSelectedJournalIds([]);
    } catch (err) {
      console.error('Gagal bulk approval:', err);
      alert('Gagal menyetujui sekaligus: ' + err.message);
    } finally {
      setBulkProcessing(false);
    }
  };

  // Setujui Jurnal Tunggal
  const handleApproveSingle = async (journal) => {
    try {
      await updateDoc(doc(db, 'journals', journal.id), {
        status: 'disetujui',
        review_note: '',
        reviewed_at: serverTimestamp(),
        updated_at: serverTimestamp(),
      });

      await logActivity({
        schoolId: userData.school_id,
        actorId: userData.uid,
        actorNama: userData.nama,
        action: 'APPROVE_JOURNAL',
        recordType: 'journals',
        recordId: journal.id,
      });

      setNotification({
        type: 'success',
        text: `Jurnal "${journal.topik}" oleh ${journal.nama_guru} telah disetujui.`,
      });

      setReviewModalOpen(false);
    } catch (err) {
      alert('Gagal menyetujui jurnal: ' + err.message);
    }
  };

  // Minta Revisi Jurnal
  const handleRequestRevision = async (e) => {
    e.preventDefault();
    if (!revisionNote.trim() || !selectedJournal) return;

    setSubmittingReview(true);
    try {
      await updateDoc(doc(db, 'journals', selectedJournal.id), {
        status: 'perlu_revisi',
        review_note: revisionNote.trim(),
        reviewed_at: serverTimestamp(),
        updated_at: serverTimestamp(),
      });

      await logActivity({
        schoolId: userData.school_id,
        actorId: userData.uid,
        actorNama: userData.nama,
        action: 'REVISION_JOURNAL',
        recordType: 'journals',
        recordId: selectedJournal.id,
      });

      setNotification({
        type: 'success',
        text: `Catatan revisi telah dikirimkan ke ${selectedJournal.nama_guru}.`,
      });

      setReviewModalOpen(false);
      setRevisionNote('');
    } catch (err) {
      alert('Gagal mengirim revisi: ' + err.message);
    } finally {
      setSubmittingReview(false);
    }
  };

  // Keputusan Koreksi Presensi (Disetujui / Ditolak)
  const handleDecisionCorrection = async (isApproved) => {
    if (!selectedCorrection) return;

    try {
      const updatePayload = {
        'koreksi.status_koreksi': isApproved ? 'disetujui' : 'ditolak',
        'koreksi.catatan_kepsek': correctionNote.trim() || (isApproved ? 'Disetujui oleh Kepala Sekolah' : 'Ditolak'),
        updated_at: serverTimestamp(),
      };

      // Jika disetujui, update jam kedatangan/pulang resmi dengan jam ajuan
      if (isApproved) {
        if (selectedCorrection.koreksi.jam_datang_ajuan) {
          updatePayload.jam_datang_device = selectedCorrection.koreksi.jam_datang_ajuan;
        }
        if (selectedCorrection.koreksi.jam_pulang_ajuan) {
          updatePayload.jam_pulang_device = selectedCorrection.koreksi.jam_pulang_ajuan;
        }
      }

      await updateDoc(doc(db, 'attendance', selectedCorrection.id), updatePayload);

      await logActivity({
        schoolId: userData.school_id,
        actorId: userData.uid,
        actorNama: userData.nama,
        action: isApproved ? 'APPROVE_CORRECTION' : 'REJECT_CORRECTION',
        recordType: 'attendance',
        recordId: selectedCorrection.id,
      });

      setNotification({
        type: 'success',
        text: `Pengajuan koreksi presensi ${selectedCorrection.nama_guru} berhasil ${isApproved ? 'disetujui' : 'ditolak'}.`,
      });

      setCorrectionModalOpen(false);
      setCorrectionNote('');
    } catch (err) {
      alert('Gagal memproses koreksi: ' + err.message);
    }
  };

  return (
    <div className="space-y-6 max-w-6xl mx-auto pb-12">
      
      {/* Header Banner */}
      <div className="bg-gradient-to-r from-amber-500 via-orange-400 to-amber-600 rounded-3xl p-6 md:p-8 text-white shadow-xl shadow-orange-500/15 relative overflow-hidden">
        <div className="absolute right-2 -bottom-4 opacity-20 text-8xl md:text-9xl pointer-events-none select-none font-brand">
          📝
        </div>
        <div className="relative z-10 flex flex-col md:flex-row md:items-center md:justify-between gap-4">
          <div>
            <div className="inline-flex items-center space-x-2 px-3.5 py-1 bg-white/20 backdrop-blur-md rounded-full text-xs font-bold mb-3 border border-white/20">
              <CheckSquare className="w-3.5 h-3.5" />
              <span>Validasi Pembelajaran & Kehadiran</span>
            </div>
            <h1 className="text-2xl md:text-3xl font-extrabold tracking-tight font-brand">
              Validasi Laporan Guru 🌸
            </h1>
            <p className="text-amber-50 text-sm mt-1 font-medium">
              Review jurnal mengajar harian, catatan revisi, dan fitur persetujuan sekaligus (Bulk Approval)
            </p>
          </div>

          {/* Tab Switcher Antara Jurnal vs Koreksi Absen */}
          <div className="flex items-center space-x-2 bg-black/20 p-1.5 rounded-2xl backdrop-blur-sm self-start md:self-auto font-brand">
            <button
              onClick={() => setActiveTab('jurnal')}
              className={`px-4 py-2 rounded-xl text-xs font-bold transition flex items-center space-x-2 ${
                activeTab === 'jurnal' ? 'bg-white text-orange-700 shadow-sm' : 'text-white/80 hover:text-white'
              }`}
            >
              <span>Jurnal KBM</span>
              <span className="px-1.5 py-0.5 rounded-full text-[10px] bg-orange-100 text-orange-800">
                {pendingJournals.length}
              </span>
            </button>
            <button
              onClick={() => setActiveTab('koreksi')}
              className={`px-4 py-2 rounded-xl text-xs font-bold transition flex items-center space-x-2 ${
                activeTab === 'koreksi' ? 'bg-white text-orange-700 shadow-sm' : 'text-white/80 hover:text-white'
              }`}
            >
              <span>Koreksi Absen</span>
              <span className="px-1.5 py-0.5 rounded-full text-[10px] bg-rose-100 text-rose-800">
                {corrections.filter((c) => c.koreksi?.status_koreksi === 'menunggu').length}
              </span>
            </button>
          </div>
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

      {/* TAMPILAN 1: VALIDASI JURNAL KBM */}
      {activeTab === 'jurnal' && (
        <div className="space-y-4">
          
          {/* Action Bar: Filter Status & Fitur Bulk Approval */}
          <div className="bg-white rounded-3xl p-5 border border-orange-200/70 shadow-sm space-y-4">
            <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
              {/* Filter Tabs */}
              <div className="flex items-center space-x-2 overflow-x-auto pb-1 scrollbar-thin">
                {[
                  { id: 'dikirim', label: 'Perlu Diperiksa', count: pendingJournals.length, color: 'bg-orange-500 text-white' },
                  { id: 'semua', label: 'Semua Status', count: journals.length, color: 'bg-slate-800 text-white' },
                  { id: 'perlu_revisi', label: 'Perlu Revisi', count: journals.filter((j) => j.status === 'perlu_revisi').length, color: 'bg-rose-600 text-white' },
                  { id: 'disetujui', label: 'Disetujui', count: journals.filter((j) => j.status === 'disetujui').length, color: 'bg-emerald-600 text-white' },
                ].map((tab) => {
                  const isActive = journalStatusFilter === tab.id;
                  return (
                    <button
                      key={tab.id}
                      onClick={() => setJournalStatusFilter(tab.id)}
                      className={`px-4 py-2 rounded-2xl text-xs font-bold whitespace-nowrap transition flex items-center space-x-1.5 ${
                        isActive ? tab.color + ' shadow-sm' : 'bg-amber-50/50 text-slate-600 hover:bg-amber-100/60 border border-orange-200/60'
                      }`}
                    >
                      <span>{tab.label}</span>
                      <span className={`px-1.5 py-0.5 rounded-full text-[10px] ${isActive ? 'bg-white/20 text-white' : 'bg-orange-100 text-orange-800'}`}>
                        {tab.count}
                      </span>
                    </button>
                  );
                })}
              </div>

              {/* FITUR SETUJUI SEKALIGUS (BULK APPROVAL BUTTON) */}
              {journalStatusFilter === 'dikirim' && pendingJournals.length > 0 && (
                isProPlan ? (
                  <div className="flex items-center space-x-2 shrink-0">
                    <button
                      onClick={handleSelectAllPending}
                      className="px-3 py-2 bg-slate-100 hover:bg-slate-200 text-slate-700 rounded-xl text-xs font-bold transition"
                    >
                      {selectedJournalIds.length === pendingJournals.length ? 'Batal Pilih Semua' : 'Pilih Semua'}
                    </button>

                    <button
                      onClick={handleBulkApprove}
                      disabled={selectedJournalIds.length === 0 || bulkProcessing}
                      className="inline-flex items-center space-x-1.5 px-4 py-2 bg-gradient-to-r from-emerald-500 to-teal-600 hover:from-emerald-600 hover:to-teal-700 text-white rounded-xl text-xs font-extrabold transition shadow-md shadow-emerald-500/20 disabled:opacity-50"
                    >
                      <Check className="w-4 h-4 stroke-[3]" />
                      <span>
                        {bulkProcessing ? 'Memproses...' : `Setujui Sekaligus (${selectedJournalIds.length})`}
                      </span>
                    </button>
                  </div>
                ) : (
                  <div className="flex items-center space-x-1.5 px-3 py-2 bg-amber-50/70 border border-amber-200/80 rounded-xl text-amber-900 text-xs font-bold shrink-0">
                    <Lock className="w-3.5 h-3.5 text-amber-600 stroke-[2.5]" />
                    <span>Setujui Sekaligus (Khusus Paket PRO)</span>
                  </div>
                )
              )}
            </div>
          </div>

          {/* Daftar Jurnal KBM */}
          {loading ? (
            <div className="p-12 text-center text-xs text-slate-400 bg-white rounded-3xl border border-orange-200/70">
              <div className="w-8 h-8 border-4 border-orange-500 border-t-transparent rounded-full animate-spin mx-auto mb-2" />
              Memuat jurnal mengajar...
            </div>
          ) : filteredJournals.length === 0 ? (
            <div className="p-10 text-center text-xs text-slate-400 bg-white rounded-3xl border border-orange-200/70">
              Tidak ada jurnal mengajar pada kategori ini.
            </div>
          ) : (
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              {filteredJournals.map((journal) => {
                const isSelected = selectedJournalIds.includes(journal.id);
                const isPending = journal.status === 'dikirim';

                return (
                  <div
                    key={journal.id}
                    className={`bg-white rounded-3xl p-5 border transition-all flex flex-col justify-between ${
                      isSelected
                        ? 'border-emerald-500 ring-2 ring-emerald-400/20 shadow-md'
                        : 'border-orange-200/70 shadow-sm hover:shadow-md'
                    }`}
                  >
                    <div>
                      {/* Top Bar: Checkbox (jika status dikirim), Tanggal, dan Status */}
                      <div className="flex items-center justify-between mb-3">
                        <div className="flex items-center space-x-2">
                          {isPending && (
                            <input
                              type="checkbox"
                              checked={isSelected}
                              onChange={() => toggleSelectJournal(journal.id)}
                              className="w-4 h-4 rounded text-emerald-600 focus:ring-emerald-500 cursor-pointer"
                            />
                          )}
                          <span className="text-xs font-bold text-slate-500">
                            {formatTanggalIndo(journal.tanggal)}
                          </span>
                        </div>

                        <span className={`px-2.5 py-0.5 rounded-full text-[10px] font-extrabold uppercase border ${
                          journal.status === 'disetujui'
                            ? 'bg-emerald-50 text-emerald-800 border-emerald-300'
                            : journal.status === 'perlu_revisi'
                            ? 'bg-rose-50 text-rose-800 border-rose-300'
                            : journal.status === 'dikirim'
                            ? 'bg-blue-50 text-blue-800 border-blue-300'
                            : 'bg-slate-100 text-slate-600 border-slate-200'
                        }`}>
                          {journal.status}
                        </span>
                      </div>

                      {/* Info Guru & Kelas */}
                      <div className="flex items-center justify-between">
                        <h4 className="text-sm font-extrabold text-slate-900 font-brand">
                          {journal.nama_guru}
                        </h4>
                        <span className="px-2 py-0.5 bg-orange-50 text-orange-800 text-[10px] font-bold rounded-lg border border-orange-200 font-brand">
                          {journal.kelompok}
                        </span>
                      </div>

                      {/* Topik & Cuplikan Kegiatan */}
                      <p className="text-xs font-bold text-slate-700 mt-2 font-brand">
                        "{journal.topik}"
                      </p>
                      <p className="text-xs text-slate-500 mt-1 line-clamp-3 leading-relaxed">
                        {journal.kegiatan_inti || 'Tidak ada rincian kegiatan inti.'}
                      </p>

                      {/* Lampiran Foto */}
                      {journal.fotos && journal.fotos.length > 0 && (
                        <div className="flex items-center space-x-2 mt-3 overflow-x-auto pb-1">
                          {journal.fotos.map((f, i) => (
                            <img
                              key={i}
                              src={f.url}
                              alt="Foto KBM"
                              className="w-14 h-14 rounded-xl object-cover border border-slate-200 shrink-0"
                            />
                          ))}
                        </div>
                      )}

                      {/* Catatan Revisi Sebelumnya */}
                      {journal.status === 'perlu_revisi' && journal.review_note && (
                        <div className="mt-3 p-2.5 bg-rose-50 border border-rose-200 rounded-2xl text-[11px] text-rose-800 font-medium">
                          <strong>Catatan Revisi:</strong> {journal.review_note}
                        </div>
                      )}
                    </div>

                    {/* Aksi Kepsek */}
                    <div className="pt-4 mt-4 border-t border-orange-100 flex items-center justify-between">
                      <button
                        onClick={() => {
                          setSelectedJournal(journal);
                          setRevisionNote(journal.review_note || '');
                          setReviewModalOpen(true);
                        }}
                        className="inline-flex items-center space-x-1 text-xs font-bold text-orange-600 hover:text-orange-800"
                      >
                        <Eye className="w-3.5 h-3.5" />
                        <span>Lihat Rincian</span>
                      </button>

                      {isPending && (
                        <div className="flex items-center space-x-2">
                          <button
                            onClick={() => {
                              setSelectedJournal(journal);
                              setRevisionNote('');
                              setReviewModalOpen(true);
                            }}
                            className="px-3 py-1.5 bg-rose-50 hover:bg-rose-100 text-rose-700 rounded-xl text-xs font-bold transition border border-rose-200"
                          >
                            Minta Revisi
                          </button>
                          <button
                            onClick={() => handleApproveSingle(journal)}
                            className="px-3.5 py-1.5 bg-emerald-600 hover:bg-emerald-700 text-white rounded-xl text-xs font-bold transition shadow-xs flex items-center space-x-1"
                          >
                            <Check className="w-3.5 h-3.5 stroke-[3]" />
                            <span>Setujui</span>
                          </button>
                        </div>
                      )}
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </div>
      )}

      {/* TAMPILAN 2: VERIFIKASI PENGAJUAN KOREKSI ABSEN */}
      {activeTab === 'koreksi' && (
        <div className="bg-white rounded-3xl p-6 border border-orange-200/70 shadow-sm space-y-4">
          <div className="border-b border-orange-100 pb-3">
            <h3 className="text-base font-extrabold text-slate-900 font-brand">
              Pengajuan Koreksi Waktu Presensi Guru
            </h3>
            <p className="text-xs text-slate-500 mt-0.5">
              Tinjau pengajuan koreksi jam datang/pulang akibat kendala teknis atau lupa absen
            </p>
          </div>

          {corrections.length === 0 ? (
            <div className="p-10 text-center text-xs text-slate-400">
              ✅ Tidak ada pengajuan koreksi presensi yang diajukan guru.
            </div>
          ) : (
            <div className="divide-y divide-orange-100">
              {corrections.map((item) => {
                const k = item.koreksi;
                const isPending = k?.status_koreksi === 'menunggu';

                return (
                  <div key={item.id} className="py-4 flex flex-col md:flex-row md:items-center justify-between gap-4">
                    <div className="space-y-1.5 max-w-xl">
                      <div className="flex items-center space-x-2">
                        <span className="text-sm font-extrabold text-slate-900 font-brand">
                          {item.nama_guru}
                        </span>
                        <span className="text-xs text-slate-500 font-semibold">
                          ({formatTanggalIndo(item.tanggal)})
                        </span>
                        <span className={`px-2 py-0.5 rounded-full text-[10px] font-bold ${
                          k.status_koreksi === 'disetujui'
                            ? 'bg-emerald-50 text-emerald-800 border border-emerald-200'
                            : k.status_koreksi === 'ditolak'
                            ? 'bg-rose-50 text-rose-800 border border-rose-200'
                            : 'bg-amber-50 text-amber-800 border border-amber-200'
                        }`}>
                          {k.status_koreksi || 'Menunggu'}
                        </span>
                      </div>

                      {/* Detail Jam Asli vs Jam Ajuan */}
                      <div className="grid grid-cols-2 gap-2 text-xs p-3 bg-amber-50/40 rounded-2xl border border-amber-200/60">
                        <div>
                          <span className="text-[10px] text-slate-400 block font-semibold">Jam Tercatat Asli:</span>
                          <span className="font-bold text-slate-700">
                            Masuk: {item.jam_datang_device || '-'} | Pulang: {item.jam_pulang_device || '-'}
                          </span>
                        </div>
                        <div>
                          <span className="text-[10px] text-orange-600 block font-extrabold">Jam Ajuan Guru:</span>
                          <span className="font-extrabold text-orange-950 font-brand">
                            Masuk: {k.jam_datang_ajuan || '-'} | Pulang: {k.jam_pulang_ajuan || '-'}
                          </span>
                        </div>
                      </div>

                      <p className="text-xs text-slate-600 italic">
                        Alasan Pengajuan: "{k.alasan || 'Tidak ada alasan'}"
                      </p>
                    </div>

                    {/* Aksi Koreksi */}
                    {isPending ? (
                      <div className="flex items-center space-x-2 self-end md:self-auto">
                        <button
                          onClick={() => {
                            setSelectedCorrection(item);
                            setCorrectionModalOpen(true);
                          }}
                          className="px-4 py-2 bg-gradient-to-r from-amber-500 to-orange-500 hover:from-amber-600 hover:to-orange-600 text-white rounded-xl text-xs font-extrabold transition shadow-xs"
                        >
                          Tinjau Keputusan
                        </button>
                      </div>
                    ) : (
                      <div className="text-xs text-slate-400 self-end md:self-auto italic">
                        Tanggapan: "{k.catatan_kepsek || '-'}"
                      </div>
                    )}
                  </div>
                );
              })}
            </div>
          )}
        </div>
      )}

      {/* MODAL: Rincian Jurnal & Catatan Revisi */}
      {reviewModalOpen && selectedJournal && createPortal(
        <div className="fixed inset-0 z-[100] flex items-center justify-center p-4 bg-slate-900/60 backdrop-blur-sm animate-fadeIn">
          <div className="bg-white rounded-3xl w-full max-w-2xl max-h-[90vh] overflow-y-auto p-6 shadow-2xl border border-orange-200/80 space-y-4 flex flex-col">
            <div className="flex items-center justify-between border-b border-orange-100 pb-3">
              <div>
                <span className="text-xs font-extrabold text-orange-600 uppercase tracking-wide font-brand">
                  Detail Jurnal KBM
                </span>
                <h3 className="text-base font-extrabold text-slate-900 font-brand">
                  {selectedJournal.topik}
                </h3>
              </div>
              <button onClick={() => setReviewModalOpen(false)} className="p-1.5 text-slate-400 hover:text-slate-600 rounded-xl">
                <X className="w-5 h-5" />
              </button>
            </div>

            <div className="space-y-3.5 text-xs text-slate-700">
              <div className="flex items-center justify-between p-3 bg-amber-50/50 rounded-2xl border border-amber-200/60 font-semibold">
                <span>Pendidik: <strong>{selectedJournal.nama_guru}</strong></span>
                <span>Kelompok: <strong>{selectedJournal.kelompok}</strong></span>
                <span>Tanggal: <strong>{formatTanggalIndo(selectedJournal.tanggal)}</strong></span>
              </div>

              <div>
                <span className="font-extrabold text-slate-800 block mb-1">Capaian Pembelajaran:</span>
                <div className="flex flex-wrap gap-1.5">
                  {selectedJournal.capaian_pembelajaran?.map((c, i) => (
                    <span key={i} className="px-2.5 py-1 bg-orange-50 text-orange-800 text-[11px] font-bold rounded-lg border border-orange-200">
                      {c}
                    </span>
                  ))}
                </div>
              </div>

              <div className="space-y-2">
                <div>
                  <span className="font-extrabold text-slate-800 block">Kegiatan Pembuka:</span>
                  <p className="p-3 bg-slate-50 rounded-2xl border border-slate-200 leading-relaxed">{selectedJournal.kegiatan_pembuka || '-'}</p>
                </div>
                <div>
                  <span className="font-extrabold text-slate-800 block">Kegiatan Inti:</span>
                  <p className="p-3 bg-slate-50 rounded-2xl border border-slate-200 leading-relaxed">{selectedJournal.kegiatan_inti || '-'}</p>
                </div>
                <div>
                  <span className="font-extrabold text-slate-800 block">Kegiatan Penutup & Refleksi:</span>
                  <p className="p-3 bg-slate-50 rounded-2xl border border-slate-200 leading-relaxed">{selectedJournal.kegiatan_penutup || '-'}</p>
                </div>
              </div>

              {/* Foto Dokumentasi */}
              {selectedJournal.fotos && selectedJournal.fotos.length > 0 && (
                <div>
                  <span className="font-extrabold text-slate-800 block mb-1">Foto Dokumentasi Pembelajaran:</span>
                  <div className="grid grid-cols-2 sm:grid-cols-3 gap-2">
                    {selectedJournal.fotos.map((f, i) => (
                      <img
                        key={i}
                        src={f.url}
                        alt="Foto KBM"
                        className="w-full h-28 rounded-2xl object-cover border border-slate-200"
                      />
                    ))}
                  </div>
                </div>
              )}

              {/* Form Catatan Revisi */}
              <div className="pt-2 border-t border-orange-100">
                <label className="block text-xs font-bold text-slate-800 mb-1">
                  Catatan Revisi untuk Guru (Jika Memerlukan Perbaikan):
                </label>
                <textarea
                  rows={3}
                  value={revisionNote}
                  onChange={(e) => setRevisionNote(e.target.value)}
                  placeholder="Contoh: Tambahkan deskripsi respons anak saat eksperimen bahan alam..."
                  className="w-full p-3 bg-amber-50/40 border border-slate-200 rounded-2xl text-xs focus:outline-none focus:bg-white focus:ring-2 focus:ring-orange-400/20 leading-relaxed"
                />
              </div>
            </div>

            <div className="pt-2 border-t border-orange-100 flex items-center justify-between">
              <button
                type="button"
                onClick={() => setReviewModalOpen(false)}
                className="px-4 py-2.5 text-xs font-bold text-slate-600 hover:bg-slate-100 rounded-xl transition"
              >
                Tutup
              </button>

              <div className="flex items-center space-x-2">
                <button
                  type="button"
                  disabled={!revisionNote.trim() || submittingReview}
                  onClick={handleRequestRevision}
                  className="px-4 py-2.5 bg-rose-50 hover:bg-rose-100 text-rose-700 rounded-xl text-xs font-bold transition border border-rose-200 disabled:opacity-50"
                >
                  Kirim Revisi
                </button>
                <button
                  type="button"
                  onClick={() => handleApproveSingle(selectedJournal)}
                  className="px-5 py-2.5 bg-emerald-600 hover:bg-emerald-700 text-white rounded-xl text-xs font-extrabold transition shadow-md shadow-emerald-600/20 flex items-center space-x-1.5"
                >
                  <Check className="w-4 h-4 stroke-[3]" />
                  <span>Setujui Jurnal Ini</span>
                </button>
              </div>
            </div>
          </div>
        </div>,
        document.body
      )}

      {/* MODAL: Verifikasi Koreksi Jam Presensi */}
      {correctionModalOpen && selectedCorrection && createPortal(
        <div className="fixed inset-0 z-[100] flex items-center justify-center p-4 bg-slate-900/60 backdrop-blur-sm animate-fadeIn">
          <div className="bg-white rounded-3xl w-full max-w-md p-6 shadow-2xl border border-orange-200/80 space-y-4">
            <div className="flex items-center justify-between border-b border-orange-100 pb-3">
              <h3 className="text-base font-extrabold text-slate-900 font-brand">
                Keputusan Koreksi Presensi
              </h3>
              <button onClick={() => setCorrectionModalOpen(false)} className="p-1.5 text-slate-400 hover:text-slate-600 rounded-xl">
                <X className="w-5 h-5" />
              </button>
            </div>

            <div className="space-y-3 text-xs text-slate-700">
              <div className="p-3 bg-amber-50/50 rounded-2xl border border-amber-200/60">
                <span className="font-extrabold text-slate-800 block text-sm">{selectedCorrection.nama_guru}</span>
                <span className="text-[11px] text-slate-500">{formatTanggalIndo(selectedCorrection.tanggal)}</span>
              </div>

              <div className="p-3 bg-slate-50 rounded-2xl border border-slate-200 space-y-1">
                <span className="font-bold text-slate-800 block">Rincian Ajuan Guru:</span>
                <p>Jam Datang Ajuan: <strong>{selectedCorrection.koreksi?.jam_datang_ajuan || '-'} WIB</strong></p>
                <p>Jam Pulang Ajuan: <strong>{selectedCorrection.koreksi?.jam_pulang_ajuan || '-'} WIB</strong></p>
                <p className="text-slate-600 italic mt-1">Alasan: "{selectedCorrection.koreksi?.alasan || '-'}"</p>
              </div>

              <div>
                <label className="block text-xs font-bold text-slate-800 mb-1">
                  Catatan Kepala Sekolah (Opsional):
                </label>
                <input
                  type="text"
                  value={correctionNote}
                  onChange={(e) => setCorrectionNote(e.target.value)}
                  placeholder="Contoh: Disetujui, guru hadir tepat waktu."
                  className="w-full px-3.5 py-2.5 text-xs font-semibold bg-amber-50/30 border border-slate-200 rounded-xl focus:outline-none focus:bg-white"
                />
              </div>
            </div>

            <div className="pt-2 border-t border-orange-100 flex items-center justify-end space-x-2">
              <button
                type="button"
                onClick={() => handleDecisionCorrection(false)}
                className="px-4 py-2.5 bg-rose-50 hover:bg-rose-100 text-rose-700 rounded-xl text-xs font-bold transition border border-rose-200"
              >
                Tolak Pengajuan
              </button>
              <button
                type="button"
                onClick={() => handleDecisionCorrection(true)}
                className="px-5 py-2.5 bg-emerald-600 hover:bg-emerald-700 text-white rounded-xl text-xs font-extrabold transition shadow-md shadow-emerald-600/20"
              >
                Setujui Koreksi
              </button>
            </div>
          </div>
        </div>,
        document.body
      )}

    </div>
  );
}


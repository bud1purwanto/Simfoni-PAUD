import React, { useState, useEffect } from 'react';
import {
  FileText,
  CheckCircle2,
  AlertCircle,
  Clock,
  Check,
  RotateCcw,
  ExternalLink,
  BookOpen,
  Filter,
  User,
  Sparkles
} from 'lucide-react';
import {
  collection,
  query,
  where,
  getDocs,
  updateDoc,
  doc,
  serverTimestamp
} from 'firebase/firestore';
import { db } from '../../config/firebase';
import { useAuth } from '../../context/AuthContext';
import { formatTanggalIndo } from '../../utils/formatters';
import { logActivity } from '../../utils/auditLogger';
import { commitWrite, QUEUED_SUFFIX } from '../../utils/offlineWrite';
import ModalKonfirmasi from '../../components/ui/ModalKonfirmasi';

export default function ValidasiRpphKepsek() {
  const { userData, schoolData } = useAuth();
  const [rpphList, setRpphList] = useState([]);
  const [loading, setLoading] = useState(true);
  const [filterStatus, setFilterStatus] = useState('dikirim');
  const [actionLoading, setActionLoading] = useState(false);
  const [notification, setNotification] = useState(null);

  // Modal Revisi State
  const [revisiModalOpen, setRevisiModalOpen] = useState(false);
  const [selectedRpph, setSelectedRpph] = useState(null);
  const [catatanRevisi, setCatatanRevisi] = useState('');

  // Fetch daftar seluruh RPPH di sekolah ini
  const fetchRpphList = async () => {
    if (!userData?.school_id) return;
    try {
      setLoading(true);
      const q = query(
        collection(db, 'rpph_submissions'),
        where('school_id', '==', userData.school_id)
      );
      const snap = await getDocs(q);
      const list = snap.docs.map(d => ({ id: d.id, ...d.data() }));
      list.sort((a, b) => (b.minggu_ke || 0) - (a.minggu_ke || 0));
      setRpphList(list);
    } catch (err) {
      console.error('Error fetching RPPH:', err);
      setNotification({ type: 'error', text: 'Gagal memuat daftar modul ajar guru.' });
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchRpphList();
  }, [userData?.school_id]);

  // Handler Pengesahan / Setujui RPPH
  const handleApprove = async (rpph) => {
    setActionLoading(true);
    try {
      const docRef = doc(db, 'rpph_submissions', rpph.id);
      const payload = {
        status: 'disetujui',
        disetujui_at: serverTimestamp(),
        disetujui_by: userData.uid,
        catatan_kepsek: 'Telah ditelaah dan disahkan sesuai Kurikulum Merdeka PAUD.',
        updated_at: serverTimestamp()
      };

      const { queued } = await commitWrite(updateDoc(docRef, payload));

      logActivity({
        schoolId: userData.school_id,
        actorId: userData.uid,
        actorNama: userData.nama,
        action: 'APPROVE_RPPH',
        recordType: 'rpph_submissions',
        recordId: rpph.id,
        detail: { kelompok: rpph.kelompok, minggu_ke: rpph.minggu_ke, guru: rpph.nama_guru }
      });

      setNotification({
        type: 'success',
        text: `Modul ajar Minggu ke-${rpph.minggu_ke} (${rpph.nama_guru}) telah disahkan!${queued ? QUEUED_SUFFIX : ''}`
      });

      await fetchRpphList();
    } catch (err) {
      console.error('Error approving RPPH:', err);
      setNotification({ type: 'error', text: 'Gagal mengesahkan modul ajar.' });
    } finally {
      setActionLoading(false);
    }
  };

  // Handler Minta Revisi
  const handleConfirmRevisi = async () => {
    if (!selectedRpph || !catatanRevisi.trim()) {
      setNotification({ type: 'error', text: 'Catatan arahan revisi wajib diisi.' });
      return;
    }

    setActionLoading(true);
    try {
      const docRef = doc(db, 'rpph_submissions', selectedRpph.id);
      const payload = {
        status: 'perlu_revisi',
        catatan_kepsek: catatanRevisi.trim(),
        updated_at: serverTimestamp()
      };

      const { queued } = await commitWrite(updateDoc(docRef, payload));

      logActivity({
        schoolId: userData.school_id,
        actorId: userData.uid,
        actorNama: userData.nama,
        action: 'REVISE_RPPH',
        recordType: 'rpph_submissions',
        recordId: selectedRpph.id,
        detail: { kelompok: selectedRpph.kelompok, minggu_ke: selectedRpph.minggu_ke, catatan: catatanRevisi }
      });

      setNotification({
        type: 'success',
        text: `Arahan revisi telah diteruskan kepada ${selectedRpph.nama_guru}.${queued ? QUEUED_SUFFIX : ''}`
      });

      setRevisiModalOpen(false);
      setSelectedRpph(null);
      setCatatanRevisi('');
      await fetchRpphList();
    } catch (err) {
      console.error('Error revising RPPH:', err);
      setNotification({ type: 'error', text: 'Gagal mengirimkan arahan revisi.' });
    } finally {
      setActionLoading(false);
    }
  };

  const filteredList = rpphList.filter(item => {
    if (filterStatus === 'semua') return true;
    return item.status === filterStatus;
  });

  return (
    <div className="max-w-6xl mx-auto space-y-5 animate-in fade-in duration-200">
      {/* Header Halaman Ceria */}
      <div className="bg-gradient-to-r from-indigo-700 via-indigo-600 to-purple-600 rounded-3xl p-5 md:p-7 text-white shadow-lg shadow-indigo-600/20 relative overflow-hidden">
        <div className="absolute right-0 top-0 bottom-0 opacity-10 pointer-events-none flex items-center pr-6">
          <BookOpen className="w-48 h-48" />
        </div>
        <div className="relative z-10 flex flex-col md:flex-row md:items-center justify-between gap-4">
          <div>
            <div className="inline-flex items-center space-x-1.5 px-3 py-1 rounded-xl bg-white/20 backdrop-blur-md text-[11px] font-bold tracking-wide uppercase mb-2">
              <Sparkles className="w-3.5 h-3.5" />
              <span>Pilar 2 - Telaah & Validasi Eksekutif</span>
            </div>
            <h1 className="text-xl md:text-2xl font-black font-brand">
              Validasi Perangkat Ajar & RPPH 📑
            </h1>
            <p className="text-xs md:text-sm text-indigo-100 max-w-xl mt-1 leading-relaxed">
              Supervisi dan telaah rencana pembelajaran mingguan 3 guru kelas. Berikan persetujuan resmi atau catatan perbaikan sebelum kegiatan belajar mengajar dimulai.
            </p>
          </div>

          <div className="flex items-center gap-2 bg-white/10 backdrop-blur-md p-2.5 rounded-2xl border border-white/20 shrink-0">
            <div className="text-center px-3">
              <div className="text-lg font-black font-brand leading-none">
                {rpphList.filter(r => r.status === 'dikirim').length}
              </div>
              <div className="text-[10px] text-indigo-100 font-bold uppercase mt-0.5">Antrean</div>
            </div>
            <div className="w-px h-6 bg-white/20" />
            <div className="text-center px-3">
              <div className="text-lg font-black font-brand leading-none text-emerald-200">
                {rpphList.filter(r => r.status === 'disetujui').length}
              </div>
              <div className="text-[10px] text-indigo-100 font-bold uppercase mt-0.5">Disahkan</div>
            </div>
          </div>
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

      {/* Filter Status Tab */}
      <div className="bg-white rounded-3xl p-3 border border-indigo-100 shadow-xs flex items-center space-x-1.5 overflow-x-auto">
        {[
          { id: 'dikirim', label: 'Menunggu Telaah', count: rpphList.filter(r => r.status === 'dikirim').length },
          { id: 'disetujui', label: 'Telah Disahkan', count: rpphList.filter(r => r.status === 'disetujui').length },
          { id: 'perlu_revisi', label: 'Perlu Revisi', count: rpphList.filter(r => r.status === 'perlu_revisi').length },
          { id: 'semua', label: 'Semua Modul', count: rpphList.length },
        ].map(tab => (
          <button
            key={tab.id}
            onClick={() => setFilterStatus(tab.id)}
            className={`px-4 py-2 rounded-2xl text-xs font-bold transition flex items-center space-x-1.5 shrink-0 ${
              filterStatus === tab.id
                ? 'bg-indigo-600 text-white shadow-xs'
                : 'text-slate-600 hover:bg-slate-100'
            }`}
          >
            <span>{tab.label}</span>
            <span className={`text-[10px] px-1.5 py-0.2 rounded-md ${
              filterStatus === tab.id ? 'bg-white/20 text-white' : 'bg-slate-200 text-slate-700'
            }`}>
              {tab.count}
            </span>
          </button>
        ))}
      </div>

      {/* Konten Daftar RPPH */}
      {loading ? (
        <div className="py-16 text-center text-slate-400 space-y-2">
          <div className="w-8 h-8 border-3 border-indigo-600 border-t-transparent rounded-full animate-spin mx-auto" />
          <p className="text-xs font-medium">Memuat pengajuan perangkat ajar...</p>
        </div>
      ) : filteredList.length === 0 ? (
        <div className="bg-white rounded-3xl p-10 border border-dashed border-indigo-200 text-center space-y-3">
          <div className="w-14 h-14 rounded-2xl bg-indigo-50 text-indigo-600 flex items-center justify-center mx-auto">
            <CheckCircle2 className="w-7 h-7" />
          </div>
          <h3 className="text-sm font-bold text-slate-700 font-brand">Tidak Ada Pengajuan pada Kategori Ini</h3>
          <p className="text-xs text-slate-400 max-w-sm mx-auto leading-relaxed">
            Seluruh berkas rencana pembelajaran di kategori ini telah tuntas ditindaklanjuti.
          </p>
        </div>
      ) : (
        <div className="space-y-3">
          {filteredList.map((item) => {
            const isDikirim = item.status === 'dikirim';
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
                    <span className="text-[11px] font-bold px-2 py-0.5 rounded-md bg-slate-100 text-slate-700">
                      {item.kelompok}
                    </span>
                    <span className="text-[11px] text-slate-500 font-medium flex items-center space-x-1">
                      <User className="w-3 h-3 text-slate-400" />
                      <span>{item.nama_guru}</span>
                    </span>
                    <span className="text-[11px] text-slate-400">
                      • Sem. {item.semester} ({item.tahun_ajaran})
                    </span>
                  </div>

                  <h3 className="text-sm font-bold text-slate-800 font-brand">
                    {item.tema} {item.subtema && <span className="text-slate-500 font-medium">({item.subtema})</span>}
                  </h3>

                  {item.ringkasan_tujuan && (
                    <p className="text-xs text-slate-500 leading-relaxed">
                      <strong>Tujuan:</strong> {item.ringkasan_tujuan}
                    </p>
                  )}

                  {item.catatan_kepsek && (
                    <div className="p-2.5 bg-slate-50 rounded-2xl border border-slate-200/80 text-[11px] text-slate-700">
                      <strong>Catatan Telaah:</strong> {item.catatan_kepsek}
                    </div>
                  )}
                </div>

                {/* Tombol Keputusan Kepala Sekolah */}
                <div className="flex flex-wrap items-center gap-2 justify-end pt-2 md:pt-0 border-t md:border-t-0 border-slate-100">
                  <a
                    href={item.file_url}
                    target="_blank"
                    rel="noreferrer"
                    className="px-3.5 py-2 rounded-2xl border border-indigo-200 bg-indigo-50 text-indigo-700 hover:bg-indigo-100 text-xs font-bold transition flex items-center space-x-1.5"
                  >
                    <ExternalLink className="w-3.5 h-3.5" />
                    <span>Buka Dokumen</span>
                  </a>

                  {isDikirim && (
                    <>
                      <button
                        onClick={() => {
                          setSelectedRpph(item);
                          setCatatanRevisi(item.catatan_kepsek || '');
                          setRevisiModalOpen(true);
                        }}
                        disabled={actionLoading}
                        className="px-3.5 py-2 rounded-2xl border border-rose-200 bg-rose-50 text-rose-700 hover:bg-rose-100 text-xs font-bold transition flex items-center space-x-1.5"
                      >
                        <RotateCcw className="w-3.5 h-3.5" />
                        <span>Revisi</span>
                      </button>

                      <button
                        onClick={() => handleApprove(item)}
                        disabled={actionLoading}
                        className="px-4 py-2 rounded-2xl bg-gradient-to-r from-emerald-600 to-teal-600 hover:from-emerald-700 hover:to-teal-700 text-white text-xs font-bold shadow-md shadow-emerald-500/20 transition flex items-center space-x-1.5"
                      >
                        <Check className="w-4 h-4 stroke-[2.5]" />
                        <span>Sahkan Modul</span>
                      </button>
                    </>
                  )}
                </div>
              </div>
            );
          })}
        </div>
      )}

      {/* Modal Dialog Form Catatan Revisi */}
      {revisiModalOpen && (
        <div className="fixed inset-0 z-[120] bg-slate-900/60 backdrop-blur-sm flex items-center justify-center p-4 animate-in fade-in duration-200">
          <div className="bg-white rounded-3xl max-w-md w-full p-6 shadow-2xl border border-slate-100 space-y-4 animate-in zoom-in-95 duration-200">
            <div className="flex items-center space-x-3 text-rose-600">
              <div className="w-10 h-10 rounded-2xl bg-rose-100 flex items-center justify-center shadow-xs">
                <RotateCcw className="w-5 h-5 stroke-[2.2]" />
              </div>
              <div>
                <h3 className="text-base font-bold text-slate-800 font-brand">Minta Revisi Modul Ajar</h3>
                <p className="text-xs text-slate-500">Minggu ke-{selectedRpph?.minggu_ke} - {selectedRpph?.nama_guru}</p>
              </div>
            </div>

            <div>
              <label className="text-xs font-bold text-slate-700">Catatan & Masukan Perbaikan Kepala Sekolah <span className="text-rose-500">*</span></label>
              <textarea
                rows={4}
                required
                value={catatanRevisi}
                onChange={(e) => setCatatanRevisi(e.target.value)}
                placeholder="Tuliskan arahan perbaikan (misal: sesuaikan kegiatan inti dengan sentra seni dan tambahkan alat peraga loose parts)..."
                className="w-full mt-1 px-3.5 py-2.5 rounded-2xl border border-slate-200 text-xs focus:ring-2 focus:ring-rose-400 focus:outline-none resize-none"
              />
            </div>

            <div className="flex items-center justify-end space-x-2 pt-2 border-t border-slate-100">
              <button
                type="button"
                onClick={() => setRevisiModalOpen(false)}
                className="px-4 py-2 rounded-2xl border border-slate-200 text-slate-600 hover:bg-slate-50 text-xs font-bold transition"
              >
                Batal
              </button>
              <button
                type="button"
                disabled={actionLoading}
                onClick={handleConfirmRevisi}
                className="px-4 py-2 rounded-2xl bg-rose-600 hover:bg-rose-700 text-white text-xs font-bold shadow-md shadow-rose-500/20 transition flex items-center space-x-1.5"
              >
                <span>{actionLoading ? 'Menyimpan...' : 'Kirim Catatan Revisi'}</span>
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

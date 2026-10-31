import React, { useState, useEffect } from 'react';
import {
  ClipboardCheck,
  Award,
  Users,
  Calendar,
  Sparkles,
  Plus,
  Star,
  CheckCircle2,
  AlertCircle,
  TrendingUp,
  FileText,
  UserCheck
} from 'lucide-react';
import {
  collection,
  query,
  where,
  getDocs,
  addDoc,
  doc,
  serverTimestamp
} from 'firebase/firestore';
import { db } from '../../config/firebase';
import { useAuth } from '../../context/AuthContext';
import { formatTanggalIndo, getLocalDateString } from '../../utils/formatters';
import { logActivity } from '../../utils/auditLogger';
import { commitWrite, QUEUED_SUFFIX } from '../../utils/offlineWrite';
import ModalKonfirmasi from '../../components/ui/ModalKonfirmasi';

const RUBRIK_ITEMS = [
  { id: 'perencanaan_pembelajaran', label: '1. Perencanaan Pembelajaran', desc: 'Kesesuaian modul ajar / RPPH dengan Kurikulum Merdeka PAUD' },
  { id: 'pelaksanaan_kegiatan_inti', label: '2. Pelaksanaan KBM & Diferensiasi', desc: 'Penguasaan langkah bermain bermakna, sentra, dan media loose parts' },
  { id: 'keterlibatan_anak', label: '3. Keterlibatan & Respons Anak', desc: 'Kemampuan memantik antusiasme, keaktifan, dan rasa ingin tahu anak' },
  { id: 'manajemen_kelas_dan_suasana', label: '4. Iklim & Manajemen Kelas', desc: 'Penciptaan suasana belajar yang aman, nyaman, suportif, dan ramah anak' },
  { id: 'asesmen_otentik', label: '5. Asesmen Otentik', desc: 'Ketelitian observasi perilaku anak (catatan anekdot & portofolio)' },
];

export default function SupervisiKinerja() {
  const { userData } = useAuth();
  const isKepsek = userData?.role === 'kepsek';

  const [supervisiList, setSupervisiList] = useState([]);
  const [guruList, setGuruList] = useState([]);
  const [loading, setLoading] = useState(true);
  const [formOpen, setFormOpen] = useState(false);
  const [saving, setSaving] = useState(false);
  const [notification, setNotification] = useState(null);

  // Form State
  const [selectedGuruId, setSelectedGuruId] = useState('');
  const [tanggalSupervisi, setTanggalSupervisi] = useState(getLocalDateString());
  const [fokusObservasi, setFokusObservasi] = useState('Penerapan Pembelajaran Berdiferensiasi & Sentra');
  const [skorRubrik, setSkorRubrik] = useState({
    perencanaan_pembelajaran: 4,
    pelaksanaan_kegiatan_inti: 4,
    keterlibatan_anak: 4,
    manajemen_kelas_dan_suasana: 4,
    asesmen_otentik: 4,
  });
  const [catatanApresiasi, setCatatanApresiasi] = useState('');
  const [catatanRekomendasi, setCatatanRekomendasi] = useState('');
  const [tindakLanjut, setTindakLanjut] = useState('');

  // Fetch Guru & Riwayat Supervisi
  const fetchData = async () => {
    if (!userData?.school_id) return;
    try {
      setLoading(true);

      // 1. Ambil daftar guru sekolah ini
      const qGuru = query(
        collection(db, 'users'),
        where('school_id', '==', userData.school_id),
        where('role', '==', 'guru')
      );
      const snapGuru = await getDocs(qGuru);
      const gList = snapGuru.docs
        .map(d => ({ uid: d.id, ...d.data() }))
        .filter(g => g.status_akun === 'aktif');
      setGuruList(gList);
      if (gList.length > 0 && !selectedGuruId) {
        setSelectedGuruId(gList[0].uid);
      }

      // 2. Ambil riwayat supervisi
      let qSupervisi;
      if (isKepsek) {
        qSupervisi = query(
          collection(db, 'teacher_supervisions'),
          where('school_id', '==', userData.school_id)
        );
      } else {
        // Guru hanya melihat hasil supervisi dirinya sendiri
        qSupervisi = query(
          collection(db, 'teacher_supervisions'),
          where('school_id', '==', userData.school_id),
          where('guru_id', '==', userData.uid)
        );
      }
      const snapSup = await getDocs(qSupervisi);
      const list = snapSup.docs.map(d => ({ id: d.id, ...d.data() }));
      list.sort((a, b) => (b.tanggal_supervisi || '').localeCompare(a.tanggal_supervisi || ''));
      setSupervisiList(list);
    } catch (err) {
      console.error('Error fetching supervisions:', err);
      setNotification({ type: 'error', text: 'Gagal memuat rekam supervisi kinerja.' });
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchData();
  }, [userData?.school_id]);

  // Hitung Nilai Akhir (Skala 100) & Predikat
  const hitungHasil = () => {
    const totalSkor = Object.values(skorRubrik).reduce((a, b) => Number(a) + Number(b), 0);
    const nilaiAkhir = Math.round((totalSkor / (RUBRIK_ITEMS.length * 4)) * 100);

    let predikat = 'Perlu Pembinaan';
    if (nilaiAkhir >= 90) predikat = 'Sangat Baik';
    else if (nilaiAkhir >= 80) predikat = 'Baik';
    else if (nilaiAkhir >= 70) predikat = 'Cukup';

    return { nilaiAkhir, predikat };
  };

  const { nilaiAkhir, predikat } = hitungHasil();

  // Handler Simpan Supervisi
  const handleSubmitSupervisi = async (e) => {
    e.preventDefault();
    const guru = guruList.find(g => g.uid === selectedGuruId);
    if (!guru) {
      setNotification({ type: 'error', text: 'Pilih guru yang disupervisi terlebih dahulu.' });
      return;
    }

    setSaving(true);
    try {
      const payload = {
        school_id: userData.school_id,
        kepsek_id: userData.uid,
        nama_kepsek: userData.nama,
        guru_id: guru.uid,
        nama_guru: guru.nama,
        kelompok_kelas: guru.kelompok_kelas || 'TK A',
        tanggal_supervisi: tanggalSupervisi,
        fokus_observasi: fokusObservasi.trim(),
        skor_rubrik: skorRubrik,
        nilai_akhir: nilaiAkhir,
        predikat: predikat,
        catatan_apresiasi: catatanApresiasi.trim() || 'Pembelajaran berlangsung tertib, ceria, dan menarik.',
        catatan_rekomendasi: catatanRekomendasi.trim(),
        tindak_lanjut: tindakLanjut.trim() || 'Pertahankan kreativitas media ajar pada tema berikutnya.',
        status: 'selesai',
        created_at: serverTimestamp(),
        updated_at: serverTimestamp()
      };

      const { queued } = await commitWrite(addDoc(collection(db, 'teacher_supervisions'), payload));

      logActivity({
        schoolId: userData.school_id,
        actorId: userData.uid,
        actorNama: userData.nama,
        action: 'SUBMIT_TEACHER_SUPERVISION',
        recordType: 'teacher_supervisions',
        recordId: 'new',
        detail: { guru: guru.nama, nilai: nilaiAkhir, predikat }
      });

      setNotification({
        type: 'success',
        text: `Supervisi untuk ${guru.nama} berhasil disimpan dengan predikat "${predikat}"!${queued ? QUEUED_SUFFIX : ''}`
      });

      setCatatanApresiasi('');
      setCatatanRekomendasi('');
      setTindakLanjut('');
      setFormOpen(false);
      await fetchData();
    } catch (err) {
      console.error('Error saving supervision:', err);
      setNotification({ type: 'error', text: 'Gagal menyimpan hasil supervisi.' });
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="max-w-6xl mx-auto space-y-5 animate-in fade-in duration-200">
      {/* Header Halaman Ceria */}
      <div className="bg-gradient-to-r from-purple-700 via-indigo-700 to-blue-700 rounded-3xl p-5 md:p-7 text-white shadow-lg shadow-indigo-700/20 relative overflow-hidden">
        <div className="absolute right-0 top-0 bottom-0 opacity-10 pointer-events-none flex items-center pr-6">
          <ClipboardCheck className="w-48 h-48" />
        </div>
        <div className="relative z-10 flex flex-col md:flex-row md:items-center justify-between gap-4">
          <div>
            <div className="inline-flex items-center space-x-1.5 px-3 py-1 rounded-xl bg-white/20 backdrop-blur-md text-[11px] font-bold tracking-wide uppercase mb-2">
              <Sparkles className="w-3.5 h-3.5" />
              <span>Pilar 5 - Evaluasi & Supervisi Kinerja Guru</span>
            </div>
            <h1 className="text-xl md:text-2xl font-black font-brand">
              Supervisi & Umpan Balik Kinerja KBM 📋
            </h1>
            <p className="text-xs md:text-sm text-indigo-100 max-w-xl mt-1 leading-relaxed">
              Instrumen evaluasi klinis pembelajaran di kelas PAUD oleh Kepala Sekolah untuk memantau mutu KBM, mengapresiasi inovasi guru, serta memberikan rekomendasi pembinaan berkala.
            </p>
          </div>

          {isKepsek && (
            <button
              onClick={() => setFormOpen(!formOpen)}
              className="px-4 py-3 rounded-2xl bg-white text-indigo-700 hover:bg-indigo-50 font-bold text-xs shadow-md transition flex items-center justify-center space-x-2 shrink-0"
            >
              <Plus className="w-4 h-4 stroke-[2.5]" />
              <span>{formOpen ? 'Tutup Form' : 'Isi Instrumen Supervisi'}</span>
            </button>
          )}
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

      {/* Form Input Supervisi Baru (Khusus Kepala Sekolah) */}
      {isKepsek && formOpen && (
        <form onSubmit={handleSubmitSupervisi} className="bg-white rounded-3xl p-6 border border-indigo-100 shadow-md space-y-5 animate-in slide-in-from-top-4 duration-200">
          <div className="flex items-center justify-between pb-3 border-b border-slate-100">
            <div className="flex items-center space-x-2 text-indigo-900 font-bold text-sm font-brand">
              <Award className="w-4 h-4 text-indigo-600" />
              <span>Instrumen Penilaian Kinerja Guru (Skala 1 - 4)</span>
            </div>
            <div className="flex items-center space-x-2">
              <span className="text-xs text-slate-500 font-medium">Predikat Sementara:</span>
              <span className="text-xs font-black px-2.5 py-0.5 rounded-lg bg-indigo-50 text-indigo-700 border border-indigo-200">
                {predikat} ({nilaiAkhir}/100)
              </span>
            </div>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
            <div>
              <label className="text-xs font-bold text-slate-700">Pilih Guru yang Disupervisi <span className="text-rose-500">*</span></label>
              <select
                required
                value={selectedGuruId}
                onChange={(e) => setSelectedGuruId(e.target.value)}
                className="w-full mt-1 px-3.5 py-2.5 rounded-2xl border border-slate-200 text-xs bg-white focus:ring-2 focus:ring-indigo-400 focus:outline-none"
              >
                {guruList.map(g => (
                  <option key={g.uid} value={g.uid}>{g.nama} ({g.kelompok_kelas || 'Guru Kelas'})</option>
                ))}
              </select>
            </div>
            <div>
              <label className="text-xs font-bold text-slate-700">Tanggal Observasi Kelas</label>
              <input
                type="date"
                value={tanggalSupervisi}
                onChange={(e) => setTanggalSupervisi(e.target.value)}
                className="w-full mt-1 px-3.5 py-2.5 rounded-2xl border border-slate-200 text-xs focus:ring-2 focus:ring-indigo-400 focus:outline-none"
              />
            </div>
            <div>
              <label className="text-xs font-bold text-slate-700">Fokus / Aspek Observasi</label>
              <input
                type="text"
                value={fokusObservasi}
                onChange={(e) => setFokusObservasi(e.target.value)}
                placeholder="Misal: Diferensiasi & Penggunaan Loose Parts"
                className="w-full mt-1 px-3.5 py-2.5 rounded-2xl border border-slate-200 text-xs focus:ring-2 focus:ring-indigo-400 focus:outline-none"
              />
            </div>
          </div>

          {/* 5 Indikator Rubrik Skala 1-4 */}
          <div className="space-y-3 pt-2">
            <h4 className="text-xs font-bold text-slate-700 uppercase tracking-wider">
              Rubrik Evaluasi 5 Dimensi Pembelajaran:
            </h4>
            <div className="grid grid-cols-1 gap-2.5">
              {RUBRIK_ITEMS.map((item) => (
                <div key={item.id} className="p-3.5 rounded-2xl border border-slate-100 bg-slate-50/50 flex flex-col sm:flex-row sm:items-center justify-between gap-3">
                  <div>
                    <h5 className="text-xs font-bold text-slate-800">{item.label}</h5>
                    <p className="text-[11px] text-slate-400 mt-0.5">{item.desc}</p>
                  </div>

                  <div className="flex items-center space-x-1 shrink-0 bg-white p-1 rounded-2xl border border-slate-200">
                    {[1, 2, 3, 4].map((skor) => {
                      const isSelected = skorRubrik[item.id] === skor;
                      const skorLabels = { 1: 'Kurang', 2: 'Cukup', 3: 'Baik', 4: 'Sangat Baik' };
                      return (
                        <button
                          key={skor}
                          type="button"
                          onClick={() => setSkorRubrik({ ...skorRubrik, [item.id]: skor })}
                          className={`px-3 py-1 rounded-xl text-xs font-black transition ${
                            isSelected
                              ? 'bg-indigo-600 text-white shadow-xs'
                              : 'text-slate-500 hover:bg-slate-100'
                          }`}
                          title={skorLabels[skor]}
                        >
                          {skor}
                        </button>
                      );
                    })}
                  </div>
                </div>
              ))}
            </div>
          </div>

          {/* Catatan & Rekomendasi Kepala Sekolah */}
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 pt-2">
            <div>
              <label className="text-xs font-bold text-slate-700">Apresiasi & Keunggulan Guru</label>
              <textarea
                rows={2}
                value={catatanApresiasi}
                onChange={(e) => setCatatanApresiasi(e.target.value)}
                placeholder="Contoh: Sangat komunikatif dalam membangun kedekatan emosional anak di awal KBM..."
                className="w-full mt-1 px-3.5 py-2 rounded-2xl border border-slate-200 text-xs focus:ring-2 focus:ring-indigo-400 focus:outline-none resize-none"
              />
            </div>
            <div>
              <label className="text-xs font-bold text-slate-700">Rekomendasi Pembinaan</label>
              <textarea
                rows={2}
                value={catatanRekomendasi}
                onChange={(e) => setCatatanRekomendasi(e.target.value)}
                placeholder="Contoh: Maksimalkan stimulasi anak yang pasif di sentra balok..."
                className="w-full mt-1 px-3.5 py-2 rounded-2xl border border-slate-200 text-xs focus:ring-2 focus:ring-indigo-400 focus:outline-none resize-none"
              />
            </div>
          </div>

          <div>
            <label className="text-xs font-bold text-slate-700">Rencana Tindak Lanjut Bersama</label>
            <input
              type="text"
              value={tindakLanjut}
              onChange={(e) => setTindakLanjut(e.target.value)}
              placeholder="Contoh: Mengikuti pelatihan pemanfaatan bahan loose parts pada pertemuan KKG berikutnya."
              className="w-full mt-1 px-3.5 py-2 rounded-2xl border border-slate-200 text-xs focus:ring-2 focus:ring-indigo-400 focus:outline-none"
            />
          </div>

          <div className="pt-2 flex items-center justify-end space-x-2 border-t border-slate-100">
            <button
              type="button"
              disabled={saving}
              onClick={() => setFormOpen(false)}
              className="px-4 py-2.5 rounded-2xl border border-slate-200 text-slate-600 hover:bg-slate-50 text-xs font-bold transition"
            >
              Batal
            </button>
            <button
              type="submit"
              disabled={saving}
              className="px-5 py-2.5 rounded-2xl bg-gradient-to-r from-purple-600 to-indigo-600 hover:from-purple-700 hover:to-indigo-700 text-white text-xs font-bold shadow-md shadow-indigo-500/20 transition flex items-center space-x-1.5"
            >
              <CheckCircle2 className="w-4 h-4" />
              <span>{saving ? 'Menyimpan...' : 'Simpan Hasil Supervisi'}</span>
            </button>
          </div>
        </form>
      )}

      {/* Riwayat Dokumen Supervisi */}
      {loading ? (
        <div className="py-16 text-center text-slate-400 space-y-2">
          <div className="w-8 h-8 border-3 border-indigo-600 border-t-transparent rounded-full animate-spin mx-auto" />
          <p className="text-xs font-medium">Memuat riwayat supervisi guru...</p>
        </div>
      ) : supervisiList.length === 0 ? (
        <div className="bg-white rounded-3xl p-10 border border-dashed border-indigo-200 text-center space-y-3">
          <div className="w-14 h-14 rounded-2xl bg-indigo-50 text-indigo-600 flex items-center justify-center mx-auto">
            <ClipboardCheck className="w-7 h-7" />
          </div>
          <h3 className="text-sm font-bold text-slate-700 font-brand">Belum Ada Rekam Supervisi</h3>
          <p className="text-xs text-slate-400 max-w-sm mx-auto leading-relaxed">
            {isKepsek
              ? 'Mulai laksanakan observasi supervisi KBM guru dengan mengklik tombol "Isi Instrumen Supervisi" di atas.'
              : 'Hasil supervisi pembelajaran dari Kepala Sekolah akan tampil di sini setelah evaluasi selesai dilaksanakan.'}
          </p>
        </div>
      ) : (
        <div className="space-y-4">
          {supervisiList.map((item) => {
            const predikatColor = {
              'Sangat Baik': 'bg-emerald-100 text-emerald-800 border-emerald-200',
              'Baik': 'bg-blue-100 text-blue-800 border-blue-200',
              'Cukup': 'bg-amber-100 text-amber-800 border-amber-200',
              'Perlu Pembinaan': 'bg-rose-100 text-rose-800 border-rose-200'
            }[item.predikat] || 'bg-slate-100 text-slate-800 border-slate-200';

            return (
              <div
                key={item.id}
                className="bg-white rounded-3xl p-5 md:p-6 border border-indigo-100/80 shadow-xs hover:shadow-md transition space-y-4"
              >
                {/* Header Kartu Supervisi */}
                <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 border-b border-slate-100 pb-3">
                  <div className="flex items-center space-x-3">
                    <div className="w-10 h-10 rounded-2xl bg-purple-100 text-purple-700 flex items-center justify-center font-bold text-sm">
                      👩‍🏫
                    </div>
                    <div>
                      <h3 className="text-sm font-bold text-slate-800 font-brand">
                        {item.nama_guru} ({item.kelompok_kelas})
                      </h3>
                      <p className="text-xs text-slate-500">
                        Observasi: {formatTanggalIndo(item.tanggal_supervisi)} • Supervisor: {item.nama_kepsek}
                      </p>
                    </div>
                  </div>

                  <div className="flex items-center space-x-2 self-start sm:self-auto">
                    <div className="text-right">
                      <div className="text-sm font-black font-brand text-indigo-900 leading-none">{item.nilai_akhir}/100</div>
                      <div className="text-[10px] text-slate-400 font-bold uppercase mt-0.5">Skor Mutu</div>
                    </div>
                    <span className={`text-xs font-black px-3 py-1 rounded-xl border ${predikatColor}`}>
                      {item.predikat}
                    </span>
                  </div>
                </div>

                {/* Fokus & Rubrik Detail */}
                <div className="space-y-2 text-xs">
                  <div className="text-slate-600">
                    <strong className="text-slate-800">Fokus Observasi:</strong> {item.fokus_observasi}
                  </div>

                  <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 gap-2 pt-1">
                    {RUBRIK_ITEMS.map((r) => (
                      <div key={r.id} className="p-2.5 rounded-xl bg-slate-50 border border-slate-100 text-[11px] flex items-center justify-between">
                        <span className="text-slate-600 truncate max-w-[170px]">{r.label}</span>
                        <span className="font-bold text-indigo-700 px-2 py-0.5 rounded-md bg-indigo-50 border border-indigo-100">
                          Skor {item.skor_rubrik?.[r.id] || 4}
                        </span>
                      </div>
                    ))}
                  </div>
                </div>

                {/* Umpan Balik & Tindak Lanjut */}
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 pt-1 text-xs">
                  {item.catatan_apresiasi && (
                    <div className="p-3 bg-emerald-50/70 border border-emerald-200/50 rounded-2xl text-emerald-950">
                      <strong>🌟 Keunggulan & Apresiasi:</strong>
                      <p className="mt-1 leading-relaxed text-[11px] text-emerald-900">{item.catatan_apresiasi}</p>
                    </div>
                  )}
                  {item.catatan_rekomendasi && (
                    <div className="p-3 bg-amber-50/70 border border-amber-200/50 rounded-2xl text-amber-950">
                      <strong>💡 Rekomendasi Perbaikan:</strong>
                      <p className="mt-1 leading-relaxed text-[11px] text-amber-900">{item.catatan_rekomendasi}</p>
                    </div>
                  )}
                </div>

                {item.tindak_lanjut && (
                  <div className="p-3 bg-indigo-50/60 border border-indigo-200/50 rounded-2xl text-[11px] text-indigo-950 flex items-center space-x-2">
                    <TrendingUp className="w-4 h-4 text-indigo-600 shrink-0" />
                    <span><strong>Tindak Lanjut Pembinaan:</strong> {item.tindak_lanjut}</span>
                  </div>
                )}
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}

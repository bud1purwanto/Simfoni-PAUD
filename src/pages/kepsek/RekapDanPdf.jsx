import React, { useState, useEffect, useMemo } from 'react';
import { 
  FileText, 
  Download, 
  FileSpreadsheet, 
  Share2, 
  Calendar, 
  Users, 
  CheckCircle2, 
  Clock, 
  AlertCircle, 
  Sparkles, 
  Building2, 
  Printer, 
  ExternalLink,
  BookOpen,
  Image as ImageIcon,
  CheckSquare,
  Lock
} from 'lucide-react';
import { collection, query, where, onSnapshot } from 'firebase/firestore';
import { db } from '../../config/firebase';
import { useAuth } from '../../context/AuthContext';
import { exportRingkasPdf, exportLengkapPortofolioPdf } from '../../utils/pdfExporter';
import { exportAttendanceToExcel } from '../../utils/excelExporter';
import { createWhatsAppShareUrl, getLocalDateString } from '../../utils/formatters';
import { hitungHariKerja, hitungMenitTerlambat } from '../../utils/schoolConfig';

const MONTH_NAMES = [
  'Januari', 'Februari', 'Maret', 'April', 'Mei', 'Juni',
  'Juli', 'Agustus', 'September', 'Oktober', 'November', 'Desember'
];

export default function RekapDanPdf() {
  const { userData, schoolData } = useAuth();

  const now = new Date();
  const [selectedMonth, setSelectedMonth] = useState(now.getMonth()); // 0 - 11
  const [selectedYear, setSelectedYear] = useState(now.getFullYear());
  const [selectedTeacherId, setSelectedTeacherId] = useState('all');

  const [teachers, setTeachers] = useState([]);
  const [attendances, setAttendances] = useState([]);
  const [journals, setJournals] = useState([]);
  const [loading, setLoading] = useState(true);
  const [exportingType, setExportingType] = useState(null); // 'ringkas' | 'portofolio' | 'excel' | 'wa'
  const [notification, setNotification] = useState(null);

  // String prefix periode YYYY-MM
  const monthStr = String(selectedMonth + 1).padStart(2, '0');
  const periodeKey = `${selectedYear}-${monthStr}`;
  const namaPeriode = `${MONTH_NAMES[selectedMonth]} ${selectedYear}`;

  const lastDay = new Date(selectedYear, selectedMonth + 1, 0).getDate();
  const periodeStart = `${periodeKey}-01`;
  const periodeEnd = `${periodeKey}-${String(lastDay).padStart(2, '0')}`;

  // 1. Ambil Data Real-Time dari Firestore (hanya periode terpilih agar hemat kuota baca)
  useEffect(() => {
    if (!userData?.school_id) {
      setLoading(false);
      return;
    }

    setLoading(true);

    // Ambil Guru
    const qTeachers = query(
      collection(db, 'users'),
      where('school_id', '==', userData.school_id),
      where('role', '==', 'guru')
    );
    const unsubTeachers = onSnapshot(qTeachers, (snap) => {
      const list = snap.docs.map((d) => ({ id: d.id, ...d.data() }));
      setTeachers(list);
    });

    // Ambil Presensi Sekolah pada periode terpilih
    const qAttendance = query(
      collection(db, 'attendance'),
      where('school_id', '==', userData.school_id),
      where('tanggal', '>=', periodeStart),
      where('tanggal', '<=', periodeEnd)
    );
    const unsubAttendance = onSnapshot(qAttendance, (snap) => {
      const list = snap.docs.map((d) => ({ id: d.id, ...d.data() }));
      setAttendances(list);
    }, (err) => console.warn('Gagal memuat presensi:', err));

    // Ambil Jurnal Mengajar pada periode terpilih
    const qJournals = query(
      collection(db, 'journals'),
      where('school_id', '==', userData.school_id),
      where('tanggal', '>=', periodeStart),
      where('tanggal', '<=', periodeEnd)
    );
    const unsubJournals = onSnapshot(qJournals, (snap) => {
      // Draf belum resmi dilaporkan guru, tidak masuk rekap
      const list = snap.docs
        .map((d) => ({ id: d.id, ...d.data() }))
        .filter((j) => j.status !== 'draf');
      list.sort((a, b) => (a.tanggal || '').localeCompare(b.tanggal || ''));
      setJournals(list);
      setLoading(false);
    }, (err) => {
      console.warn('Gagal memuat jurnal:', err);
      setLoading(false);
    });

    return () => {
      unsubTeachers();
      unsubAttendance();
      unsubJournals();
    };
  }, [userData?.school_id, periodeStart, periodeEnd]);

  const hariKerjaEfektif = hitungHariKerja(periodeKey, schoolData);

  // 2. Filter & Agregasi Data berdasarkan Bulan & Guru Terpilih
  const filteredData = useMemo(() => {
    // Saring presensi bulan ini
    // Izin/sakit yang diajukan untuk tanggal mendatang belum dihitung dalam rekap
    const todayKey = getLocalDateString();
    let monthAttendances = attendances.filter((a) => a.tanggal && a.tanggal.startsWith(periodeKey) && a.tanggal <= todayKey);
    let monthJournals = journals.filter((j) => j.tanggal && j.tanggal.startsWith(periodeKey));

    if (selectedTeacherId !== 'all') {
      monthAttendances = monthAttendances.filter((a) => a.user_id === selectedTeacherId);
      monthJournals = monthJournals.filter((j) => j.user_id === selectedTeacherId);
    }

    // Rekapitulasi per Guru untuk tabel & Excel
    // Guru nonaktif tetap direkap bila memiliki presensi di periode ini (mis. mutasi di tengah bulan)
    const rekapPresensi = teachers
      .filter((t) => (selectedTeacherId === 'all' ? true : t.id === selectedTeacherId))
      .filter((t) => t.status_akun === 'aktif' || monthAttendances.some((a) => a.user_id === t.id))
      .map((t) => {
        const teacherAtts = monthAttendances.filter((a) => a.user_id === t.id);
        const hadir = teacherAtts.filter((a) => a.status === 'hadir').length;
        const terlambatAtts = teacherAtts.filter((a) => a.status === 'terlambat');
        const terlambat = terlambatAtts.length;
        const menitTerlambat = terlambatAtts.reduce(
          (acc, a) => acc + (Number.isFinite(a.menit_terlambat) ? a.menit_terlambat : hitungMenitTerlambat(a.jam_datang_device, schoolData)),
          0
        );
        const izin = teacherAtts.filter((a) => a.status === 'izin').length;
        const sakit = teacherAtts.filter((a) => a.status === 'sakit').length;
        const lupaPulang = teacherAtts.filter((a) => a.status_pulang === 'lupa_absen').length;
        const totalMasuk = hadir + terlambat;

        const persentase = hariKerjaEfektif > 0 ? Math.min(100, Math.round((totalMasuk / hariKerjaEfektif) * 100)) : 0;
        const alpa = Math.max(0, hariKerjaEfektif - totalMasuk - izin - sakit);

        return {
          id: t.id,
          nama: t.nama,
          kelompok: t.kelompok_kelas || '-',
          hadir,
          terlambat,
          menitTerlambat,
          izin,
          sakit,
          alpa,
          lupaPulang,
          totalHari: totalMasuk,
          persentase: `${persentase}%`,
          catatan: persentase >= 90 ? 'Disiplin Tinggi' : persentase >= 75 ? 'Cukup' : 'Perlu Perhatian',
        };
      });

    // Statistik Agregat Keseluruhan
    const totalHadirGlobal = monthAttendances.filter((a) => a.status === 'hadir').length;
    const totalTerlambatGlobal = monthAttendances.filter((a) => a.status === 'terlambat').length;
    const totalIzinGlobal = monthAttendances.filter((a) => a.status === 'izin').length;
    const totalSakitGlobal = monthAttendances.filter((a) => a.status === 'sakit').length;
    const totalJurnalDisetujui = monthJournals.filter((j) => j.status === 'disetujui').length;

    return {
      monthAttendances,
      monthJournals,
      rekapPresensi,
      totalHadirGlobal,
      totalTerlambatGlobal,
      totalIzinGlobal,
      totalSakitGlobal,
      totalJurnalDisetujui,
    };
  }, [attendances, journals, teachers, periodeKey, selectedTeacherId, hariKerjaEfektif, schoolData]);

  // 3. Handler Ekspor PDF Ringkas
  const handleExportRingkasPdf = async () => {
    try {
      setExportingType('ringkas');
      await exportRingkasPdf({
        schoolData: schoolData || {},
        periode: namaPeriode,
        hariKerjaEfektif,
        rekapPresensi: filteredData.rekapPresensi,
        rekapKbm: filteredData.monthJournals.map((j) => ({
          tanggal: j.tanggal,
          nama_guru: j.nama_guru,
          kelompok: j.kelompok,
          topik: j.topik,
          status: j.status,
        })),
      });
    } catch (err) {
      console.error('Error generating Ringkas PDF:', err);
      setNotification({ type: 'error', text: 'Gagal membuat PDF Ringkas: ' + err.message });
    } finally {
      setExportingType(null);
    }
  };

  // 4. Handler Ekspor PDF Portofolio Foto BAN-PDM
  const handleExportPortofolioPdf = async () => {
    try {
      setExportingType('portofolio');
      // Portofolio akreditasi hanya memuat jurnal yang telah divalidasi Kepala Sekolah
      const approvedJournals = filteredData.monthJournals.filter((j) => j.status === 'disetujui');
      if (approvedJournals.length === 0) {
        setNotification({ type: 'warning', text: 'Belum ada jurnal berstatus DISETUJUI pada periode ini untuk dijadikan Portofolio.' });
        return;
      }
      await exportLengkapPortofolioPdf({
        schoolData: schoolData || {},
        periode: namaPeriode,
        journals: approvedJournals,
      });
    } catch (err) {
      console.error('Error generating Portofolio PDF:', err);
      setNotification({ type: 'error', text: 'Gagal membuat Portofolio PDF: ' + err.message });
    } finally {
      setExportingType(null);
    }
  };

  // 5. Handler Ekspor Excel (.xlsx) untuk Honorarium
  const handleExportExcel = () => {
    try {
      setExportingType('excel');
      exportAttendanceToExcel({
        namaSekolah: schoolData?.nama_sekolah || 'SIMFONI PAUD',
        periodeBulan: namaPeriode,
        hariKerjaEfektif,
        rekapData: filteredData.rekapPresensi,
      });
    } catch (err) {
      console.error('Error exporting Excel:', err);
      setNotification({ type: 'error', text: 'Gagal mengunduh Excel: ' + err.message });
    } finally {
      setExportingType(null);
    }
  };

  // 6. Handler Bagikan Ringkasan ke WhatsApp (wa.me)
  const handleShareToWhatsApp = () => {
    const namaSekolah = schoolData?.nama_sekolah || 'PAUD / TK';
    const textMsg = 
      `*REKAPITULASI PEMBELAJARAN & KEHADIRAN PAUD*\n` +
      `🏫 *${namaSekolah}*\n` +
      `📅 Periode: *${namaPeriode}* (${hariKerjaEfektif} hari kerja)\n\n` +
      `📊 *Ringkasan Kehadiran Guru:*\n` +
      `• Hadir Tepat Waktu: ${filteredData.totalHadirGlobal} presensi\n` +
      `• Terlambat: ${filteredData.totalTerlambatGlobal} presensi\n` +
      `• Izin / Sakit: ${filteredData.totalIzinGlobal + filteredData.totalSakitGlobal} hari\n` +
      `• Jurnal KBM Disetujui: ${filteredData.totalJurnalDisetujui} modul\n\n` +
      `_Dibuat secara otomatis melalui Sistem Terintegrasi SIMFONI PAUD._`;

    window.open(createWhatsAppShareUrl(textMsg), '_blank');
  };

  return (
    <div className="space-y-6 pb-20 md:pb-6">
      {notification && (
        <div className={`p-4 rounded-2xl text-xs font-bold flex items-center justify-between animate-fadeIn border ${
          notification.type === 'error' ? 'bg-rose-50 border-rose-200 text-rose-700' : 'bg-amber-50 border-amber-200 text-amber-800'
        }`}>
          <div className="flex items-center space-x-2">
            <AlertCircle className="w-4 h-4 flex-shrink-0" />
            <span>{notification.text}</span>
          </div>
          <button onClick={() => setNotification(null)} className="text-slate-400 hover:text-slate-600 font-bold ml-2">?</button>
        </div>
      )}

      {/* Header Banner */}
      <div className="bg-gradient-to-r from-amber-500 via-orange-500 to-amber-600 rounded-3xl p-6 md:p-8 text-white shadow-lg shadow-orange-500/20 relative overflow-hidden">
        <div className="absolute right-0 top-0 translate-x-8 -translate-y-8 w-48 h-48 bg-white/10 rounded-full blur-2xl pointer-events-none" />
        <div className="relative z-10 flex flex-col md:flex-row md:items-center justify-between gap-4">
          <div>
            <div className="inline-flex items-center space-x-2 px-3 py-1 bg-white/20 backdrop-blur-md rounded-full text-xs font-bold text-amber-100 mb-3">
              <Printer className="w-3.5 h-3.5" />
              <span>Pusat Pelaporan Resmi & Honorarium</span>
            </div>
            <h1 className="text-2xl md:text-3xl font-extrabold font-brand tracking-tight">
              Rekapitulasi & Ekspor Laporan
            </h1>
            <p className="text-amber-100 text-sm mt-1 max-w-xl font-medium">
              Unduh PDF berstempel resmi untuk Pengawas/Yayasan, Portofolio Akreditasi BAN-PDM, dan Spreadsheet Excel honor guru.
            </p>
          </div>

          <div className="flex items-center space-x-2">
            <button
              onClick={handleShareToWhatsApp}
              className="px-4 py-2.5 bg-emerald-500 hover:bg-emerald-600 active:scale-95 text-white font-extrabold text-xs rounded-2xl shadow-sm transition flex items-center space-x-2 font-brand"
            >
              <Share2 className="w-4 h-4 stroke-[2.5]" />
              <span>Bagikan WA</span>
            </button>
          </div>
        </div>
      </div>

      {/* FILTER PERIODE & GURU */}
      <div className="bg-white rounded-3xl p-5 border border-slate-200/80 shadow-sm grid grid-cols-1 md:grid-cols-3 gap-4">
        {/* Pilih Bulan */}
        <div>
          <label className="block text-xs font-bold text-slate-700 mb-1.5 uppercase tracking-wider">
            Bulan Pelaporan
          </label>
          <select
            value={selectedMonth}
            onChange={(e) => setSelectedMonth(Number(e.target.value))}
            className="w-full px-3.5 py-2.5 text-xs font-bold rounded-2xl border border-slate-200 focus:outline-none focus:ring-2 focus:ring-orange-500/20 focus:border-orange-500 bg-slate-50 text-slate-800"
          >
            {MONTH_NAMES.map((name, idx) => (
              <option key={idx} value={idx}>
                {name}
              </option>
            ))}
          </select>
        </div>

        {/* Pilih Tahun */}
        <div>
          <label className="block text-xs font-bold text-slate-700 mb-1.5 uppercase tracking-wider">
            Tahun
          </label>
          <select
            value={selectedYear}
            onChange={(e) => setSelectedYear(Number(e.target.value))}
            className="w-full px-3.5 py-2.5 text-xs font-bold rounded-2xl border border-slate-200 focus:outline-none focus:ring-2 focus:ring-orange-500/20 focus:border-orange-500 bg-slate-50 text-slate-800"
          >
            {[2025, 2026, 2027].map((yr) => (
              <option key={yr} value={yr}>
                Tahun {yr}
              </option>
            ))}
          </select>
        </div>

        {/* Saring Guru */}
        <div>
          <label className="block text-xs font-bold text-slate-700 mb-1.5 uppercase tracking-wider">
            Saring Guru
          </label>
          <select
            value={selectedTeacherId}
            onChange={(e) => setSelectedTeacherId(e.target.value)}
            className="w-full px-3.5 py-2.5 text-xs font-bold rounded-2xl border border-slate-200 focus:outline-none focus:ring-2 focus:ring-orange-500/20 focus:border-orange-500 bg-slate-50 text-slate-800"
          >
            <option value="all">Semua Guru ({teachers.length})</option>
            {teachers.map((t) => (
              <option key={t.id} value={t.id}>
                {t.nama} ({t.kelompok_kelas || 'TK'})
              </option>
            ))}
          </select>
        </div>
      </div>

      {/* METRIK KARTU RINGKASAN */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-3 md:gap-4">
        <div className="bg-white rounded-3xl p-4 md:p-5 border border-slate-200/80 shadow-sm flex items-center space-x-3.5">
          <div className="w-10 h-10 md:w-12 md:h-12 rounded-2xl bg-emerald-100 text-emerald-700 flex items-center justify-center font-bold flex-shrink-0">
            <CheckCircle2 className="w-5 h-5 md:w-6 md:h-6" />
          </div>
          <div>
            <div className="text-xl md:text-2xl font-black text-slate-800 font-brand">
              {filteredData.totalHadirGlobal}
            </div>
            <div className="text-[11px] md:text-xs text-slate-500 font-semibold">
              Presensi Hadir
            </div>
          </div>
        </div>

        <div className="bg-white rounded-3xl p-4 md:p-5 border border-slate-200/80 shadow-sm flex items-center space-x-3.5">
          <div className="w-10 h-10 md:w-12 md:h-12 rounded-2xl bg-amber-100 text-amber-700 flex items-center justify-center font-bold flex-shrink-0">
            <Clock className="w-5 h-5 md:w-6 md:h-6" />
          </div>
          <div>
            <div className="text-xl md:text-2xl font-black text-slate-800 font-brand">
              {filteredData.totalTerlambatGlobal}
            </div>
            <div className="text-[11px] md:text-xs text-slate-500 font-semibold">
              Terlambat
            </div>
          </div>
        </div>

        <div className="bg-white rounded-3xl p-4 md:p-5 border border-slate-200/80 shadow-sm flex items-center space-x-3.5">
          <div className="w-10 h-10 md:w-12 md:h-12 rounded-2xl bg-blue-100 text-blue-700 flex items-center justify-center font-bold flex-shrink-0">
            <BookOpen className="w-5 h-5 md:w-6 md:h-6" />
          </div>
          <div>
            <div className="text-xl md:text-2xl font-black text-slate-800 font-brand">
              {filteredData.totalJurnalDisetujui}
            </div>
            <div className="text-[11px] md:text-xs text-slate-500 font-semibold">
              Jurnal Disetujui
            </div>
          </div>
        </div>

        <div className="bg-white rounded-3xl p-4 md:p-5 border border-slate-200/80 shadow-sm flex items-center space-x-3.5">
          <div className="w-10 h-10 md:w-12 md:h-12 rounded-2xl bg-amber-100 text-amber-700 flex items-center justify-center font-bold flex-shrink-0">
            <Users className="w-5 h-5 md:w-6 md:h-6" />
          </div>
          <div>
            <div className="text-xl md:text-2xl font-black text-slate-800 font-brand">
              {teachers.length}
            </div>
            <div className="text-[11px] md:text-xs text-slate-500 font-semibold">
              Total Guru
            </div>
          </div>
        </div>
      </div>

      {/* KARTU 3 PILIHAN EKSPOR DOKUMEN */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        {/* 1. PDF Ringkas Kop Resmi */}
        <div className="bg-white rounded-3xl p-6 border border-slate-200/80 shadow-sm flex flex-col justify-between hover:border-orange-300 transition group">
          <div>
            <div className="w-12 h-12 rounded-2xl bg-orange-100 text-orange-600 flex items-center justify-center mb-4 group-hover:scale-105 transition">
              <FileText className="w-6 h-6 stroke-[2.5]" />
            </div>
            <span className="px-2.5 py-0.5 rounded-full text-[10px] font-extrabold bg-orange-100 text-orange-700">
              Format Dinas / Pengawas
            </span>
            <h3 className="text-lg font-extrabold text-slate-800 font-brand mt-2">
              PDF Ringkas Kop Resmi
            </h3>
            <p className="text-xs text-slate-500 mt-1 font-medium leading-relaxed">
              Kop surat dinamis, tabel rekapitulasi kehadiran, daftar materi KBM, tanda tangan Kepala Sekolah, dan stempel cap digital sekolah transparan. Sangat ringan (&lt; 500 KB).
            </p>
          </div>

          <button
            onClick={handleExportRingkasPdf}
            disabled={exportingType === 'ringkas'}
            className="mt-6 w-full py-3 px-4 rounded-2xl font-extrabold text-xs text-white bg-gradient-to-r from-amber-500 to-orange-500 hover:from-amber-600 hover:to-orange-600 active:scale-95 shadow-md shadow-orange-500/20 transition flex items-center justify-center space-x-2 font-brand disabled:opacity-50"
          >
            <Download className="w-4 h-4 stroke-[2.5]" />
            <span>{exportingType === 'ringkas' ? 'Membuat PDF...' : 'Unduh PDF Ringkas'}</span>
          </button>
        </div>

        {/* 2. PDF Portofolio Foto BAN-PDM */}
        <div className="bg-white rounded-3xl p-6 border border-slate-200/80 shadow-sm flex flex-col justify-between hover:border-teal-300 transition group">
          <div>
            <div className="w-12 h-12 rounded-2xl bg-teal-100 text-teal-700 flex items-center justify-center mb-4 group-hover:scale-105 transition">
              <ImageIcon className="w-6 h-6 stroke-[2.5]" />
            </div>
            <span className="px-2.5 py-0.5 rounded-full text-[10px] font-extrabold bg-teal-100 text-teal-800">
              Standar Akreditasi
            </span>
            <h3 className="text-lg font-extrabold text-slate-800 font-brand mt-2">
              Portofolio Foto BAN-PDM
            </h3>
            <p className="text-xs text-slate-500 mt-1 font-medium leading-relaxed">
              Dokumen bukti fisik akreditasi PAUD dengan dokumentasi foto kegiatan, pemetaan Capaian Pembelajaran Kurikulum Merdeka, serta refleksi guru.
            </p>
          </div>

          {schoolData?.paket_langganan === 'pro' ? (
            <button
              onClick={handleExportPortofolioPdf}
              disabled={exportingType === 'portofolio' || filteredData.monthJournals.length === 0}
              className="mt-6 w-full py-3 px-4 rounded-2xl font-extrabold text-xs text-white bg-gradient-to-r from-teal-500 to-emerald-600 hover:from-teal-600 hover:to-emerald-700 active:scale-95 shadow-md shadow-teal-500/20 transition flex items-center justify-center space-x-2 font-brand disabled:opacity-50"
            >
              <Download className="w-4 h-4 stroke-[2.5]" />
              <span>{exportingType === 'portofolio' ? 'Menyusun Portofolio...' : 'Unduh Portofolio BAN-PDM'}</span>
            </button>
          ) : (
            <div className="mt-6 p-3 rounded-2xl bg-amber-50/70 border border-amber-200/80 text-center flex flex-col items-center justify-center space-y-1">
              <div className="flex items-center space-x-1.5 text-amber-900 font-extrabold text-xs font-brand">
                <Lock className="w-4 h-4 text-amber-600 stroke-[2.5]" />
                <span>Terkunci (Khusus Paket PRO)</span>
              </div>
              <p className="text-[10px] text-amber-700 font-medium">
                Hubungi Superadmin SIMFONI untuk aktivasi Paket PRO
              </p>
            </div>
          )}
        </div>

        {/* 3. Spreadsheet Excel (.xlsx) untuk Honorarium */}
        <div className="bg-white rounded-3xl p-6 border border-slate-200/80 shadow-sm flex flex-col justify-between hover:border-emerald-300 transition group">
          <div>
            <div className="w-12 h-12 rounded-2xl bg-emerald-100 text-emerald-600 flex items-center justify-center mb-4 group-hover:scale-105 transition">
              <FileSpreadsheet className="w-6 h-6 stroke-[2.5]" />
            </div>
            <span className="px-2.5 py-0.5 rounded-full text-[10px] font-extrabold bg-emerald-100 text-emerald-700">
              Bendahara & Yayasan
            </span>
            <h3 className="text-lg font-extrabold text-slate-800 font-brand mt-2">
              Excel Honorarium (.xlsx)
            </h3>
            <p className="text-xs text-slate-500 mt-1 font-medium leading-relaxed">
              Format lembar sebar kompatibel Microsoft Excel & Google Sheets untuk penghitungan tunjangan, transport kehadiran harian, dan rekap penggajian guru.
            </p>
          </div>

          {schoolData?.paket_langganan === 'pro' ? (
            <button
              onClick={handleExportExcel}
              disabled={exportingType === 'excel'}
              className="mt-6 w-full py-3 px-4 rounded-2xl font-extrabold text-xs text-white bg-gradient-to-r from-emerald-500 to-teal-600 hover:from-emerald-600 hover:to-teal-700 active:scale-95 shadow-md shadow-emerald-500/20 transition flex items-center justify-center space-x-2 font-brand disabled:opacity-50"
            >
              <Download className="w-4 h-4 stroke-[2.5]" />
              <span>{exportingType === 'excel' ? 'Mengolah Excel...' : 'Unduh Excel Honor (.xlsx)'}</span>
            </button>
          ) : (
            <div className="mt-6 p-3 rounded-2xl bg-amber-50/70 border border-amber-200/80 text-center flex flex-col items-center justify-center space-y-1">
              <div className="flex items-center space-x-1.5 text-amber-900 font-extrabold text-xs font-brand">
                <Lock className="w-4 h-4 text-amber-600 stroke-[2.5]" />
                <span>Terkunci (Khusus Paket PRO)</span>
              </div>
              <p className="text-[10px] text-amber-700 font-medium">
                Hubungi Superadmin SIMFONI untuk aktivasi Paket PRO
              </p>
            </div>
          )}
        </div>
      </div>

      {/* TABEL PREVIEW REKAPITULASI KEHADIRAN GURU */}
      <div className="bg-white rounded-3xl border border-slate-200/80 shadow-sm overflow-hidden">
        <div className="p-5 border-b border-slate-100 flex items-center justify-between">
          <div className="flex items-center space-x-2">
            <Users className="w-5 h-5 text-orange-500" />
            <h3 className="font-extrabold text-slate-800 text-base font-brand">
              Preview Rekap Presensi Periode {namaPeriode}
            </h3>
            <span className="hidden sm:inline text-[11px] text-slate-400 font-semibold">({hariKerjaEfektif} hari kerja efektif)</span>
          </div>
          <span className="text-xs text-slate-400 font-bold">
            {filteredData.rekapPresensi.length} Guru
          </span>
        </div>

        <div className="overflow-x-auto">
          <table className="w-full text-left text-xs">
            <thead className="bg-slate-50 text-slate-500 font-bold uppercase tracking-wider border-b border-slate-100">
              <tr>
                <th className="py-3 px-4">Nama Lengkap</th>
                <th className="py-3 px-4">Kelompok</th>
                <th className="py-3 px-4 text-center">Hadir</th>
                <th className="py-3 px-4 text-center">Terlambat</th>
                <th className="py-3 px-4 text-center">Izin</th>
                <th className="py-3 px-4 text-center">Sakit</th>
                <th className="py-3 px-4 text-center">Tanpa Ket.</th>
                <th className="py-3 px-4 text-center">Tingkat Hadir</th>
                <th className="py-3 px-4 text-center">Catatan</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100 font-medium">
              {filteredData.rekapPresensi.length === 0 ? (
                <tr>
                  <td colSpan={9} className="py-8 text-center text-slate-400">
                    Belum ada data guru pada filter ini.
                  </td>
                </tr>
              ) : (
                filteredData.rekapPresensi.map((row) => (
                  <tr key={row.id} className="hover:bg-slate-50/80 transition">
                    <td className="py-3.5 px-4 font-bold text-slate-800">
                      {row.nama}
                    </td>
                    <td className="py-3.5 px-4 text-slate-600">
                      <span className="px-2 py-0.5 rounded-full text-[10px] font-bold bg-amber-50 text-amber-700 border border-amber-200/60">
                        {row.kelompok}
                      </span>
                    </td>
                    <td className="py-3.5 px-4 text-center font-bold text-emerald-600">
                      {row.hadir} hari
                    </td>
                    <td className="py-3.5 px-4 text-center font-bold text-amber-600">
                      {row.terlambat} hari
                      {row.menitTerlambat > 0 && (
                        <span className="block text-[10px] font-semibold text-amber-500">{row.menitTerlambat} menit</span>
                      )}
                    </td>
                    <td className="py-3.5 px-4 text-center text-slate-500">
                      {row.izin} hari
                    </td>
                    <td className="py-3.5 px-4 text-center text-slate-500">
                      {row.sakit} hari
                    </td>
                    <td className="py-3.5 px-4 text-center text-rose-500 font-bold">
                      {row.alpa} hari
                    </td>
                    <td className="py-3.5 px-4 text-center font-extrabold text-slate-700">
                      {row.persentase}
                    </td>
                    <td className="py-3.5 px-4 text-center">
                      <span
                        className={`px-2 py-0.5 rounded-full text-[10px] font-extrabold ${
                          row.catatan === 'Disiplin Tinggi'
                            ? 'bg-emerald-100 text-emerald-800'
                            : row.catatan === 'Cukup'
                            ? 'bg-blue-100 text-blue-800'
                            : 'bg-rose-100 text-rose-800'
                        }`}
                      >
                        {row.catatan}
                      </span>
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}


import React, { useState, useEffect, useMemo } from 'react';
import { createPortal } from 'react-dom';
import { useNavigate } from 'react-router-dom';
import {
  Clock,
  Calendar,
  CheckCircle2,
  AlertTriangle,
  AlertCircle,
  Search,
  Filter,
  MessageCircle,
  ArrowRight,
  Sparkles,
  ChevronLeft,
  ChevronRight,
  Settings,
  FileText,
  UserCheck,
  X,
  Send,
  HelpCircle,
  RefreshCw,
  Info
} from 'lucide-react';
import {
  collection,
  query,
  where,
  onSnapshot,
  doc,
  updateDoc,
  serverTimestamp
} from 'firebase/firestore';
import { db } from '../../config/firebase';
import { useAuth } from '../../context/AuthContext';
import {
  getLocalDateString,
  formatTanggalIndo,
  formatJamMenit,
  getNamaHari
} from '../../utils/formatters';
import {
  getJamMasuk,
  getJamPulang,
  getToleransiMenit,
  getHariKerja,
  hitungStatusKedatangan,
  hitungMenitTerlambat
} from '../../utils/schoolConfig';
import { logActivity } from '../../utils/auditLogger';
import ModalKonfirmasi from '../../components/ui/ModalKonfirmasi';

export default function PresensiGuruKepsek() {
  const navigate = useNavigate();
  const { userData, schoolData } = useAuth();

  const todayStr = getLocalDateString();
  const [selectedDate, setSelectedDate] = useState(todayStr);

  // Firestore Data State
  const [teachers, setTeachers] = useState([]);
  const [attendanceList, setAttendanceList] = useState([]);
  const [pendingCorrections, setPendingCorrections] = useState([]);
  const [loading, setLoading] = useState(true);

  // Filter & Search
  const [statusFilter, setStatusFilter] = useState('semua'); // 'semua' | 'tepat' | 'terlambat' | 'izin_sakit' | 'belum_absen' | 'koreksi'
  const [searchQuery, setSearchQuery] = useState('');

  // Koreksi Modal State
  const [correctionModalOpen, setCorrectionModalOpen] = useState(false);
  const [selectedCorrectionRecord, setSelectedCorrectionRecord] = useState(null);
  const [correctionNote, setCorrectionNote] = useState('');
  const [actionLoading, setActionLoading] = useState(false);

  // Jam Kerja Info Modal State
  const [schoolHoursModalOpen, setSchoolHoursModalOpen] = useState(false);

  // Notification Banner
  const [notification, setNotification] = useState(null);

  // Real-time Firestore Listeners
  useEffect(() => {
    if (!userData?.school_id) return;

    setLoading(true);

    // 1. Data Seluruh Guru di Sekolah Ini
    const qTeachers = query(
      collection(db, 'users'),
      where('school_id', '==', userData.school_id),
      where('role', '==', 'guru')
    );

    const unsubTeachers = onSnapshot(
      qTeachers,
      (snap) => {
        const list = snap.docs.map((d) => ({ id: d.id, ...d.data() }));
        setTeachers(list);
      },
      (err) => console.warn('Gagal memuat guru:', err)
    );

    // 2. Data Presensi pada Tanggal Terpilih
    const qAttendance = query(
      collection(db, 'attendance'),
      where('school_id', '==', userData.school_id),
      where('tanggal', '==', selectedDate)
    );

    const unsubAttendance = onSnapshot(
      qAttendance,
      (snap) => {
        const list = snap.docs.map((d) => ({ id: d.id, ...d.data() }));
        setAttendanceList(list);
        setLoading(false);
      },
      (err) => {
        console.warn('Gagal memuat presensi tanggal terpilih:', err);
        setLoading(false);
      }
    );

    // 3. Antrean Koreksi yang Menunggu Keputusan (Semua tanggal)
    const qCorrections = query(
      collection(db, 'attendance'),
      where('school_id', '==', userData.school_id),
      where('koreksi.status_koreksi', '==', 'menunggu'),
      where('koreksi.diajukan', '==', true)
    );

    const unsubCorrections = onSnapshot(
      qCorrections,
      (snap) => {
        setPendingCorrections(snap.docs.map((d) => ({ id: d.id, ...d.data() })));
      },
      (err) => console.warn('Gagal memuat koreksi:', err)
    );

    return () => {
      unsubTeachers();
      unsubAttendance();
      unsubCorrections();
    };
  }, [userData?.school_id, selectedDate]);

  // Guru Aktif Saja
  const activeTeachers = useMemo(() => {
    return teachers.filter((t) => t.status_akun === 'aktif');
  }, [teachers]);

  // Cek apakah tanggal terpilih adalah hari libur sekolah (5 hari kerja = Sabtu-Minggu libur, 6 hari kerja = Minggu libur)
  const isHariLibur = useMemo(() => {
    const d = new Date(selectedDate);
    const day = d.getDay(); // 0 = Minggu, 6 = Sabtu
    const maxHari = getHariKerja(schoolData);
    if (day === 0) return true;
    if (day === 6 && maxHari === 5) return true;
    return false;
  }, [selectedDate, schoolData]);

  // Deteksi Lewat Jam 18:00
  const isPast1800 = useMemo(() => {
    const now = new Date();
    return now.getHours() >= 18;
  }, []);

  // Map gabungan Guru + Presensi Hari Ini
  const teacherAttendanceMap = useMemo(() => {
    return activeTeachers.map((teacher) => {
      const att = attendanceList.find((a) => a.user_id === teacher.uid);
      const isHadir = att?.status === 'hadir';
      const isTerlambat = att?.status === 'terlambat';
      const isIzinSakit = att?.status === 'izin' || att?.status === 'sakit';
      const isBelumAbsen = !att;

      // Cek Koreksi Khusus untuk presensi ini
      const hasPendingCorrection = att?.koreksi?.diajukan && att?.koreksi?.status_koreksi === 'menunggu';

      // Dual Timestamp discrepancy check
      const serverDate = att?.jam_datang_server?.toDate?.();
      const selisihJamHp =
        serverDate && att?.jam_datang_device
          ? Math.round(
              Number(att.jam_datang_device.slice(0, 2)) * 60 +
                Number(att.jam_datang_device.slice(3, 5)) -
                (serverDate.getHours() * 60 + serverDate.getMinutes())
            )
          : 0;
      const selisihBesar = Math.abs(selisihJamHp) > 15;

      // Status lupa absen pulang
      const isLupaPulang =
        selectedDate === todayStr &&
        isPast1800 &&
        (isHadir || isTerlambat) &&
        !att?.jam_pulang_device;

      return {
        teacher,
        attendance: att,
        isHadir,
        isTerlambat,
        isIzinSakit,
        isBelumAbsen,
        hasPendingCorrection,
        selisihBesar,
        selisihJamHp,
        serverDate,
        isLupaPulang
      };
    });
  }, [activeTeachers, attendanceList, selectedDate, todayStr, isPast1800]);

  // Statistik Agregat untuk Tanggal Terpilih
  const stats = useMemo(() => {
    const total = activeTeachers.length;
    let tepatWaktu = 0;
    let terlambat = 0;
    let izinSakit = 0;
    let belumAbsen = 0;
    let totalKoreksiTanggalIni = 0;
    let totalLupaPulang = 0;

    teacherAttendanceMap.forEach((item) => {
      if (item.isHadir) tepatWaktu++;
      else if (item.isTerlambat) terlambat++;
      else if (item.isIzinSakit) izinSakit++;
      else if (item.isBelumAbsen) belumAbsen++;

      if (item.hasPendingCorrection) totalKoreksiTanggalIni++;
      if (item.isLupaPulang) totalLupaPulang++;
    });

    const persenHadir = total > 0 ? Math.round(((tepatWaktu + terlambat) / total) * 100) : 0;

    return {
      total,
      tepatWaktu,
      terlambat,
      izinSakit,
      belumAbsen,
      persenHadir,
      totalKoreksiTanggalIni,
      totalLupaPulang
    };
  }, [activeTeachers.length, teacherAttendanceMap]);

  // Filter Data Berdasarkan Tab & Search Query
  const filteredTeachers = useMemo(() => {
    return teacherAttendanceMap.filter((item) => {
      // 1. Search Query
      if (searchQuery.trim()) {
        const q = searchQuery.toLowerCase();
        const namaMatch = item.teacher.nama?.toLowerCase().includes(q);
        const rombelMatch = item.teacher.kelompok_kelas?.toLowerCase().includes(q);
        if (!namaMatch && !rombelMatch) return false;
      }

      // 2. Tab Status Filter
      if (statusFilter === 'tepat') return item.isHadir;
      if (statusFilter === 'terlambat') return item.isTerlambat;
      if (statusFilter === 'izin_sakit') return item.isIzinSakit;
      if (statusFilter === 'belum_absen') return item.isBelumAbsen;
      if (statusFilter === 'koreksi') return item.hasPendingCorrection;

      return true;
    });
  }, [teacherAttendanceMap, searchQuery, statusFilter]);

  // Navigasi Tanggal Cepat
  const handleChangeDateBy = (days) => {
    const d = new Date(selectedDate);
    d.setDate(d.getDate() + days);
    setSelectedDate(getLocalDateString(d));
  };

  // Format Pesan WhatsApp Ramah
  const getWhatsAppReminderUrl = (guruNama, tipe = 'belum_absen') => {
    const namaSekolah = schoolData?.nama_sekolah || userData?.nama_sekolah || 'PAUD';
    let text = '';
    if (tipe === 'belum_absen') {
      text = `Halo Bu/Pak ${guruNama}, assalamu'alaikum. Mengingatkan pengisian presensi kedatangan di SIMFONI PAUD (${namaSekolah}) untuk hari ${formatTanggalIndo(selectedDate)}. Semoga harinya menyenangkan! 🙏`;
    } else if (tipe === 'lupa_pulang') {
      text = `Halo Bu/Pak ${guruNama}, assalamu'alaikum. Mengingatkan untuk melakukan presensi pulang di aplikasi SIMFONI PAUD (${namaSekolah}) hari ini. Terima kasih atas dedikasinya hari ini! 🌸`;
    } else {
      text = `Halo Bu/Pak ${guruNama}, assalamu'alaikum. Terkait presensi hari ini di SIMFONI PAUD (${namaSekolah}).`;
    }
    return `https://wa.me/?text=${encodeURIComponent(text)}`;
  };

  // Buka Modal Verifikasi Koreksi
  const handleOpenCorrection = (attRecord) => {
    setSelectedCorrectionRecord(attRecord);
    setCorrectionNote('');
    setCorrectionModalOpen(true);
  };

  // Keputusan Persetujuan / Penolakan Koreksi
  const handleDecisionCorrection = async (isApproved) => {
    if (!selectedCorrectionRecord) return;

    setActionLoading(true);
    try {
      const updatePayload = {
        'koreksi.status_koreksi': isApproved ? 'disetujui' : 'ditolak',
        'koreksi.catatan_kepsek':
          correctionNote.trim() || (isApproved ? 'Disetujui oleh Kepala Sekolah' : 'Ditolak'),
        updated_at: serverTimestamp(),
      };

      // Jika disetujui, update jam kedatangan/pulang resmi dengan jam ajuan
      if (isApproved) {
        const { jam_datang_ajuan: jamDatang, jam_pulang_ajuan: jamPulang } =
          selectedCorrectionRecord.koreksi || {};

        if (jamDatang) {
          updatePayload.jam_datang_device = `${jamDatang.slice(0, 5)}:00`;
          updatePayload.status = hitungStatusKedatangan(jamDatang, schoolData);
          updatePayload.menit_terlambat = hitungMenitTerlambat(jamDatang, schoolData);
        }
        if (jamPulang) {
          updatePayload.jam_pulang_device = `${jamPulang.slice(0, 5)}:00`;
          updatePayload.status_pulang = 'selesai';
        }
      }

      await updateDoc(doc(db, 'attendance', selectedCorrectionRecord.id), updatePayload);

      await logActivity({
        schoolId: userData.school_id,
        actorId: userData.uid,
        actorNama: userData.nama,
        action: isApproved ? 'APPROVE_CORRECTION' : 'REJECT_CORRECTION',
        recordType: 'attendance',
        recordId: selectedCorrectionRecord.id,
      });

      setNotification({
        type: 'success',
        text: `Koreksi presensi guru "${selectedCorrectionRecord.nama_guru}" berhasil ${
          isApproved ? 'disetujui' : 'ditolak'
        }.`,
      });

      setCorrectionModalOpen(false);
      setSelectedCorrectionRecord(null);
    } catch (err) {
      console.error('Gagal memproses koreksi:', err);
      setNotification({
        type: 'error',
        text: 'Gagal memproses koreksi presensi: ' + err.message,
      });
    } finally {
      setActionLoading(false);
    }
  };

  return (
    <div className="space-y-6 max-w-7xl mx-auto pb-16">
      {/* 1. Header & Quick Date Navigator */}
      <div className="bg-gradient-to-r from-amber-500 via-orange-500 to-amber-600 rounded-3xl p-6 md:p-8 text-white shadow-xl shadow-orange-500/15 relative overflow-hidden">
        <div className="absolute -right-8 -bottom-8 w-44 h-44 bg-white/10 rounded-full blur-2xl pointer-events-none" />
        <div className="relative z-10 flex flex-col md:flex-row md:items-center justify-between gap-6">
          <div>
            <div className="inline-flex items-center space-x-2 px-3 py-1 bg-white/20 backdrop-blur-md rounded-xl text-xs font-bold mb-2">
              <Clock className="w-4 h-4" />
              <span>Monitoring Harian Guru</span>
            </div>
            <h1 className="text-2xl md:text-3xl font-black font-brand tracking-tight">
              Presensi & Kehadiran Guru
            </h1>
            <p className="text-orange-100 text-xs md:text-sm mt-1 max-w-xl font-medium leading-relaxed">
              Pantau langsung jam kedatangan, kedisiplinan, catatan izin/sakit, dan verifikasi permohonan koreksi jam guru secara terpusat.
            </p>
          </div>

          {/* Quick Action Navigasi */}
          <div className="flex flex-wrap items-center gap-2">
            <button
              onClick={() => setSchoolHoursModalOpen(true)}
              className="px-3.5 py-2.5 bg-white/15 hover:bg-white/25 backdrop-blur-md text-white rounded-2xl text-xs font-bold transition flex items-center space-x-1.5 border border-white/20 shadow-xs"
            >
              <Settings className="w-4 h-4" />
              <span>Aturan Jam Masuk</span>
            </button>
            <button
              onClick={() => navigate('/kepsek/rekap')}
              className="px-4 py-2.5 bg-white text-orange-800 hover:bg-orange-50 rounded-2xl text-xs font-extrabold transition flex items-center space-x-1.5 shadow-md shadow-orange-950/10"
            >
              <FileText className="w-4 h-4 text-orange-600" />
              <span>Rekap PDF & Excel</span>
            </button>
          </div>
        </div>
      </div>

      {/* 2. Tanggal Operasional Picker Bar */}
      <div className="bg-white rounded-3xl p-4 md:p-5 border border-orange-200/70 shadow-sm flex flex-col md:flex-row md:items-center justify-between gap-4">
        {/* Tombol Panah & Label Tanggal */}
        <div className="flex items-center space-x-2">
          <button
            onClick={() => handleChangeDateBy(-1)}
            title="Hari Sebelumnya"
            className="p-2.5 rounded-2xl bg-orange-50 hover:bg-orange-100 text-orange-800 border border-orange-200 transition"
          >
            <ChevronLeft className="w-4 h-4" />
          </button>

          <div className="px-3 py-1.5 bg-amber-50/70 border border-amber-200/80 rounded-2xl flex items-center space-x-2.5">
            <Calendar className="w-4 h-4 text-orange-600" />
            <div>
              <div className="text-xs font-black text-slate-800 font-brand">
                {formatTanggalIndo(selectedDate)}
              </div>
              <div className="text-[10px] text-slate-500 font-semibold flex items-center space-x-1.5">
                <span>{selectedDate === todayStr ? '⭐ Hari Ini' : getNamaHari(new Date(selectedDate))}</span>
                {isHariLibur && (
                  <span className="px-1.5 py-0.2 bg-rose-100 text-rose-700 rounded-md font-bold text-[9px]">
                    Hari Libur
                  </span>
                )}
              </div>
            </div>
          </div>

          <button
            onClick={() => handleChangeDateBy(1)}
            disabled={selectedDate >= todayStr}
            title="Hari Berikutnya"
            className="p-2.5 rounded-2xl bg-orange-50 hover:bg-orange-100 text-orange-800 border border-orange-200 transition disabled:opacity-30 disabled:cursor-not-allowed"
          >
            <ChevronRight className="w-4 h-4" />
          </button>
        </div>

        {/* Shortcut Chip Hari & Date Input Native */}
        <div className="flex flex-wrap items-center gap-2">
          <button
            onClick={() => setSelectedDate(todayStr)}
            className={`px-3 py-2 rounded-xl text-xs font-extrabold transition ${
              selectedDate === todayStr
                ? 'bg-orange-600 text-white shadow-xs'
                : 'bg-slate-100 text-slate-600 hover:bg-slate-200'
            }`}
          >
            Hari Ini
          </button>
          {(() => {
            const yesterday = new Date();
            yesterday.setDate(yesterday.getDate() - 1);
            const yestStr = getLocalDateString(yesterday);
            return (
              <button
                onClick={() => setSelectedDate(yestStr)}
                className={`px-3 py-2 rounded-xl text-xs font-extrabold transition ${
                  selectedDate === yestStr
                    ? 'bg-orange-600 text-white shadow-xs'
                    : 'bg-slate-100 text-slate-600 hover:bg-slate-200'
                }`}
              >
                Kemarin
              </button>
            );
          })()}

          <div className="flex items-center space-x-1 pl-2 border-l border-slate-200">
            <span className="text-xs text-slate-500 font-semibold hidden sm:inline">Pilih:</span>
            <input
              type="date"
              max={todayStr}
              value={selectedDate}
              onChange={(e) => e.target.value && setSelectedDate(e.target.value)}
              className="px-3 py-1.5 text-xs font-bold text-slate-700 bg-slate-50 border border-slate-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-orange-400"
            />
          </div>
        </div>
      </div>

      {/* Notification Toast */}
      {notification && (
        <div
          className={`p-4 rounded-2xl text-xs font-bold flex items-center justify-between shadow-xs ${
            notification.type === 'success'
              ? 'bg-emerald-50 text-emerald-800 border border-emerald-200'
              : 'bg-rose-50 text-rose-800 border border-rose-200'
          }`}
        >
          <div className="flex items-center space-x-2">
            {notification.type === 'success' ? (
              <CheckCircle2 className="w-4 h-4 text-emerald-600" />
            ) : (
              <AlertCircle className="w-4 h-4 text-rose-600" />
            )}
            <span>{notification.text}</span>
          </div>
          <button
            onClick={() => setNotification(null)}
            className="text-slate-400 hover:text-slate-600"
          >
            <X className="w-4 h-4" />
          </button>
        </div>
      )}

      {/* 3. Ringkasan KPI Kehadiran Tanggal Terpilih */}
      <div className="grid grid-cols-2 md:grid-cols-5 gap-3.5">
        {/* Guru Terdaftar */}
        <div className="bg-white rounded-3xl p-4 border border-orange-200/70 shadow-xs flex flex-col justify-between">
          <div className="flex items-center justify-between">
            <span className="text-[11px] font-extrabold text-slate-500 uppercase tracking-wider font-brand">
              Total Guru
            </span>
            <div className="w-8 h-8 rounded-xl bg-orange-100 text-orange-700 flex items-center justify-center font-bold text-xs">
              <UserCheck className="w-4 h-4" />
            </div>
          </div>
          <div className="mt-3">
            <div className="text-2xl font-black text-slate-900 font-brand">{stats.total}</div>
            <div className="text-[11px] text-slate-500 mt-0.5 font-medium">Guru aktif sekolah</div>
          </div>
        </div>

        {/* Hadir Tepat Waktu */}
        <div className="bg-emerald-50/50 rounded-3xl p-4 border border-emerald-200/80 shadow-xs flex flex-col justify-between">
          <div className="flex items-center justify-between">
            <span className="text-[11px] font-extrabold text-emerald-700 uppercase tracking-wider font-brand">
              Tepat Waktu
            </span>
            <div className="w-8 h-8 rounded-xl bg-emerald-100 text-emerald-800 flex items-center justify-center font-bold text-xs">
              🌸
            </div>
          </div>
          <div className="mt-3">
            <div className="text-2xl font-black text-emerald-950 font-brand">{stats.tepatWaktu}</div>
            <div className="text-[11px] text-emerald-700 mt-0.5 font-semibold">
              {stats.persenHadir}% kehadiran total
            </div>
          </div>
        </div>

        {/* Terlambat */}
        <div className="bg-amber-50/50 rounded-3xl p-4 border border-amber-200/80 shadow-xs flex flex-col justify-between">
          <div className="flex items-center justify-between">
            <span className="text-[11px] font-extrabold text-amber-700 uppercase tracking-wider font-brand">
              Terlambat
            </span>
            <div className="w-8 h-8 rounded-xl bg-amber-100 text-amber-800 flex items-center justify-center font-bold text-xs">
              ⏳
            </div>
          </div>
          <div className="mt-3">
            <div className="text-2xl font-black text-amber-950 font-brand">{stats.terlambat}</div>
            <div className="text-[11px] text-amber-700 mt-0.5 font-medium">
              Lewat toleransi ({getToleransiMenit(schoolData)} mnt)
            </div>
          </div>
        </div>

        {/* Izin & Sakit */}
        <div className="bg-sky-50/50 rounded-3xl p-4 border border-sky-200/80 shadow-xs flex flex-col justify-between">
          <div className="flex items-center justify-between">
            <span className="text-[11px] font-extrabold text-sky-700 uppercase tracking-wider font-brand">
              Izin / Sakit
            </span>
            <div className="w-8 h-8 rounded-xl bg-sky-100 text-sky-800 flex items-center justify-center font-bold text-xs">
              📝
            </div>
          </div>
          <div className="mt-3">
            <div className="text-2xl font-black text-sky-950 font-brand">{stats.izinSakit}</div>
            <div className="text-[11px] text-sky-700 mt-0.5 font-medium">Keterangan resmi</div>
          </div>
        </div>

        {/* Belum Absen */}
        <div className="col-span-2 md:col-span-1 bg-rose-50/40 rounded-3xl p-4 border border-rose-200/70 shadow-xs flex flex-col justify-between">
          <div className="flex items-center justify-between">
            <span className="text-[11px] font-extrabold text-rose-700 uppercase tracking-wider font-brand">
              Belum Absen
            </span>
            <div className="w-8 h-8 rounded-xl bg-rose-100 text-rose-800 flex items-center justify-center font-bold text-xs">
              ❓
            </div>
          </div>
          <div className="mt-3">
            <div className="text-2xl font-black text-rose-950 font-brand">{stats.belumAbsen}</div>
            <div className="text-[11px] text-rose-700 mt-0.5 font-semibold">
              {stats.belumAbsen > 0 ? 'Perlu diingatkan' : 'Semua hadir lengkap'}
            </div>
          </div>
        </div>
      </div>

      {/* 4. Banner Peringatan Lupa Absen Pulang (> 18:00) */}
      {selectedDate === todayStr && stats.totalLupaPulang > 0 && (
        <div className="p-4 md:p-5 rounded-3xl bg-rose-50 border-2 border-rose-200 text-rose-900 shadow-sm flex flex-col sm:flex-row sm:items-center justify-between gap-3">
          <div className="flex items-start space-x-3">
            <div className="w-10 h-10 rounded-2xl bg-rose-100 text-rose-700 flex items-center justify-center font-bold text-lg shrink-0">
              ⚠️
            </div>
            <div>
              <h4 className="font-extrabold text-sm font-brand text-rose-950">
                Peringatan: {stats.totalLupaPulang} Guru Belum Melakukan Absen Pulang
              </h4>
              <p className="text-xs text-rose-700 mt-0.5 leading-relaxed">
                Waktu saat ini sudah melewati pukul 18:00 WIB. Guru-guru ini sudah hadir pagi tadi namun belum menekan tombol presensi pulang. Anda dapat menyapa mereka melalui WhatsApp agar status tidak tertandai lupa absen.
              </p>
            </div>
          </div>
          <a
            href={getWhatsAppReminderUrl('Bapak/Ibu', 'lupa_pulang')}
            target="_blank"
            rel="noopener noreferrer"
            className="px-4 py-2 bg-rose-600 hover:bg-rose-700 text-white rounded-2xl text-xs font-bold transition flex items-center space-x-1.5 self-start sm:self-auto shrink-0 shadow-xs"
          >
            <MessageCircle className="w-4 h-4" />
            <span>Ingatkan via WhatsApp</span>
          </a>
        </div>
      )}

      {/* 5. Filter Tab & Search Controls */}
      <div className="bg-white rounded-3xl p-4 md:p-5 border border-orange-200/70 shadow-sm space-y-4">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
          {/* Status Filter Tabs */}
          <div className="flex flex-wrap items-center gap-1.5">
            <button
              onClick={() => setStatusFilter('semua')}
              className={`px-3.5 py-1.5 rounded-xl text-xs font-extrabold transition ${
                statusFilter === 'semua'
                  ? 'bg-orange-600 text-white shadow-xs'
                  : 'bg-slate-100 text-slate-600 hover:bg-slate-200'
              }`}
            >
              Semua ({stats.total})
            </button>
            <button
              onClick={() => setStatusFilter('tepat')}
              className={`px-3.5 py-1.5 rounded-xl text-xs font-extrabold transition ${
                statusFilter === 'tepat'
                  ? 'bg-emerald-600 text-white shadow-xs'
                  : 'bg-emerald-50 text-emerald-800 hover:bg-emerald-100'
              }`}
            >
              🌸 Tepat Waktu ({stats.tepatWaktu})
            </button>
            <button
              onClick={() => setStatusFilter('terlambat')}
              className={`px-3.5 py-1.5 rounded-xl text-xs font-extrabold transition ${
                statusFilter === 'terlambat'
                  ? 'bg-amber-600 text-white shadow-xs'
                  : 'bg-amber-50 text-amber-800 hover:bg-amber-100'
              }`}
            >
              ⏳ Terlambat ({stats.terlambat})
            </button>
            <button
              onClick={() => setStatusFilter('izin_sakit')}
              className={`px-3.5 py-1.5 rounded-xl text-xs font-extrabold transition ${
                statusFilter === 'izin_sakit'
                  ? 'bg-sky-600 text-white shadow-xs'
                  : 'bg-sky-50 text-sky-800 hover:bg-sky-100'
              }`}
            >
              📝 Izin/Sakit ({stats.izinSakit})
            </button>
            <button
              onClick={() => setStatusFilter('belum_absen')}
              className={`px-3.5 py-1.5 rounded-xl text-xs font-extrabold transition ${
                statusFilter === 'belum_absen'
                  ? 'bg-rose-600 text-white shadow-xs'
                  : 'bg-rose-50 text-rose-800 hover:bg-rose-100'
              }`}
            >
              ❓ Belum Hadir ({stats.belumAbsen})
            </button>
            {stats.totalKoreksiTanggalIni > 0 && (
              <button
                onClick={() => setStatusFilter('koreksi')}
                className={`px-3.5 py-1.5 rounded-xl text-xs font-extrabold transition animate-pulse ${
                  statusFilter === 'koreksi'
                    ? 'bg-purple-600 text-white shadow-xs'
                    : 'bg-purple-100 text-purple-900 border border-purple-300'
                }`}
              >
                ⚡ Ada Koreksi ({stats.totalKoreksiTanggalIni})
              </button>
            )}
          </div>

          {/* Search Bar */}
          <div className="relative w-full sm:w-64">
            <Search className="w-4 h-4 absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
            <input
              type="text"
              placeholder="Cari nama guru / kelas..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="w-full pl-9 pr-4 py-2 bg-slate-50 border border-slate-200 rounded-2xl text-xs font-semibold focus:outline-none focus:ring-2 focus:ring-orange-400"
            />
          </div>
        </div>

        {/* 6. Daftar Kartu Kehadiran Guru */}
        {loading ? (
          <div className="py-16 text-center text-xs text-slate-400">
            <div className="w-9 h-9 border-4 border-orange-500 border-t-transparent rounded-full animate-spin mx-auto mb-3" />
            <span className="font-semibold">Memuat rekapitulasi kehadiran guru...</span>
          </div>
        ) : filteredTeachers.length === 0 ? (
          <div className="py-12 text-center text-xs text-slate-400 bg-slate-50/50 rounded-2xl border border-dashed border-slate-200">
            <UserCheck className="w-8 h-8 text-slate-300 mx-auto mb-2" />
            <p className="font-bold text-slate-600">Tidak ada data guru yang sesuai filter.</p>
            <p className="text-[11px] text-slate-400 mt-0.5">
              Ubah filter status atau kata kunci pencarian Anda.
            </p>
          </div>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4 pt-1">
            {filteredTeachers.map((item) => {
              const {
                teacher,
                attendance: att,
                isHadir,
                isTerlambat,
                isIzinSakit,
                isBelumAbsen,
                hasPendingCorrection,
                selisihBesar,
                selisihJamHp,
                serverDate,
                isLupaPulang
              } = item;

              return (
                <div
                  key={teacher.uid}
                  className={`p-5 rounded-3xl border transition-all space-y-3.5 relative overflow-hidden ${
                    hasPendingCorrection
                      ? 'bg-purple-50/40 border-purple-300 shadow-sm'
                      : isHadir
                      ? 'bg-emerald-50/30 border-emerald-200 hover:border-emerald-300'
                      : isTerlambat
                      ? 'bg-amber-50/40 border-amber-200 hover:border-amber-300'
                      : isIzinSakit
                      ? 'bg-sky-50/40 border-sky-200'
                      : 'bg-slate-50/70 border-slate-200'
                  }`}
                >
                  {/* Header Kartu: Guru & Status Badge */}
                  <div className="flex items-start justify-between gap-3">
                    <div className="flex items-center space-x-3">
                      <div className="w-10 h-10 rounded-2xl bg-gradient-to-tr from-amber-400 to-orange-400 text-white flex items-center justify-center font-black text-sm shrink-0 shadow-xs">
                        {teacher.nama?.charAt(0)?.toUpperCase() || 'G'}
                      </div>
                      <div>
                        <h3 className="text-sm font-extrabold text-slate-900 font-brand flex items-center space-x-1.5">
                          <span>{teacher.nama}</span>
                        </h3>
                        <div className="flex items-center space-x-2 mt-0.5">
                          <span className="px-2 py-0.5 bg-white text-slate-600 rounded-lg text-[10px] font-bold border border-slate-200 shadow-xs">
                            {teacher.kelompok_kelas || 'Semua Kelompok'}
                          </span>
                          <span className="text-[10px] text-slate-400 truncate max-w-[130px]">
                            {teacher.email}
                          </span>
                        </div>
                      </div>
                    </div>

                    {/* Badge Status */}
                    <div className="shrink-0">
                      {isHadir && (
                        <span className="px-3 py-1 bg-emerald-100 text-emerald-800 rounded-xl text-xs font-black border border-emerald-300 inline-flex items-center space-x-1 shadow-xs">
                          <span>🌸</span>
                          <span>Tepat Waktu</span>
                        </span>
                      )}
                      {isTerlambat && (
                        <span className="px-3 py-1 bg-amber-100 text-amber-900 rounded-xl text-xs font-black border border-amber-300 inline-flex items-center space-x-1 shadow-xs">
                          <span>⏳</span>
                          <span>Terlambat {att?.menit_terlambat || ''} mnt</span>
                        </span>
                      )}
                      {isIzinSakit && (
                        <span className="px-3 py-1 bg-sky-100 text-sky-900 rounded-xl text-xs font-black border border-sky-300 uppercase shadow-xs">
                          📝 {att?.status}
                        </span>
                      )}
                      {isBelumAbsen && (
                        <span className="px-3 py-1 bg-rose-100 text-rose-800 rounded-xl text-xs font-bold border border-rose-200 shadow-xs">
                          Belum Absen
                        </span>
                      )}
                    </div>
                  </div>

                  {/* Rincian Waktu & Dual Timestamp */}
                  <div className="p-3 bg-white/80 backdrop-blur-xs rounded-2xl border border-orange-100/80 space-y-2 text-xs">
                    <div className="grid grid-cols-2 gap-2 text-slate-600">
                      <div>
                        <span className="text-[10px] text-slate-400 block font-semibold">JAM DATANG</span>
                        <div className="font-extrabold text-slate-800 flex items-center space-x-1">
                          <Clock className="w-3.5 h-3.5 text-emerald-600" />
                          <span>{att?.jam_datang_device ? formatJamMenit(att.jam_datang_device) : '-'}</span>
                        </div>
                      </div>
                      <div>
                        <span className="text-[10px] text-slate-400 block font-semibold">JAM PULANG</span>
                        <div className="font-extrabold text-slate-800 flex items-center space-x-1">
                          <Clock className="w-3.5 h-3.5 text-orange-600" />
                          <span>{att?.jam_pulang_device ? formatJamMenit(att.jam_pulang_device) : '-'}</span>
                        </div>
                      </div>
                    </div>

                    {/* Catatan Izin / Sakit */}
                    {isIzinSakit && att?.catatan && (
                      <div className="pt-1.5 border-t border-slate-100 text-[11px] text-sky-900 font-medium">
                        <strong>Keterangan:</strong> "{att.catatan}"
                      </div>
                    )}

                    {/* Info Dual Timestamp (Selisih Jam HP & Server) */}
                    {selisihBesar && (
                      <div className="pt-1 border-t border-slate-100 text-[10px] font-semibold text-amber-700 flex items-center space-x-1">
                        <Info className="w-3 h-3 shrink-0" />
                        <span>
                          Diterima server {formatJamMenit(serverDate)} (selisih {Math.abs(selisihJamHp)} menit dari jam HP)
                        </span>
                      </div>
                    )}

                    {/* Deteksi Belum Checkout Pulang */}
                    {isLupaPulang && (
                      <div className="pt-1 border-t border-rose-100 text-[10px] font-bold text-rose-700 flex items-center space-x-1">
                        <AlertTriangle className="w-3 h-3 shrink-0" />
                        <span>Peringatan: Belum presensi pulang (&gt; 18:00)</span>
                      </div>
                    )}
                  </div>

                  {/* Banner Pengajuan Koreksi Jam */}
                  {hasPendingCorrection && (
                    <div className="p-3 bg-purple-50 rounded-2xl border border-purple-200 text-xs space-y-2">
                      <div className="flex items-center justify-between text-purple-900 font-bold">
                        <span className="flex items-center space-x-1">
                          <span>⚡</span>
                          <span>Pengajuan Koreksi Jam Menunggu</span>
                        </span>
                        <span className="text-[10px] bg-purple-200 text-purple-900 px-2 py-0.5 rounded-lg">
                          Perlu Review
                        </span>
                      </div>
                      <div className="text-[11px] text-purple-950 font-medium">
                        Ajuan Datang: <strong>{att.koreksi.jam_datang_ajuan || '-'}</strong> • Ajuan Pulang: <strong>{att.koreksi.jam_pulang_ajuan || '-'}</strong>
                      </div>
                      {att.koreksi.alasan && (
                        <div className="text-[11px] text-purple-800 italic">
                          "{att.koreksi.alasan}"
                        </div>
                      )}
                      <button
                        onClick={() => handleOpenCorrection(att)}
                        className="w-full py-2 bg-purple-600 hover:bg-purple-700 text-white rounded-xl text-xs font-extrabold transition shadow-xs"
                      >
                        Periksa & Putuskan Koreksi
                      </button>
                    </div>
                  )}

                  {/* Riwayat Keputusan Koreksi Sebelumnya */}
                  {att?.koreksi?.status_koreksi && att.koreksi.status_koreksi !== 'menunggu' && (
                    <div className="text-[11px] text-slate-500 bg-slate-50 p-2 rounded-xl border border-slate-200 flex items-center justify-between">
                      <span>Koreksi: <strong className="capitalize">{att.koreksi.status_koreksi}</strong></span>
                      <span className="text-[10px] text-slate-400 italic">"{att.koreksi.catatan_kepsek}"</span>
                    </div>
                  )}

                  {/* Tombol Aksi Cepat Bawah */}
                  <div className="flex items-center justify-between gap-2 pt-1 border-t border-slate-100">
                    {/* Aksi WhatsApp */}
                    {isBelumAbsen ? (
                      <a
                        href={getWhatsAppReminderUrl(teacher.nama, 'belum_absen')}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="flex-1 py-2 px-3 bg-emerald-50 hover:bg-emerald-100 text-emerald-800 rounded-xl text-xs font-extrabold transition flex items-center justify-center space-x-1.5 border border-emerald-200"
                      >
                        <MessageCircle className="w-3.5 h-3.5 text-emerald-600" />
                        <span>Ingatkan Absen (WA)</span>
                      </a>
                    ) : isLupaPulang ? (
                      <a
                        href={getWhatsAppReminderUrl(teacher.nama, 'lupa_pulang')}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="flex-1 py-2 px-3 bg-rose-50 hover:bg-rose-100 text-rose-800 rounded-xl text-xs font-extrabold transition flex items-center justify-center space-x-1.5 border border-rose-200"
                      >
                        <MessageCircle className="w-3.5 h-3.5 text-rose-600" />
                        <span>Ingatkan Pulang (WA)</span>
                      </a>
                    ) : (
                      <a
                        href={getWhatsAppReminderUrl(teacher.nama, 'umum')}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="py-1.5 px-3 bg-slate-100 hover:bg-slate-200 text-slate-700 rounded-xl text-xs font-bold transition flex items-center space-x-1"
                      >
                        <MessageCircle className="w-3.5 h-3.5 text-slate-500" />
                        <span>Kirim Pesan</span>
                      </a>
                    )}

                    {/* Jika guru memiliki presensi namun ingin dikoreksi langsung oleh Kepsek */}
                    {att && !hasPendingCorrection && (
                      <button
                        onClick={() => handleOpenCorrection(att)}
                        className="py-1.5 px-3 bg-orange-50 hover:bg-orange-100 text-orange-800 rounded-xl text-xs font-bold transition border border-orange-200"
                      >
                        Sesuaikan Jam
                      </button>
                    )}
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </div>

      {/* 7. Modal Verifikasi Koreksi Presensi Guru */}
      {correctionModalOpen && selectedCorrectionRecord && createPortal(
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/60 backdrop-blur-xs animate-in fade-in duration-200">
          <div className="bg-white rounded-3xl max-w-lg w-full p-6 space-y-5 border border-orange-200 shadow-2xl relative">
            <div className="flex items-center justify-between border-b border-orange-100 pb-3">
              <div className="flex items-center space-x-2.5">
                <div className="w-9 h-9 rounded-2xl bg-purple-100 text-purple-700 flex items-center justify-center font-bold">
                  ⚡
                </div>
                <div>
                  <h3 className="text-base font-extrabold text-slate-900 font-brand">
                    Verifikasi Koreksi Jam Presensi
                  </h3>
                  <p className="text-xs text-slate-500">
                    Guru: {selectedCorrectionRecord.nama_guru} ({formatTanggalIndo(selectedCorrectionRecord.tanggal)})
                  </p>
                </div>
              </div>
              <button
                onClick={() => setCorrectionModalOpen(false)}
                className="text-slate-400 hover:text-slate-600 p-1 rounded-xl"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            {/* Perbandingan Jam Saat Ini vs Ajuan Guru */}
            <div className="grid grid-cols-2 gap-3 text-xs bg-slate-50 p-4 rounded-2xl border border-slate-200">
              <div className="space-y-1">
                <span className="text-[10px] font-bold text-slate-400 block uppercase">
                  Data Tercatat Saat Ini
                </span>
                <div className="text-slate-700">
                  Datang: <strong>{selectedCorrectionRecord.jam_datang_device ? formatJamMenit(selectedCorrectionRecord.jam_datang_device) : '-'}</strong>
                </div>
                <div className="text-slate-700">
                  Pulang: <strong>{selectedCorrectionRecord.jam_pulang_device ? formatJamMenit(selectedCorrectionRecord.jam_pulang_device) : '-'}</strong>
                </div>
              </div>

              <div className="space-y-1 border-l border-slate-200 pl-3">
                <span className="text-[10px] font-bold text-purple-600 block uppercase">
                  Jam Pengajuan Baru
                </span>
                <div className="text-purple-950 font-bold">
                  Datang: {selectedCorrectionRecord.koreksi?.jam_datang_ajuan || '-'}
                </div>
                <div className="text-purple-950 font-bold">
                  Pulang: {selectedCorrectionRecord.koreksi?.jam_pulang_ajuan || '-'}
                </div>
              </div>
            </div>

            {/* Alasan Guru */}
            {selectedCorrectionRecord.koreksi?.alasan && (
              <div className="p-3 bg-purple-50 rounded-2xl border border-purple-200 text-xs">
                <span className="text-[10px] font-bold text-purple-700 uppercase block mb-1">
                  Alasan dari Guru:
                </span>
                <p className="text-purple-950 italic">
                  "{selectedCorrectionRecord.koreksi.alasan}"
                </p>
              </div>
            )}

            {/* Catatan Tindak Lanjut dari Kepala Sekolah */}
            <div className="space-y-1.5">
              <label className="text-xs font-bold text-slate-700 block">
                Catatan Kepala Sekolah (Opsional):
              </label>
              <textarea
                rows={2}
                placeholder="Contoh: Disetujui setelah konfirmasi kendala sinyal..."
                value={correctionNote}
                onChange={(e) => setCorrectionNote(e.target.value)}
                className="w-full p-3 bg-slate-50 border border-slate-200 rounded-2xl text-xs font-medium focus:outline-none focus:ring-2 focus:ring-orange-400 resize-none"
              />
            </div>

            {/* Tombol Keputusan */}
            <div className="flex items-center space-x-2 pt-2">
              <button
                type="button"
                disabled={actionLoading}
                onClick={() => handleDecisionCorrection(false)}
                className="flex-1 py-2.5 px-4 bg-rose-50 hover:bg-rose-100 text-rose-800 rounded-2xl text-xs font-extrabold transition border border-rose-200 disabled:opacity-50"
              >
                {actionLoading ? 'Memproses...' : 'Tolak Ajuan'}
              </button>
              <button
                type="button"
                disabled={actionLoading}
                onClick={() => handleDecisionCorrection(true)}
                className="flex-1 py-2.5 px-4 bg-gradient-to-r from-emerald-600 to-teal-600 hover:from-emerald-700 hover:to-teal-700 text-white rounded-2xl text-xs font-extrabold transition shadow-md shadow-emerald-600/20 disabled:opacity-50 flex items-center justify-center space-x-1.5"
              >
                {actionLoading && <RefreshCw className="w-3.5 h-3.5 animate-spin" />}
                <span>Setujui Koreksi</span>
              </button>
            </div>
          </div>
        </div>,
        document.body
      )}

      {/* 8. Modal Info Aturan Jam Sekolah */}
      {schoolHoursModalOpen && createPortal(
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/60 backdrop-blur-xs animate-in fade-in duration-200">
          <div className="bg-white rounded-3xl max-w-md w-full p-6 space-y-4 border border-orange-200 shadow-2xl relative">
            <div className="flex items-center justify-between border-b border-orange-100 pb-3">
              <div className="flex items-center space-x-2">
                <Clock className="w-5 h-5 text-orange-600" />
                <h3 className="text-base font-extrabold text-slate-900 font-brand">
                  Aturan Jam Kerja Sekolah
                </h3>
              </div>
              <button
                onClick={() => setSchoolHoursModalOpen(false)}
                className="text-slate-400 hover:text-slate-600 p-1 rounded-xl"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <div className="space-y-3 text-xs">
              <div className="p-3.5 bg-amber-50/70 rounded-2xl border border-amber-200/80 flex items-center justify-between">
                <div>
                  <span className="text-[10px] text-amber-700 font-bold block uppercase">Jam Masuk Sekolah</span>
                  <span className="text-base font-black text-amber-950 font-brand">
                    {getJamMasuk(schoolData)} WIB
                  </span>
                </div>
                <div className="text-right">
                  <span className="text-[10px] text-amber-700 font-bold block uppercase">Toleransi Keterlambatan</span>
                  <span className="text-base font-black text-amber-950 font-brand">
                    {getToleransiMenit(schoolData)} Menit
                  </span>
                </div>
              </div>

              <div className="p-3.5 bg-slate-50 rounded-2xl border border-slate-200 flex items-center justify-between">
                <div>
                  <span className="text-[10px] text-slate-500 font-bold block uppercase">Jam Pulang Resmi</span>
                  <span className="text-base font-black text-slate-900 font-brand">
                    {getJamPulang(schoolData)} WIB
                  </span>
                </div>
                <div className="text-right">
                  <span className="text-[10px] text-slate-500 font-bold block uppercase">Hari Kerja Efektif</span>
                  <span className="text-base font-black text-slate-900 font-brand">
                    {getHariKerja(schoolData)} Hari / Minggu
                  </span>
                </div>
              </div>

              <p className="text-[11px] text-slate-500 leading-relaxed bg-orange-50/50 p-3 rounded-xl border border-orange-100">
                ℹ️ Parameter jam kerja ini dikonfigurasi saat pendaftaran tenant sekolah oleh Superadmin. Status keterlambatan dihitung otomatis jika guru melakukan absen lewat dari jam masuk ditambah toleransi.
              </p>
            </div>

            <button
              onClick={() => setSchoolHoursModalOpen(false)}
              className="w-full py-2.5 bg-slate-100 hover:bg-slate-200 text-slate-800 rounded-2xl text-xs font-bold transition"
            >
              Tutup
            </button>
          </div>
        </div>,
        document.body
      )}
    </div>
  );
}

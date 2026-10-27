import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { 
  Users, 
  Clock, 
  CheckSquare, 
  AlertTriangle, 
  FileText, 
  Calendar, 
  ArrowRight, 
  CheckCircle2, 
  AlertCircle,
  Sparkles,
  ShieldCheck,
  Building2,
  TrendingUp,
  UserCheck
} from 'lucide-react';
import { collection, query, where, onSnapshot, getDocs } from 'firebase/firestore';
import { db } from '../../config/firebase';
import { useAuth } from '../../context/AuthContext';
import { formatTanggalIndo, formatJamMenit, getLocalDateString } from '../../utils/formatters';

export default function DashboardKepsek() {
  const { userData, schoolData } = useAuth();
  const navigate = useNavigate();

  const [teachers, setTeachers] = useState([]);
  const [todayAttendance, setTodayAttendance] = useState([]);
  const [pendingJournals, setPendingJournals] = useState([]);
  const [pendingCorrections, setPendingCorrections] = useState([]);
  const [pendingIssues, setPendingIssues] = useState([]);
  const [loading, setLoading] = useState(true);

  const todayStr = getLocalDateString();
  const now = new Date();
  const isAfter18 = now.getHours() >= 18;

  useEffect(() => {
    if (!userData?.school_id) {
      setLoading(false);
      return;
    }

    setLoading(true);

    // 1. Ambil Semua Akun Guru di Sekolah Ini
    const qTeachers = query(
      collection(db, 'users'),
      where('school_id', '==', userData.school_id),
      where('role', '==', 'guru')
    );

    const unsubTeachers = onSnapshot(qTeachers, (snap) => {
      const list = snap.docs.map((d) => ({ id: d.id, ...d.data() }));
      setTeachers(list);
    });

    // 2. Ambil Presensi Hari Ini
    const qAttendance = query(
      collection(db, 'attendance'),
      where('school_id', '==', userData.school_id),
      where('tanggal', '==', todayStr)
    );

    const unsubAttendance = onSnapshot(qAttendance, (snap) => {
      const list = snap.docs.map((d) => ({ id: d.id, ...d.data() }));
      setTodayAttendance(list);
    });

    // 2b. Pengajuan koreksi presensi yang menunggu keputusan (semua tanggal, bukan hanya hari ini)
    const qCorrections = query(
      collection(db, 'attendance'),
      where('school_id', '==', userData.school_id),
      where('koreksi.status_koreksi', '==', 'menunggu'),
      where('koreksi.diajukan', '==', true)
    );

    const unsubCorrections = onSnapshot(
      qCorrections,
      (snap) => setPendingCorrections(snap.docs.map((d) => ({ id: d.id, ...d.data() }))),
      (err) => console.warn('Gagal memuat antrean koreksi:', err)
    );

    // 3. Ambil Antrean Jurnal KBM yang Perlu Direview ('dikirim')
    const qJournals = query(
      collection(db, 'journals'),
      where('school_id', '==', userData.school_id),
      where('status', '==', 'dikirim')
    );

    const unsubJournals = onSnapshot(qJournals, (snap) => {
      const list = snap.docs.map((d) => ({ id: d.id, ...d.data() }));
      setPendingJournals(list);
    });

    // 4. Ambil Laporan Kendala Sarpras ('laporan_kendala' & status 'dilaporkan')
    const qIssues = query(
      collection(db, 'tasks_and_issues'),
      where('school_id', '==', userData.school_id),
      where('kategori', '==', 'laporan_kendala'),
      where('status', '==', 'dilaporkan')
    );

    const unsubIssues = onSnapshot(
      qIssues,
      (snap) => {
        const list = snap.docs.map((d) => ({ id: d.id, ...d.data() }));
        setPendingIssues(list);
        setLoading(false);
      },
      (err) => {
        console.warn('Gagal memuat laporan kendala:', err);
        setLoading(false);
      }
    );

    return () => {
      unsubTeachers();
      unsubAttendance();
      unsubCorrections();
      unsubJournals();
      unsubIssues();
    };
  }, [userData?.school_id, todayStr]);

  // Statistik Agregat
  const activeTeachers = teachers.filter((t) => t.status_akun === 'aktif');
  const kuotaGuru = schoolData?.kuota_guru || 5;
  const kuotaTerpakai = activeTeachers.length;

  // Hanya hitung presensi milik guru aktif (bukan presensi Kepsek sendiri / guru nonaktif)
  const activeTeacherIds = new Set(activeTeachers.map((t) => t.id));
  const teacherAttendance = todayAttendance.filter((a) => activeTeacherIds.has(a.user_id));
  const hadirCount = teacherAttendance.filter((a) => a.status === 'hadir').length;
  const terlambatCount = teacherAttendance.filter((a) => a.status === 'terlambat').length;
  const izinSakitCount = teacherAttendance.filter((a) => a.status === 'izin' || a.status === 'sakit').length;
  const belumAbsenCount = Math.max(0, activeTeachers.length - teacherAttendance.length);

  // Deteksi Lupa Absen Pulang (Sudah masuk tapi belum checkout setelah jam 18:00)
  const lupaPulangList = teacherAttendance.filter(
    (a) => ['hadir', 'terlambat'].includes(a.status) && a.jam_datang_device && !a.jam_pulang_device && isAfter18
  );

  return (
    <div className="space-y-6 max-w-6xl mx-auto pb-12">
      
      {/* 1. Header Salam & Identitas Sekolah */}
      <div className="bg-gradient-to-r from-amber-500 via-orange-400 to-amber-600 rounded-3xl p-6 md:p-8 text-white shadow-xl shadow-orange-500/15 relative overflow-hidden">
        <div className="absolute right-2 -bottom-4 opacity-20 text-8xl md:text-9xl pointer-events-none select-none font-brand">
          🏫
        </div>
        <div className="relative z-10 max-w-2xl">
          <div className="inline-flex items-center space-x-2 px-3.5 py-1 bg-white/20 backdrop-blur-md rounded-full text-xs font-bold mb-3 border border-white/20">
            <Building2 className="w-3.5 h-3.5 text-amber-200" />
            <span>Portal Monitoring Kepala Sekolah</span>
            <span>•</span>
            <span>{formatTanggalIndo(new Date())}</span>
          </div>

          <h1 className="text-2xl md:text-3xl font-extrabold tracking-tight font-brand">
            Selamat Datang, {userData?.nama || 'Kepala Sekolah'}! 🌸
          </h1>
          <p className="text-xs md:text-sm text-amber-50 mt-1.5 leading-relaxed font-medium">
            Monitoring aktivitas harian guru, review jurnal KBM Kurikulum Merdeka, dan pengelolaan administrasi di <strong>{schoolData?.nama_sekolah || 'sekolah Anda'}</strong>.
          </p>
        </div>
      </div>

      {/* 2. Kartu Metrik Cepat (4 Kolom Responsif) */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3.5 md:gap-4">
        
        {/* Kuota Guru Sekolah */}
        <div className="bg-white rounded-3xl p-5 border border-orange-200/80 shadow-xs flex flex-col justify-between">
          <div className="flex items-center justify-between">
            <span className="text-[11px] font-extrabold text-orange-400 uppercase tracking-wider font-brand">
              Kuota Guru
            </span>
            <div className="w-8 h-8 rounded-xl bg-orange-100 text-orange-700 flex items-center justify-center font-bold">
              <Users className="w-4 h-4" />
            </div>
          </div>
          <div className="mt-2">
            <div className="text-2xl font-black text-slate-800 font-brand">
              {kuotaTerpakai} <span className="text-sm text-slate-400 font-semibold">/ {kuotaGuru}</span>
            </div>
            <p className="text-[11px] text-slate-500 mt-0.5">
              {kuotaTerpakai >= kuotaGuru ? '⚠️ Kuota Penuh' : `${kuotaGuru - kuotaTerpakai} slot tersedia`}
            </p>
          </div>
        </div>

        {/* Kehadiran Guru Hari Ini */}
        <div className="bg-white rounded-3xl p-5 border border-emerald-200/80 shadow-xs flex flex-col justify-between">
          <div className="flex items-center justify-between">
            <span className="text-[11px] font-extrabold text-emerald-600 uppercase tracking-wider font-brand">
              Hadir Hari Ini
            </span>
            <div className="w-8 h-8 rounded-xl bg-emerald-100 text-emerald-700 flex items-center justify-center font-bold">
              <UserCheck className="w-4 h-4" />
            </div>
          </div>
          <div className="mt-2">
            <div className="text-2xl font-black text-emerald-950 font-brand">
              {hadirCount + terlambatCount} <span className="text-sm text-slate-400 font-semibold">/ {activeTeachers.length} Guru</span>
            </div>
            <p className="text-[11px] text-emerald-700 mt-0.5 font-medium">
              {hadirCount} tepat waktu, {terlambatCount} terlambat{izinSakitCount > 0 ? `, ${izinSakitCount} izin/sakit` : ''}
            </p>
          </div>
        </div>

        {/* Antrean Validasi Jurnal */}
        <div 
          onClick={() => navigate('/kepsek/validasi')}
          className="bg-white rounded-3xl p-5 border border-blue-200/80 shadow-xs flex flex-col justify-between cursor-pointer hover:shadow-md transition group"
        >
          <div className="flex items-center justify-between">
            <span className="text-[11px] font-extrabold text-blue-600 uppercase tracking-wider font-brand">
              Antrean Jurnal
            </span>
            <div className="w-8 h-8 rounded-xl bg-blue-100 text-blue-700 flex items-center justify-center font-bold group-hover:scale-110 transition">
              <CheckSquare className="w-4 h-4" />
            </div>
          </div>
          <div className="mt-2">
            <div className="text-2xl font-black text-blue-950 font-brand">
              {pendingJournals.length} <span className="text-xs text-blue-600 font-semibold">Laporan</span>
            </div>
            <p className="text-[11px] text-blue-700 mt-0.5 flex items-center space-x-1 font-semibold">
              <span>Perlu diperiksa</span>
              <ArrowRight className="w-3 h-3 group-hover:translate-x-1 transition" />
            </p>
          </div>
        </div>

        {/* Notifikasi Kendala & Koreksi */}
        <div className="bg-white rounded-3xl p-5 border border-amber-200/80 shadow-xs flex flex-col justify-between">
          <div className="flex items-center justify-between">
            <span className="text-[11px] font-extrabold text-amber-600 uppercase tracking-wider font-brand">
              Perlu Tindakan
            </span>
            <div className="w-8 h-8 rounded-xl bg-amber-100 text-amber-700 flex items-center justify-center font-bold">
              <AlertTriangle className="w-4 h-4" />
            </div>
          </div>
          <div className="mt-2">
            <div className="text-2xl font-black text-amber-950 font-brand">
              {pendingCorrections.length + pendingIssues.length} <span className="text-xs text-amber-700 font-semibold">Item</span>
            </div>
            <p className="text-[11px] text-amber-800 mt-0.5 font-medium">
              {pendingCorrections.length} koreksi absen, {pendingIssues.length} kendala
            </p>
          </div>
        </div>

      </div>

      <button
        onClick={() => navigate('/kepsek/riwayat')}
        className="md:hidden w-full p-3.5 rounded-2xl bg-white border border-orange-200/70 text-xs font-extrabold text-orange-800 flex items-center justify-between shadow-xs"
      >
        <span>🕘 Riwayat Aktivitas Sekolah</span>
        <ArrowRight className="w-4 h-4" />
      </button>

      {/* 3. Banner Notifikasi Spesial: Deteksi Lupa Absen Pulang */}
      {lupaPulangList.length > 0 && (
        <div className="p-4 rounded-3xl bg-rose-50 border-2 border-rose-200 text-rose-800 shadow-xs flex items-start space-x-3">
          <div className="w-9 h-9 rounded-2xl bg-rose-100 text-rose-700 flex items-center justify-center font-bold shrink-0 mt-0.5">
            ⚠️
          </div>
          <div className="space-y-1">
            <h4 className="font-extrabold text-sm text-rose-900 font-brand">
              Deteksi Lupa Absen Pulang ({lupaPulangList.length} Guru)
            </h4>
            <p className="text-xs text-rose-700 leading-relaxed">
              Waktu saat ini telah melewati pukul 18:00 WIB. Guru berikut tercatat sudah hadir pagi ini namun belum melakukan *checkout* presensi pulang:
            </p>
            <div className="flex flex-wrap gap-2 pt-1">
              {lupaPulangList.map((g) => (
                <span key={g.id} className="px-3 py-1 bg-white rounded-xl text-xs font-bold text-rose-800 border border-rose-200 shadow-xs">
                  {g.nama_guru} (Masuk {formatJamMenit(g.jam_datang_device)})
                </span>
              ))}
            </div>
          </div>
        </div>
      )}

      {/* 4. Monitoring Live Kehadiran Guru Hari Ini */}
      <div className="bg-white rounded-3xl p-6 border border-orange-200/70 shadow-sm space-y-4">
        <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3 border-b border-orange-100 pb-4">
          <div>
            <h3 className="text-base font-extrabold text-slate-900 font-brand flex items-center space-x-2">
              <span>📋</span>
              <span>Pantauan Langsung Kehadiran Guru Hari Ini</span>
            </h3>
            <p className="text-xs text-slate-500 mt-0.5">
              Live status jam datang, jam pulang, dan catatan waktu lokal perangkat
            </p>
          </div>

          <div className="flex items-center space-x-2">
            <button
              onClick={() => navigate('/kepsek/guru')}
              className="px-4 py-2 bg-amber-50 hover:bg-amber-100 text-amber-900 rounded-2xl text-xs font-bold transition border border-amber-200"
            >
              Kelola Daftar Guru
            </button>
            <button
              onClick={() => navigate('/kepsek/rekap')}
              className="px-4 py-2 bg-gradient-to-r from-amber-500 to-orange-500 hover:from-amber-600 hover:to-orange-600 text-white rounded-2xl text-xs font-extrabold transition shadow-md shadow-orange-500/20"
            >
              Ekspor Laporan PDF/Excel
            </button>
          </div>
        </div>

        {/* Tabel Kehadiran Guru Hari Ini */}
        {loading ? (
          <div className="p-12 text-center text-xs text-slate-400">
            <div className="w-8 h-8 border-4 border-orange-500 border-t-transparent rounded-full animate-spin mx-auto mb-2" />
            Memuat data kehadiran...
          </div>
        ) : activeTeachers.length === 0 ? (
          <div className="p-8 text-center text-xs text-slate-400">
            Belum ada guru yang didaftarkan pada sekolah ini.
          </div>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 gap-3.5">
            {activeTeachers.map((teacher) => {
              const att = todayAttendance.find((a) => a.user_id === teacher.uid);
              const isHadir = att?.status === 'hadir';
              const isTerlambat = att?.status === 'terlambat';
              const isBelumAbsen = !att;
              const isIzinSakit = att?.status === 'izin' || att?.status === 'sakit';
              // Dual Timestamp: selisih besar antara jam HP dan jam server bisa berarti sinkron
              // tertunda (sinyal lemah) ATAU jam HP diubah. Ditampilkan netral sebagai bahan pertimbangan.
              const serverDate = att?.jam_datang_server?.toDate?.();
              const selisihJamHp = serverDate && att?.jam_datang_device
                ? Math.round(((Number(att.jam_datang_device.slice(0, 2)) * 60 + Number(att.jam_datang_device.slice(3, 5)))
                    - (serverDate.getHours() * 60 + serverDate.getMinutes())))
                : 0;
              const selisihBesar = Math.abs(selisihJamHp) > 15;

              return (
                <div
                  key={teacher.uid}
                  className={`p-4 rounded-2xl border transition-all flex items-center justify-between ${
                    isHadir
                      ? 'bg-emerald-50/40 border-emerald-200/80'
                      : isTerlambat
                      ? 'bg-amber-50/40 border-amber-200/80'
                      : 'bg-slate-50/60 border-slate-200'
                  }`}
                >
                  <div className="space-y-1">
                    <div className="flex items-center space-x-2">
                      <span className="text-xs font-extrabold text-slate-800 font-brand">
                        {teacher.nama}
                      </span>
                      <span className="px-2 py-0.5 bg-white text-slate-600 rounded-lg text-[10px] font-bold border border-slate-200">
                        {teacher.kelompok_kelas || 'TK'}
                      </span>
                    </div>

                    <div className="text-[11px] text-slate-500 flex items-center space-x-3">
                      <span>Datang: <strong className="text-slate-700">{att?.jam_datang_device ? formatJamMenit(att.jam_datang_device) : '-'}</strong></span>
                      <span>•</span>
                      <span>Pulang: <strong className="text-slate-700">{att?.jam_pulang_device ? formatJamMenit(att.jam_pulang_device) : '-'}</strong></span>
                    </div>
                    {selisihBesar && (
                      <div className="text-[10px] font-semibold text-amber-700" title="Selisih jam HP saat tombol ditekan dengan jam diterima server">
                        ℹ️ Diterima server {formatJamMenit(serverDate)} (selisih {Math.abs(selisihJamHp)} menit dari jam HP)
                      </div>
                    )}
                  </div>

                  <div>
                    {isHadir && (
                      <span className="px-3 py-1 bg-emerald-100 text-emerald-800 rounded-xl text-xs font-extrabold border border-emerald-300 flex items-center space-x-1">
                        <span>🌸</span>
                        <span>Tepat Waktu</span>
                      </span>
                    )}
                    {isTerlambat && (
                      <span className="px-3 py-1 bg-amber-100 text-amber-800 rounded-xl text-xs font-extrabold border border-amber-300 flex items-center space-x-1">
                        <span>⏳</span>
                        <span>Terlambat</span>
                      </span>
                    )}
                    {isIzinSakit && (
                      <span title={att.catatan || ''} className="px-3 py-1 bg-sky-50 text-sky-800 rounded-xl text-xs font-extrabold border border-sky-200 capitalize">
                        📝 {att.status}
                      </span>
                    )}
                    {isBelumAbsen && (
                      <span className="px-3 py-1 bg-slate-100 text-slate-600 rounded-xl text-xs font-bold border border-slate-200">
                        Belum Absen
                      </span>
                    )}
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </div>

      {/* 5. Aksi Cepat Validasi Jurnal & Tindak Lanjut */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        
        {/* Antrean Review Jurnal KBM */}
        <div className="bg-white rounded-3xl p-6 border border-orange-200/70 shadow-sm space-y-3">
          <div className="flex items-center justify-between border-b border-orange-100 pb-3">
            <div className="flex items-center space-x-2.5">
              <span className="text-lg">📖</span>
              <h4 className="text-sm font-extrabold text-slate-800 font-brand">
                Antrean Jurnal Mengajar ({pendingJournals.length})
              </h4>
            </div>
            <button
              onClick={() => navigate('/kepsek/validasi')}
              className="text-xs text-orange-600 hover:text-orange-800 font-extrabold flex items-center space-x-1"
            >
              <span>Review Semua</span>
              <ArrowRight className="w-3.5 h-3.5" />
            </button>
          </div>

          {pendingJournals.length > 0 ? (
            <div className="space-y-2">
              {pendingJournals.slice(0, 3).map((j) => (
                <div key={j.id} className="p-3 bg-amber-50/50 rounded-2xl border border-amber-200/60 text-xs flex items-center justify-between">
                  <div>
                    <span className="font-extrabold text-slate-800 block">{j.nama_guru}</span>
                    <span className="text-[11px] text-slate-500">"{j.topik}" • Kelompok {j.kelompok}</span>
                  </div>
                  <button
                    onClick={() => navigate('/kepsek/validasi')}
                    className="px-3 py-1.5 bg-orange-500 text-white rounded-xl text-[11px] font-bold shadow-xs hover:bg-orange-600"
                  >
                    Periksa
                  </button>
                </div>
              ))}
            </div>
          ) : (
            <div className="py-6 text-center text-xs text-slate-400">
              ✅ Seluruh jurnal yang dikirim telah selesai divalidasi.
            </div>
          )}
        </div>

        {/* Pengajuan Koreksi Jam Absen */}
        <div className="bg-white rounded-3xl p-6 border border-orange-200/70 shadow-sm space-y-3">
          <div className="flex items-center justify-between border-b border-orange-100 pb-3">
            <div className="flex items-center space-x-2.5">
              <span className="text-lg">⏰</span>
              <h4 className="text-sm font-extrabold text-slate-800 font-brand">
                Pengajuan Koreksi Absen ({pendingCorrections.length})
              </h4>
            </div>
            <button
              onClick={() => navigate('/kepsek/validasi')}
              className="text-xs text-orange-600 hover:text-orange-800 font-extrabold flex items-center space-x-1"
            >
              <span>Buka Menu</span>
              <ArrowRight className="w-3.5 h-3.5" />
            </button>
          </div>

          {pendingCorrections.length > 0 ? (
            <div className="space-y-2">
              {pendingCorrections.slice(0, 3).map((c) => (
                <div key={c.id} className="p-3 bg-rose-50/50 rounded-2xl border border-rose-200/60 text-xs flex items-center justify-between">
                  <div>
                    <span className="font-extrabold text-slate-800 block">{c.nama_guru}</span>
                    <span className="text-[11px] text-rose-700">Alasan: {c.koreksi?.alasan || '-'}</span>
                  </div>
                  <button
                    onClick={() => navigate('/kepsek/validasi')}
                    className="px-3 py-1.5 bg-rose-600 text-white rounded-xl text-[11px] font-bold shadow-xs hover:bg-rose-700"
                  >
                    Tanggapi
                  </button>
                </div>
              ))}
            </div>
          ) : (
            <div className="py-6 text-center text-xs text-slate-400">
              ✅ Tidak ada pengajuan koreksi presensi yang tertunda.
            </div>
          )}
        </div>

      </div>

    </div>
  );
}


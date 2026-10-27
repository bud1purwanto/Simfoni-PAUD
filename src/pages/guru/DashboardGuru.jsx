import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import {
  Clock,
  BookOpen,
  Calendar,
  AlertCircle,
  CheckCircle2,
  ArrowRight,
  Sun,
  AlertTriangle,
  FileEdit,
  Send,
  Coffee
} from 'lucide-react';
import { doc, getDoc, setDoc, updateDoc, serverTimestamp, collection, query, where, getDocs, limit } from 'firebase/firestore';
import { db } from '../../config/firebase';
import { useAuth } from '../../context/AuthContext';
import { formatTanggalIndo, formatJamMenit } from '../../utils/formatters';
import { logActivity } from '../../utils/auditLogger';

export default function DashboardGuru() {
  const { userData, schoolData } = useAuth();
  const navigate = useNavigate();

  const [todayAttendance, setTodayAttendance] = useState(null);
  const [todayJournal, setTodayJournal] = useState(null);
  const [todaySchedule, setTodaySchedule] = useState([]);
  const [loading, setLoading] = useState(true);
  const [actionLoading, setActionLoading] = useState(false);
  const [msg, setMsg] = useState(null);

  const todayStr = new Date().toISOString().split('T')[0];
  const daysIndo = ['Minggu', 'Senin', 'Selasa', 'Rabu', 'Kamis', 'Jumat', 'Sabtu'];
  const todayDayName = daysIndo[new Date().getDay()];

  // Fetch data harian guru
  useEffect(() => {
    let isMounted = true;

    const fetchDashboardData = async () => {
      if (!userData?.uid || !userData?.school_id) return;

      try {
        setLoading(true);

        // 1. Ambil Presensi Hari Ini
        const attendanceDocId = `${userData.school_id}_${todayStr}_${userData.uid}`;
        const attSnap = await getDoc(doc(db, 'attendance', attendanceDocId));
        if (isMounted && attSnap.exists()) {
          setTodayAttendance(attSnap.data());
        }

        // 2. Ambil Jurnal Hari Ini
        const qJournal = query(
          collection(db, 'journals'),
          where('school_id', '==', userData.school_id),
          where('user_id', '==', userData.uid),
          where('tanggal', '==', todayStr),
          limit(1)
        );
        const journalSnap = await getDocs(qJournal);
        if (isMounted && !journalSnap.empty) {
          setTodayJournal({ id: journalSnap.docs[0].id, ...journalSnap.docs[0].data() });
        }

        // 3. Ambil Jadwal KBM Hari Ini
        const qSchedule = query(
          collection(db, 'schedules'),
          where('school_id', '==', userData.school_id),
          where('hari', '==', todayDayName)
        );
        const schedSnap = await getDocs(qSchedule);
        if (isMounted) {
          const scheds = schedSnap.docs.map(d => ({ id: d.id, ...d.data() }));
          setTodaySchedule(scheds);
        }
      } catch (err) {
        console.error('Error fetching dashboard guru data:', err);
      } finally {
        if (isMounted) setLoading(false);
      }
    };

    fetchDashboardData();
    return () => { isMounted = false; };
  }, [userData, todayStr, todayDayName]);

  // Aksi Absen Datang
  const handleAbsenDatang = async () => {
    setActionLoading(true);
    setMsg(null);
    try {
      const now = new Date();
      const jamDevice = now.toTimeString().split(' ')[0]; // '07:30:15'
      const docId = `${userData.school_id}_${todayStr}_${userData.uid}`;

      // Status keterlambatan sederhana (jika lewat jam 07:45)
      const isLate = now.getHours() > 7 || (now.getHours() === 7 && now.getMinutes() > 45);

      const payload = {
        id: docId,
        school_id: userData.school_id,
        user_id: userData.uid,
        nama_guru: userData.nama,
        tanggal: todayStr,
        jam_datang_server: serverTimestamp(),
        jam_datang_device: jamDevice,
        jam_pulang_server: null,
        jam_pulang_device: null,
        status: isLate ? 'terlambat' : 'hadir',
        status_pulang: 'belum_absen',
        catatan: isLate ? 'Terlambat masuk sekolah' : 'Tepat waktu',
        lokasi: null,
        koreksi: {
          diajukan: false,
          jam_datang_ajuan: null,
          jam_pulang_ajuan: null,
          alasan: '',
          status_koreksi: 'menunggu',
          catatan_kepsek: '',
        },
        created_at: serverTimestamp(),
        updated_at: serverTimestamp(),
      };

      await setDoc(doc(db, 'attendance', docId), payload);
      setTodayAttendance(payload);

      await logActivity({
        schoolId: userData.school_id,
        actorId: userData.uid,
        actorNama: userData.nama,
        action: 'ABSEN_DATANG',
        recordType: 'attendance',
        recordId: docId,
      });

      setMsg({ type: 'success', text: `Berhasil mencatat kehadiran pukul ${jamDevice} WIB.` });
    } catch (err) {
      console.error(err);
      setMsg({ type: 'error', text: 'Gagal melakukan presensi datang. Silakan coba lagi.' });
    } finally {
      setActionLoading(false);
    }
  };

  // Aksi Absen Pulang
  const handleAbsenPulang = async () => {
    setActionLoading(true);
    setMsg(null);
    try {
      const now = new Date();
      const jamDevice = now.toTimeString().split(' ')[0];
      const docId = `${userData.school_id}_${todayStr}_${userData.uid}`;

      const updateData = {
        jam_pulang_server: serverTimestamp(),
        jam_pulang_device: jamDevice,
        status_pulang: 'selesai',
        updated_at: serverTimestamp(),
      };

      await updateDoc(doc(db, 'attendance', docId), updateData);
      setTodayAttendance(prev => ({ ...prev, ...updateData }));

      await logActivity({
        schoolId: userData.school_id,
        actorId: userData.uid,
        actorNama: userData.nama,
        action: 'ABSEN_PULANG',
        recordType: 'attendance',
        recordId: docId,
      });

      setMsg({ type: 'success', text: `Presensi pulang berhasil dicatat pukul ${jamDevice} WIB. Selamat beristirahat!` });
    } catch (err) {
      console.error(err);
      setMsg({ type: 'error', text: 'Gagal mencatat presensi pulang.' });
    } finally {
      setActionLoading(false);
    }
  };

  return (
    <div className="space-y-6 max-w-5xl mx-auto pb-6">
      
      {/* 1. Header Sambutan Hangat & Ceria Guru PAUD */}
      <div className="bg-gradient-to-r from-amber-400 via-orange-400 to-rose-400 rounded-3xl p-6 md:p-8 text-white shadow-xl shadow-orange-500/15 relative overflow-hidden">
        <div className="absolute right-2 -bottom-4 opacity-20 text-8xl md:text-9xl pointer-events-none select-none font-brand">
          🌻
        </div>
        <div className="relative z-10 max-w-2xl">
          <div className="inline-flex items-center space-x-2 px-3 py-1 bg-white/20 backdrop-blur-md rounded-full text-xs font-bold mb-3 border border-white/20">
            <Sun className="w-3.5 h-3.5 text-amber-200" />
            <span>{formatTanggalIndo(new Date())}</span>
            <span>•</span>
            <span>Cerah & Ceria ☀️</span>
          </div>

          <h1 className="text-xl md:text-3xl font-extrabold tracking-tight font-brand">
            Semangat Pagi, {userData?.nama || 'Ibu Guru'}! 👋
          </h1>
          <p className="text-xs md:text-sm text-amber-50 mt-1.5 leading-relaxed font-medium">
            Mendampingi <strong>Kelompok {userData?.kelompok_kelas || 'TK A'}</strong> di {schoolData?.nama_sekolah || 'TK Dharma Wanita Persatuan 8'}. Semoga hari ini penuh senyum, tawa, dan kreasi buah hati!
          </p>
        </div>
      </div>

      {msg && (
        <div className={`p-4 rounded-3xl text-xs font-bold flex items-center space-x-2.5 animate-fadeIn shadow-sm ${
          msg.type === 'success' 
            ? 'bg-emerald-50 text-emerald-800 border-2 border-emerald-200' 
            : 'bg-rose-50 text-rose-800 border-2 border-rose-200'
        }`}>
          {msg.type === 'success' ? <CheckCircle2 className="w-4 h-4 text-emerald-600 shrink-0" /> : <AlertCircle className="w-4 h-4 text-rose-600 shrink-0" />}
          <span>{msg.text}</span>
        </div>
      )}

      {/* 2. Grid Kartu Presensi Stempel Ceria & Status Jurnal Hari Ini */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4 md:gap-6">
        
        {/* KARTU PRESENSI "STEMPEL CERIA" */}
        <div className="bg-white rounded-3xl p-6 border-2 border-emerald-200/80 shadow-sm flex flex-col justify-between relative overflow-hidden">
          <div className="absolute top-0 right-0 w-24 h-24 bg-emerald-50 rounded-full blur-2xl pointer-events-none"></div>

          <div>
            <div className="flex items-center justify-between mb-4">
              <div className="flex items-center space-x-3">
                <div className="w-10 h-10 rounded-2xl bg-emerald-100 text-emerald-700 flex items-center justify-center font-bold text-lg shadow-xs">
                  ⏰
                </div>
                <div>
                  <h3 className="text-sm font-extrabold text-slate-800 font-brand uppercase tracking-wider">
                    Presensi Hari Ini
                  </h3>
                  <p className="text-[11px] text-slate-400 font-medium">Dual-Timestamp Anti-Trap</p>
                </div>
              </div>

              {todayAttendance && (
                <span className={`px-3 py-1 rounded-full text-xs font-extrabold border flex items-center space-x-1 ${
                  todayAttendance.status === 'hadir'
                    ? 'bg-emerald-50 text-emerald-800 border-emerald-300'
                    : todayAttendance.status === 'terlambat'
                    ? 'bg-amber-50 text-amber-800 border-amber-300'
                    : 'bg-slate-100 text-slate-700 border-slate-300'
                }`}>
                  <span>{todayAttendance.status === 'hadir' ? '🌸' : '⏳'}</span>
                  <span className="capitalize">{todayAttendance.status}</span>
                </span>
              )}
            </div>

            <div className="grid grid-cols-2 gap-3 my-4">
              <div className="p-3.5 rounded-2xl bg-emerald-50/70 border border-emerald-100/90 text-center">
                <span className="text-[10px] font-extrabold text-emerald-700 block uppercase tracking-wider">
                  Jam Datang
                </span>
                <span className="text-base font-extrabold text-emerald-950 mt-0.5 block font-brand">
                  {todayAttendance?.jam_datang_device ? `${todayAttendance.jam_datang_device.slice(0, 5)} WIB` : 'Belum Absen'}
                </span>
                <span className="text-[10px] text-emerald-600 font-medium mt-0.5 block">
                  {todayAttendance ? '✅ Tercatat di sistem' : 'Menunggu Anda'}
                </span>
              </div>

              <div className="p-3.5 rounded-2xl bg-amber-50/70 border border-amber-100 text-center">
                <span className="text-[10px] font-extrabold text-amber-700 block uppercase tracking-wider">
                  Jam Pulang
                </span>
                <span className="text-base font-extrabold text-amber-950 mt-0.5 block font-brand">
                  {todayAttendance?.jam_pulang_device ? `${todayAttendance.jam_pulang_device.slice(0, 5)} WIB` : 'Belum Absen'}
                </span>
                <span className="text-[10px] text-amber-600 font-medium mt-0.5 block">
                  {todayAttendance?.jam_pulang_device ? '✅ Selesai bertugas' : '⏳ Jadwal 11:30'}
                </span>
              </div>
            </div>
          </div>

          <div className="pt-2">
            {!todayAttendance ? (
              <button
                onClick={handleAbsenDatang}
                disabled={actionLoading}
                className="w-full py-4 px-5 rounded-2xl font-extrabold text-xs text-white bg-gradient-to-r from-emerald-500 to-teal-600 hover:from-emerald-600 hover:to-teal-700 active:scale-98 shadow-md shadow-emerald-500/25 transition flex items-center justify-center space-x-2"
              >
                <Clock className="w-4 h-4 stroke-[2.5]" />
                <span>{actionLoading ? 'Mencatat Kehadiran...' : 'Sentuh untuk Absen Datang (07:15)'}</span>
              </button>
            ) : !todayAttendance.jam_pulang_device ? (
              <button
                onClick={handleAbsenPulang}
                disabled={actionLoading}
                className="w-full py-4 px-5 rounded-2xl font-extrabold text-xs text-white bg-gradient-to-r from-amber-500 to-orange-500 hover:from-amber-600 hover:to-orange-600 active:scale-98 shadow-md shadow-orange-500/25 transition flex items-center justify-center space-x-2"
              >
                <Coffee className="w-4 h-4 stroke-[2.5]" />
                <span>{actionLoading ? 'Mencatat Checkout...' : 'Sentuh untuk Absen Pulang'}</span>
              </button>
            ) : (
              <div className="w-full py-3 rounded-2xl bg-emerald-50 border border-emerald-200 text-emerald-800 text-center text-xs font-bold flex items-center justify-center space-x-1.5">
                <span>🌸</span>
                <span>Presensi Hari Ini Telah Lengkap. Selamat Beristirahat!</span>
              </div>
            )}
          </div>
        </div>

        {/* KARTU JURNAL KBM HARI INI */}
        <div className="bg-white rounded-3xl p-6 border-2 border-orange-200/70 shadow-sm flex flex-col justify-between relative overflow-hidden">
          <div className="absolute top-0 right-0 w-24 h-24 bg-orange-50 rounded-full blur-2xl pointer-events-none"></div>

          <div>
            <div className="flex items-center justify-between mb-4">
              <div className="flex items-center space-x-3">
                <div className="w-10 h-10 rounded-2xl bg-orange-100 text-orange-700 flex items-center justify-center font-bold text-lg shadow-xs">
                  📖
                </div>
                <div>
                  <h3 className="text-sm font-extrabold text-slate-800 font-brand uppercase tracking-wider">
                    Jurnal KBM Hari Ini
                  </h3>
                  <p className="text-[11px] text-slate-400 font-medium">Kurikulum Merdeka PAUD</p>
                </div>
              </div>

              {todayJournal && (
                <span className={`px-3 py-1 rounded-full text-[10px] font-extrabold uppercase border ${
                  todayJournal.status === 'disetujui'
                    ? 'bg-emerald-50 text-emerald-800 border-emerald-300'
                    : todayJournal.status === 'perlu_revisi'
                    ? 'bg-rose-50 text-rose-800 border-rose-300'
                    : todayJournal.status === 'dikirim'
                    ? 'bg-blue-50 text-blue-800 border-blue-300'
                    : 'bg-amber-50 text-amber-800 border-amber-300'
                }`}>
                  {todayJournal.status}
                </span>
              )}
            </div>

            <div className="p-4 rounded-2xl bg-amber-50/50 border border-amber-200/60 my-4 text-xs">
              {todayJournal ? (
                <div className="space-y-1.5">
                  <span className="text-[10px] font-extrabold text-orange-700 uppercase tracking-wide">
                    Topik Kegiatan:
                  </span>
                  <p className="font-extrabold text-slate-800 text-sm font-brand line-clamp-1">
                    "{todayJournal.topik || 'Topik Pembelajaran'}"
                  </p>
                  <p className="text-slate-600 text-[11px] line-clamp-2 leading-relaxed">
                    {todayJournal.kegiatan_inti || 'Belum ada uraian kegiatan.'}
                  </p>
                  {todayJournal.status === 'perlu_revisi' && todayJournal.review_note && (
                    <div className="mt-2.5 p-2.5 bg-rose-50 border border-rose-200 text-rose-800 rounded-xl text-[11px] font-medium">
                      <strong>Catatan Kepala Sekolah:</strong> {todayJournal.review_note}
                    </div>
                  )}
                </div>
              ) : (
                <div className="text-center py-3 text-slate-500 text-xs">
                  <div className="text-2xl mb-1">📝</div>
                  <span className="font-semibold text-slate-700">Belum ada jurnal yang diisi hari ini.</span>
                  <p className="text-[11px] text-slate-400 mt-0.5">
                    Gunakan Voice-to-Text atau Bank Template untuk mengisi cepat!
                  </p>
                </div>
              )}
            </div>
          </div>

          <div className="pt-2">
            <button
              onClick={() => navigate('/guru/jurnal')}
              className="w-full py-4 px-5 rounded-2xl font-extrabold text-xs text-orange-800 bg-orange-100 hover:bg-orange-200 active:scale-98 transition flex items-center justify-center space-x-2 border border-orange-300/80 shadow-xs"
            >
              <FileEdit className="w-4 h-4 stroke-[2.5]" />
              <span>{todayJournal ? 'Buka & Edit Jurnal' : 'Tulis Jurnal Ceria Sekarang'}</span>
            </button>
          </div>
        </div>
      </div>

      {/* 3. Jadwal KBM & Sentra Hari Ini */}
      <div className="bg-white rounded-3xl p-6 border border-orange-200/60 shadow-sm">
        <div className="flex items-center justify-between mb-4">
          <div className="flex items-center space-x-3">
            <div className="w-9 h-9 rounded-2xl bg-amber-100 text-amber-700 flex items-center justify-center font-bold">
              <Calendar className="w-5 h-5 text-amber-600 stroke-[2.2]" />
            </div>
            <div>
              <h3 className="text-sm font-extrabold text-slate-800 font-brand">
                Jadwal Sentra & Kelas Hari Ini ({todayDayName})
              </h3>
              <p className="text-[11px] text-slate-400">Roster kegiatan harian sekolah</p>
            </div>
          </div>
          <button
            onClick={() => navigate('/guru/jadwal')}
            className="text-xs text-orange-600 hover:text-orange-800 font-extrabold flex items-center space-x-1"
          >
            <span>Lihat Mingguan</span>
            <ArrowRight className="w-3.5 h-3.5 stroke-[2.5]" />
          </button>
        </div>

        {todaySchedule.length > 0 ? (
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
            {todaySchedule.map((item) => (
              <div key={item.id} className="p-4 rounded-2xl bg-amber-50/40 border border-amber-200/70 text-xs hover:shadow-xs transition">
                <div className="flex items-center justify-between text-slate-500 text-[10px] mb-1.5">
                  <span className="font-extrabold text-orange-800">{item.jam_mulai} - {item.jam_selesai} WIB</span>
                  <span className="font-extrabold text-orange-700 bg-orange-100 px-2 py-0.5 rounded-lg border border-orange-200 font-brand">
                    {item.kelompok}
                  </span>
                </div>
                <p className="font-extrabold text-slate-800 text-sm font-brand line-clamp-1">{item.kegiatan}</p>
                <p className="text-slate-500 text-[11px] mt-1 font-medium">Pengampu: {item.pic_nama || 'Guru Kelas'}</p>
              </div>
            ))}
          </div>
        ) : (
          <div className="text-center py-6 text-slate-400 text-xs">
            🌸 Belum ada jadwal khusus yang dijadwalkan Kepala Sekolah untuk hari ini.
          </div>
        )}
      </div>
    </div>
  );
}


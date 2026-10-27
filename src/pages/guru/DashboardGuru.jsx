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
    <div className="space-y-6 max-w-5xl mx-auto">
      
      {/* 1. Header Sambutan Guru */}
      <div className="bg-gradient-to-r from-indigo-600 via-indigo-700 to-purple-700 rounded-3xl p-6 md:p-8 text-white shadow-md relative overflow-hidden">
        <div className="relative z-10">
          <div className="flex items-center space-x-2 text-indigo-200 text-xs font-semibold mb-2">
            <Sun className="w-4 h-4 text-amber-300" />
            <span>{formatTanggalIndo(new Date())}</span>
          </div>
          <h1 className="text-xl md:text-2xl font-bold tracking-tight">
            Selamat Datang, {userData?.nama || 'Ibu Guru'}!
          </h1>
          <p className="text-xs md:text-sm text-indigo-100 mt-1 max-w-xl">
            {schoolData?.nama_sekolah || 'TK Dharma Wanita Persatuan 8'} • Kelompok {userData?.kelompok_kelas || 'TK A'}
          </p>
        </div>
        <div className="absolute right-4 bottom-0 opacity-15 text-8xl font-black pointer-events-none select-none">
          🎶
        </div>
      </div>

      {msg && (
        <div className={`p-4 rounded-2xl text-xs flex items-center space-x-2.5 animate-fadeIn ${
          msg.type === 'success' 
            ? 'bg-emerald-50 text-emerald-800 border border-emerald-200' 
            : 'bg-rose-50 text-rose-800 border border-rose-200'
        }`}>
          {msg.type === 'success' ? <CheckCircle2 className="w-4 h-4 text-emerald-600 shrink-0" /> : <AlertCircle className="w-4 h-4 text-rose-600 shrink-0" />}
          <span>{msg.text}</span>
        </div>
      )}

      {/* 2. Grid Kartu Presensi Cepat & Status Jurnal Hari Ini */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4 md:gap-6">
        
        {/* KARTU PRESENSI HARI INI */}
        <div className="bg-white rounded-3xl p-6 border border-slate-200/80 shadow-sm flex flex-col justify-between">
          <div>
            <div className="flex items-center justify-between mb-4">
              <div className="flex items-center space-x-2.5">
                <div className="w-9 h-9 rounded-xl bg-indigo-50 text-indigo-600 flex items-center justify-center">
                  <Clock className="w-5 h-5" />
                </div>
                <div>
                  <h3 className="text-sm font-bold text-slate-800">Presensi Hari Ini</h3>
                  <p className="text-[11px] text-slate-400">Pencatatan Kehadiran KBM</p>
                </div>
              </div>

              {todayAttendance && (
                <span className={`px-2.5 py-0.5 rounded-full text-[10px] font-bold uppercase ${
                  todayAttendance.status === 'hadir'
                    ? 'bg-emerald-50 text-emerald-700 border border-emerald-200'
                    : todayAttendance.status === 'terlambat'
                    ? 'bg-amber-50 text-amber-700 border border-amber-200'
                    : 'bg-slate-100 text-slate-700'
                }`}>
                  {todayAttendance.status}
                </span>
              )}
            </div>

            <div className="space-y-3 my-4">
              <div className="flex items-center justify-between text-xs p-3 rounded-2xl bg-slate-50 border border-slate-100">
                <span className="text-slate-500 font-medium">Jam Datang:</span>
                <span className="font-bold text-slate-800">
                  {todayAttendance?.jam_datang_device ? `${todayAttendance.jam_datang_device} WIB` : 'Belum Absen'}
                </span>
              </div>

              <div className="flex items-center justify-between text-xs p-3 rounded-2xl bg-slate-50 border border-slate-100">
                <span className="text-slate-500 font-medium">Jam Pulang:</span>
                <span className="font-bold text-slate-800">
                  {todayAttendance?.jam_pulang_device ? `${todayAttendance.jam_pulang_device} WIB` : 'Belum Absen'}
                </span>
              </div>
            </div>
          </div>

          <div className="pt-2">
            {!todayAttendance ? (
              <button
                onClick={handleAbsenDatang}
                disabled={actionLoading}
                className="w-full py-3 px-4 rounded-xl font-bold text-xs text-white bg-indigo-600 hover:bg-indigo-700 active:bg-indigo-800 shadow-sm transition flex items-center justify-center space-x-2"
              >
                <Clock className="w-4 h-4" />
                <span>{actionLoading ? 'Mencatat...' : 'Absen Datang Sekarang'}</span>
              </button>
            ) : !todayAttendance.jam_pulang_device ? (
              <button
                onClick={handleAbsenPulang}
                disabled={actionLoading}
                className="w-full py-3 px-4 rounded-xl font-bold text-xs text-white bg-emerald-600 hover:bg-emerald-700 active:bg-emerald-800 shadow-sm transition flex items-center justify-center space-x-2"
              >
                <Coffee className="w-4 h-4" />
                <span>{actionLoading ? 'Mencatat...' : 'Absen Pulang'}</span>
              </button>
            ) : (
              <div className="w-full py-2.5 rounded-xl bg-slate-100 text-slate-600 text-center text-xs font-semibold">
                ✓ Presensi Hari Ini Lengkap
              </div>
            )}
          </div>
        </div>

        {/* KARTU JURNAL KBM HARI INI */}
        <div className="bg-white rounded-3xl p-6 border border-slate-200/80 shadow-sm flex flex-col justify-between">
          <div>
            <div className="flex items-center justify-between mb-4">
              <div className="flex items-center space-x-2.5">
                <div className="w-9 h-9 rounded-xl bg-purple-50 text-purple-600 flex items-center justify-center">
                  <BookOpen className="w-5 h-5" />
                </div>
                <div>
                  <h3 className="text-sm font-bold text-slate-800">Jurnal Mengajar Hari Ini</h3>
                  <p className="text-[11px] text-slate-400">Kurikulum Merdeka</p>
                </div>
              </div>

              {todayJournal && (
                <span className={`px-2.5 py-0.5 rounded-full text-[10px] font-bold uppercase ${
                  todayJournal.status === 'disetujui'
                    ? 'bg-emerald-50 text-emerald-700 border border-emerald-200'
                    : todayJournal.status === 'perlu_revisi'
                    ? 'bg-rose-50 text-rose-700 border border-rose-200'
                    : todayJournal.status === 'dikirim'
                    ? 'bg-blue-50 text-blue-700 border border-blue-200'
                    : 'bg-slate-100 text-slate-600 border border-slate-200'
                }`}>
                  {todayJournal.status}
                </span>
              )}
            </div>

            <div className="p-4 rounded-2xl bg-slate-50 border border-slate-100 my-4 text-xs">
              {todayJournal ? (
                <div className="space-y-1.5">
                  <p className="font-bold text-slate-800 text-sm line-clamp-1">
                    {todayJournal.topik || 'Topik Pembelajaran'}
                  </p>
                  <p className="text-slate-500 text-[11px] line-clamp-2">
                    {todayJournal.kegiatan_inti || 'Belum ada uraian kegiatan.'}
                  </p>
                  {todayJournal.status === 'perlu_revisi' && todayJournal.review_note && (
                    <div className="mt-2 p-2 bg-rose-50 border border-rose-200 text-rose-700 rounded-xl text-[11px]">
                      <strong>Catatan Kepsek:</strong> {todayJournal.review_note}
                    </div>
                  )}
                </div>
              ) : (
                <div className="text-center py-2 text-slate-400 text-xs">
                  Belum ada jurnal mengajar yang diisi untuk hari ini.
                </div>
              )}
            </div>
          </div>

          <div className="pt-2">
            <button
              onClick={() => navigate('/guru/jurnal')}
              className="w-full py-3 px-4 rounded-xl font-bold text-xs text-indigo-600 bg-indigo-50 hover:bg-indigo-100 transition flex items-center justify-center space-x-2"
            >
              <FileEdit className="w-4 h-4" />
              <span>{todayJournal ? 'Buka & Edit Jurnal' : 'Tulis Jurnal Hari Ini'}</span>
            </button>
          </div>
        </div>
      </div>

      {/* 3. Jadwal KBM Hari Ini */}
      <div className="bg-white rounded-3xl p-6 border border-slate-200/80 shadow-sm">
        <div className="flex items-center justify-between mb-4">
          <div className="flex items-center space-x-2.5">
            <div className="w-8 h-8 rounded-xl bg-amber-50 text-amber-600 flex items-center justify-center">
              <Calendar className="w-4 h-4" />
            </div>
            <h3 className="text-sm font-bold text-slate-800">
              Jadwal Kelas Hari Ini ({todayDayName})
            </h3>
          </div>
          <button
            onClick={() => navigate('/guru/jadwal')}
            className="text-xs text-indigo-600 hover:text-indigo-800 font-semibold flex items-center space-x-1"
          >
            <span>Lihat Mingguan</span>
            <ArrowRight className="w-3.5 h-3.5" />
          </button>
        </div>

        {todaySchedule.length > 0 ? (
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
            {todaySchedule.map((item) => (
              <div key={item.id} className="p-3.5 rounded-2xl bg-slate-50 border border-slate-100 text-xs">
                <div className="flex items-center justify-between text-slate-400 text-[10px] mb-1">
                  <span>{item.jam_mulai} - {item.jam_selesai} WIB</span>
                  <span className="font-bold text-indigo-600 bg-indigo-50 px-2 py-0.5 rounded-md">
                    {item.kelompok}
                  </span>
                </div>
                <p className="font-bold text-slate-800 line-clamp-1">{item.kegiatan}</p>
                <p className="text-slate-500 text-[11px] mt-0.5">PIC: {item.pic_nama || 'Guru Kelas'}</p>
              </div>
            ))}
          </div>
        ) : (
          <div className="text-center py-6 text-slate-400 text-xs">
            Tidak ada jadwal KBM terjadwal untuk hari ini.
          </div>
        )}
      </div>
    </div>
  );
}


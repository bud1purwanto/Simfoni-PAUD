import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { 
  Calendar, 
  Clock, 
  BookOpen, 
  User, 
  Filter, 
  ArrowRight, 
  CalendarDays,
  Sparkles,
  Info,
  Users
} from 'lucide-react';
import { collection, query, where, onSnapshot } from 'firebase/firestore';
import { db } from '../../config/firebase';
import { useAuth } from '../../context/AuthContext';

const HARI_LIST = ['Semua Hari', 'Senin', 'Selasa', 'Rabu', 'Kamis', 'Jumat', 'Sabtu'];

export default function JadwalGuru() {
  const { currentUser, schoolData } = useAuth();
  const navigate = useNavigate();

  // Dapatkan hari ini dalam bahasa Indonesia
  const hariIni = ['Minggu', 'Senin', 'Selasa', 'Rabu', 'Kamis', 'Jumat', 'Sabtu'][new Date().getDay()];
  const defaultHari = HARI_LIST.includes(hariIni) ? hariIni : 'Senin';

  const [schedules, setSchedules] = useState([]);
  const [loading, setLoading] = useState(true);
  const [selectedHari, setSelectedHari] = useState(defaultHari);
  const [filterSaya, setFilterSaya] = useState(false);

  // Ambil jadwal mingguan dari koleksi `schedules`
  useEffect(() => {
    if (!currentUser?.school_id) {
      setLoading(false);
      return;
    }

    setLoading(true);
    const schedulesRef = collection(db, 'schedules');
    const q = query(schedulesRef, where('school_id', '==', currentUser.school_id));

    const unsubscribe = onSnapshot(
      q,
      (snapshot) => {
        const list = snapshot.docs.map((doc) => ({
          id: doc.id,
          ...doc.data(),
        }));

        // Urutkan berdasarkan jam_mulai
        list.sort((a, b) => (a.jam_mulai || '').localeCompare(b.jam_mulai || ''));
        setSchedules(list);
        setLoading(false);
      },
      (error) => {
        console.warn('Gagal memuat jadwal mengajar:', error);
        setLoading(false);
      }
    );

    return () => unsubscribe();
  }, [currentUser?.school_id]);

  // Filter jadwal berdasarkan hari dan PIC guru
  const filteredSchedules = schedules.filter((item) => {
    // Filter hari
    if (selectedHari !== 'Semua Hari' && item.hari !== selectedHari) {
      return false;
    }
    // Filter jadwal saya
    if (filterSaya) {
      const isMySchedule = item.pic_guru_id === currentUser?.uid || 
                           item.pic_guru_id === 'all' || 
                           (item.pic_nama && item.pic_nama.toLowerCase().includes((currentUser?.nama_lengkap || '').toLowerCase()));
      if (!isMySchedule) return false;
    }
    return true;
  });

  return (
    <div className="space-y-6 max-w-5xl mx-auto pb-12">
      {/* Header & Subtitle */}
      <div className="bg-gradient-to-r from-emerald-600 via-teal-600 to-emerald-700 rounded-3xl p-6 md:p-8 text-white shadow-xl shadow-emerald-900/10">
        <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-4">
          <div>
            <div className="inline-flex items-center space-x-2 px-3 py-1 bg-white/15 backdrop-blur-md rounded-full text-xs font-semibold mb-3">
              <CalendarDays className="w-3.5 h-3.5" />
              <span>Jadwal Pembelajaran Kurikulum Merdeka</span>
            </div>
            <h1 className="text-2xl md:text-3xl font-extrabold tracking-tight">
              Jadwal Mengajar KBM
            </h1>
            <p className="text-emerald-100 text-sm mt-1">
              {schoolData?.nama_sekolah || 'PAUD'} • Roster kegiatan mingguan kelas dan sentra
            </p>
          </div>

          <div className="flex items-center space-x-2 bg-white/10 backdrop-blur-md px-4 py-2.5 rounded-2xl border border-white/20 text-xs">
            <Sparkles className="w-4 h-4 text-amber-300 shrink-0" />
            <div>
              <div className="font-semibold text-white">Hari Ini: {hariIni}</div>
              <div className="text-emerald-200">
                {schedules.filter((s) => s.hari === hariIni).length} kegiatan terjadwal
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* Navigasi Filter Hari (Pill Horizontal Scrollable) */}
      <div className="bg-white rounded-3xl p-4 md:p-5 border border-slate-200/80 shadow-sm space-y-4">
        <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
          <div className="flex items-center space-x-2 text-xs font-bold text-slate-500 uppercase tracking-wider">
            <Filter className="w-3.5 h-3.5" />
            <span>Pilih Hari</span>
          </div>

          {/* Toggle Filter: Jadwal Saya vs Semua */}
          <button
            type="button"
            onClick={() => setFilterSaya(!filterSaya)}
            className={`inline-flex items-center space-x-2 px-3.5 py-1.5 rounded-xl text-xs font-semibold transition-all ${
              filterSaya
                ? 'bg-emerald-600 text-white shadow-md shadow-emerald-600/20'
                : 'bg-slate-100 text-slate-600 hover:bg-slate-200'
            }`}
          >
            <User className="w-3.5 h-3.5" />
            <span>{filterSaya ? 'Menampilkan Jadwal Saya' : 'Tampilkan Jadwal Saya Saja'}</span>
          </button>
        </div>

        {/* Tab Hari */}
        <div className="flex items-center space-x-2 overflow-x-auto pb-1 scrollbar-thin">
          {HARI_LIST.map((hari) => {
            const isActive = selectedHari === hari;
            const isToday = hari === hariIni;
            const count = hari === 'Semua Hari' 
              ? schedules.length 
              : schedules.filter((s) => s.hari === hari).length;

            return (
              <button
                key={hari}
                type="button"
                onClick={() => setSelectedHari(hari)}
                className={`px-4 py-2 rounded-2xl text-xs font-bold transition-all whitespace-nowrap flex items-center space-x-2 ${
                  isActive
                    ? 'bg-emerald-600 text-white shadow-md shadow-emerald-600/25 ring-2 ring-emerald-600/30'
                    : 'bg-slate-50 text-slate-600 hover:bg-slate-100 border border-slate-200/60'
                }`}
              >
                <span>{hari}</span>
                {isToday && (
                  <span className={`w-2 h-2 rounded-full ${isActive ? 'bg-amber-300' : 'bg-emerald-500'}`} />
                )}
                <span
                  className={`px-1.5 py-0.5 rounded-full text-[10px] ${
                    isActive ? 'bg-white/20 text-white' : 'bg-slate-200 text-slate-600'
                  }`}
                >
                  {count}
                </span>
              </button>
            );
          })}
        </div>
      </div>

      {/* Konten Daftar Jadwal */}
      {loading ? (
        <div className="flex flex-col items-center justify-center p-12 bg-white rounded-3xl border border-slate-200/80">
          <div className="w-8 h-8 border-4 border-emerald-600 border-t-transparent rounded-full animate-spin mb-3" />
          <p className="text-sm font-semibold text-slate-600">Memuat jadwal mengajar...</p>
        </div>
      ) : filteredSchedules.length === 0 ? (
        <div className="bg-white rounded-3xl p-8 md:p-12 border border-slate-200/80 text-center shadow-sm">
          <div className="w-14 h-14 bg-emerald-50 text-emerald-600 rounded-2xl flex items-center justify-center mx-auto mb-4">
            <Calendar className="w-7 h-7" />
          </div>
          <h3 className="text-base font-bold text-slate-800">
            Tidak ada jadwal untuk {selectedHari}
          </h3>
          <p className="text-xs text-slate-500 max-w-sm mx-auto mt-1">
            {filterSaya 
              ? 'Anda tidak memiliki jadwal mengajar langsung pada hari yang dipilih.'
              : 'Jadwal kegiatan mingguan belum diatur oleh Kepala Sekolah untuk hari ini.'}
          </p>

          <div className="mt-6 flex flex-wrap justify-center gap-3">
            {filterSaya && (
              <button
                type="button"
                onClick={() => setFilterSaya(false)}
                className="px-4 py-2 bg-slate-100 hover:bg-slate-200 text-slate-700 rounded-xl text-xs font-semibold transition-all"
              >
                Lihat Semua Jadwal
              </button>
            )}
            <button
              type="button"
              onClick={() => navigate('/guru/jurnal')}
              className="inline-flex items-center space-x-2 px-4 py-2 bg-emerald-600 hover:bg-emerald-700 text-white rounded-xl text-xs font-semibold transition-all shadow-md shadow-emerald-600/20"
            >
              <BookOpen className="w-3.5 h-3.5" />
              <span>Tulis Jurnal Mandiri</span>
            </button>
          </div>
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          {filteredSchedules.map((item) => {
            const isToday = item.hari === hariIni;
            const isMyDuty = item.pic_guru_id === currentUser?.uid || 
                             item.pic_guru_id === 'all' ||
                             (item.pic_nama && item.pic_nama.toLowerCase().includes((currentUser?.nama_lengkap || '').toLowerCase()));

            return (
              <div
                key={item.id}
                className={`bg-white rounded-3xl p-5 border transition-all hover:shadow-md ${
                  isToday 
                    ? 'border-emerald-300 ring-1 ring-emerald-200/80 shadow-sm' 
                    : 'border-slate-200/80 shadow-sm'
                }`}
              >
                {/* Header Kartu: Hari & Waktu */}
                <div className="flex items-center justify-between mb-3">
                  <div className="flex items-center space-x-2">
                    <span className="px-2.5 py-1 bg-slate-100 text-slate-700 rounded-xl text-xs font-bold">
                      {item.hari}
                    </span>
                    {isToday && (
                      <span className="px-2.5 py-1 bg-emerald-100 text-emerald-700 rounded-xl text-xs font-bold">
                        Hari Ini
                      </span>
                    )}
                    {isMyDuty && (
                      <span className="px-2 py-0.5 bg-teal-50 text-teal-700 rounded-lg text-[10px] font-semibold border border-teal-200">
                        Jadwal Saya
                      </span>
                    )}
                  </div>

                  <div className="flex items-center space-x-1.5 text-xs font-semibold text-slate-600 bg-slate-50 px-2.5 py-1 rounded-xl border border-slate-200/60">
                    <Clock className="w-3.5 h-3.5 text-emerald-600" />
                    <span>{item.jam_mulai || '07:30'} - {item.jam_selesai || '10:00'} WIB</span>
                  </div>
                </div>

                {/* Kegiatan / Topik */}
                <div className="mb-3">
                  <div className="text-xs font-semibold text-emerald-600 uppercase tracking-wide">
                    Kegiatan Pembelajaran
                  </div>
                  <h4 className="text-base font-bold text-slate-800 mt-0.5">
                    {item.kegiatan || 'Aktivitas KBM'}
                  </h4>
                </div>

                {/* Detail: Kelompok & Guru Pengajar */}
                <div className="grid grid-cols-2 gap-2 p-3 bg-slate-50 rounded-2xl border border-slate-200/60 text-xs mb-4">
                  <div>
                    <span className="text-[11px] text-slate-400 block font-medium">Kelompok / Kelas</span>
                    <span className="font-bold text-slate-700 flex items-center space-x-1 mt-0.5">
                      <Users className="w-3.5 h-3.5 text-slate-500" />
                      <span>{item.kelompok || 'Semua Kelompok'}</span>
                    </span>
                  </div>
                  <div>
                    <span className="text-[11px] text-slate-400 block font-medium">Guru Pengampu</span>
                    <span className="font-bold text-slate-700 flex items-center space-x-1 mt-0.5 truncate">
                      <User className="w-3.5 h-3.5 text-slate-500 shrink-0" />
                      <span className="truncate">{item.pic_nama || 'Semua Guru'}</span>
                    </span>
                  </div>
                </div>

                {/* Aksi Cepat: Buat Jurnal untuk Jadwal Ini */}
                <button
                  type="button"
                  onClick={() => {
                    const queryParams = new URLSearchParams({
                      kelompok: item.kelompok || 'TK A',
                      topik: item.kegiatan || '',
                    });
                    navigate(`/guru/jurnal?${queryParams.toString()}`);
                  }}
                  className="w-full py-2.5 px-4 bg-emerald-50 hover:bg-emerald-100 active:bg-emerald-200 text-emerald-800 rounded-2xl text-xs font-bold transition-all flex items-center justify-center space-x-2 border border-emerald-200"
                >
                  <BookOpen className="w-3.5 h-3.5 text-emerald-600" />
                  <span>Tulis Jurnal dari Jadwal Ini</span>
                  <ArrowRight className="w-3.5 h-3.5 text-emerald-600" />
                </button>
              </div>
            );
          })}
        </div>
      )}

      {/* Info Card Bawah */}
      <div className="bg-slate-50 border border-slate-200 rounded-3xl p-5 flex items-start space-x-3 text-xs text-slate-600">
        <Info className="w-4 h-4 text-emerald-600 shrink-0 mt-0.5" />
        <div>
          <p className="font-bold text-slate-800">Informasi Penataan Jadwal</p>
          <p className="mt-0.5">
            Jadwal kegiatan mingguan ini disusun dan dikelola langsung oleh Kepala Sekolah. 
            Jika terdapat perubahan jadwal tatap muka atau pergantian sentra, silakan koordinasikan dengan Kepala Sekolah.
          </p>
        </div>
      </div>
    </div>
  );
}


import React, { useState, useEffect, useCallback } from 'react';
import { createPortal } from 'react-dom';
import { useSearchParams } from 'react-router-dom';
import {
  Clock,
  Calendar,
  AlertCircle,
  CheckCircle2,
  AlertTriangle,
  FileText,
  Filter,
  Send,
  HelpCircle,
  Stethoscope
} from 'lucide-react';
import {
  collection,
  query,
  where,
  getDocs,
  getDoc,
  setDoc,
  doc,
  updateDoc,
  serverTimestamp
} from 'firebase/firestore';
import { addDays, format } from 'date-fns';
import { id as localeId } from 'date-fns/locale';
import { db } from '../../config/firebase';
import { useAuth } from '../../context/AuthContext';
import { formatTanggalIndo, getLocalDateString, getLocalMonthString } from '../../utils/formatters';
import { logActivity } from '../../utils/auditLogger';
import { commitWrite, QUEUED_SUFFIX } from '../../utils/offlineWrite';
import { getJamMasuk, getJamPulang } from '../../utils/schoolConfig';

const STATUS_HADIR = ['hadir', 'terlambat'];

export default function PresensiGuru() {
  const { userData, schoolData } = useAuth();
  const [searchParams, setSearchParams] = useSearchParams();

  const [attendanceList, setAttendanceList] = useState([]);
  const [loading, setLoading] = useState(true);
  const [selectedMonth, setSelectedMonth] = useState(getLocalMonthString());
  const todayStr = getLocalDateString();

  // State Modal Pengajuan Koreksi
  const [koreksiModalOpen, setKoreksiModalOpen] = useState(false);
  const [selectedRecord, setSelectedRecord] = useState(null);
  const [jamDatangAjuan, setJamDatangAjuan] = useState(getJamMasuk(schoolData));
  const [jamPulangAjuan, setJamPulangAjuan] = useState(getJamPulang(schoolData));
  const [alasanKoreksi, setAlasanKoreksi] = useState('');
  const [submittingKoreksi, setSubmittingKoreksi] = useState(false);
  const [notification, setNotification] = useState(null);

  // State Modal Pengajuan Izin / Sakit
  const [izinModalOpen, setIzinModalOpen] = useState(searchParams.get('izin') === '1');
  const [izinTanggal, setIzinTanggal] = useState(todayStr);
  const [izinJenis, setIzinJenis] = useState('izin');
  const [izinAlasan, setIzinAlasan] = useState('');
  const [submittingIzin, setSubmittingIzin] = useState(false);
  const [izinError, setIzinError] = useState('');

  // Ambil riwayat presensi berdasarkan bulan
  const fetchAttendanceHistory = useCallback(async () => {
    if (!userData?.uid || !userData?.school_id) return;
    setLoading(true);
    try {
      const q = query(
        collection(db, 'attendance'),
        where('school_id', '==', userData.school_id),
        where('user_id', '==', userData.uid)
      );
      const snap = await getDocs(q);
      const list = snap.docs.map(d => ({ id: d.id, ...d.data() }));

      // Urutkan tanggal terbaru di memori (bebas dari kebutuhan composite index Firestore)
      list.sort((a, b) => (b.tanggal || '').localeCompare(a.tanggal || ''));

      // Tandai otomatis 'lupa_absen' untuk hari-hari lalu yang hadir tanpa checkout
      list
        .filter((item) => STATUS_HADIR.includes(item.status) && !item.jam_pulang_device
          && item.tanggal < todayStr && item.status_pulang !== 'lupa_absen')
        .forEach((item) => {
          item.status_pulang = 'lupa_absen';
          updateDoc(doc(db, 'attendance', item.id), { status_pulang: 'lupa_absen', updated_at: serverTimestamp() })
            .catch((err) => console.warn('Gagal menandai lupa absen:', err));
        });

      // Filter per bulan di sisi klien
      const filtered = list.filter(item => item.tanggal?.startsWith(selectedMonth));
      setAttendanceList(filtered);
    } catch (err) {
      console.error('Error fetching attendance history:', err);
    } finally {
      setLoading(false);
    }
  }, [userData?.uid, userData?.school_id, selectedMonth, todayStr]);

  useEffect(() => {
    fetchAttendanceHistory();
  }, [fetchAttendanceHistory]);

  // Buka modal koreksi
  const handleOpenKoreksi = (record) => {
    setSelectedRecord(record);
    setJamDatangAjuan(record.koreksi?.jam_datang_ajuan || record.jam_datang_device?.slice(0, 5) || getJamMasuk(schoolData));
    setJamPulangAjuan(record.koreksi?.jam_pulang_ajuan || record.jam_pulang_device?.slice(0, 5) || getJamPulang(schoolData));
    setAlasanKoreksi(record.koreksi?.alasan || '');
    setKoreksiModalOpen(true);
  };

  const closeIzinModal = () => {
    setIzinModalOpen(false);
    setIzinError('');
    if (searchParams.get('izin')) setSearchParams({}, { replace: true });
  };

  // Ajukan Izin / Sakit (membuat record presensi berstatus izin/sakit untuk tanggal terpilih)
  const handleSubmitIzin = async (e) => {
    e.preventDefault();
    setIzinError('');
    if (!izinAlasan.trim()) {
      setIzinError('Mohon isi keterangan izin / sakit.');
      return;
    }

    const docId = `${userData.school_id}_${izinTanggal}_${userData.uid}`;
    setSubmittingIzin(true);
    try {
      const existing = await getDoc(doc(db, 'attendance', docId)).catch(() => null);
      if (existing?.exists()) {
        setIzinError('Sudah ada catatan presensi pada tanggal tersebut. Gunakan "Ajukan Koreksi" bila perlu perubahan.');
        return;
      }

      const { queued } = await commitWrite(setDoc(doc(db, 'attendance', docId), {
        id: docId,
        school_id: userData.school_id,
        user_id: userData.uid,
        nama_guru: userData.nama,
        tanggal: izinTanggal,
        jam_datang_server: null,
        jam_datang_device: null,
        jam_pulang_server: null,
        jam_pulang_device: null,
        status: izinJenis,
        menit_terlambat: 0,
        status_pulang: 'selesai',
        catatan: izinAlasan.trim(),
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
      }));

      logActivity({
        schoolId: userData.school_id,
        actorId: userData.uid,
        actorNama: userData.nama,
        action: izinJenis === 'sakit' ? 'AJUKAN_SAKIT' : 'AJUKAN_IZIN',
        recordType: 'attendance',
        recordId: docId,
      });

      setNotification({
        type: 'success',
        text: `Keterangan ${izinJenis} untuk ${formatTanggalIndo(izinTanggal)} berhasil dicatat.${queued ? QUEUED_SUFFIX : ''}`,
      });
      setIzinAlasan('');
      closeIzinModal();
      if (izinTanggal.startsWith(selectedMonth)) fetchAttendanceHistory();
    } catch (err) {
      console.error(err);
      setIzinError('Gagal mengirim keterangan. Tanggal izin hanya dapat diajukan maksimal 7 hari ke belakang.');
    } finally {
      setSubmittingIzin(false);
    }
  };

  // Submit pengajuan koreksi
  const handleSubmitKoreksi = async (e) => {
    e.preventDefault();
    if (!selectedRecord) return;

    setSubmittingKoreksi(true);
    setNotification(null);

    try {
      const docRef = doc(db, 'attendance', selectedRecord.id);
      const koreksiData = {
        'koreksi.diajukan': true,
        'koreksi.jam_datang_ajuan': jamDatangAjuan,
        'koreksi.jam_pulang_ajuan': jamPulangAjuan,
        'koreksi.alasan': alasanKoreksi,
        'koreksi.status_koreksi': 'menunggu',
        'koreksi.catatan_kepsek': '',
        updated_at: serverTimestamp(),
      };

      const { queued } = await commitWrite(updateDoc(docRef, koreksiData));

      logActivity({
        schoolId: userData.school_id,
        actorId: userData.uid,
        actorNama: userData.nama,
        action: 'AJUKAN_KOREKSI_PRESENSI',
        recordType: 'attendance',
        recordId: selectedRecord.id,
      });

      setNotification({
        type: 'success',
        text: `Pengajuan koreksi jam presensi berhasil dikirim ke Kepala Sekolah.${queued ? QUEUED_SUFFIX : ''}`,
      });

      setKoreksiModalOpen(false);
      fetchAttendanceHistory();
    } catch (err) {
      console.error(err);
      setNotification({ type: 'error', text: 'Gagal mengirim pengajuan koreksi.' });
    } finally {
      setSubmittingKoreksi(false);
    }
  };

  return (
    <div className="space-y-6 max-w-5xl mx-auto pb-6">
      {/* Header Halaman */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <h1 className="text-xl md:text-2xl font-extrabold text-slate-900 font-brand">
            Riwayat & Koreksi Presensi 🌸
          </h1>
          <p className="text-xs text-slate-500 mt-0.5 font-medium">
            Presensi dual timestamp anti-trap: jam kehadiran Anda aman saat sinyal drop.
          </p>
        </div>

        <div className="flex items-center gap-2 self-start sm:self-auto">
        <button
          onClick={() => setIzinModalOpen(true)}
          className="inline-flex items-center space-x-1.5 px-4 py-2.5 rounded-2xl bg-white border border-orange-200/80 text-orange-800 hover:bg-orange-50 text-xs font-extrabold shadow-xs transition"
        >
          <Stethoscope className="w-4 h-4" />
          <span>Ajukan Izin / Sakit</span>
        </button>

        {/* Filter Bulan */}
        <div className="flex items-center space-x-2 bg-white px-3.5 py-2 rounded-2xl border border-orange-200/80 shadow-xs">
          <Calendar className="w-4 h-4 text-orange-500" />
          <input
            type="month"
            value={selectedMonth}
            onChange={(e) => setSelectedMonth(e.target.value)}
            className="text-xs font-bold text-slate-700 bg-transparent focus:outline-none"
          />
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

      {/* Info Card: Dual Timestamp Explanation */}
      <div className="p-4 rounded-3xl bg-amber-50/70 border border-amber-200/80 text-amber-950 text-xs flex items-start space-x-3 shadow-xs">
        <HelpCircle className="w-5 h-5 text-amber-600 shrink-0 mt-0.5" />
        <div className="space-y-0.5">
          <p className="font-extrabold font-brand text-amber-900 text-sm">Proteksi Jam Hadir Guru (Anti-Trap Offline):</p>
          <p className="text-amber-800 leading-relaxed text-[11px]">
            Sistem merekam <strong>Jam Perangkat HP Anda</strong> saat tombol absen ditekan. Jika sinyal internet sekolah sedang padam dan data baru tersinkron belakangan, jam kehadiran Anda tetap dihitung berdasarkan waktu asli tombol ditekan, sehingga tidak dirugikan sebagai terlambat.
          </p>
        </div>
      </div>

      {/* Daftar Presensi */}
      <div className="bg-white rounded-3xl border border-slate-200/80 shadow-sm overflow-hidden">
        <div className="p-4 md:p-6 border-b border-slate-100 flex items-center justify-between">
          <h3 className="text-sm font-bold text-slate-800">
            Daftar Presensi {format(new Date(`${selectedMonth}-01T00:00:00`), 'MMMM yyyy', { locale: localeId })}
          </h3>
          <span className="text-xs text-slate-500 font-medium">
            Total Record: {attendanceList.length} hari
          </span>
        </div>

        {loading ? (
          <div className="p-12 text-center text-xs text-slate-400">
            Memuat riwayat presensi...
          </div>
        ) : attendanceList.length > 0 ? (
          <div className="divide-y divide-slate-100">
            {attendanceList.map((item) => {
              const isHadir = STATUS_HADIR.includes(item.status);
              const isLupaPulang = isHadir && !item.jam_pulang_device && item.tanggal < todayStr;
              const koreksiFinal = item.koreksi?.diajukan && item.koreksi?.status_koreksi !== 'menunggu';

              return (
                <div key={item.id} className="p-4 md:p-5 flex flex-col md:flex-row md:items-center justify-between gap-3 hover:bg-slate-50/80 transition">
                  <div className="space-y-1">
                    <div className="flex items-center space-x-2">
                      <span className="text-xs font-bold text-slate-800">
                        {formatTanggalIndo(item.tanggal)}
                      </span>
                      <span className={`px-2 py-0.5 rounded-full text-[10px] font-bold uppercase ${
                        item.status === 'hadir'
                          ? 'bg-emerald-50 text-emerald-700 border border-emerald-200'
                          : item.status === 'terlambat'
                          ? 'bg-amber-50 text-amber-700 border border-amber-200'
                          : 'bg-rose-50 text-rose-700 border border-rose-200'
                      }`}>
                        {item.status}
                      </span>

                      {isLupaPulang && (
                        <span className="px-2 py-0.5 rounded-full text-[10px] font-bold bg-rose-50 text-rose-700 border border-rose-200">
                          Lupa Absen Pulang
                        </span>
                      )}

                      {item.koreksi?.diajukan && (
                        <span className={`px-2 py-0.5 rounded-full text-[10px] font-semibold ${
                          item.koreksi.status_koreksi === 'disetujui'
                            ? 'bg-emerald-100 text-emerald-800'
                            : item.koreksi.status_koreksi === 'ditolak'
                            ? 'bg-rose-100 text-rose-800'
                            : 'bg-amber-100 text-amber-800 animate-pulse'
                        }`}>
                          Koreksi: {item.koreksi.status_koreksi}
                        </span>
                      )}
                    </div>

                    <div className="flex flex-wrap items-center gap-x-4 gap-y-1 text-xs text-slate-500 pt-0.5">
                      {isHadir && (
                        <>
                          <span>Datang: <strong className="text-slate-700">{item.jam_datang_device ? item.jam_datang_device.slice(0, 5) : '-'}</strong></span>
                          <span>Pulang: <strong className="text-slate-700">{item.jam_pulang_device ? item.jam_pulang_device.slice(0, 5) : '-'}</strong></span>
                        </>
                      )}
                      {item.catatan && <span className="text-slate-400">({item.catatan})</span>}
                    </div>

                    {item.koreksi?.diajukan && item.koreksi?.catatan_kepsek && (
                      <p className="text-[11px] text-rose-600 bg-rose-50 p-1.5 rounded-lg border border-rose-100 mt-1">
                        <strong>Catatan Kepsek:</strong> {item.koreksi.catatan_kepsek}
                      </p>
                    )}
                  </div>

                  {isHadir && !koreksiFinal && (
                    <div className="flex items-center space-x-2 shrink-0 pt-2 md:pt-0">
                      <button
                        onClick={() => handleOpenKoreksi(item)}
                        className={`px-3 py-1.5 rounded-xl border text-xs font-semibold transition flex items-center space-x-1 ${
                          isLupaPulang && !item.koreksi?.diajukan
                            ? 'border-rose-200 bg-rose-50 text-rose-700 hover:bg-rose-100'
                            : 'border-slate-200 text-slate-600 hover:bg-slate-100 hover:text-slate-900'
                        }`}
                      >
                        <FileText className="w-3.5 h-3.5" />
                        <span>
                          {item.koreksi?.diajukan ? 'Ubah Ajuan Koreksi' : isLupaPulang ? 'Ajukan Jam Pulang' : 'Ajukan Koreksi'}
                        </span>
                      </button>
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        ) : (
          <div className="p-12 text-center text-xs text-slate-400">
            Tidak ada riwayat presensi di bulan ini.
          </div>
        )}
      </div>

      {/* Modal Pengajuan Koreksi Presensi */}
      {koreksiModalOpen && createPortal(
        <div className="fixed inset-0 z-[100] flex items-center justify-center p-4 bg-slate-900/60 backdrop-blur-sm animate-fadeIn">
          <div className="bg-white w-full max-w-md rounded-3xl shadow-xl border border-orange-200/80 p-6">
            <div className="flex items-center space-x-3 mb-4">
              <div className="w-10 h-10 rounded-xl bg-amber-50 text-amber-600 flex items-center justify-center">
                <Clock className="w-5 h-5" />
              </div>
              <div>
                <h3 className="text-base font-bold text-slate-900 font-brand">Form Koreksi Presensi</h3>
                <p className="text-xs text-slate-500">
                  {selectedRecord ? formatTanggalIndo(selectedRecord.tanggal) : ''}
                </p>
              </div>
            </div>

            <form onSubmit={handleSubmitKoreksi} className="space-y-4">
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-semibold text-slate-700 mb-1">
                    Jam Datang Ajuan
                  </label>
                  <input
                    type="time"
                    required
                    value={jamDatangAjuan}
                    onChange={(e) => setJamDatangAjuan(e.target.value)}
                    className="w-full px-3 py-2 text-xs rounded-xl border border-slate-300 focus:outline-none focus:ring-2 focus:ring-amber-500/20 focus:border-amber-500"
                  />
                </div>

                <div>
                  <label className="block text-xs font-semibold text-slate-700 mb-1">
                    Jam Pulang Ajuan
                  </label>
                  <input
                    type="time"
                    required
                    value={jamPulangAjuan}
                    onChange={(e) => setJamPulangAjuan(e.target.value)}
                    className="w-full px-3 py-2 text-xs rounded-xl border border-slate-300 focus:outline-none focus:ring-2 focus:ring-amber-500/20 focus:border-amber-500"
                  />
                </div>
              </div>

              <div>
                <label className="block text-xs font-semibold text-slate-700 mb-1">
                  Alasan Koreksi / Keterangan
                </label>
                <textarea
                  required
                  rows={3}
                  value={alasanKoreksi}
                  onChange={(e) => setAlasanKoreksi(e.target.value)}
                  placeholder="Contoh: Lupa menekan tombol absen pulang karena mengantar anak didik, atau internet sekolah gangguan."
                  className="w-full px-3 py-2 text-xs rounded-xl border border-slate-300 focus:outline-none focus:ring-2 focus:ring-amber-500/20 focus:border-amber-500"
                />
              </div>

              <div className="p-3 bg-amber-50/50 rounded-xl text-[11px] text-slate-600 border border-amber-200/60">
                Pengajuan koreksi ini akan diteruskan ke Kepala Sekolah untuk diperiksa dan disetujui.
              </div>

              <div className="pt-2 flex items-center space-x-2">
                <button
                  type="button"
                  onClick={() => setKoreksiModalOpen(false)}
                  className="w-1/2 py-2.5 rounded-xl border border-slate-200 text-slate-600 font-bold text-xs hover:bg-slate-50 transition"
                >
                  Batal
                </button>
                <button
                  type="submit"
                  disabled={submittingKoreksi}
                  className="w-1/2 py-2.5 rounded-xl font-bold text-xs text-white bg-gradient-to-r from-amber-500 to-orange-500 hover:from-amber-600 hover:to-orange-600 shadow-md shadow-orange-500/20 transition flex items-center justify-center space-x-1"
                >
                  <Send className="w-3.5 h-3.5" />
                  <span>{submittingKoreksi ? 'Mengirim...' : 'Kirim Pengajuan'}</span>
                </button>
              </div>
            </form>
          </div>
        </div>,
        document.body
      )}

      {/* Modal Pengajuan Izin / Sakit */}
      {izinModalOpen && createPortal(
        <div className="fixed inset-0 z-[100] flex items-center justify-center p-4 bg-slate-900/60 backdrop-blur-sm animate-fadeIn">
          <div className="bg-white w-full max-w-md rounded-3xl shadow-xl border border-orange-200/80 p-6">
            <div className="flex items-center space-x-3 mb-4">
              <div className="w-10 h-10 rounded-xl bg-amber-50 text-amber-600 flex items-center justify-center">
                <Stethoscope className="w-5 h-5" />
              </div>
              <div>
                <h3 className="text-base font-bold text-slate-900 font-brand">Ajukan Izin / Sakit</h3>
                <p className="text-xs text-slate-500">Tercatat langsung di rekap presensi & honor.</p>
              </div>
            </div>

            {izinError && (
              <div className="mb-3 p-3 rounded-xl bg-rose-50 border border-rose-200 text-rose-700 text-xs font-semibold flex items-start space-x-2">
                <AlertCircle className="w-4 h-4 shrink-0 mt-0.5" />
                <span>{izinError}</span>
              </div>
            )}

            <form onSubmit={handleSubmitIzin} className="space-y-4">
              <div className="grid grid-cols-2 gap-2">
                {[
                  { id: 'izin', label: '📝 Izin' },
                  { id: 'sakit', label: '🤒 Sakit' },
                ].map((opt) => (
                  <button
                    key={opt.id}
                    type="button"
                    onClick={() => setIzinJenis(opt.id)}
                    className={`py-3 rounded-2xl text-xs font-extrabold border transition ${
                      izinJenis === opt.id
                        ? 'bg-amber-500 text-white border-amber-500 shadow-sm'
                        : 'bg-white text-slate-600 border-slate-200 hover:bg-slate-50'
                    }`}
                  >
                    {opt.label}
                  </button>
                ))}
              </div>

              <div>
                <label className="block text-xs font-semibold text-slate-700 mb-1">Tanggal</label>
                <input
                  type="date"
                  required
                  value={izinTanggal}
                  min={format(addDays(new Date(), -7), 'yyyy-MM-dd')}
                  max={format(addDays(new Date(), 30), 'yyyy-MM-dd')}
                  onChange={(e) => setIzinTanggal(e.target.value)}
                  className="w-full px-3 py-2 text-xs rounded-xl border border-slate-300 focus:outline-none focus:ring-2 focus:ring-amber-500/20 focus:border-amber-500"
                />
              </div>

              <div>
                <label className="block text-xs font-semibold text-slate-700 mb-1">Keterangan</label>
                <textarea
                  required
                  rows={3}
                  value={izinAlasan}
                  onChange={(e) => setIzinAlasan(e.target.value)}
                  placeholder={izinJenis === 'sakit' ? 'Contoh: Demam, istirahat sesuai saran dokter.' : 'Contoh: Menghadiri acara keluarga di luar kota.'}
                  className="w-full px-3 py-2 text-xs rounded-xl border border-slate-300 focus:outline-none focus:ring-2 focus:ring-amber-500/20 focus:border-amber-500"
                />
              </div>

              <div className="pt-2 flex items-center space-x-2">
                <button
                  type="button"
                  onClick={closeIzinModal}
                  className="w-1/2 py-2.5 rounded-xl border border-slate-200 text-slate-600 font-bold text-xs hover:bg-slate-50 transition"
                >
                  Batal
                </button>
                <button
                  type="submit"
                  disabled={submittingIzin}
                  className="w-1/2 py-2.5 rounded-xl font-bold text-xs text-white bg-gradient-to-r from-amber-500 to-orange-500 hover:from-amber-600 hover:to-orange-600 shadow-md shadow-orange-500/20 transition flex items-center justify-center space-x-1 disabled:opacity-60"
                >
                  <Send className="w-3.5 h-3.5" />
                  <span>{submittingIzin ? 'Mengirim...' : 'Kirim Keterangan'}</span>
                </button>
              </div>
            </form>
          </div>
        </div>,
        document.body
      )}
    </div>
  );
}


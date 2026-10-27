import React, { useState, useEffect } from 'react';
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
  MapPin
} from 'lucide-react';
import {
  collection,
  query,
  where,
  getDocs,
  orderBy,
  doc,
  updateDoc,
  serverTimestamp
} from 'firebase/firestore';
import { db } from '../../config/firebase';
import { useAuth } from '../../context/AuthContext';
import { formatTanggalIndo } from '../../utils/formatters';
import { logActivity } from '../../utils/auditLogger';

export default function PresensiGuru() {
  const { userData } = useAuth();

  const [attendanceList, setAttendanceList] = useState([]);
  const [loading, setLoading] = useState(true);
  const [selectedMonth, setSelectedMonth] = useState(
    new Date().toISOString().slice(0, 7) // '2026-10'
  );

  // State Modal Pengajuan Koreksi
  const [koreksiModalOpen, setKoreksiModalOpen] = useState(false);
  const [selectedRecord, setSelectedRecord] = useState(null);
  const [jamDatangAjuan, setJamDatangAjuan] = useState('07:30');
  const [jamPulangAjuan, setJamPulangAjuan] = useState('11:30');
  const [alasanKoreksi, setAlasanKoreksi] = useState('');
  const [submittingKoreksi, setSubmittingKoreksi] = useState(false);
  const [notification, setNotification] = useState(null);

  // Ambil riwayat presensi berdasarkan bulan
  const fetchAttendanceHistory = async () => {
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

      // Filter per bulan di sisi klien
      const filtered = list.filter(item => item.tanggal?.startsWith(selectedMonth));
      setAttendanceList(filtered);
    } catch (err) {
      console.error('Error fetching attendance history:', err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchAttendanceHistory();
  }, [userData, selectedMonth]);

  // Buka modal koreksi
  const handleOpenKoreksi = (record) => {
    setSelectedRecord(record);
    setJamDatangAjuan(record.jam_datang_device || '07:30');
    setJamPulangAjuan(record.jam_pulang_device || '11:30');
    setAlasanKoreksi(record.koreksi?.alasan || '');
    setKoreksiModalOpen(true);
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

      await updateDoc(docRef, koreksiData);

      await logActivity({
        schoolId: userData.school_id,
        actorId: userData.uid,
        actorNama: userData.nama,
        action: 'AJUKAN_KOREKSI_PRESENSI',
        recordType: 'attendance',
        recordId: selectedRecord.id,
      });

      setNotification({
        type: 'success',
        text: 'Pengajuan koreksi jam presensi berhasil dikirim ke Kepala Sekolah.',
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
    <div className="space-y-6 max-w-5xl mx-auto">
      {/* Header Halaman */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <h1 className="text-xl font-bold text-slate-900">Riwayat & Koreksi Presensi</h1>
          <p className="text-xs text-slate-500 mt-0.5">
            Presensi dual timestamp dengan proteksi sinkronisasi sinyal offline.
          </p>
        </div>

        {/* Filter Bulan */}
        <div className="flex items-center space-x-2 bg-white px-3 py-1.5 rounded-2xl border border-slate-200/80 shadow-sm">
          <Calendar className="w-4 h-4 text-slate-400" />
          <input
            type="month"
            value={selectedMonth}
            onChange={(e) => setSelectedMonth(e.target.value)}
            className="text-xs font-semibold text-slate-700 bg-transparent focus:outline-none"
          />
        </div>
      </div>

      {notification && (
        <div className={`p-4 rounded-2xl text-xs flex items-center space-x-2.5 animate-fadeIn ${
          notification.type === 'success' 
            ? 'bg-emerald-50 text-emerald-800 border border-emerald-200' 
            : 'bg-rose-50 text-rose-800 border border-rose-200'
        }`}>
          {notification.type === 'success' ? <CheckCircle2 className="w-4 h-4 text-emerald-600 shrink-0" /> : <AlertCircle className="w-4 h-4 text-rose-600 shrink-0" />}
          <span>{notification.text}</span>
        </div>
      )}

      {/* Info Card: Dual Timestamp Explanation */}
      <div className="p-4 rounded-2xl bg-indigo-50/70 border border-indigo-100 text-indigo-900 text-xs flex items-start space-x-3">
        <HelpCircle className="w-4 h-4 text-indigo-600 shrink-0 mt-0.5" />
        <div className="space-y-0.5">
          <p className="font-bold">Keamanan Catatan Jam Guru:</p>
          <p className="text-indigo-800 leading-relaxed text-[11px]">
            Sistem merekam <strong>Jam Perangkat HP</strong> saat tombol absen ditekan. Jika sinyal internet sekolah sedang mati dan data baru tersinkron belakangan, jam kehadiran Anda tetap dihitung berdasarkan waktu asli tombol ditekan, sehingga tidak dirugikan sebagai terlambat.
          </p>
        </div>
      </div>

      {/* Daftar Presensi */}
      <div className="bg-white rounded-3xl border border-slate-200/80 shadow-sm overflow-hidden">
        <div className="p-4 md:p-6 border-b border-slate-100 flex items-center justify-between">
          <h3 className="text-sm font-bold text-slate-800">
            Daftar Presensi Bulan {selectedMonth}
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
              const isLupaPulang = !item.jam_pulang_device && item.tanggal !== new Date().toISOString().split('T')[0];

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
                      <span>Datang: <strong className="text-slate-700">{item.jam_datang_device ? `${item.jam_datang_device} WIB` : '-'}</strong></span>
                      <span>Pulang: <strong className="text-slate-700">{item.jam_pulang_device ? `${item.jam_pulang_device} WIB` : '-'}</strong></span>
                      {item.catatan && <span className="text-slate-400">({item.catatan})</span>}
                    </div>

                    {item.koreksi?.diajukan && item.koreksi?.catatan_kepsek && (
                      <p className="text-[11px] text-rose-600 bg-rose-50 p-1.5 rounded-lg border border-rose-100 mt-1">
                        <strong>Catatan Kepsek:</strong> {item.koreksi.catatan_kepsek}
                      </p>
                    )}
                  </div>

                  <div className="flex items-center space-x-2 shrink-0 pt-2 md:pt-0">
                    <button
                      onClick={() => handleOpenKoreksi(item)}
                      className="px-3 py-1.5 rounded-xl border border-slate-200 text-xs font-semibold text-slate-600 hover:bg-slate-100 hover:text-slate-900 transition flex items-center space-x-1"
                    >
                      <FileText className="w-3.5 h-3.5" />
                      <span>{item.koreksi?.diajukan ? 'Ubah Ajuan Koreksi' : 'Ajukan Koreksi'}</span>
                    </button>
                  </div>
                </div>
              );
            })}
          </div>
        ) : (
          <div className="p-12 text-center text-xs text-slate-400">
            Tidak ada riwayat presensi di bulan {selectedMonth}.
          </div>
        )}
      </div>

      {/* Modal Pengajuan Koreksi Presensi */}
      {koreksiModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/60 backdrop-blur-sm animate-fadeIn">
          <div className="bg-white w-full max-w-md rounded-3xl shadow-xl border border-slate-100 p-6">
            <div className="flex items-center space-x-3 mb-4">
              <div className="w-10 h-10 rounded-xl bg-amber-50 text-amber-600 flex items-center justify-center">
                <Clock className="w-5 h-5" />
              </div>
              <div>
                <h3 className="text-base font-bold text-slate-900">Form Koreksi Presensi</h3>
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
                    className="w-full px-3 py-2 text-xs rounded-xl border border-slate-300 focus:outline-none focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-600"
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
                    className="w-full px-3 py-2 text-xs rounded-xl border border-slate-300 focus:outline-none focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-600"
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
                  className="w-full px-3 py-2 text-xs rounded-xl border border-slate-300 focus:outline-none focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-600"
                />
              </div>

              <div className="p-3 bg-slate-50 rounded-xl text-[11px] text-slate-500 border border-slate-200">
                Pengajuan koreksi ini akan diteruskan ke Kepala Sekolah untuk diperiksa dan disetujui.
              </div>

              <div className="pt-2 flex items-center space-x-2">
                <button
                  type="button"
                  onClick={() => setKoreksiModalOpen(false)}
                  className="w-1/2 py-2.5 rounded-xl border border-slate-200 text-slate-600 font-medium text-xs hover:bg-slate-50 transition"
                >
                  Batal
                </button>
                <button
                  type="submit"
                  disabled={submittingKoreksi}
                  className="w-1/2 py-2.5 rounded-xl font-medium text-xs text-white bg-indigo-600 hover:bg-indigo-700 shadow-sm transition flex items-center justify-center space-x-1"
                >
                  <Send className="w-3.5 h-3.5" />
                  <span>{submittingKoreksi ? 'Mengirim...' : 'Kirim Pengajuan'}</span>
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}


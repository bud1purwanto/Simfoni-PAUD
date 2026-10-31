import React, { useState, useEffect, useCallback } from 'react';
import {
  Calendar,
  Users,
  CheckCircle2,
  AlertCircle,
  Clock,
  Save,
  Filter,
  Heart,
  Baby,
  Smile,
  Frown,
  Check,
  ChevronLeft,
  ChevronRight,
  Sparkles
} from 'lucide-react';
import {
  collection,
  query,
  where,
  getDocs,
  doc,
  getDoc,
  setDoc,
  serverTimestamp
} from 'firebase/firestore';
import { db } from '../../config/firebase';
import { useAuth } from '../../context/AuthContext';
import { getLocalDateString, formatTanggalIndo } from '../../utils/formatters';
import { getKelompokOptions, normalizeKelompok } from '../../utils/schoolConfig';
import { logActivity } from '../../utils/auditLogger';
import { commitWrite, QUEUED_SUFFIX } from '../../utils/offlineWrite';

const STATUS_OPTS = [
  { id: 'hadir', label: 'Hadir', short: 'H', color: 'bg-emerald-500 text-white shadow-emerald-500/20' },
  { id: 'sakit', label: 'Sakit', short: 'S', color: 'bg-amber-500 text-white shadow-amber-500/20' },
  { id: 'izin', label: 'Izin', short: 'I', color: 'bg-blue-500 text-white shadow-blue-500/20' },
  { id: 'alpa', label: 'Alpa', short: 'A', color: 'bg-rose-500 text-white shadow-rose-500/20' },
];

export default function PresensiSiswa() {
  const { userData, schoolData } = useAuth();
  const [selectedTanggal, setSelectedTanggal] = useState(getLocalDateString());
  const daftarKelompok = getKelompokOptions(schoolData).filter(k => k !== 'Semua');
  const kelasSaya = normalizeKelompok(userData?.kelompok_kelas);

  const [selectedKelompok, setSelectedKelompok] = useState(
    kelasSaya && daftarKelompok.includes(kelasSaya) ? kelasSaya : (daftarKelompok[0] || 'TK A')
  );

  const [siswaList, setSiswaList] = useState([]);
  const [kehadiranState, setKehadiranState] = useState({});
  const [catatanKesehatan, setCatatanKesehatan] = useState({});
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [notification, setNotification] = useState(null);
  const [existingRecord, setExistingRecord] = useState(null);

  // Doc ID Firestore unik per sekolah, tanggal, dan rombel
  const getDocId = (tgl, klp) => `${userData?.school_id}_${tgl}_${klp.replace(/\s+/g, '_')}`;

  // Ambil Data Siswa dan Status Presensi Tanggal Terpilih
  const fetchData = useCallback(async () => {
    if (!userData?.school_id) return;
    setLoading(true);
    try {
      // 1. Ambil murid aktif pada rombel kelompok terpilih
      const qSiswa = query(
        collection(db, 'students'),
        where('school_id', '==', userData.school_id),
        where('kelompok', '==', selectedKelompok)
      );
      const snapSiswa = await getDocs(qSiswa);
      const list = snapSiswa.docs
        .map(d => ({ id: d.id, ...d.data() }))
        .filter(s => s.status === 'aktif');
      list.sort((a, b) => (a.nama_lengkap || '').localeCompare(b.nama_lengkap || ''));
      setSiswaList(list);

      // 2. Ambil dokumen presensi jika sudah pernah diisi
      const docId = getDocId(selectedTanggal, selectedKelompok);
      const docSnap = await getDoc(doc(db, 'student_attendance', docId));

      const newKehadiran = {};
      const newCatatan = {};

      if (docSnap.exists()) {
        const data = docSnap.data();
        setExistingRecord(data);
        (data.data_siswa || []).forEach(item => {
          newKehadiran[item.student_id] = item.status;
          if (item.catatan) newCatatan[item.student_id] = item.catatan;
        });
      } else {
        setExistingRecord(null);
        // Default semua siswa adalah 'hadir' untuk kemudahan pengisian cepat
        list.forEach(s => {
          newKehadiran[s.id] = 'hadir';
        });
      }

      setKehadiranState(newKehadiran);
      setCatatanKesehatan(newCatatan);
    } catch (err) {
      console.error('Error fetching student attendance:', err);
      setNotification({ type: 'error', text: 'Gagal memuat presensi murid. Periksa jaringan Anda.' });
    } finally {
      setLoading(false);
    }
  }, [userData?.school_id, selectedKelompok, selectedTanggal]);

  useEffect(() => {
    fetchData();
  }, [fetchData]);

  // Handler Ganti Status Per Siswa
  const handleStatusChange = (studentId, status) => {
    setKehadiranState(prev => ({
      ...prev,
      [studentId]: status
    }));
  };

  // Handler Set Semua Hadir Sekali Klik
  const handleSetAllHadir = () => {
    const updated = {};
    siswaList.forEach(s => {
      updated[s.id] = 'hadir';
    });
    setKehadiranState(updated);
  };

  // Hitung Agregat Kehadiran
  const hitungRekap = () => {
    let hadir = 0;
    let sakit = 0;
    let izin = 0;
    let alpa = 0;

    siswaList.forEach(s => {
      const st = kehadiranState[s.id] || 'hadir';
      if (st === 'hadir') hadir++;
      else if (st === 'sakit') sakit++;
      else if (st === 'izin') izin++;
      else if (st === 'alpa') alpa++;
    });

    return { hadir, sakit, izin, alpa, total: siswaList.length };
  };

  const rekap = hitungRekap();

  // Handler Simpan Presensi Harian
  const handleSaveAttendance = async () => {
    if (siswaList.length === 0) {
      setNotification({ type: 'error', text: 'Belum ada murid di kelompok ini untuk diabsen.' });
      return;
    }

    setSaving(true);
    try {
      const dataSiswaPayload = siswaList.map(s => ({
        student_id: s.id,
        nama: s.nama_lengkap,
        nama_panggilan: s.nama_panggilan || '',
        status: kehadiranState[s.id] || 'hadir',
        catatan: catatanKesehatan[s.id] || ''
      }));

      const docId = getDocId(selectedTanggal, selectedKelompok);
      const payload = {
        id: docId,
        school_id: userData.school_id,
        tanggal: selectedTanggal,
        kelompok: selectedKelompok,
        guru_id: userData.uid,
        nama_guru: userData.nama,
        total_siswa: siswaList.length,
        rekap,
        data_siswa: dataSiswaPayload,
        updated_at: serverTimestamp(),
      };

      if (!existingRecord) {
        payload.created_at = serverTimestamp();
      }

      const { queued } = await commitWrite(setDoc(doc(db, 'student_attendance', docId), payload, { merge: true }));

      logActivity({
        schoolId: userData.school_id,
        actorId: userData.uid,
        actorNama: userData.nama,
        action: 'SUBMIT_STUDENT_ATTENDANCE',
        recordType: 'student_attendance',
        recordId: docId,
        detail: { kelompok: selectedKelompok, tanggal: selectedTanggal, hadir: rekap.hadir, total: rekap.total }
      });

      setExistingRecord(payload);
      setNotification({
        type: 'success',
        text: `Presensi ${selectedKelompok} tanggal ${formatTanggalIndo(selectedTanggal)} berhasil disimpan!${queued ? QUEUED_SUFFIX : ''}`
      });
    } catch (err) {
      console.error('Error saving student attendance:', err);
      setNotification({ type: 'error', text: 'Gagal menyimpan presensi murid. Silakan coba kembali.' });
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="max-w-5xl mx-auto space-y-5 animate-in fade-in duration-200">
      {/* Header Halaman Ceria */}
      <div className="bg-gradient-to-r from-emerald-600 via-teal-600 to-cyan-600 rounded-3xl p-5 md:p-7 text-white shadow-lg shadow-teal-600/20 relative overflow-hidden">
        <div className="absolute right-0 top-0 bottom-0 opacity-10 pointer-events-none flex items-center pr-6">
          <Baby className="w-48 h-48" />
        </div>
        <div className="relative z-10 flex flex-col md:flex-row md:items-center justify-between gap-4">
          <div>
            <div className="inline-flex items-center space-x-1.5 px-3 py-1 rounded-xl bg-white/20 backdrop-blur-md text-[11px] font-bold tracking-wide uppercase mb-2">
              <Sparkles className="w-3.5 h-3.5" />
              <span>Pilar 1 - Presensi Kehadiran Digital</span>
            </div>
            <h1 className="text-xl md:text-2xl font-black font-brand">
              Presensi Murid Harian 🎒
            </h1>
            <p className="text-xs md:text-sm text-teal-100 max-w-xl mt-1 leading-relaxed">
              Catat kehadiran 21 anak didik per rombel dengan cepat. Lengkapi catatan bila ada anak yang batuk, demam, atau butuh pemantauan guru saat KBM.
            </p>
          </div>

          {/* Quick Counter */}
          <div className="flex items-center gap-2 bg-white/10 backdrop-blur-md p-2.5 rounded-2xl border border-white/20 shrink-0">
            <div className="text-center px-2">
              <div className="text-lg font-black font-brand leading-none">{rekap.hadir}</div>
              <div className="text-[10px] text-teal-100 font-bold uppercase mt-0.5">Hadir</div>
            </div>
            <div className="w-px h-6 bg-white/20" />
            <div className="text-center px-2">
              <div className="text-lg font-black font-brand leading-none text-amber-200">{rekap.sakit}</div>
              <div className="text-[10px] text-teal-100 font-bold uppercase mt-0.5">Sakit</div>
            </div>
            <div className="w-px h-6 bg-white/20" />
            <div className="text-center px-2">
              <div className="text-lg font-black font-brand leading-none text-blue-200">{rekap.izin}</div>
              <div className="text-[10px] text-teal-100 font-bold uppercase mt-0.5">Izin</div>
            </div>
            <div className="w-px h-6 bg-white/20" />
            <div className="text-center px-2">
              <div className="text-lg font-black font-brand leading-none text-rose-200">{rekap.alpa}</div>
              <div className="text-[10px] text-teal-100 font-bold uppercase mt-0.5">Alpa</div>
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
          <button
            onClick={() => setNotification(null)}
            className="text-slate-400 hover:text-slate-600 font-bold ml-3"
          >
            ✕
          </button>
        </div>
      )}

      {/* Bar Kontrol Tanggal & Kelompok Rombel */}
      <div className="bg-white rounded-3xl p-4 border border-orange-100 shadow-xs flex flex-col md:flex-row gap-3 items-center justify-between">
        <div className="flex flex-wrap items-center gap-2 w-full md:w-auto">
          {/* Pemilih Tanggal */}
          <div className="flex items-center space-x-1.5 bg-slate-50 border border-slate-200 px-3 py-1.5 rounded-2xl text-xs">
            <Calendar className="w-4 h-4 text-slate-500" />
            <input
              type="date"
              value={selectedTanggal}
              onChange={(e) => setSelectedTanggal(e.target.value)}
              className="bg-transparent font-bold text-slate-700 focus:outline-none text-xs"
            />
          </div>

          {/* Pemilih Kelompok */}
          <div className="flex items-center space-x-1 bg-slate-50 border border-slate-200 p-1 rounded-2xl">
            {daftarKelompok.map((klp) => (
              <button
                key={klp}
                onClick={() => setSelectedKelompok(klp)}
                className={`px-3 py-1.5 rounded-xl text-xs font-bold transition ${
                  selectedKelompok === klp
                    ? 'bg-gradient-to-r from-emerald-500 to-teal-500 text-white shadow-xs'
                    : 'text-slate-600 hover:text-slate-900'
                }`}
              >
                {klp}
              </button>
            ))}
          </div>
        </div>

        {/* Tombol Aksi Cepat */}
        <div className="flex items-center space-x-2 w-full md:w-auto justify-end">
          <button
            onClick={handleSetAllHadir}
            className="px-3.5 py-2 rounded-2xl border border-emerald-200 bg-emerald-50 text-emerald-700 hover:bg-emerald-100 text-xs font-bold transition flex items-center space-x-1.5"
            title="Tandai semua anak Hadir sekaligus"
          >
            <Check className="w-3.5 h-3.5" />
            <span>Semua Hadir</span>
          </button>

          <button
            onClick={handleSaveAttendance}
            disabled={saving || loading || siswaList.length === 0}
            className="px-5 py-2.5 rounded-2xl bg-gradient-to-r from-emerald-500 to-teal-500 hover:from-emerald-600 hover:to-teal-600 text-white text-xs font-bold shadow-md shadow-teal-500/20 transition flex items-center space-x-1.5 disabled:opacity-50"
          >
            <Save className="w-4 h-4" />
            <span>{saving ? 'Menyimpan...' : 'Simpan Presensi'}</span>
          </button>
        </div>
      </div>

      {/* Konten Daftar Siswa */}
      {loading ? (
        <div className="py-16 text-center text-slate-400 space-y-2">
          <div className="w-8 h-8 border-3 border-teal-500 border-t-transparent rounded-full animate-spin mx-auto" />
          <p className="text-xs font-medium">Memuat data murid kelompok {selectedKelompok}...</p>
        </div>
      ) : siswaList.length === 0 ? (
        <div className="bg-white rounded-3xl p-10 border border-dashed border-teal-200 text-center space-y-3">
          <div className="w-14 h-14 rounded-2xl bg-teal-50 text-teal-600 flex items-center justify-center mx-auto">
            <Baby className="w-7 h-7" />
          </div>
          <h3 className="text-sm font-bold text-slate-700 font-brand">
            Belum Ada Murid Terdaftar di {selectedKelompok}
          </h3>
          <p className="text-xs text-slate-400 max-w-sm mx-auto leading-relaxed">
            Silakan tambahkan data murid terlebih dahulu melalui menu <strong>Murid</strong> agar dapat mencatat presensi rombel ini.
          </p>
        </div>
      ) : (
        <div className="bg-white rounded-3xl border border-orange-100 shadow-xs overflow-hidden">
          <div className="p-4 bg-slate-50/70 border-b border-slate-100 flex items-center justify-between">
            <div className="flex items-center space-x-2">
              <Users className="w-4 h-4 text-teal-600" />
              <span className="text-xs font-bold text-slate-700">
                Daftar Presensi {selectedKelompok} ({siswaList.length} Murid)
              </span>
            </div>
            {existingRecord && (
              <span className="text-[10px] text-emerald-700 bg-emerald-50 border border-emerald-200 px-2 py-0.5 rounded-lg font-bold">
                ✓ Sudah Tersimpan
              </span>
            )}
          </div>

          <div className="divide-y divide-slate-100">
            {siswaList.map((siswa, idx) => {
              const currentStatus = kehadiranState[siswa.id] || 'hadir';
              const isLaki = siswa.jenis_kelamin === 'L';

              return (
                <div
                  key={siswa.id}
                  className="p-3.5 sm:p-4 hover:bg-amber-50/20 transition flex flex-col sm:flex-row sm:items-center justify-between gap-3"
                >
                  {/* Nama & Info Siswa */}
                  <div className="flex items-center space-x-3">
                    <span className="text-xs font-bold text-slate-400 w-5 text-center">
                      {idx + 1}
                    </span>
                    <div className={`w-10 h-10 rounded-2xl flex items-center justify-center font-black text-xs shrink-0 ${
                      isLaki ? 'bg-blue-100 text-blue-700' : 'bg-pink-100 text-pink-700'
                    }`}>
                      {isLaki ? '👦' : '👧'}
                    </div>
                    <div>
                      <div className="flex items-center space-x-2">
                        <h4 className="text-xs font-bold text-slate-800 font-brand">
                          {siswa.nama_lengkap}
                        </h4>
                        {siswa.nama_panggilan && (
                          <span className="text-[10px] text-slate-400">({siswa.nama_panggilan})</span>
                        )}
                      </div>
                      {siswa.catatan_khusus && (
                        <p className="text-[10px] text-amber-600 line-clamp-1 font-medium">
                          ⚠️ {siswa.catatan_khusus}
                        </p>
                      )}
                    </div>
                  </div>

                  {/* Tombol Pilihan Status H/S/I/A & Catatan Tambahan */}
                  <div className="flex flex-wrap items-center gap-2 justify-end pl-8 sm:pl-0">
                    <div className="flex items-center bg-slate-100 p-1 rounded-2xl border border-slate-200/80">
                      {STATUS_OPTS.map(opt => {
                        const isSelected = currentStatus === opt.id;
                        return (
                          <button
                            key={opt.id}
                            onClick={() => handleStatusChange(siswa.id, opt.id)}
                            className={`px-3 py-1.5 rounded-xl text-xs font-extrabold transition ${
                              isSelected
                                ? opt.color
                                : 'text-slate-500 hover:text-slate-800'
                            }`}
                          >
                            {opt.short}
                          </button>
                        );
                      })}
                    </div>

                    {/* Input Catatan Cepat (misal batuk/demam) jika sakit atau izin */}
                    {(currentStatus === 'sakit' || currentStatus === 'izin') && (
                      <input
                        type="text"
                        placeholder="Keterangan sakit/izin..."
                        value={catatanKesehatan[siswa.id] || ''}
                        onChange={(e) => setCatatanKesehatan({ ...catatanKesehatan, [siswa.id]: e.target.value })}
                        className="px-3 py-1.5 rounded-xl border border-slate-200 text-xs w-40 focus:ring-2 focus:ring-teal-400 focus:outline-none"
                      />
                    )}
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      )}
    </div>
  );
}

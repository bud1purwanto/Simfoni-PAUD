import React, { useState, useEffect, useCallback } from 'react';
import {
  Sparkles,
  BookOpen,
  Calendar,
  Filter,
  Users,
  Award,
  Plus,
  Trash2,
  CheckCircle2,
  Heart,
  Baby,
  Smile,
  FileText,
  Star,
  ExternalLink
} from 'lucide-react';
import {
  collection,
  query,
  where,
  getDocs,
  addDoc,
  deleteDoc,
  doc,
  serverTimestamp
} from 'firebase/firestore';
import { db } from '../../config/firebase';
import { useAuth } from '../../context/AuthContext';
import { getLocalDateString, formatTanggalIndo } from '../../utils/formatters';
import { getKelompokOptions, normalizeKelompok } from '../../utils/schoolConfig';
import { logActivity } from '../../utils/auditLogger';
import { commitWrite, QUEUED_SUFFIX } from '../../utils/offlineWrite';
import ModalKonfirmasi from '../../components/ui/ModalKonfirmasi';

const ELEMEN_CAPAIAN = [
  'Nilai Agama & Budi Pekerti',
  'Jati Diri',
  'Dasar-dasar Literasi & STEAM'
];

const TIPE_ASESMEN = [
  { id: 'anekdot', label: 'Catatan Anekdot', desc: 'Peristiwa atau perilaku bermakna anak' },
  { id: 'hasil_karya', label: 'Hasil Karya / Portofolio', desc: 'Kreasi seni, balok, gambar, sains anak' },
  { id: 'ceklis', label: 'Ceklis Ketercapaian', desc: 'Indikator capaian tujuan belajar' },
];

export default function AsesmenSiswaGuru() {
  const { userData, schoolData } = useAuth();
  const daftarKelompok = getKelompokOptions(schoolData).filter(k => k !== 'Semua');
  const kelasSaya = normalizeKelompok(userData?.kelompok_kelas);

  const [selectedKelompok, setSelectedKelompok] = useState(
    kelasSaya && daftarKelompok.includes(kelasSaya) ? kelasSaya : (daftarKelompok[0] || 'TK A')
  );

  const [siswaList, setSiswaList] = useState([]);
  const [asesmenList, setAsesmenList] = useState([]);
  const [loading, setLoading] = useState(true);
  const [formOpen, setFormOpen] = useState(false);
  const [saving, setSaving] = useState(false);
  const [notification, setNotification] = useState(null);

  // Form State
  const [selectedStudentId, setSelectedStudentId] = useState('');
  const [tanggal, setTanggal] = useState(getLocalDateString());
  const [mingguKe, setMingguKe] = useState(1);
  const [tipeAsesmen, setTipeAsesmen] = useState('anekdot');
  const [elemenTerpilih, setElemenTerpilih] = useState([ELEMEN_CAPAIAN[0]]);
  const [deskripsi, setDeskripsi] = useState('');
  const [fotoUrl, setFotoUrl] = useState('');
  const [umpanBalik, setUmpanBalik] = useState('');

  // Delete State
  const [deleteModalOpen, setDeleteModalOpen] = useState(false);
  const [itemToDelete, setItemToDelete] = useState(null);

  // Filter Siswa di Tab Tampilan
  const [filterSiswaId, setFilterSiswaId] = useState('semua');

  // Load Siswa & Asesmen
  const fetchData = useCallback(async () => {
    if (!userData?.school_id) return;
    setLoading(true);
    try {
      // 1. Ambil data siswa kelompok terpilih
      const qSiswa = query(
        collection(db, 'students'),
        where('school_id', '==', userData.school_id),
        where('kelompok', '==', selectedKelompok)
      );
      const snapSiswa = await getDocs(qSiswa);
      const sList = snapSiswa.docs
        .map(d => ({ id: d.id, ...d.data() }))
        .filter(s => s.status === 'aktif');
      sList.sort((a, b) => (a.nama_lengkap || '').localeCompare(b.nama_lengkap || ''));
      setSiswaList(sList);

      if (sList.length > 0 && !selectedStudentId) {
        setSelectedStudentId(sList[0].id);
      }

      // 2. Ambil catatan asesmen
      const qAsesmen = query(
        collection(db, 'student_assessments'),
        where('school_id', '==', userData.school_id),
        where('kelompok', '==', selectedKelompok)
      );
      const snapAsesmen = await getDocs(qAsesmen);
      const aList = snapAsesmen.docs.map(d => ({ id: d.id, ...d.data() }));
      aList.sort((a, b) => (b.tanggal || '').localeCompare(a.tanggal || ''));
      setAsesmenList(aList);
    } catch (err) {
      console.error('Error fetching assessments:', err);
      setNotification({ type: 'error', text: 'Gagal memuat catatan asesmen murid.' });
    } finally {
      setLoading(false);
    }
  }, [userData?.school_id, selectedKelompok]);

  useEffect(() => {
    fetchData();
  }, [fetchData]);

  // Toggle Elemen Capaian
  const toggleElemen = (el) => {
    setElemenTerpilih(prev =>
      prev.includes(el) ? prev.filter(x => x !== el) : [...prev, el]
    );
  };

  // Simpan Asesmen
  const handleSubmitAsesmen = async (e) => {
    e.preventDefault();
    const siswa = siswaList.find(s => s.id === selectedStudentId);
    if (!siswa) {
      setNotification({ type: 'error', text: 'Pilih murid terlebih dahulu.' });
      return;
    }
    if (!deskripsi.trim()) {
      setNotification({ type: 'error', text: 'Deskripsi pengamatan perkembangan wajib diisi.' });
      return;
    }

    setSaving(true);
    try {
      const payload = {
        school_id: userData.school_id,
        student_id: siswa.id,
        nama_siswa: siswa.nama_lengkap,
        nama_panggilan: siswa.nama_panggilan || '',
        kelompok: selectedKelompok,
        guru_id: userData.uid,
        nama_guru: userData.nama,
        tanggal,
        minggu_ke: Number(mingguKe),
        tipe_asesmen: tipeAsesmen,
        elemen_capaian: elemenTerpilih,
        deskripsi_pengamatan: deskripsi.trim(),
        foto_url: fotoUrl.trim() || null,
        umpan_balik_guru: umpanBalik.trim(),
        created_at: serverTimestamp(),
        updated_at: serverTimestamp()
      };

      const { queued } = await commitWrite(addDoc(collection(db, 'student_assessments'), payload));

      logActivity({
        schoolId: userData.school_id,
        actorId: userData.uid,
        actorNama: userData.nama,
        action: 'SUBMIT_STUDENT_ASSESSMENT',
        recordType: 'student_assessments',
        recordId: 'new',
        detail: { nama: siswa.nama_lengkap, tipe: tipeAsesmen, kelompok: selectedKelompok }
      });

      setNotification({
        type: 'success',
        text: `Asesmen capaian untuk ${siswa.nama_panggilan || siswa.nama_lengkap} berhasil disimpan!${queued ? QUEUED_SUFFIX : ''}`
      });

      // Reset
      setDeskripsi('');
      setFotoUrl('');
      setUmpanBalik('');
      setFormOpen(false);
      await fetchData();
    } catch (err) {
      console.error('Error saving assessment:', err);
      setNotification({ type: 'error', text: 'Gagal menyimpan data asesmen murid.' });
    } finally {
      setSaving(false);
    }
  };

  // Hapus Asesmen
  const handleConfirmDelete = async () => {
    if (!itemToDelete) return;
    setSaving(true);
    try {
      await commitWrite(deleteDoc(doc(db, 'student_assessments', itemToDelete.id)));
      setNotification({ type: 'success', text: 'Catatan asesmen berhasil dihapus.' });
      setDeleteModalOpen(false);
      setItemToDelete(null);
      await fetchData();
    } catch (err) {
      console.error('Error deleting assessment:', err);
      setNotification({ type: 'error', text: 'Gagal menghapus asesmen.' });
    } finally {
      setSaving(false);
    }
  };

  const filteredAsesmen = asesmenList.filter(item => {
    if (filterSiswaId === 'semua') return true;
    return item.student_id === filterSiswaId;
  });

  return (
    <div className="max-w-6xl mx-auto space-y-5 animate-in fade-in duration-200">
      {/* Header Halaman Ceria */}
      <div className="bg-gradient-to-r from-rose-500 via-pink-600 to-purple-600 rounded-3xl p-5 md:p-7 text-white shadow-lg shadow-pink-600/20 relative overflow-hidden">
        <div className="absolute right-0 top-0 bottom-0 opacity-10 pointer-events-none flex items-center pr-6">
          <Award className="w-48 h-48" />
        </div>
        <div className="relative z-10 flex flex-col md:flex-row md:items-center justify-between gap-4">
          <div>
            <div className="inline-flex items-center space-x-1.5 px-3 py-1 rounded-xl bg-white/20 backdrop-blur-md text-[11px] font-bold tracking-wide uppercase mb-2">
              <Sparkles className="w-3.5 h-3.5" />
              <span>Pilar 4 - Administrasi & Asesmen Kurikulum Merdeka</span>
            </div>
            <h1 className="text-xl md:text-2xl font-black font-brand">
              Capaian Perkembangan 21 Siswa 🌟
            </h1>
            <p className="text-xs md:text-sm text-pink-100 max-w-xl mt-1 leading-relaxed">
              Catat observasi otentik anak didik secara berkala: Catatan Anekdot, Hasil Karya/Portofolio, dan Ceklis Capaian Elemen Belajar PAUD.
            </p>
          </div>

          <button
            onClick={() => setFormOpen(!formOpen)}
            className="px-4 py-3 rounded-2xl bg-white text-pink-600 hover:bg-pink-50 font-bold text-xs shadow-md transition flex items-center justify-center space-x-2 shrink-0"
          >
            <Plus className="w-4 h-4 stroke-[2.5]" />
            <span>{formOpen ? 'Tutup Form' : 'Catat Asesmen Baru'}</span>
          </button>
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

      {/* Bar Kontrol Kelompok & Filter Murid */}
      <div className="bg-white rounded-3xl p-4 border border-pink-100 shadow-xs flex flex-col sm:flex-row gap-3 items-center justify-between">
        <div className="flex items-center space-x-2 w-full sm:w-auto">
          <span className="text-xs font-bold text-slate-500">Kelompok:</span>
          <div className="flex items-center space-x-1 bg-slate-50 border border-slate-200 p-1 rounded-2xl">
            {daftarKelompok.map((klp) => (
              <button
                key={klp}
                onClick={() => setSelectedKelompok(klp)}
                className={`px-3 py-1.5 rounded-xl text-xs font-bold transition ${
                  selectedKelompok === klp
                    ? 'bg-gradient-to-r from-pink-500 to-rose-500 text-white shadow-xs'
                    : 'text-slate-600 hover:text-slate-900'
                }`}
              >
                {klp}
              </button>
            ))}
          </div>
        </div>

        {/* Filter Siswa */}
        <div className="flex items-center space-x-2 w-full sm:w-auto justify-end">
          <Filter className="w-3.5 h-3.5 text-slate-400" />
          <select
            value={filterSiswaId}
            onChange={(e) => setFilterSiswaId(e.target.value)}
            className="px-3 py-1.5 rounded-2xl border border-slate-200 text-xs bg-white text-slate-700 font-medium focus:outline-none focus:ring-2 focus:ring-pink-400"
          >
            <option value="semua">Semua Murid ({siswaList.length})</option>
            {siswaList.map(s => (
              <option key={s.id} value={s.id}>{s.nama_lengkap}</option>
            ))}
          </select>
        </div>
      </div>

      {/* Form Input Asesmen Baru (Collapsible) */}
      {formOpen && (
        <form onSubmit={handleSubmitAsesmen} className="bg-white rounded-3xl p-6 border border-pink-100 shadow-md space-y-4 animate-in slide-in-from-top-4 duration-200">
          <div className="flex items-center space-x-2 pb-2 border-b border-slate-100 text-pink-900 font-bold text-sm font-brand">
            <Award className="w-4 h-4 text-pink-600" />
            <span>Form Observasi Capaian Perkembangan Anak</span>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
            <div>
              <label className="text-xs font-bold text-slate-700">Nama Murid <span className="text-rose-500">*</span></label>
              <select
                required
                value={selectedStudentId}
                onChange={(e) => setSelectedStudentId(e.target.value)}
                className="w-full mt-1 px-3.5 py-2.5 rounded-2xl border border-slate-200 text-xs bg-white focus:ring-2 focus:ring-pink-400 focus:outline-none"
              >
                {siswaList.map(s => (
                  <option key={s.id} value={s.id}>{s.nama_lengkap} ({s.nama_panggilan || 'Anak'})</option>
                ))}
              </select>
            </div>

            <div>
              <label className="text-xs font-bold text-slate-700">Tanggal Observasi</label>
              <input
                type="date"
                value={tanggal}
                onChange={(e) => setTanggal(e.target.value)}
                className="w-full mt-1 px-3.5 py-2.5 rounded-2xl border border-slate-200 text-xs focus:ring-2 focus:ring-pink-400 focus:outline-none"
              />
            </div>

            <div>
              <label className="text-xs font-bold text-slate-700">Minggu Ke-</label>
              <input
                type="number"
                min="1"
                max="24"
                value={mingguKe}
                onChange={(e) => setMingguKe(e.target.value)}
                className="w-full mt-1 px-3.5 py-2.5 rounded-2xl border border-slate-200 text-xs focus:ring-2 focus:ring-pink-400 focus:outline-none"
              />
            </div>
          </div>

          {/* Tipe Asesmen */}
          <div>
            <label className="text-xs font-bold text-slate-700">Instrumen Asesmen Kurikulum Merdeka</label>
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-2 mt-1">
              {TIPE_ASESMEN.map(t => (
                <button
                  key={t.id}
                  type="button"
                  onClick={() => setTipeAsesmen(t.id)}
                  className={`p-3 rounded-2xl text-left border transition ${
                    tipeAsesmen === t.id
                      ? 'bg-pink-50 border-pink-300 text-pink-900 shadow-xs'
                      : 'border-slate-200 text-slate-600 hover:bg-slate-50'
                  }`}
                >
                  <div className="text-xs font-bold">{t.label}</div>
                  <div className="text-[10px] text-slate-400 mt-0.5">{t.desc}</div>
                </button>
              ))}
            </div>
          </div>

          {/* Elemen Capaian Pembelajaran */}
          <div>
            <label className="text-xs font-bold text-slate-700">Elemen Capaian Pembelajaran Teramati</label>
            <div className="flex flex-wrap gap-2 mt-1.5">
              {ELEMEN_CAPAIAN.map(el => {
                const isSelected = elemenTerpilih.includes(el);
                return (
                  <button
                    key={el}
                    type="button"
                    onClick={() => toggleElemen(el)}
                    className={`px-3 py-1.5 rounded-xl text-xs font-bold border transition ${
                      isSelected
                        ? 'bg-purple-600 text-white border-purple-600 shadow-xs'
                        : 'border-slate-200 text-slate-600 hover:bg-slate-50'
                    }`}
                  >
                    {isSelected ? '✓ ' : '+ '}{el}
                  </button>
                );
              })}
            </div>
          </div>

          {/* Deskripsi Pengamatan */}
          <div>
            <label className="text-xs font-bold text-slate-700">Deskripsi Pengamatan / Narasi Perilaku <span className="text-rose-500">*</span></label>
            <textarea
              rows={3}
              required
              value={deskripsi}
              onChange={(e) => setDeskripsi(e.target.value)}
              placeholder="Contoh: Saat bermain sentra balok, Azzam mampu menyusun 10 balok tinggi secara seimbang dan mengucapkan syukur ketika menara berhasil berdiri tanpa jatuh..."
              className="w-full mt-1 px-3.5 py-2.5 rounded-2xl border border-slate-200 text-xs focus:ring-2 focus:ring-pink-400 focus:outline-none resize-none"
            />
          </div>

          {/* Foto Bukti Karya / Link */}
          <div>
            <label className="text-xs font-bold text-slate-700">Tautan Foto Karya / Dokumentasi (Opsional)</label>
            <input
              type="url"
              value={fotoUrl}
              onChange={(e) => setFotoUrl(e.target.value)}
              placeholder="https://... (URL foto hasil karya anak)"
              className="w-full mt-1 px-3.5 py-2 rounded-2xl border border-slate-200 text-xs focus:ring-2 focus:ring-pink-400 focus:outline-none"
            />
          </div>

          {/* Umpan Balik Guru */}
          <div>
            <label className="text-xs font-bold text-slate-700">Umpan Balik & Rencana Pendampingan Lanjutan</label>
            <input
              type="text"
              value={umpanBalik}
              onChange={(e) => setUmpanBalik(e.target.value)}
              placeholder="Contoh: Ajak anak mengeksplorasi jembatan lengkung pada KBM berikutnya."
              className="w-full mt-1 px-3.5 py-2 rounded-2xl border border-slate-200 text-xs focus:ring-2 focus:ring-pink-400 focus:outline-none"
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
              className="px-5 py-2.5 rounded-2xl bg-gradient-to-r from-pink-500 to-rose-500 hover:from-pink-600 hover:to-rose-600 text-white text-xs font-bold shadow-md shadow-pink-500/20 transition flex items-center space-x-1.5"
            >
              <CheckCircle2 className="w-4 h-4" />
              <span>{saving ? 'Menyimpan...' : 'Simpan Asesmen Murid'}</span>
            </button>
          </div>
        </form>
      )}

      {/* Daftar Catatan Asesmen Siswa */}
      {loading ? (
        <div className="py-16 text-center text-slate-400 space-y-2">
          <div className="w-8 h-8 border-3 border-pink-500 border-t-transparent rounded-full animate-spin mx-auto" />
          <p className="text-xs font-medium">Memuat rekam asesmen murid...</p>
        </div>
      ) : filteredAsesmen.length === 0 ? (
        <div className="bg-white rounded-3xl p-10 border border-dashed border-pink-200 text-center space-y-3">
          <div className="w-14 h-14 rounded-2xl bg-pink-50 text-pink-600 flex items-center justify-center mx-auto">
            <Award className="w-7 h-7" />
          </div>
          <h3 className="text-sm font-bold text-slate-700 font-brand">Belum Ada Catatan Asesmen</h3>
          <p className="text-xs text-slate-400 max-w-sm mx-auto leading-relaxed">
            Mulai rekam perkembangan 21 anak didik kelompok {selectedKelompok} dengan mengklik tombol "Catat Asesmen Baru" di atas.
          </p>
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          {filteredAsesmen.map((item) => {
            const tipeLabel = TIPE_ASESMEN.find(t => t.id === item.tipe_asesmen)?.label || item.tipe_asesmen;
            return (
              <div
                key={item.id}
                className="bg-white rounded-3xl p-5 border border-pink-100/80 shadow-xs hover:shadow-md transition flex flex-col justify-between space-y-3"
              >
                <div className="space-y-2">
                  <div className="flex items-center justify-between">
                    <div className="flex items-center space-x-2">
                      <div className="w-8 h-8 rounded-xl bg-pink-100 text-pink-700 font-bold text-xs flex items-center justify-center">
                        👶
                      </div>
                      <div>
                        <h4 className="text-xs font-bold text-slate-800 font-brand">
                          {item.nama_siswa}
                        </h4>
                        <span className="text-[10px] text-slate-400">
                          {formatTanggalIndo(item.tanggal)} • Mg {item.minggu_ke}
                        </span>
                      </div>
                    </div>
                    <span className="text-[10px] font-bold px-2 py-0.5 rounded-lg bg-pink-50 text-pink-700 border border-pink-200">
                      {tipeLabel}
                    </span>
                  </div>

                  {/* Badges Elemen Capaian */}
                  <div className="flex flex-wrap gap-1">
                    {(item.elemen_capaian || []).map(el => (
                      <span key={el} className="text-[9.5px] font-semibold px-2 py-0.2 rounded-md bg-purple-50 text-purple-700">
                        {el}
                      </span>
                    ))}
                  </div>

                  <p className="text-xs text-slate-600 leading-relaxed bg-slate-50 p-3 rounded-2xl border border-slate-100">
                    "{item.deskripsi_pengamatan}"
                  </p>

                  {item.umpan_balik_guru && (
                    <div className="text-[11px] text-amber-900 bg-amber-50/70 p-2.5 rounded-xl border border-amber-200/50">
                      <strong>Tindak Lanjut:</strong> {item.umpan_balik_guru}
                    </div>
                  )}

                  {item.foto_url && (
                    <a
                      href={item.foto_url}
                      target="_blank"
                      rel="noreferrer"
                      className="inline-flex items-center space-x-1 text-[10px] font-bold text-pink-600 hover:text-pink-700"
                    >
                      <ExternalLink className="w-3 h-3" />
                      <span>Lihat Foto Hasil Karya</span>
                    </a>
                  )}
                </div>

                <div className="pt-2 border-t border-slate-100 flex items-center justify-between text-[11px] text-slate-400">
                  <span>Guru: {item.nama_guru}</span>
                  <button
                    onClick={() => {
                      setItemToDelete(item);
                      setDeleteModalOpen(true);
                    }}
                    className="p-1.5 rounded-xl text-slate-400 hover:text-rose-600 hover:bg-rose-50 transition"
                    title="Hapus Catatan"
                  >
                    <Trash2 className="w-4 h-4" />
                  </button>
                </div>
              </div>
            );
          })}
        </div>
      )}

      {/* Modal Konfirmasi Hapus */}
      <ModalKonfirmasi
        isOpen={deleteModalOpen}
        title="Hapus Catatan Asesmen?"
        message={`Apakah Anda yakin ingin menghapus catatan capaian perkembangan untuk "${itemToDelete?.nama_siswa}"?`}
        confirmText="Ya, Hapus"
        cancelText="Batal"
        type="danger"
        loading={saving}
        onConfirm={handleConfirmDelete}
        onClose={() => {
          setDeleteModalOpen(false);
          setItemToDelete(null);
        }}
      />
    </div>
  );
}

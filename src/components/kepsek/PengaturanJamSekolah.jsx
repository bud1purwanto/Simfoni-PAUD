import React, { useState, useEffect } from 'react';
import { Clock, ChevronDown, Save } from 'lucide-react';
import { doc, updateDoc, serverTimestamp } from 'firebase/firestore';
import { db } from '../../config/firebase';
import { useAuth } from '../../context/AuthContext';
import { logActivity } from '../../utils/auditLogger';
import { getJamMasuk, getJamPulang, getToleransiMenit, getHariKerja, toMinutes } from '../../utils/schoolConfig';

/**
 * Pengaturan operasional jam sekolah oleh Kepala Sekolah.
 * Nilai ini menentukan status 'terlambat', menit keterlambatan, dan hari kerja efektif
 * pada rekap PDF/Excel. Security Rules membatasi Kepsek hanya pada field-field ini.
 */
export default function PengaturanJamSekolah({ onSaved }) {
  const { userData, schoolData, reloadUserData } = useAuth();
  const [open, setOpen] = useState(false);
  const [jamMasuk, setJamMasuk] = useState(getJamMasuk(schoolData));
  const [jamPulang, setJamPulang] = useState(getJamPulang(schoolData));
  const [toleransi, setToleransi] = useState(getToleransiMenit(schoolData));
  const [hariKerja, setHariKerja] = useState(getHariKerja(schoolData));
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');

  useEffect(() => {
    setJamMasuk(getJamMasuk(schoolData));
    setJamPulang(getJamPulang(schoolData));
    setToleransi(getToleransiMenit(schoolData));
    setHariKerja(getHariKerja(schoolData));
  }, [schoolData]);

  const handleSave = async (e) => {
    e.preventDefault();
    setError('');
    if (toMinutes(jamPulang) <= toMinutes(jamMasuk)) {
      setError('Jam pulang harus setelah jam masuk.');
      return;
    }
    const tol = Math.max(0, Math.min(120, Number(toleransi) || 0));

    setSaving(true);
    try {
      await updateDoc(doc(db, 'schools', userData.school_id), {
        jam_masuk: jamMasuk,
        jam_pulang: jamPulang,
        toleransi_terlambat_menit: tol,
        hari_kerja: Number(hariKerja) === 6 ? 6 : 5,
        updated_at: serverTimestamp(),
      });
      logActivity({
        schoolId: userData.school_id,
        actorId: userData.uid,
        actorNama: userData.nama,
        action: 'UPDATE_JAM_SEKOLAH',
        recordType: 'schools',
        recordId: userData.school_id,
        detail: { jam_masuk: jamMasuk, jam_pulang: jamPulang, toleransi: tol },
      });
      await reloadUserData();
      setOpen(false);
      onSaved?.();
    } catch (err) {
      console.error('Gagal menyimpan jam sekolah:', err);
      setError('Gagal menyimpan pengaturan: ' + err.message);
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="bg-white rounded-3xl border border-orange-200/70 shadow-sm">
      <button
        type="button"
        onClick={() => setOpen(!open)}
        className="w-full p-4 flex items-center justify-between text-left"
        aria-expanded={open}
      >
        <div className="flex items-center space-x-3">
          <div className="w-9 h-9 rounded-2xl bg-amber-100 text-amber-700 flex items-center justify-center">
            <Clock className="w-4 h-4" />
          </div>
          <div>
            <p className="text-xs font-extrabold text-slate-800 font-brand">Pengaturan Jam Sekolah</p>
            <p className="text-[11px] text-slate-500">
              Masuk {getJamMasuk(schoolData)} (toleransi {getToleransiMenit(schoolData)} mnt) • Pulang {getJamPulang(schoolData)} • {getHariKerja(schoolData)} hari kerja
            </p>
          </div>
        </div>
        <ChevronDown className={`w-4 h-4 text-slate-400 transition ${open ? 'rotate-180' : ''}`} />
      </button>

      {open && (
        <form onSubmit={handleSave} className="px-4 pb-4 space-y-3 border-t border-orange-100 pt-4">
          <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
            <label className="text-xs font-bold text-slate-700 space-y-1">
              <span>Jam Masuk</span>
              <input type="time" required value={jamMasuk} onChange={(e) => setJamMasuk(e.target.value)}
                className="w-full px-3 py-2 text-xs font-semibold rounded-xl border border-slate-200 focus:outline-none focus:ring-2 focus:ring-orange-500/20 focus:border-orange-500" />
            </label>
            <label className="text-xs font-bold text-slate-700 space-y-1">
              <span>Toleransi (menit)</span>
              <input type="number" min={0} max={120} required value={toleransi} onChange={(e) => setToleransi(e.target.value)}
                className="w-full px-3 py-2 text-xs font-semibold rounded-xl border border-slate-200 focus:outline-none focus:ring-2 focus:ring-orange-500/20 focus:border-orange-500" />
            </label>
            <label className="text-xs font-bold text-slate-700 space-y-1">
              <span>Jam Pulang</span>
              <input type="time" required value={jamPulang} onChange={(e) => setJamPulang(e.target.value)}
                className="w-full px-3 py-2 text-xs font-semibold rounded-xl border border-slate-200 focus:outline-none focus:ring-2 focus:ring-orange-500/20 focus:border-orange-500" />
            </label>
            <label className="text-xs font-bold text-slate-700 space-y-1">
              <span>Hari Kerja</span>
              <select value={hariKerja} onChange={(e) => setHariKerja(Number(e.target.value))}
                className="w-full px-3 py-2 text-xs font-semibold rounded-xl border border-slate-200 bg-white focus:outline-none focus:ring-2 focus:ring-orange-500/20 focus:border-orange-500">
                <option value={5}>Senin–Jumat</option>
                <option value={6}>Senin–Sabtu</option>
              </select>
            </label>
          </div>
          {error && <p className="text-xs font-semibold text-rose-600">{error}</p>}
          <p className="text-[11px] text-slate-500">
            Guru dianggap terlambat jika jam di HP saat menekan tombol absen melewati jam masuk + toleransi.
          </p>
          <div className="flex justify-end">
            <button type="submit" disabled={saving}
              className="inline-flex items-center space-x-1.5 px-4 py-2.5 rounded-xl bg-gradient-to-r from-amber-500 to-orange-500 text-white text-xs font-extrabold shadow-md shadow-orange-500/20 disabled:opacity-60">
              <Save className="w-3.5 h-3.5" />
              <span>{saving ? 'Menyimpan...' : 'Simpan Pengaturan'}</span>
            </button>
          </div>
        </form>
      )}
    </div>
  );
}

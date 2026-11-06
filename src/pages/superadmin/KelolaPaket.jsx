import React, { useEffect, useMemo, useState } from 'react';
import { createPortal } from 'react-dom';
import { Sparkles, Plus, Edit, Trash2, Check, X, Users, GraduationCap, CheckCircle2, AlertCircle, Download } from 'lucide-react';
import { collection, onSnapshot, doc, setDoc, deleteDoc, writeBatch, serverTimestamp } from 'firebase/firestore';
import { db } from '../../config/firebase';
import { useAuth } from '../../context/AuthContext';
import { logActivity } from '../../utils/auditLogger';
import ModalKonfirmasi from '../../components/ui/ModalKonfirmasi';
import {
  DEFAULT_PLANS,
  PLAN_FEATURES,
  OPTIONAL_FEATURE_KEYS,
  getPlan,
  resolvePlanId,
  formatRupiah,
  formatKuota,
} from '../../utils/planConfig';

const EMPTY_FORM = {
  id: '',
  nama: '',
  deskripsi: '',
  harga_bulanan: 0,
  harga_tahunan: 0,
  kuota_guru: 3,
  kuota_murid: 25,
  murid_tanpa_batas: false,
  is_trial: false,
  durasi_trial_hari: 14,
  urutan: 9,
  aktif: true,
  fitur: Object.fromEntries(OPTIONAL_FEATURE_KEYS.map((k) => [k, false])),
};

/**
 * Superadmin: kelola paket langganan secara dinamis (nama, harga, kuota, fitur).
 * Perubahan fitur langsung berlaku bagi sekolah di paket tersebut (realtime);
 * perubahan kuota dapat diterapkan ke seluruh sekolah pemakai paket.
 */
export default function KelolaPaket() {
  const { userData } = useAuth();
  const [plansDb, setPlansDb] = useState({});
  const [schools, setSchools] = useState([]);
  const [loading, setLoading] = useState(true);
  const [notification, setNotification] = useState(null);

  const [form, setForm] = useState(null); // null = modal tertutup
  const [isNew, setIsNew] = useState(false);
  const [saving, setSaving] = useState(false);
  const [applyQuota, setApplyQuota] = useState(null); // { planId, kuota_guru, kuota_murid, schools }
  const [deleteTarget, setDeleteTarget] = useState(null);

  useEffect(() => {
    const unsubPlans = onSnapshot(collection(db, 'plans'), (snap) => {
      setPlansDb(Object.fromEntries(snap.docs.map((d) => [d.id, d.data()])));
      setLoading(false);
    }, (err) => {
      console.error('Gagal memuat paket:', err);
      setLoading(false);
    });
    const unsubSchools = onSnapshot(collection(db, 'schools'), (snap) => {
      setSchools(snap.docs.map((d) => ({ id: d.id, ...d.data() })));
    });
    return () => { unsubPlans(); unsubSchools(); };
  }, []);

  const showNotification = (type, text) => {
    setNotification({ type, text });
    setTimeout(() => setNotification(null), 5000);
  };

  const dbEmpty = !loading && Object.keys(plansDb).length === 0;

  // Paket di DB (atau bawaan bila DB masih kosong), terurut
  const plans = useMemo(() => {
    const ids = dbEmpty ? Object.keys(DEFAULT_PLANS) : Object.keys(plansDb);
    return ids.map((id) => getPlan(id, plansDb)).sort((a, b) => (a.urutan ?? 99) - (b.urutan ?? 99));
  }, [plansDb, dbEmpty]);

  const schoolsByPlan = useMemo(() => {
    const map = {};
    schools.forEach((s) => {
      const id = resolvePlanId(s.paket_langganan);
      (map[id] = map[id] || []).push(s);
    });
    return map;
  }, [schools]);

  const handleSeedDefaults = async () => {
    setSaving(true);
    try {
      const batch = writeBatch(db);
      Object.entries(DEFAULT_PLANS).forEach(([id, p]) => {
        batch.set(doc(db, 'plans', id), { ...p, updated_at: serverTimestamp() });
      });
      await batch.commit();
      logActivity({ actorId: userData.uid, actorNama: userData.nama, action: 'SEED_PLANS', recordType: 'plans', recordId: 'default' });
      showNotification('success', 'Paket bawaan (Uji Coba, Rintisan, Sahabat PAUD, Mandiri Plus) berhasil dimuat.');
    } catch (err) {
      showNotification('error', 'Gagal memuat paket bawaan: ' + err.message);
    } finally {
      setSaving(false);
    }
  };

  const openEdit = (plan) => {
    setIsNew(false);
    setForm({
      ...EMPTY_FORM,
      ...plan,
      kuota_murid: plan.kuota_murid ?? 60,
      murid_tanpa_batas: plan.kuota_murid === null || plan.kuota_murid === undefined,
      fitur: { ...EMPTY_FORM.fitur, ...(plan.fitur || {}) },
    });
  };

  const openNew = () => {
    setIsNew(true);
    setForm({ ...EMPTY_FORM });
  };

  const handleSave = async (e) => {
    e.preventDefault();
    const id = isNew ? form.id.trim().toLowerCase().replace(/[^a-z0-9_]/g, '_') : form.id;
    if (!id || !form.nama.trim()) {
      showNotification('error', 'ID dan nama paket wajib diisi.');
      return;
    }
    if (isNew && (plansDb[id] || ['basic', 'pro'].includes(id))) {
      showNotification('error', `ID paket "${id}" sudah dipakai.`);
      return;
    }

    const payload = {
      nama: form.nama.trim(),
      deskripsi: form.deskripsi.trim(),
      harga_bulanan: Math.max(0, Number(form.harga_bulanan) || 0),
      harga_tahunan: Math.max(0, Number(form.harga_tahunan) || 0),
      kuota_guru: Math.max(1, Number(form.kuota_guru) || 1),
      kuota_murid: form.murid_tanpa_batas ? null : Math.max(1, Number(form.kuota_murid) || 1),
      is_trial: !!form.is_trial,
      durasi_trial_hari: form.is_trial ? Math.max(1, Number(form.durasi_trial_hari) || 14) : null,
      urutan: Number(form.urutan) || 0,
      aktif: !!form.aktif,
      fitur: Object.fromEntries(OPTIONAL_FEATURE_KEYS.map((k) => [k, !!form.fitur[k]])),
      updated_at: serverTimestamp(),
    };

    setSaving(true);
    try {
      // Bila DB masih kosong, simpan juga paket bawaan lain agar tidak "hilang" dari daftar
      if (dbEmpty) {
        const batch = writeBatch(db);
        Object.entries(DEFAULT_PLANS).forEach(([pid, p]) => {
          if (pid !== id) batch.set(doc(db, 'plans', pid), { ...p, updated_at: serverTimestamp() });
        });
        await batch.commit();
      }
      await setDoc(doc(db, 'plans', id), payload, { merge: true });
      logActivity({
        actorId: userData.uid,
        actorNama: userData.nama,
        action: isNew ? 'ADD_PLAN' : 'UPDATE_PLAN',
        recordType: 'plans',
        recordId: id,
        detail: { nama: payload.nama, kuota_guru: payload.kuota_guru, kuota_murid: payload.kuota_murid ?? 'tanpa_batas' },
      });

      // Tawarkan penerapan kuota baru ke sekolah yang kuotanya berbeda
      const affected = (schoolsByPlan[id] || []).filter(
        (s) => s.kuota_guru !== payload.kuota_guru || (s.kuota_murid ?? null) !== payload.kuota_murid
      );
      setForm(null);
      if (affected.length > 0) {
        setApplyQuota({ planId: id, nama: payload.nama, kuota_guru: payload.kuota_guru, kuota_murid: payload.kuota_murid, schools: affected });
      } else {
        showNotification('success', `Paket "${payload.nama}" tersimpan. Perubahan fitur langsung berlaku.`);
      }
    } catch (err) {
      showNotification('error', 'Gagal menyimpan paket: ' + err.message);
    } finally {
      setSaving(false);
    }
  };

  const handleApplyQuota = async () => {
    if (!applyQuota) return;
    setSaving(true);
    try {
      const batch = writeBatch(db);
      applyQuota.schools.forEach((s) => {
        batch.update(doc(db, 'schools', s.id), {
          kuota_guru: applyQuota.kuota_guru,
          kuota_murid: applyQuota.kuota_murid,
          updated_at: serverTimestamp(),
        });
      });
      await batch.commit();
      showNotification('success', `Kuota baru diterapkan ke ${applyQuota.schools.length} sekolah.`);
    } catch (err) {
      showNotification('error', 'Gagal menerapkan kuota: ' + err.message);
    } finally {
      setSaving(false);
      setApplyQuota(null);
    }
  };

  const handleDelete = async () => {
    if (!deleteTarget) return;
    setSaving(true);
    try {
      await deleteDoc(doc(db, 'plans', deleteTarget.id));
      logActivity({ actorId: userData.uid, actorNama: userData.nama, action: 'DELETE_PLAN', recordType: 'plans', recordId: deleteTarget.id });
      showNotification('success', `Paket "${deleteTarget.nama}" dihapus.`);
    } catch (err) {
      showNotification('error', 'Gagal menghapus paket: ' + err.message);
    } finally {
      setSaving(false);
      setDeleteTarget(null);
    }
  };

  const setFitur = (key, value) => setForm((f) => ({ ...f, fitur: { ...f.fitur, [key]: value } }));

  return (
    <div className="space-y-6 pb-20 md:pb-6">
      <div className="bg-gradient-to-r from-amber-500 via-orange-500 to-amber-600 rounded-3xl p-6 md:p-8 text-white shadow-lg shadow-orange-500/20 flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div>
          <div className="inline-flex items-center space-x-2 px-3 py-1 bg-white/20 rounded-full text-xs font-bold text-amber-100 mb-3">
            <Sparkles className="w-3.5 h-3.5" />
            <span>Pengaturan Bisnis SaaS</span>
          </div>
          <h1 className="text-2xl md:text-3xl font-extrabold font-brand tracking-tight">Paket Langganan</h1>
          <p className="text-amber-100 text-sm mt-1 max-w-xl font-medium">
            Atur nama, harga, kuota guru & murid, serta fitur tiap paket. Perubahan fitur langsung berlaku bagi sekolah pemakai paket.
          </p>
        </div>
        <button
          onClick={openNew}
          className="self-start md:self-auto px-5 py-3 bg-white text-orange-600 hover:bg-orange-50 font-extrabold text-xs rounded-2xl shadow-sm flex items-center space-x-2 font-brand"
        >
          <Plus className="w-4 h-4 stroke-[3]" />
          <span>Paket Baru</span>
        </button>
      </div>

      {notification && (
        <div className={`p-4 rounded-2xl flex items-center space-x-3 text-sm font-semibold ${
          notification.type === 'success' ? 'bg-emerald-50 text-emerald-800 border border-emerald-200' : 'bg-rose-50 text-rose-800 border border-rose-200'
        }`}>
          {notification.type === 'success' ? <CheckCircle2 className="w-5 h-5 shrink-0" /> : <AlertCircle className="w-5 h-5 shrink-0" />}
          <span>{notification.text}</span>
        </div>
      )}

      {dbEmpty && (
        <div className="p-4 rounded-3xl bg-amber-50 border border-amber-200 flex flex-col sm:flex-row sm:items-center justify-between gap-3">
          <p className="text-xs text-amber-900 font-semibold">
            Paket belum tersimpan di database. Sistem sementara memakai paket bawaan di bawah ini.
          </p>
          <button
            onClick={handleSeedDefaults}
            disabled={saving}
            className="px-4 py-2.5 rounded-xl bg-amber-500 hover:bg-amber-600 text-white text-xs font-extrabold flex items-center gap-1.5 disabled:opacity-60"
          >
            <Download className="w-4 h-4" />
            <span>Muat Paket Bawaan</span>
          </button>
        </div>
      )}

      {loading ? (
        <div className="p-12 text-center text-xs text-slate-400">Memuat paket...</div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-4 gap-4">
          {plans.map((p) => {
            const pemakai = schoolsByPlan[p.id] || [];
            return (
              <div key={p.id} className={`bg-white rounded-3xl p-5 border shadow-sm flex flex-col ${p.aktif === false ? 'border-slate-200 opacity-70' : 'border-orange-200/70'}`}>
                <div className="flex items-start justify-between gap-2">
                  <div>
                    <h3 className="text-base font-extrabold text-slate-900 font-brand">{p.nama}</h3>
                    <p className="text-[11px] text-slate-400 font-mono">{p.id}{p.is_trial ? ' • trial' : ''}{p.aktif === false ? ' • nonaktif' : ''}</p>
                  </div>
                  <span className="px-2 py-0.5 rounded-lg bg-slate-100 text-slate-600 text-[10px] font-bold shrink-0">{pemakai.length} sekolah</span>
                </div>
                <p className="text-xs text-slate-500 mt-1">{p.deskripsi}</p>

                <div className="mt-3 p-3 rounded-2xl bg-amber-50/60 border border-amber-100">
                  <p className="text-lg font-black text-slate-800 font-brand">
                    {p.is_trial ? `Gratis ${p.durasi_trial_hari || 14} hari` : `${formatRupiah(p.harga_bulanan)}`}
                    {!p.is_trial && <span className="text-xs text-slate-400 font-semibold"> /bln</span>}
                  </p>
                  {!p.is_trial && <p className="text-[11px] text-emerald-700 font-bold">Tahunan: {formatRupiah(p.harga_tahunan)}</p>}
                </div>

                <div className="mt-3 grid grid-cols-2 gap-2 text-xs">
                  <div className="flex items-center gap-1.5 text-slate-700"><Users className="w-3.5 h-3.5 text-orange-500" /> {p.kuota_guru} guru</div>
                  <div className="flex items-center gap-1.5 text-slate-700"><GraduationCap className="w-3.5 h-3.5 text-orange-500" /> {formatKuota(p.kuota_murid)} murid</div>
                </div>

                <ul className="mt-3 space-y-1 flex-1">
                  {PLAN_FEATURES.filter((f) => !f.core).map((f) => (
                    <li key={f.key} className={`text-[11px] flex items-start gap-1.5 ${p.fitur?.[f.key] ? 'text-slate-700' : 'text-slate-300 line-through'}`}>
                      {p.fitur?.[f.key] ? <Check className="w-3.5 h-3.5 text-emerald-600 shrink-0 mt-px" /> : <X className="w-3.5 h-3.5 shrink-0 mt-px" />}
                      <span>{f.label}</span>
                    </li>
                  ))}
                </ul>

                <div className="mt-4 pt-3 border-t border-orange-100 flex items-center gap-2">
                  <button onClick={() => openEdit(p)} className="flex-1 px-3 py-2 rounded-xl bg-slate-50 hover:bg-slate-100 border border-slate-200 text-xs font-bold text-slate-700 flex items-center justify-center gap-1.5">
                    <Edit className="w-3.5 h-3.5" /> Ubah
                  </button>
                  {!DEFAULT_PLANS[p.id] && (
                    <button
                      onClick={() => (pemakai.length ? showNotification('error', `Paket masih dipakai ${pemakai.length} sekolah. Pindahkan sekolah ke paket lain dahulu.`) : setDeleteTarget(p))}
                      aria-label="Hapus paket"
                      className="px-3 py-2 rounded-xl text-rose-600 hover:bg-rose-50 text-xs font-bold"
                    >
                      <Trash2 className="w-3.5 h-3.5" />
                    </button>
                  )}
                </div>
              </div>
            );
          })}
        </div>
      )}

      {form && createPortal(
        <div className="fixed inset-0 z-[100] bg-slate-900/60 backdrop-blur-sm flex items-center justify-center p-4">
          <form onSubmit={handleSave} className="bg-white rounded-3xl w-full max-w-2xl max-h-[90vh] overflow-y-auto p-6 shadow-2xl border border-orange-200/80 space-y-4">
            <div className="flex items-center justify-between border-b border-orange-100 pb-3">
              <h3 className="text-base font-extrabold text-slate-900 font-brand">{isNew ? 'Paket Baru' : `Ubah ${form.nama}`}</h3>
              <button type="button" onClick={() => setForm(null)} className="p-1.5 text-slate-400 hover:text-slate-600 rounded-xl" aria-label="Tutup">
                <X className="w-5 h-5" />
              </button>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
              {isNew && (
                <label className="text-xs font-bold text-slate-700 space-y-1">
                  <span>ID Paket (huruf kecil, tanpa spasi)</span>
                  <input required value={form.id} onChange={(e) => setForm({ ...form, id: e.target.value })} placeholder="contoh: yayasan_besar"
                    className="w-full px-3 py-2 text-xs rounded-xl border border-slate-200 font-mono" />
                </label>
              )}
              <label className="text-xs font-bold text-slate-700 space-y-1">
                <span>Nama Paket</span>
                <input required value={form.nama} onChange={(e) => setForm({ ...form, nama: e.target.value })}
                  className="w-full px-3 py-2 text-xs rounded-xl border border-slate-200" />
              </label>
              <label className="text-xs font-bold text-slate-700 space-y-1 md:col-span-2">
                <span>Deskripsi Singkat</span>
                <input value={form.deskripsi} onChange={(e) => setForm({ ...form, deskripsi: e.target.value })}
                  className="w-full px-3 py-2 text-xs rounded-xl border border-slate-200" />
              </label>
              <label className="text-xs font-bold text-slate-700 space-y-1">
                <span>Harga Bulanan (Rp)</span>
                <input type="number" min={0} value={form.harga_bulanan} onChange={(e) => setForm({ ...form, harga_bulanan: e.target.value })}
                  className="w-full px-3 py-2 text-xs rounded-xl border border-slate-200" />
              </label>
              <label className="text-xs font-bold text-slate-700 space-y-1">
                <span>Harga Tahunan (Rp)</span>
                <input type="number" min={0} value={form.harga_tahunan} onChange={(e) => setForm({ ...form, harga_tahunan: e.target.value })}
                  className="w-full px-3 py-2 text-xs rounded-xl border border-slate-200" />
              </label>
              <label className="text-xs font-bold text-slate-700 space-y-1">
                <span>Kuota Guru</span>
                <input type="number" min={1} required value={form.kuota_guru} onChange={(e) => setForm({ ...form, kuota_guru: e.target.value })}
                  className="w-full px-3 py-2 text-xs rounded-xl border border-slate-200" />
              </label>
              <div className="text-xs font-bold text-slate-700 space-y-1">
                <span>Kuota Murid</span>
                <div className="flex items-center gap-2">
                  <input type="number" min={1} disabled={form.murid_tanpa_batas} value={form.kuota_murid}
                    onChange={(e) => setForm({ ...form, kuota_murid: e.target.value })}
                    className="w-full px-3 py-2 text-xs rounded-xl border border-slate-200 disabled:bg-slate-50 disabled:text-slate-300" />
                  <label className="flex items-center gap-1.5 whitespace-nowrap font-semibold">
                    <input type="checkbox" checked={form.murid_tanpa_batas} onChange={(e) => setForm({ ...form, murid_tanpa_batas: e.target.checked })} />
                    Tanpa batas
                  </label>
                </div>
              </div>
              <label className="text-xs font-bold text-slate-700 space-y-1">
                <span>Urutan Tampil</span>
                <input type="number" value={form.urutan} onChange={(e) => setForm({ ...form, urutan: e.target.value })}
                  className="w-full px-3 py-2 text-xs rounded-xl border border-slate-200" />
              </label>
              <div className="text-xs font-bold text-slate-700 space-y-2 pt-5">
                <label className="flex items-center gap-2 font-semibold">
                  <input type="checkbox" checked={form.aktif} onChange={(e) => setForm({ ...form, aktif: e.target.checked })} />
                  Paket aktif (bisa dipilih untuk sekolah)
                </label>
                <label className="flex items-center gap-2 font-semibold">
                  <input type="checkbox" checked={form.is_trial} onChange={(e) => setForm({ ...form, is_trial: e.target.checked })} />
                  Paket uji coba
                  {form.is_trial && (
                    <input type="number" min={1} value={form.durasi_trial_hari || 14} onChange={(e) => setForm({ ...form, durasi_trial_hari: e.target.value })}
                      className="w-16 px-2 py-1 rounded-lg border border-slate-200" aria-label="Durasi trial (hari)" />
                  )}
                  {form.is_trial && <span>hari</span>}
                </label>
              </div>
            </div>

            <div className="pt-2 border-t border-orange-100">
              <p className="text-xs font-extrabold text-slate-800 mb-2">Fitur dalam Paket</p>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-2">
                {PLAN_FEATURES.map((f) => (
                  <label key={f.key} className={`flex items-start gap-2 p-2.5 rounded-xl border text-xs ${f.core ? 'bg-slate-50 border-slate-100 text-slate-500' : 'border-slate-200 text-slate-700'}`}>
                    <input
                      type="checkbox"
                      disabled={f.core}
                      checked={f.core || !!form.fitur[f.key]}
                      onChange={(e) => setFitur(f.key, e.target.checked)}
                      className="mt-0.5"
                    />
                    <span>{f.label}{f.core && <em className="text-[10px] block">Selalu termasuk</em>}</span>
                  </label>
                ))}
              </div>
            </div>

            <div className="flex justify-end gap-2 pt-2 border-t border-orange-100">
              <button type="button" onClick={() => setForm(null)} className="px-4 py-2.5 text-xs font-bold text-slate-600 hover:bg-slate-100 rounded-xl">Batal</button>
              <button type="submit" disabled={saving} className="px-5 py-2.5 bg-gradient-to-r from-amber-500 to-orange-500 text-white rounded-xl text-xs font-extrabold shadow-md disabled:opacity-60">
                {saving ? 'Menyimpan...' : 'Simpan Paket'}
              </button>
            </div>
          </form>
        </div>,
        document.body
      )}

      <ModalKonfirmasi
        isOpen={!!applyQuota}
        type="info"
        title="Terapkan Kuota Baru?"
        message={applyQuota && `Paket "${applyQuota.nama}" kini ${applyQuota.kuota_guru} guru & ${formatKuota(applyQuota.kuota_murid).toLowerCase()} murid. Terapkan ke ${applyQuota.schools.length} sekolah pemakai paket ini (${applyQuota.schools.map((s) => s.nama_sekolah).join(', ')})? Pilih "Biarkan" bila sekolah tersebut memakai kuota khusus.`}
        confirmText="Ya, Terapkan"
        cancelText="Biarkan"
        loading={saving}
        onConfirm={handleApplyQuota}
        onClose={() => { setApplyQuota(null); showNotification('success', 'Paket tersimpan. Kuota sekolah tidak diubah.'); }}
      />

      <ModalKonfirmasi
        isOpen={!!deleteTarget}
        type="danger"
        title="Hapus Paket?"
        message={deleteTarget && `Paket "${deleteTarget.nama}" akan dihapus permanen.`}
        confirmText="Hapus Paket"
        loading={saving}
        onConfirm={handleDelete}
        onClose={() => setDeleteTarget(null)}
      />
    </div>
  );
}

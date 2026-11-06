import React, { useEffect, useState } from 'react';
import { Lock, Sparkles } from 'lucide-react';
import { collection, getDocs } from 'firebase/firestore';
import { db } from '../../config/firebase';
import { useAuth } from '../../context/AuthContext';
import { PLAN_FEATURES, cheapestPlanWithFeature, formatRupiah } from '../../utils/planConfig';

/**
 * Hook kecil: daftar paket dari Firestore (untuk menyebut paket termurah yang membuka fitur).
 */
const usePlansFromDb = () => {
  const [plans, setPlans] = useState({});
  useEffect(() => {
    let active = true;
    getDocs(collection(db, 'plans'))
      .then((snap) => active && setPlans(Object.fromEntries(snap.docs.map((d) => [d.id, d.data()]))))
      .catch(() => {});
    return () => { active = false; };
  }, []);
  return plans;
};

/**
 * Kartu "fitur terkunci" yang bisa dipakai di dalam halaman (mis. tombol Excel di Rekap).
 */
export function FeatureLockedCard({ feature, compact = false }) {
  const { plan } = useAuth();
  const plansFromDb = usePlansFromDb();
  const label = PLAN_FEATURES.find((f) => f.key === feature)?.label || 'Fitur ini';
  const target = cheapestPlanWithFeature(feature, plansFromDb);

  return (
    <div className={`rounded-3xl border border-amber-200/80 bg-amber-50/70 text-amber-950 ${compact ? 'p-3' : 'p-6'} space-y-1.5`}>
      <div className="flex items-center gap-2 text-xs font-extrabold font-brand">
        <Lock className="w-4 h-4 text-amber-600 shrink-0" />
        <span>{target ? `Tersedia mulai ${target.nama}` : 'Belum tersedia di paket Anda'}</span>
      </div>
      {!compact && (
        <p className="text-xs leading-relaxed text-amber-900/80">
          {label} belum termasuk dalam <strong>{plan?.nama || 'paket sekolah Anda'}</strong>.
          {target && <> Mulai {formatRupiah(target.harga_bulanan)}/bulan.</>} Hubungi Administrator SIMFONI untuk meningkatkan paket.
        </p>
      )}
    </div>
  );
}

/**
 * Pembungkus rute: render halaman hanya jika paket sekolah menyediakan `feature`.
 */
export default function FeatureGate({ feature, children }) {
  const { hasFeature } = useAuth();
  if (hasFeature(feature)) return children;

  return (
    <div className="max-w-lg mx-auto py-10 space-y-4 text-center">
      <div className="w-14 h-14 rounded-3xl bg-amber-100 text-amber-700 flex items-center justify-center mx-auto">
        <Sparkles className="w-7 h-7" />
      </div>
      <h1 className="text-lg font-extrabold text-slate-900 font-brand">Fitur Belum Aktif di Paket Sekolah</h1>
      <div className="text-left">
        <FeatureLockedCard feature={feature} />
      </div>
    </div>
  );
}

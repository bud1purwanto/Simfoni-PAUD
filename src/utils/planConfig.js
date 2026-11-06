/**
 * Paket Langganan SaaS (dinamis).
 *
 * Sumber kebenaran ada di koleksi Firestore `plans/{planId}` dan dikelola Superadmin
 * di halaman /superadmin/paket. Konstanta di bawah hanya:
 *  - nilai awal saat koleksi `plans` masih kosong (tombol "Muat Paket Bawaan"), dan
 *  - fallback bila dokumen paket belum ada / gagal dimuat.
 *
 * Kuota guru & murid disalin ke dokumen `schools` saat paket dipilih (boleh di-override
 * per sekolah), karena Security Rules menegakkan kuota dari dokumen sekolah.
 */

// Fitur yang dapat diaktifkan/dimatikan per paket. `core` = selalu aktif di semua paket.
export const PLAN_FEATURES = [
  { key: 'presensi', label: 'Presensi datang/pulang guru & kepsek (anti-trap sinyal)', core: true },
  { key: 'jurnal', label: 'Jurnal KBM harian (Voice-to-Text + foto ringan)', core: true },
  { key: 'wa_share', label: 'Kirim ringkasan kegiatan ke WhatsApp', core: true },
  { key: 'data_murid', label: 'Data induk & presensi murid', core: true },
  { key: 'pdf_kop', label: 'Cetak PDF laporan ber-kop surat sekolah', core: true },
  { key: 'rpph', label: 'Modul unggah RPPH / Modul Ajar mingguan' },
  { key: 'asesmen', label: 'Catatan capaian anak (Agama, Jati Diri, STEAM)' },
  { key: 'supervisi', label: 'Supervisi & evaluasi kinerja guru oleh Kepsek' },
  { key: 'stempel_pdf', label: 'Stempel resmi digital transparan pada PDF' },
  { key: 'excel', label: 'Ekspor rekap kehadiran & honor guru ke Excel (.xlsx)' },
  { key: 'portofolio', label: 'PDF Portofolio Akreditasi BAN-PDM (foto kegiatan)' },
  { key: 'bulk_approval', label: 'Setujui jurnal sekaligus (bulk approval)' },
];

export const OPTIONAL_FEATURE_KEYS = PLAN_FEATURES.filter((f) => !f.core).map((f) => f.key);

const fitur = (keys) => Object.fromEntries(OPTIONAL_FEATURE_KEYS.map((k) => [k, keys.includes(k)]));
const SEMUA_FITUR = OPTIONAL_FEATURE_KEYS;

export const DEFAULT_PLANS = {
  trial: {
    nama: 'Uji Coba Gratis',
    deskripsi: 'Masa coba 14 hari dengan fitur setara Paket Rintisan.',
    harga_bulanan: 0,
    harga_tahunan: 0,
    kuota_guru: 3,
    kuota_murid: 25,
    durasi_trial_hari: 14,
    is_trial: true,
    fitur: fitur([]),
    urutan: 0,
    aktif: true,
  },
  rintisan: {
    nama: 'Paket Rintisan',
    deskripsi: 'Untuk KB, SPS, TPA, atau TK baru berbina.',
    harga_bulanan: 99000,
    harga_tahunan: 990000,
    kuota_guru: 3,
    kuota_murid: 25,
    is_trial: false,
    fitur: fitur([]),
    urutan: 1,
    aktif: true,
  },
  sahabat: {
    nama: 'Paket Sahabat PAUD',
    deskripsi: 'Sangat pas untuk TK DWP, Aisyiyah, Muslimat & TK reguler.',
    harga_bulanan: 175000,
    harga_tahunan: 1750000,
    kuota_guru: 6,
    kuota_murid: 60,
    is_trial: false,
    fitur: fitur(SEMUA_FITUR),
    urutan: 2,
    aktif: true,
  },
  mandiri: {
    nama: 'Paket Mandiri Plus',
    deskripsi: 'Untuk TK unggulan, rombel besar & yayasan multi-kelas.',
    harga_bulanan: 299000,
    harga_tahunan: 2990000,
    kuota_guru: 12,
    kuota_murid: null, // null = tanpa batas
    is_trial: false,
    fitur: fitur(SEMUA_FITUR),
    urutan: 3,
    aktif: true,
  },
};

// Nilai `paket_langganan` versi lama dipetakan ke paket baru tanpa mengubah data tersimpan.
export const LEGACY_PLAN_MAP = { basic: 'sahabat', pro: 'mandiri' };

export const resolvePlanId = (planId) => LEGACY_PLAN_MAP[planId] || planId || 'rintisan';

/**
 * Gabungkan dokumen paket dari Firestore dengan bawaan (field yang hilang memakai bawaan).
 */
export const getPlan = (planId, plansFromDb = {}) => {
  const id = resolvePlanId(planId);
  const base = DEFAULT_PLANS[id] || DEFAULT_PLANS.rintisan;
  const fromDb = plansFromDb[id];
  if (!fromDb) return { id, ...base };
  return { id, ...base, ...fromDb, fitur: { ...base.fitur, ...(fromDb.fitur || {}) } };
};

export const planHasFeature = (plan, key) => {
  const def = PLAN_FEATURES.find((f) => f.key === key);
  if (!def || def.core) return true;
  return plan?.fitur?.[key] === true;
};

/**
 * Nama paket termurah (urutan terkecil, non-trial) yang menyediakan fitur `key`.
 * Dipakai pesan "tersedia mulai Paket ...".
 */
export const cheapestPlanWithFeature = (key, plansFromDb = {}) => {
  const ids = [...new Set([...Object.keys(DEFAULT_PLANS), ...Object.keys(plansFromDb)])];
  return ids
    .map((id) => getPlan(id, plansFromDb))
    .filter((p) => !p.is_trial && p.aktif !== false && planHasFeature(p, key))
    .sort((a, b) => (a.urutan ?? 99) - (b.urutan ?? 99))[0] || null;
};

export const formatRupiah = (n) =>
  typeof n === 'number' ? `Rp ${n.toLocaleString('id-ID')}` : '-';

export const formatKuota = (n) => (n === null || n === undefined ? 'Tanpa batas' : String(n));

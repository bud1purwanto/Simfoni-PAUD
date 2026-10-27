/**
 * Konfigurasi operasional sekolah (tenant) beserta nilai bawaannya.
 * Seluruh halaman WAJIB membaca nilai ini dari `schoolData` melalui helper di bawah,
 * bukan meng-hardcode jam masuk atau daftar kelompok kelas.
 */

export const DEFAULT_KELOMPOK = ["TK A", "TK B", "Kelompok Bermain"];
export const KELOMPOK_SEMUA = "Semua";

export const DEFAULT_JAM_MASUK = "07:30";
export const DEFAULT_JAM_PULANG = "11:30";
export const DEFAULT_TOLERANSI_MENIT = 15;
export const DEFAULT_HARI_KERJA = 5; // Senin–Jumat (6 = Senin–Sabtu)

export const DEFAULT_PASSWORD = {
  guru: "Guru1234!",
  kepsek: "Kepsek1234!",
};

export const STATUS_LANGGANAN_AKTIF = ["aktif", "masa_tenggang"];

// Nilai lama yang pernah disimpan oleh versi sebelumnya dinormalisasi agar relasi
// jadwal ↔ jurnal ↔ guru memakai label kelompok yang sama.
const LEGACY_KELOMPOK = {
  "Kelompok Bermain (KB)": "Kelompok Bermain",
  "Semua Kelompok": KELOMPOK_SEMUA,
  "Semua Rombel": KELOMPOK_SEMUA,
};

export const normalizeKelompok = (value) => LEGACY_KELOMPOK[value] || value || "";

export const getKelompokOptions = (schoolData) => {
  const list = Array.isArray(schoolData?.kelompok_tersedia) && schoolData.kelompok_tersedia.length
    ? schoolData.kelompok_tersedia
    : DEFAULT_KELOMPOK;
  return list.map(normalizeKelompok);
};

export const getJamMasuk = (schoolData) => schoolData?.jam_masuk || DEFAULT_JAM_MASUK;
export const getJamPulang = (schoolData) => schoolData?.jam_pulang || DEFAULT_JAM_PULANG;
export const getToleransiMenit = (schoolData) =>
  Number.isFinite(Number(schoolData?.toleransi_terlambat_menit))
    ? Number(schoolData.toleransi_terlambat_menit)
    : DEFAULT_TOLERANSI_MENIT;
export const getHariKerja = (schoolData) => (Number(schoolData?.hari_kerja) === 6 ? 6 : DEFAULT_HARI_KERJA);

/**
 * Konversi 'HH:mm' atau 'HH:mm:ss' menjadi menit sejak tengah malam. null jika tidak valid.
 */
export const toMinutes = (hhmm) => {
  if (typeof hhmm !== "string") return null;
  const match = hhmm.trim().match(/^(\d{1,2}):(\d{2})/);
  if (!match) return null;
  return Number(match[1]) * 60 + Number(match[2]);
};

/**
 * Menit keterlambatan dihitung dari jam masuk + toleransi. 0 jika tepat waktu.
 */
export const hitungMenitTerlambat = (jamDatang, schoolData) => {
  const datang = toMinutes(jamDatang);
  const masuk = toMinutes(getJamMasuk(schoolData));
  if (datang === null || masuk === null) return 0;
  const selisih = datang - (masuk + getToleransiMenit(schoolData));
  return selisih > 0 ? selisih : 0;
};

/**
 * Status kedatangan ('hadir' | 'terlambat') berdasarkan jam perangkat (anti-trap offline).
 */
export const hitungStatusKedatangan = (jamDatang, schoolData) =>
  hitungMenitTerlambat(jamDatang, schoolData) > 0 ? "terlambat" : "hadir";

/**
 * Jumlah hari kerja efektif pada bulan 'YYYY-MM'. Untuk bulan berjalan hanya dihitung
 * sampai hari ini agar persentase kehadiran tidak terlihat rendah di awal bulan.
 */
export const hitungHariKerja = (periodeKey, schoolData, today = new Date()) => {
  const [year, month] = periodeKey.split("-").map(Number);
  if (!year || !month) return 0;
  const hariKerja = getHariKerja(schoolData);
  const lastDay = new Date(year, month, 0).getDate();
  const isCurrentMonth = today.getFullYear() === year && today.getMonth() + 1 === month;
  const isFutureMonth = year > today.getFullYear() || (year === today.getFullYear() && month > today.getMonth() + 1);
  if (isFutureMonth) return 0;
  const endDay = isCurrentMonth ? today.getDate() : lastDay;

  let count = 0;
  for (let d = 1; d <= endDay; d++) {
    const day = new Date(year, month - 1, d).getDay();
    if (day === 0) continue; // Minggu
    if (day === 6 && hariKerja === 5) continue; // Sabtu libur untuk 5 hari kerja
    count++;
  }
  return count;
};

/**
 * Apakah masa langganan sudah lewat dari tanggal `berlaku_hingga` (inklusif hari terakhir).
 */
export const isLanggananKedaluwarsa = (schoolData, now = Date.now()) => {
  if (!schoolData?.berlaku_hingga) return false;
  const [y, m, d] = schoolData.berlaku_hingga.split("-").map(Number);
  if (!y || !m || !d) return false;
  return new Date(y, m - 1, d, 23, 59, 59, 999).getTime() < now;
};

/**
 * Sisa hari masa langganan (negatif jika sudah lewat). null jika tanggal tidak diset.
 */
export const sisaHariLangganan = (schoolData, now = new Date()) => {
  if (!schoolData?.berlaku_hingga) return null;
  const [y, m, d] = schoolData.berlaku_hingga.split("-").map(Number);
  if (!y || !m || !d) return null;
  const end = new Date(y, m - 1, d);
  const start = new Date(now.getFullYear(), now.getMonth(), now.getDate());
  return Math.round((end - start) / 86400000);
};

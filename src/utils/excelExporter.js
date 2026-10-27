import * as XLSX from "xlsx";

/**
 * Mengekspor rekapitulasi presensi guru ke format Excel (.xlsx)
 * Sangat berguna bagi Kepala Sekolah dan Bendahara untuk penghitungan gaji & honorarium guru.
 * 
 * @param {Object} params
 * @param {string} params.namaSekolah - Nama sekolah dari schoolData
 * @param {string} params.periodeBulan - Contoh: 'Oktober 2026'
 * @param {Array} params.rekapData - Array data kehadiran per guru
 * [
 *   {
 *     nama: 'Bu Siti Rahayu',
 *     kelompok: 'TK A',
 *     hadir: 20,
 *     terlambat: 1,
 *     izin: 1,
 *     sakit: 0,
 *     totalHari: 22,
 *     persentase: '95%'
 *   }
 * ]
 */
export const exportAttendanceToExcel = ({
  namaSekolah = "SIMFONI PAUD",
  periodeBulan = "Periode Berjalan",
  hariKerjaEfektif = null,
  rekapData = [],
}) => {
  // 1. Siapkan header informasi sekolah
  const headerInfo = [
    ["REKAPITULASI PRESENSI & HONORARIUM GURU"],
    [`Nama Sekolah: ${namaSekolah}`],
    [`Periode: ${periodeBulan}`],
    ...(hariKerjaEfektif !== null ? [[`Hari Kerja Efektif: ${hariKerjaEfektif} hari`]] : []),
    [`Tanggal Unduh: ${new Date().toLocaleDateString("id-ID", { day: "numeric", month: "long", year: "numeric" })}`],
    [], // Baris kosong pemisah
  ];

  // 2. Baris judul tabel
  const tableHeaders = [
    "No",
    "Nama Lengkap Guru",
    "Kelompok Kelas",
    "Hadir Tepat Waktu (Hari)",
    "Terlambat (Hari)",
    "Total Menit Terlambat",
    "Izin (Hari)",
    "Sakit (Hari)",
    "Tanpa Keterangan (Hari)",
    "Lupa Absen Pulang (Hari)",
    "Total Kehadiran (Hari)",
    "Persentase Kehadiran (%)",
    "Catatan",
  ];

  // 3. Data isi tabel (angka disimpan sebagai number agar bisa langsung dihitung di Excel)
  const rows = rekapData.map((item, index) => [
    index + 1,
    item.nama || "-",
    item.kelompok || "-",
    item.hadir || 0,
    item.terlambat || 0,
    item.menitTerlambat || 0,
    item.izin || 0,
    item.sakit || 0,
    item.alpa || 0,
    item.lupaPulang || 0,
    (item.hadir || 0) + (item.terlambat || 0),
    parseInt(item.persentase, 10) || 0,
    item.catatan || "-",
  ]);

  // Gabungkan seluruh baris
  const worksheetData = [...headerInfo, tableHeaders, ...rows];

  // Buat worksheet dan workbook
  const worksheet = XLSX.utils.aoa_to_sheet(worksheetData);

  // Atur lebar kolom agar rapi
  worksheet["!cols"] = [
    { wch: 5 },  // No
    { wch: 28 }, // Nama
    { wch: 15 }, // Kelompok
    { wch: 14 }, // Hadir
    { wch: 12 }, // Terlambat
    { wch: 14 }, // Menit terlambat
    { wch: 10 }, // Izin
    { wch: 10 }, // Sakit
    { wch: 14 }, // Tanpa keterangan
    { wch: 14 }, // Lupa pulang
    { wch: 14 }, // Total
    { wch: 14 }, // %
    { wch: 18 }, // Catatan
  ];

  const workbook = XLSX.utils.book_new();
  XLSX.utils.book_append_sheet(workbook, worksheet, "Rekap Presensi");

  // Nama file ramah sistem
  const cleanSchoolName = namaSekolah.replace(/[^a-zA-Z0-9]/g, "_");
  const cleanPeriode = periodeBulan.replace(/[^a-zA-Z0-9]/g, "_");
  const filename = `Rekap_Presensi_${cleanSchoolName}_${cleanPeriode}.xlsx`;

  // Tulis file dan unduh ke perangkat pengguna
  XLSX.writeFile(workbook, filename);
};


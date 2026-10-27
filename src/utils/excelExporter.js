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
  rekapData = [],
}) => {
  // 1. Siapkan header informasi sekolah
  const headerInfo = [
    ["REKAPITULASI PRESENSI & HONORARIUM GURU"],
    [`Nama Sekolah: ${namaSekolah}`],
    [`Periode: ${periodeBulan}`],
    [`Tanggal Unduh: ${new Date().toLocaleDateString("id-ID")}`],
    [], // Baris kosong pemisah
  ];

  // 2. Baris judul tabel
  const tableHeaders = [
    "No",
    "Nama Lengkap Guru",
    "Kelompok Kelas",
    "Hadir (Hari)",
    "Terlambat (Hari)",
    "Izin (Hari)",
    "Sakit (Hari)",
    "Total Kehadiran",
    "Persentase (%)",
    "Status Honor",
  ];

  // 3. Data isi tabel
  const rows = rekapData.map((item, index) => [
    index + 1,
    item.nama || "-",
    item.kelompok || "-",
    item.hadir || 0,
    item.terlambat || 0,
    item.izin || 0,
    item.sakit || 0,
    (item.hadir || 0) + (item.terlambat || 0),
    item.persentase || "0%",
    item.catatan || "Lengkap",
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
    { wch: 12 }, // Hadir
    { wch: 14 }, // Terlambat
    { wch: 12 }, // Izin
    { wch: 12 }, // Sakit
    { wch: 15 }, // Total
    { wch: 15 }, // %
    { wch: 20 }, // Catatan
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


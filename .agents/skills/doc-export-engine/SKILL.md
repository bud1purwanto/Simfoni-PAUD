---
name: doc-export-engine
description: >-
  Prosedur dan standar pembuatan rekapitulasi dokumen resmi PAUD: PDF Ringkas Kop Resmi,
  PDF Portofolio Foto BAN-PDM, stempel cap digital transparan, dan Spreadsheet Excel (.xlsx) untuk honor guru.
  Gunakan skill ini saat mengembangkan atau memperbaiki fitur ekspor laporan di modul Kepala Sekolah dan Guru.
---

# Document Export Engine (SIMFONI PAUD)

Panduan teknis untuk menghasilkan dokumen laporan administrasi PAUD dan spreadsheet honorarium yang profesional dan dinamis.

## 1. Dynamic Branding Kop Surat Resmi

Dilarang keras melakukan *hardcode* nama sekolah, alamat, atau nama Kepala Sekolah pada dokumen cetak. Gunakan data dinamis dari tenant (`schoolData`):

```javascript
import { generateSimpleReportPDF, generateFullPortfolioPDF } from '../utils/pdfExporter';

// Memanggil generator dengan data tenant dinamis:
await generateSimpleReportPDF({
  schoolData: {
    nama_sekolah: schoolData.nama_sekolah,
    npsn: schoolData.npsn,
    alamat: schoolData.alamat,
    telepon: schoolData.telepon,
    logo_url: schoolData.logo_url,
    stempel_url: schoolData.stempel_url,
    nama_kepsek: schoolData.nama_kepsek,
    nip_kepsek: schoolData.nip_kepsek,
  },
  attendanceList: attendanceData,
  journalsList: journalsData,
  periode: { bulan: 10, tahun: 2026 }
});
```

## 2. Dua Varian PDF (Ringkas vs Portofolio)

* **PDF Ringkas (Ramah Smartphone & Hemat Memori):**
  * Ukuran file kecil (< 500 KB).
  * Berisi tabel presensi bulanan, ringkasan capaian topik KBM, tanda tangan Kepsek, dan stempel digital sekolah.
  * Aman dibuka langsung di perangkat HP tanpa risiko tab browser tertutup tiba-tiba (*crash*).
* **PDF Lengkap Portofolio (Arsip Akreditasi BAN-PDM):**
  * Dilengkapi dokumentasi foto aktivitas kegiatan belajar mengajar dengan izin publikasi.
  * Direkomendasikan diunduh melalui laptop atau komputer PC.

## 3. Ekspor Spreadsheet Excel (.xlsx) untuk Honorarium Guru

Gunakan `src/utils/excelExporter.js` untuk rekapitulasi kehadiran dan perhitungan honor/transport guru:

```javascript
import { exportAttendanceToExcel } from '../utils/excelExporter';

exportAttendanceToExcel({
  schoolName: schoolData.nama_sekolah,
  monthName: 'Oktober',
  year: 2026,
  summaryData: summaryByTeacher, // { nama, total_hari, hadir, terlambat, izin, sakit, total_menit_terlambat }
});
```

## 4. Penataan Stempel & Tanda Tangan Digital

* Letakkan stempel sekolah sedikit menindih (*overlapping*) tanda tangan Kepala Sekolah dengan efek transparansi / *alpha blend* alami layaknya dokumen fisik asli.
* Jika URL gambar logo atau stempel tidak dapat dimuat (misal kendala CORS atau offline), sediakan *fallback* rendering teks rapi tanpa menghentikan proses pembuatan PDF.


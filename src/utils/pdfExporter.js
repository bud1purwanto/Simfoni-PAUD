import jsPDF from "jspdf";
import autoTable from "jspdf-autotable";

/**
 * Helper untuk memuat gambar dari URL eksternal ke format base64
 */
const loadImageBase64 = (url) => {
  return new Promise((resolve) => {
    if (!url) return resolve(null);
    const img = new Image();
    img.crossOrigin = "Anonymous";
    img.onload = () => {
      const canvas = document.createElement("canvas");
      canvas.width = img.width;
      canvas.height = img.height;
      const ctx = canvas.getContext("2d");
      ctx.drawImage(img, 0, 0);
      try {
        const dataURL = canvas.toDataURL("image/png");
        resolve(dataURL);
      } catch (e) {
        console.warn("Gagal konversi gambar ke dataURL:", e);
        resolve(null);
      }
    };
    img.onerror = () => resolve(null);
    img.src = url;
  });
};

/**
 * 1. Rekap PDF Ringkas (Format Administrasi Sekolah / Dinas)
 * Sangat ringan (< 500 KB), render instan, dan 100% aman dibuka di HP tanpa risiko browser crash.
 */
export const exportRingkasPdf = async ({
  schoolData = {},
  periode = "Oktober 2026",
  rekapPresensi = [],
  rekapKbm = [],
}) => {
  const doc = new jsPDF({
    orientation: "portrait",
    unit: "mm",
    format: "a4",
  });

  const pageWidth = doc.internal.pageSize.getWidth();

  // Load logo sekolah jika ada
  let logoBase64 = null;
  if (schoolData.logo_url) {
    logoBase64 = await loadImageBase64(schoolData.logo_url);
  }

  // --- A. KOP SURAT RESMI DINAMIS ---
  let startY = 15;
  if (logoBase64) {
    doc.addImage(logoBase64, "PNG", 14, startY - 2, 20, 20);
  }

  const textStartX = logoBase64 ? 38 : 14;
  doc.setFont("helvetica", "bold");
  doc.setFontSize(14);
  doc.text(
    (schoolData.nama_sekolah || "SIMFONI PAUD").toUpperCase(),
    textStartX,
    startY + 4
  );

  doc.setFont("helvetica", "normal");
  doc.setFontSize(9);
  doc.setTextColor(80, 80, 80);
  const alamatText = `${schoolData.alamat || "Alamat Sekolah"}, ${schoolData.kota || ""} | Telp: ${schoolData.telepon || "-"}`;
  doc.text(alamatText, textStartX, startY + 10);
  if (schoolData.npsn) {
    doc.text(`NPSN: ${schoolData.npsn}`, textStartX, startY + 15);
  }

  // Garis Pembatas Kop Surat
  doc.setDrawColor(40, 40, 40);
  doc.setLineWidth(0.8);
  doc.line(14, startY + 20, pageWidth - 14, startY + 20);
  doc.setLineWidth(0.2);
  doc.line(14, startY + 21, pageWidth - 14, startY + 21);

  // --- B. JUDUL LAPORAN ---
  let currentY = startY + 30;
  doc.setFont("helvetica", "bold");
  doc.setFontSize(12);
  doc.setTextColor(20, 20, 20);
  doc.text("REKAPITULASI PEMBELAJARAN & KEHADIRAN GURU", pageWidth / 2, currentY, { align: "center" });

  doc.setFont("helvetica", "normal");
  doc.setFontSize(10);
  doc.text(`Periode: ${periode}`, pageWidth / 2, currentY + 6, { align: "center" });

  // --- C. TABEL REKAP KEHADIRAN GURU ---
  currentY += 14;
  doc.setFont("helvetica", "bold");
  doc.setFontSize(10);
  doc.text("I. Ringkasan Kehadiran Guru", 14, currentY);

  const presensiHeaders = [["No", "Nama Guru", "Kelompok", "Hadir", "Terlambat", "Izin", "Sakit"]];
  const presensiRows = rekapPresensi.map((item, idx) => [
    idx + 1,
    item.nama || "-",
    item.kelompok || "-",
    `${item.hadir || 0} hari`,
    `${item.terlambat || 0} hari`,
    `${item.izin || 0} hari`,
    `${item.sakit || 0} hari`,
  ]);

  autoTable(doc, {
    startY: currentY + 3,
    head: presensiHeaders,
    body: presensiRows.length ? presensiRows : [["-", "Belum ada data", "-", "-", "-", "-", "-"]],
    theme: "striped",
    headStyles: { fillColor: [79, 70, 229] },
    styles: { fontSize: 8.5 },
    margin: { left: 14, right: 14 },
  });

  // --- D. TABEL RINGKASAN JURNAL KBM ---
  currentY = doc.lastAutoTable.finalY + 10;
  doc.setFont("helvetica", "bold");
  doc.setFontSize(10);
  doc.text("II. Ringkasan Jurnal Mengajar Kurikulum Merdeka", 14, currentY);

  const kbmHeaders = [["No", "Tanggal", "Guru", "Kelas", "Topik Pembelajaran", "Status"]];
  const kbmRows = rekapKbm.map((j, idx) => [
    idx + 1,
    j.tanggal || "-",
    j.nama_guru || "-",
    j.kelompok || "-",
    j.topik || "-",
    (j.status || "disetujui").toUpperCase(),
  ]);

  autoTable(doc, {
    startY: currentY + 3,
    head: kbmHeaders,
    body: kbmRows.length ? kbmRows : [["-", "-", "Belum ada jurnal", "-", "-", "-"]],
    theme: "grid",
    headStyles: { fillColor: [55, 65, 81] },
    styles: { fontSize: 8 },
    margin: { left: 14, right: 14 },
  });

  // --- E. KOLOM TANDA TANGAN & STEMPEL CAP DIGITAL ---
  let finalY = doc.lastAutoTable.finalY + 15;
  if (finalY > 240) {
    doc.addPage();
    finalY = 25;
  }

  const signX = pageWidth - 70;
  doc.setFont("helvetica", "normal");
  doc.setFontSize(9);
  doc.text(`${schoolData.kota || "Tempat"}, ${new Date().toLocaleDateString("id-ID")}`, signX, finalY);
  doc.text("Mengetahui,", signX, finalY + 5);
  doc.text("Kepala Sekolah", signX, finalY + 10);

  // Jika ada stempel cap digital sekolah, tampilkan transparan
  if (schoolData.stempel_url) {
    const stempelBase64 = await loadImageBase64(schoolData.stempel_url);
    if (stempelBase64) {
      doc.addImage(stempelBase64, "PNG", signX - 6, finalY + 11, 26, 26);
    }
  }

  doc.setFont("helvetica", "bold");
  doc.text(schoolData.nama_kepsek_resmi || "Kepala Sekolah", signX, finalY + 32);
  doc.setFont("helvetica", "normal");
  if (schoolData.nip_kepsek) {
    doc.text(`NIP: ${schoolData.nip_kepsek}`, signX, finalY + 37);
  }

  // Unduh dokumen
  const cleanSchool = (schoolData.nama_sekolah || "Sekolah").replace(/[^a-zA-Z0-9]/g, "_");
  const cleanPeriode = periode.replace(/[^a-zA-Z0-9]/g, "_");
  doc.save(`Rekap_Resmi_${cleanSchool}_${cleanPeriode}.pdf`);
};

/**
 * 2. Rekap PDF Lengkap (Portofolio Pembelajaran + Dokumentasi Foto)
 * Ditujukan untuk akreditasi BAN-PDM & arsip pengawas di laptop.
 */
export const exportLengkapPortofolioPdf = async ({
  schoolData = {},
  periode = "Oktober 2026",
  journals = [],
}) => {
  const doc = new jsPDF({
    orientation: "portrait",
    unit: "mm",
    format: "a4",
  });

  const pageWidth = doc.internal.pageSize.getWidth();

  // Cover Page Portofolio
  doc.setFillColor(79, 70, 229);
  doc.rect(0, 0, pageWidth, 45, "F");

  doc.setFont("helvetica", "bold");
  doc.setFontSize(18);
  doc.setTextColor(255, 255, 255);
  doc.text("PORTOFOLIO KEGIATAN KBM PAUD", pageWidth / 2, 22, { align: "center" });

  doc.setFontSize(12);
  doc.text((schoolData.nama_sekolah || "SIMFONI PAUD").toUpperCase(), pageWidth / 2, 32, { align: "center" });

  let currentY = 55;
  doc.setFont("helvetica", "normal");
  doc.setFontSize(10);
  doc.setTextColor(40, 40, 40);
  doc.text(`Periode: ${periode}`, 14, currentY);
  doc.text(`Total Jurnal Terdokumentasi: ${journals.length} Kegiatan`, 14, currentY + 6);

  currentY += 15;

  for (let i = 0; i < journals.length; i++) {
    const j = journals[i];
    
    // Periksa apakah halaman baru diperlukan
    if (currentY > 230) {
      doc.addPage();
      currentY = 20;
    }

    doc.setDrawColor(200, 200, 200);
    doc.setFillColor(248, 250, 252);
    doc.roundedRect(14, currentY, pageWidth - 28, 48, 2, 2, "FD");

    doc.setFont("helvetica", "bold");
    doc.setFontSize(11);
    doc.setTextColor(30, 41, 59);
    doc.text(`${i + 1}. [${j.kelompok || "TK"}] ${j.topik || "Kegiatan KBM"}`, 18, currentY + 8);

    doc.setFont("helvetica", "normal");
    doc.setFontSize(8.5);
    doc.setTextColor(71, 85, 105);
    doc.text(`Guru: ${j.nama_guru || "-"} | Tanggal: ${j.tanggal || "-"}`, 18, currentY + 14);
    
    const capaian = Array.isArray(j.capaian_pembelajaran) ? j.capaian_pembelajaran.join(", ") : "-";
    doc.text(`Capaian: ${capaian}`, 18, currentY + 19);

    doc.setFont("helvetica", "italic");
    const intiText = doc.splitTextToSize(`Inti: ${j.kegiatan_inti || "-"}`, pageWidth - 40);
    doc.text(intiText.slice(0, 2), 18, currentY + 25);

    const refleksiText = doc.splitTextToSize(`Refleksi: ${j.refleksi || "-"}`, pageWidth - 40);
    doc.text(refleksiText.slice(0, 2), 18, currentY + 36);

    currentY += 54;
  }

  const cleanSchool = (schoolData.nama_sekolah || "Sekolah").replace(/[^a-zA-Z0-9]/g, "_");
  doc.save(`Portofolio_KBM_${cleanSchool}_${periode}.pdf`);
};


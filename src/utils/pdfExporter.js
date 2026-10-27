import jsPDF from "jspdf";
import autoTable from "jspdf-autotable";
import { formatTanggalIndo } from "./formatters";

// Palet Warm Honey & Sage Green (lihat docs/ui-design-guidelines.md)
const COLOR_HONEY = [217, 119, 6];
const COLOR_SAGE = [77, 124, 95];
const COLOR_INK = [30, 41, 59];
const COLOR_MUTED = [100, 116, 139];

const MARGIN = 14;

/**
 * Memuat gambar dari URL eksternal ke dataURL.
 * - PNG dipertahankan (stempel/logo transparan).
 * - Foto diperkecil ke `maxSize` px dan dikonversi JPEG agar PDF tetap ringan.
 * Mengembalikan null jika gagal (mis. CORS bucket Storage belum dikonfigurasi).
 */
const loadImage = (url, { format = "PNG", maxSize = 600, quality = 0.75 } = {}) => {
  return new Promise((resolve) => {
    if (!url) return resolve(null);
    const img = new Image();
    img.crossOrigin = "Anonymous";
    img.onload = () => {
      const scale = Math.min(1, maxSize / Math.max(img.width, img.height));
      const width = Math.max(1, Math.round(img.width * scale));
      const height = Math.max(1, Math.round(img.height * scale));
      const canvas = document.createElement("canvas");
      canvas.width = width;
      canvas.height = height;
      const ctx = canvas.getContext("2d");
      if (format === "JPEG") {
        ctx.fillStyle = "#ffffff";
        ctx.fillRect(0, 0, width, height);
      }
      ctx.drawImage(img, 0, 0, width, height);
      try {
        const dataUrl = format === "JPEG" ? canvas.toDataURL("image/jpeg", quality) : canvas.toDataURL("image/png");
        resolve({ dataUrl, width, height });
      } catch (e) {
        console.warn("Gagal konversi gambar ke dataURL:", e);
        resolve(null);
      }
    };
    img.onerror = () => resolve(null);
    img.src = url;
  });
};

const cleanFileName = (text) => (text || "Sekolah").replace(/[^a-zA-Z0-9]+/g, "_").replace(/^_|_$/g, "");

/**
 * Kop Surat resmi dinamis dari data tenant. Mengembalikan posisi Y setelah garis kop.
 */
const drawKopSurat = (doc, schoolData, logo) => {
  const pageWidth = doc.internal.pageSize.getWidth();
  const startY = 15;

  if (logo) {
    const ratio = logo.width / logo.height;
    const h = 20;
    const w = Math.min(24, h * ratio);
    doc.addImage(logo.dataUrl, "PNG", MARGIN, startY - 2, w, w / ratio);
  }

  const textStartX = logo ? MARGIN + 26 : MARGIN;
  doc.setFont("helvetica", "bold");
  doc.setFontSize(14);
  doc.setTextColor(...COLOR_INK);
  doc.text((schoolData.nama_sekolah || "SIMFONI PAUD").toUpperCase(), textStartX, startY + 4);

  doc.setFont("helvetica", "normal");
  doc.setFontSize(9);
  doc.setTextColor(...COLOR_MUTED);
  const alamatParts = [schoolData.alamat, schoolData.kota].filter(Boolean).join(", ");
  const alamatText = [alamatParts, schoolData.telepon ? `Telp: ${schoolData.telepon}` : null].filter(Boolean).join(" | ");
  if (alamatText) doc.text(alamatText, textStartX, startY + 10);
  if (schoolData.npsn) doc.text(`NPSN: ${schoolData.npsn}`, textStartX, startY + 15);

  doc.setDrawColor(40, 40, 40);
  doc.setLineWidth(0.8);
  doc.line(MARGIN, startY + 20, pageWidth - MARGIN, startY + 20);
  doc.setLineWidth(0.2);
  doc.line(MARGIN, startY + 21, pageWidth - MARGIN, startY + 21);

  return startY + 21;
};

/**
 * Blok tanda tangan Kepala Sekolah + stempel digital transparan.
 */
const drawPengesahan = (doc, schoolData, stempel, y) => {
  const pageWidth = doc.internal.pageSize.getWidth();
  const pageHeight = doc.internal.pageSize.getHeight();
  let finalY = y;
  if (finalY > pageHeight - 55) {
    doc.addPage();
    finalY = 25;
  }

  const signX = pageWidth - 75;
  doc.setFont("helvetica", "normal");
  doc.setFontSize(9);
  doc.setTextColor(...COLOR_INK);
  doc.text(`${schoolData.kota || ""}${schoolData.kota ? ", " : ""}${formatTanggalIndo(new Date()).replace(/^[^,]+, /, "")}`, signX, finalY);
  doc.text("Mengetahui,", signX, finalY + 5);
  doc.text("Kepala Sekolah", signX, finalY + 10);

  if (stempel) {
    doc.addImage(stempel.dataUrl, "PNG", signX - 6, finalY + 11, 26, 26);
  }

  doc.setFont("helvetica", "bold");
  doc.text(schoolData.nama_kepsek_resmi || "( ............................. )", signX, finalY + 32);
  doc.setFont("helvetica", "normal");
  if (schoolData.nip_kepsek) {
    doc.text(`NIP: ${schoolData.nip_kepsek}`, signX, finalY + 37);
  }
};

const addPageNumbers = (doc, label) => {
  const total = doc.getNumberOfPages();
  const pageWidth = doc.internal.pageSize.getWidth();
  const pageHeight = doc.internal.pageSize.getHeight();
  for (let i = 1; i <= total; i++) {
    doc.setPage(i);
    doc.setFont("helvetica", "normal");
    doc.setFontSize(7.5);
    doc.setTextColor(...COLOR_MUTED);
    doc.text(`${label} • Halaman ${i} dari ${total}`, pageWidth / 2, pageHeight - 8, { align: "center" });
  }
};

/**
 * 1. Rekap PDF Ringkas (Format Administrasi Sekolah / Dinas)
 * Sangat ringan (< 500 KB), render instan, dan aman dibuka di HP tanpa risiko browser crash.
 */
export const exportRingkasPdf = async ({
  schoolData = {},
  periode = "",
  hariKerjaEfektif = null,
  rekapPresensi = [],
  rekapKbm = [],
}) => {
  const doc = new jsPDF({ orientation: "portrait", unit: "mm", format: "a4" });
  const pageWidth = doc.internal.pageSize.getWidth();

  const [logo, stempel] = await Promise.all([
    loadImage(schoolData.logo_url, { maxSize: 300 }),
    loadImage(schoolData.stempel_url, { maxSize: 300 }),
  ]);

  // --- A. KOP SURAT RESMI DINAMIS ---
  let currentY = drawKopSurat(doc, schoolData, logo) + 9;

  // --- B. JUDUL LAPORAN ---
  doc.setFont("helvetica", "bold");
  doc.setFontSize(12);
  doc.setTextColor(...COLOR_INK);
  doc.text("REKAPITULASI PEMBELAJARAN & KEHADIRAN GURU", pageWidth / 2, currentY, { align: "center" });

  doc.setFont("helvetica", "normal");
  doc.setFontSize(10);
  const subJudul = hariKerjaEfektif !== null ? `Periode: ${periode} (${hariKerjaEfektif} hari kerja efektif)` : `Periode: ${periode}`;
  doc.text(subJudul, pageWidth / 2, currentY + 6, { align: "center" });

  // --- C. TABEL REKAP KEHADIRAN GURU ---
  currentY += 14;
  doc.setFont("helvetica", "bold");
  doc.setFontSize(10);
  doc.text("I. Ringkasan Kehadiran Guru", MARGIN, currentY);

  const presensiHeaders = [["No", "Nama Guru", "Kelompok", "Hadir", "Terlambat", "Izin", "Sakit", "Tanpa Ket.", "%"]];
  const presensiRows = rekapPresensi.map((item, idx) => [
    idx + 1,
    item.nama || "-",
    item.kelompok || "-",
    item.hadir || 0,
    item.menitTerlambat ? `${item.terlambat || 0} (${item.menitTerlambat} mnt)` : item.terlambat || 0,
    item.izin || 0,
    item.sakit || 0,
    item.alpa || 0,
    item.persentase || "0%",
  ]);

  autoTable(doc, {
    startY: currentY + 3,
    head: presensiHeaders,
    body: presensiRows.length ? presensiRows : [["-", "Belum ada data", "-", "-", "-", "-", "-", "-", "-"]],
    theme: "striped",
    headStyles: { fillColor: COLOR_SAGE },
    styles: { fontSize: 8.5 },
    columnStyles: { 0: { cellWidth: 9 }, 3: { halign: "center" }, 4: { halign: "center" }, 5: { halign: "center" }, 6: { halign: "center" }, 7: { halign: "center" }, 8: { halign: "center" } },
    margin: { left: MARGIN, right: MARGIN },
  });

  // --- D. TABEL RINGKASAN JURNAL KBM ---
  currentY = doc.lastAutoTable.finalY + 10;
  doc.setFont("helvetica", "bold");
  doc.setFontSize(10);
  doc.setTextColor(...COLOR_INK);
  doc.text("II. Ringkasan Jurnal Mengajar Kurikulum Merdeka", MARGIN, currentY);

  const statusLabel = { dikirim: "Menunggu", perlu_revisi: "Revisi", disetujui: "Disetujui" };
  const kbmHeaders = [["No", "Tanggal", "Guru", "Kelas", "Topik Pembelajaran", "Status"]];
  const kbmRows = rekapKbm.map((j, idx) => [
    idx + 1,
    j.tanggal || "-",
    j.nama_guru || "-",
    j.kelompok || "-",
    j.topik || "-",
    statusLabel[j.status] || j.status || "-",
  ]);

  autoTable(doc, {
    startY: currentY + 3,
    head: kbmHeaders,
    body: kbmRows.length ? kbmRows : [["-", "-", "Belum ada jurnal", "-", "-", "-"]],
    theme: "grid",
    headStyles: { fillColor: COLOR_HONEY },
    styles: { fontSize: 8 },
    columnStyles: { 0: { cellWidth: 9 }, 1: { cellWidth: 22 } },
    margin: { left: MARGIN, right: MARGIN },
  });

  // --- E. KOLOM TANDA TANGAN & STEMPEL CAP DIGITAL ---
  drawPengesahan(doc, schoolData, stempel, doc.lastAutoTable.finalY + 15);
  addPageNumbers(doc, `Rekap ${periode} - ${schoolData.nama_sekolah || "SIMFONI PAUD"}`);

  doc.save(`Rekap_Resmi_${cleanFileName(schoolData.nama_sekolah)}_${cleanFileName(periode)}.pdf`);
};

/**
 * 2. Rekap PDF Lengkap (Portofolio Pembelajaran + Dokumentasi Foto)
 * Ditujukan untuk akreditasi BAN-PDM & arsip pengawas (disarankan diunduh via laptop).
 * Maksimal 2 foto per jurnal, diperkecil ke JPEG agar ukuran file tetap wajar.
 */
export const exportLengkapPortofolioPdf = async ({
  schoolData = {},
  periode = "",
  journals = [],
  maxFotoPerJurnal = 2,
}) => {
  const doc = new jsPDF({ orientation: "portrait", unit: "mm", format: "a4" });
  const pageWidth = doc.internal.pageSize.getWidth();
  const pageHeight = doc.internal.pageSize.getHeight();
  const contentWidth = pageWidth - MARGIN * 2;
  const bottomLimit = pageHeight - 18;

  const [logo, stempel] = await Promise.all([
    loadImage(schoolData.logo_url, { maxSize: 300 }),
    loadImage(schoolData.stempel_url, { maxSize: 300 }),
  ]);

  let y = drawKopSurat(doc, schoolData, logo) + 10;

  doc.setFont("helvetica", "bold");
  doc.setFontSize(13);
  doc.setTextColor(...COLOR_INK);
  doc.text("PORTOFOLIO KEGIATAN PEMBELAJARAN (KBM)", pageWidth / 2, y, { align: "center" });
  doc.setFont("helvetica", "normal");
  doc.setFontSize(10);
  doc.text(`Periode: ${periode} • ${journals.length} kegiatan tervalidasi`, pageWidth / 2, y + 6, { align: "center" });
  y += 14;

  const ensureSpace = (needed) => {
    if (y + needed > bottomLimit) {
      doc.addPage();
      y = 20;
    }
  };

  const writeParagraph = (label, text, fontSize = 8.5) => {
    if (!text) return;
    doc.setFontSize(fontSize);
    const lines = doc.splitTextToSize(`${label}: ${text}`, contentWidth - 8);
    const lineHeight = fontSize * 0.42;
    for (const line of lines) {
      ensureSpace(lineHeight);
      doc.text(line, MARGIN + 4, y);
      y += lineHeight;
    }
    y += 1.5;
  };

  for (let i = 0; i < journals.length; i++) {
    const j = journals[i];
    ensureSpace(30);

    // Judul kegiatan dengan aksen garis honey
    doc.setFillColor(...COLOR_HONEY);
    doc.rect(MARGIN, y - 4, 1.5, 6, "F");
    doc.setFont("helvetica", "bold");
    doc.setFontSize(10.5);
    doc.setTextColor(...COLOR_INK);
    const judul = doc.splitTextToSize(`${i + 1}. ${j.topik || "Kegiatan KBM"}`, contentWidth - 6);
    doc.text(judul, MARGIN + 4, y);
    y += judul.length * 4.6;

    doc.setFont("helvetica", "normal");
    doc.setFontSize(8.5);
    doc.setTextColor(...COLOR_MUTED);
    doc.text(`${formatTanggalIndo(j.tanggal)} • Kelompok ${j.kelompok || "-"} • Guru: ${j.nama_guru || "-"}`, MARGIN + 4, y);
    y += 5;

    doc.setTextColor(...COLOR_INK);
    const capaian = Array.isArray(j.capaian_pembelajaran) && j.capaian_pembelajaran.length ? j.capaian_pembelajaran.join(", ") : "-";
    writeParagraph("Capaian Pembelajaran", capaian);
    writeParagraph("Tujuan", j.tujuan);
    writeParagraph("Kegiatan Pembuka", j.kegiatan_pembuka);
    writeParagraph("Kegiatan Inti", j.kegiatan_inti);
    writeParagraph("Kegiatan Penutup", j.kegiatan_penutup);
    writeParagraph("Refleksi", j.refleksi);

    // Foto dokumentasi (berdampingan)
    const fotos = (j.fotos || []).slice(0, maxFotoPerJurnal);
    if (fotos.length) {
      const loaded = (await Promise.all(fotos.map((f) => loadImage(f.url, { format: "JPEG", maxSize: 900, quality: 0.7 })))).filter(Boolean);
      if (loaded.length) {
        const gap = 4;
        const slotWidth = (contentWidth - 8 - gap * (maxFotoPerJurnal - 1)) / maxFotoPerJurnal;
        const slotHeight = 52;
        ensureSpace(slotHeight + 4);
        loaded.forEach((img, idx) => {
          const ratio = img.width / img.height;
          let w = slotWidth;
          let h = w / ratio;
          if (h > slotHeight) {
            h = slotHeight;
            w = h * ratio;
          }
          doc.addImage(img.dataUrl, "JPEG", MARGIN + 4 + idx * (slotWidth + gap), y, w, h);
        });
        y += slotHeight + 4;
      } else {
        doc.setFontSize(7.5);
        doc.setTextColor(...COLOR_MUTED);
        doc.text(`(${fotos.length} foto dokumentasi tersimpan di sistem)`, MARGIN + 4, y);
        doc.setTextColor(...COLOR_INK);
        y += 5;
      }
    }

    // Pemisah antar kegiatan
    ensureSpace(4);
    doc.setDrawColor(226, 232, 240);
    doc.setLineWidth(0.2);
    doc.line(MARGIN, y, pageWidth - MARGIN, y);
    y += 7;
  }

  drawPengesahan(doc, schoolData, stempel, y + 5);
  addPageNumbers(doc, `Portofolio KBM ${periode} - ${schoolData.nama_sekolah || "SIMFONI PAUD"}`);

  doc.save(`Portofolio_KBM_${cleanFileName(schoolData.nama_sekolah)}_${cleanFileName(periode)}.pdf`);
};

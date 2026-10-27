import { format, parseISO } from "date-fns";
import { id } from "date-fns/locale";

/**
 * Format tanggal standar Indonesia (contoh: 'Senin, 27 Oktober 2026')
 */
export const formatTanggalIndo = (dateOrString) => {
  if (!dateOrString) return "-";
  try {
    const d = typeof dateOrString === "string" ? parseISO(dateOrString) : dateOrString;
    return format(d, "EEEE, d MMMM yyyy", { locale: id });
  } catch {
    return String(dateOrString);
  }
};

/**
 * Format jam menit (contoh: '07:30 WIB')
 */
export const formatJamMenit = (timestampOrDate) => {
  if (!timestampOrDate) return "-";
  try {
    // Firestore Timestamp object memiliki method toDate()
    const d = timestampOrDate?.toDate ? timestampOrDate.toDate() : new Date(timestampOrDate);
    return `${format(d, "HH:mm")} WIB`;
  } catch {
    return "-";
  }
};

/**
 * Helper untuk membuat URL WhatsApp Share (wa.me)
 */
export const createWhatsAppShareUrl = (text, phone = "") => {
  const encodedText = encodeURIComponent(text);
  if (phone) {
    const cleanPhone = phone.replace(/[^0-9]/g, "").replace(/^0/, "62");
    return `https://wa.me/${cleanPhone}?text=${encodedText}`;
  }
  return `https://wa.me/?text=${encodedText}`;
};

/**
 * Format teks ringkasan KBM untuk dibagikan ke WhatsApp
 */
export const formatKbmToWhatsAppMessage = ({
  namaSekolah,
  namaGuru,
  kelompok,
  tanggal,
  topik,
  kegiatanInti,
  status,
}) => {
  return `🎶 *LAPORAN KEGIATAN KBM - ${namaSekolah.toUpperCase()}*\n\n` +
    `📅 *Tanggal:* ${formatTanggalIndo(tanggal)}\n` +
    `👩‍🏫 *Guru:* ${namaGuru} (${kelompok})\n` +
    `🎨 *Topik:* ${topik}\n` +
    `📝 *Kegiatan:* ${kegiatanInti || "-"}\n` +
    `✅ *Status:* ${(status || "disetujui").toUpperCase()}\n\n` +
    `_Dikelola melalui SIMFONI PAUD - Sistem Informasi Monitoring & Pelaporan Terintegrasi_`;
};


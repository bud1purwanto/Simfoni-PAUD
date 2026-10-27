import { format, parseISO } from "date-fns";
import { id } from "date-fns/locale";

/**
 * Tanggal lokal perangkat dalam format 'YYYY-MM-DD'.
 * JANGAN gunakan `toISOString()` untuk tanggal operasional: nilainya UTC, sehingga
 * presensi pukul 00:00–06:59 WIB tercatat sebagai tanggal kemarin.
 */
export const getLocalDateString = (date = new Date()) => format(date, "yyyy-MM-dd");

/**
 * Bulan lokal perangkat dalam format 'YYYY-MM'.
 */
export const getLocalMonthString = (date = new Date()) => format(date, "yyyy-MM");

/**
 * Jam lokal perangkat dalam format 'HH:mm:ss' (dipakai untuk *_device timestamp).
 */
export const getLocalTimeString = (date = new Date()) => format(date, "HH:mm:ss");

/**
 * Nama hari Indonesia untuk tanggal tertentu (Minggu, Senin, ...).
 */
export const HARI_INDO = ["Minggu", "Senin", "Selasa", "Rabu", "Kamis", "Jumat", "Sabtu"];
export const getNamaHari = (date = new Date()) => HARI_INDO[date.getDay()];

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
    // Jika format string jam langsung dari device (misal '07:30' atau '07:30:15')
    if (typeof timestampOrDate === "string") {
      if (/^\d{2}:\d{2}(:\d{2})?$/.test(timestampOrDate.trim())) {
        return `${timestampOrDate.trim().slice(0, 5)} WIB`;
      }
    }
    // Firestore Timestamp object memiliki method toDate()
    const d = timestampOrDate?.toDate ? timestampOrDate.toDate() : new Date(timestampOrDate);
    if (isNaN(d.getTime())) {
      return String(timestampOrDate);
    }
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
  return `🎶 *LAPORAN KEGIATAN KBM - ${(namaSekolah || "PAUD").toUpperCase()}*\n\n` +
    `📅 *Tanggal:* ${formatTanggalIndo(tanggal)}\n` +
    `👩‍🏫 *Guru:* ${namaGuru} (${kelompok})\n` +
    `🎨 *Topik:* ${topik}\n` +
    `📝 *Kegiatan:* ${kegiatanInti || "-"}\n` +
    `✅ *Status:* ${(status || "disetujui").toUpperCase()}\n\n` +
    `_Dikelola melalui SIMFONI PAUD - Sistem Informasi Monitoring & Pelaporan Terintegrasi_`;
};


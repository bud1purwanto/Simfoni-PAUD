import { collection, addDoc, serverTimestamp } from "firebase/firestore";
import { db } from "../config/firebase";

/**
 * Helper untuk mencatat aktivitas penting ke koleksi audit_logs
 * @param {Object} params
 * @param {string|null} params.schoolId - ID sekolah tenant (atau null jika aksi global superadmin)
 * @param {string} params.actorId - UID pelaksana aksi (WAJIB sama dengan UID sesi aktif, divalidasi Security Rules)
 * @param {string} params.actorNama - Nama lengkap pelaksana
 * @param {string} params.action - Kode aksi UPPER_SNAKE_CASE (ADD_GURU, APPROVE_JOURNAL, dll)
 * @param {string} params.recordType - 'schools' | 'users' | 'attendance' | 'journals' | 'schedules' | 'tasks_and_issues' | 'audit_logs'
 * @param {string} params.recordId - ID dokumen target
 * @param {Object} [params.detail] - Keterangan tambahan ringkas (opsional, nilai primitif)
 */
export const logActivity = async ({
  schoolId = null,
  actorId,
  actorNama,
  action,
  recordType,
  recordId,
  detail = null,
}) => {
  // Fire-and-forget: tidak menunggu konfirmasi server agar UI tidak macet saat offline
  // (addDoc tetap antre di IndexedDB dan terkirim otomatis saat sinyal kembali).
  try {
    addDoc(collection(db, "audit_logs"), {
      school_id: schoolId || null,
      actor_id: actorId,
      actor_nama: actorNama || "Pengguna",
      action: action,
      record_type: recordType,
      record_id: String(recordId ?? "-"),
      detail: detail ? sanitizeDetail(detail) : null,
      timestamp: serverTimestamp(),
    }).catch((error) => console.warn("Gagal menyimpan audit log:", error));
  } catch (error) {
    // Audit log failure tidak boleh memblokir interaksi pengguna utama
    console.warn("Gagal menyimpan audit log:", error);
  }
};

// Firestore menolak nilai `undefined`; simpan hanya nilai primitif yang terdefinisi.
const sanitizeDetail = (detail) =>
  Object.fromEntries(
    Object.entries(detail)
      .filter(([, v]) => v !== undefined && (v === null || ["string", "number", "boolean"].includes(typeof v)))
  );

/**
 * Label ramah pengguna untuk kode aksi audit log (dipakai halaman Riwayat Aktivitas).
 */
export const ACTION_LABELS = {
  ADD_SCHOOL: "Mendaftarkan sekolah",
  UPDATE_SCHOOL: "Memperbarui profil sekolah",
  SUSPEND_SCHOOL: "Menangguhkan layanan sekolah",
  ACTIVATE_SCHOOL: "Mengaktifkan layanan sekolah",
  ADD_KEPSEK: "Membuat akun Kepala Sekolah",
  EDIT_KEPSEK: "Mengubah profil Kepala Sekolah",
  TOGGLE_STATUS_KEPSEK: "Mengubah status akun Kepala Sekolah",
  RESET_PASSWORD_KEPSEK: "Mereset sandi Kepala Sekolah",
  ADD_GURU: "Menambah akun guru",
  EDIT_GURU: "Mengubah profil guru",
  TOGGLE_STATUS_GURU: "Mengubah status akun guru",
  RESET_PASSWORD_GURU: "Mereset sandi guru",
  UPDATE_JAM_SEKOLAH: "Mengubah jam sekolah",
  ADD_JADWAL: "Menambah jadwal",
  UPDATE_JADWAL: "Mengubah jadwal",
  DELETE_JADWAL: "Menghapus jadwal",
  ABSEN_DATANG: "Absen datang",
  ABSEN_PULANG: "Absen pulang",
  AJUKAN_IZIN: "Mengajukan izin",
  AJUKAN_SAKIT: "Mengajukan sakit",
  AJUKAN_KOREKSI_PRESENSI: "Mengajukan koreksi presensi",
  APPROVE_CORRECTION: "Menyetujui koreksi presensi",
  REJECT_CORRECTION: "Menolak koreksi presensi",
  SIMPAN_DRAF_JURNAL: "Menyimpan draf jurnal",
  KIRIM_JURNAL: "Mengirim jurnal",
  APPROVE_JOURNAL: "Menyetujui jurnal",
  BULK_APPROVE_JOURNALS: "Menyetujui jurnal sekaligus",
  REVISION_JOURNAL: "Meminta revisi jurnal",
  ADD_TASK_OR_ISSUE: "Melaporkan tugas/kendala",
  RESPOND_TASK_OR_ISSUE: "Menanggapi tugas/kendala",
  ADD_STUDENT: "Menambahkan murid baru",
  UPDATE_STUDENT: "Memperbarui profil murid",
  DELETE_STUDENT: "Menghapus data murid",
  SUBMIT_STUDENT_ATTENDANCE: "Mencatat presensi rombel murid",
  SUBMIT_RPPH: "Mengunggah perangkat ajar (RPPH)",
  APPROVE_RPPH: "Mengesahkan perangkat ajar (RPPH)",
  REVISE_RPPH: "Meminta revisi perangkat ajar (RPPH)",
  SUBMIT_STUDENT_ASSESSMENT: "Mencatat asesmen capaian murid",
  SUBMIT_TEACHER_SUPERVISION: "Menyimpan evaluasi supervisi guru",
  PURGE_LOGS: "Membersihkan log lama",
  AUTO_PURGE_LOGS: "Pembersihan log otomatis",
};

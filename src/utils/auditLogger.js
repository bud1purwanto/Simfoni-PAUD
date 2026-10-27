import { collection, addDoc, serverTimestamp } from "firebase/firestore";
import { db } from "../config/firebase";

/**
 * Helper untuk mencatat aktivitas penting ke koleksi audit_logs
 * @param {Object} params
 * @param {string|null} params.schoolId - ID sekolah tenant (atau null jika aksi global superadmin)
 * @param {string} params.actorId - UID pelaksana aksi
 * @param {string} params.actorNama - Nama lengkap pelaksana
 * @param {string} params.action - Kode aksi (ADD_GURU, APPROVE_JOURNAL, dll)
 * @param {string} params.recordType - 'schools' | 'users' | 'attendance' | 'journals' | 'tasks_and_issues' | 'audit_logs'
 * @param {string} params.recordId - ID dokumen target
 */
export const logActivity = async ({
  schoolId = null,
  actorId,
  actorNama,
  action,
  recordType,
  recordId,
}) => {
  try {
    await addDoc(collection(db, "audit_logs"), {
      school_id: schoolId,
      actor_id: actorId,
      actor_nama: actorNama || "Pengguna",
      action: action,
      record_type: recordType,
      record_id: String(recordId),
      timestamp: serverTimestamp(),
    });
  } catch (error) {
    // Audit log failure tidak boleh memblokir interaksi pengguna utama
    console.warn("Gagal menyimpan audit log:", error);
  }
};


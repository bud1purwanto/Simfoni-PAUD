import { doc, updateDoc, serverTimestamp } from "firebase/firestore";
import { db } from "../config/firebase";

/**
 * Menyelaraskan counter `schools.jumlah_guru_aktif` dengan jumlah guru aktif sebenarnya.
 * Counter ini dipakai Security Rules untuk menegakkan `kuota_guru` di sisi server, sehingga
 * sekolah lama (sebelum counter ada) wajib disinkronkan sekali oleh Superadmin.
 * Dipanggil otomatis saat Superadmin membuka Dashboard / Kelola Sekolah.
 * @returns {Promise<number>} jumlah sekolah yang diperbaiki
 */
export const syncGuruCounters = async (schools, users) => {
  const activeBySchool = {};
  users.forEach((u) => {
    if (u.role === "guru" && u.status_akun === "aktif" && u.school_id) {
      activeBySchool[u.school_id] = (activeBySchool[u.school_id] || 0) + 1;
    }
  });

  const mismatched = schools.filter((s) => s.jumlah_guru_aktif !== (activeBySchool[s.id] || 0));
  await Promise.all(
    mismatched.map((s) =>
      updateDoc(doc(db, "schools", s.id), {
        jumlah_guru_aktif: activeBySchool[s.id] || 0,
        updated_at: serverTimestamp(),
      }).catch((err) => console.warn(`Gagal sinkron kuota ${s.id}:`, err))
    )
  );
  return mismatched.length;
};

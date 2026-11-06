import { collection, doc, getDocs, updateDoc, serverTimestamp } from "firebase/firestore";
import { db } from "../config/firebase";

/**
 * Inisialisasi counter `schools.jumlah_guru_aktif` dan `schools.jumlah_murid_aktif` untuk
 * sekolah yang BELUM memiliki counter (data lama). Counter dipakai Security Rules untuk
 * menegakkan kuota paket; setelah ada, rules menjamin counter selalu berubah satu batch
 * dengan datanya, jadi counter yang sudah ada TIDAK ditimpa (listener schools & users bisa
 * tiba tidak berurutan dan menimpa counter dengan angka basi).
 * Dipanggil otomatis saat Superadmin membuka Dashboard / Kelola Sekolah.
 * @returns {Promise<number>} jumlah sekolah yang diinisialisasi
 */
let studentCountsCache = null; // dimuat sekali per sesi (hemat kuota baca)

const loadStudentCounts = async () => {
  if (!studentCountsCache) {
    studentCountsCache = getDocs(collection(db, "students")).then((snap) => {
      const counts = {};
      snap.docs.forEach((d) => {
        const s = d.data();
        if ((s.status || "aktif") === "aktif" && s.school_id) {
          counts[s.school_id] = (counts[s.school_id] || 0) + 1;
        }
      });
      return counts;
    }).catch((err) => {
      studentCountsCache = null;
      throw err;
    });
  }
  return studentCountsCache;
};

const isMissing = (v) => typeof v !== "number";

export const syncGuruCounters = async (schools, users) => {
  const pending = schools.filter((s) => isMissing(s.jumlah_guru_aktif) || isMissing(s.jumlah_murid_aktif));
  if (pending.length === 0) return 0;

  const guruBySchool = {};
  users.forEach((u) => {
    if (u.role === "guru" && u.status_akun === "aktif" && u.school_id) {
      guruBySchool[u.school_id] = (guruBySchool[u.school_id] || 0) + 1;
    }
  });

  let muridBySchool = null;
  try {
    if (pending.some((s) => isMissing(s.jumlah_murid_aktif))) muridBySchool = await loadStudentCounts();
  } catch (err) {
    console.warn("Gagal menghitung murid untuk sinkron kuota:", err);
  }

  const updates = pending
    .map((s) => {
      const patch = {};
      if (isMissing(s.jumlah_guru_aktif)) patch.jumlah_guru_aktif = guruBySchool[s.id] || 0;
      if (muridBySchool && isMissing(s.jumlah_murid_aktif)) patch.jumlah_murid_aktif = muridBySchool[s.id] || 0;
      return [s.id, patch];
    })
    .filter(([, patch]) => Object.keys(patch).length > 0);

  await Promise.all(
    updates.map(([id, patch]) =>
      updateDoc(doc(db, "schools", id), { ...patch, updated_at: serverTimestamp() })
        .catch((err) => console.warn(`Gagal sinkron kuota ${id}:`, err))
    )
  );
  return updates.length;
};

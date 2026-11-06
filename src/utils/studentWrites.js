import { collection, doc, writeBatch, increment, serverTimestamp } from 'firebase/firestore';
import { db } from '../config/firebase';
import { commitWrite } from './offlineWrite';

/**
 * Penulisan data murid + counter kuota `schools.jumlah_murid_aktif` dalam SATU batch.
 * Security Rules memverifikasi perubahan counter (±1 hanya jika status "aktif" murid berubah)
 * dan menolak bila melebihi `schools.kuota_murid` (null = tanpa batas).
 * Murid berstatus lulus / mutasi tidak memakan kuota.
 */
const isAktif = (status) => (status || 'aktif') === 'aktif';

const counterUpdate = (schoolId, studentId, delta) => ({
  ref: doc(db, 'schools', schoolId),
  data: {
    jumlah_murid_aktif: increment(delta),
    murid_counter_ref: studentId,
    updated_at: serverTimestamp(),
  },
});

/**
 * Simpan murid baru atau perbarui murid lama.
 * @returns {Promise<{ id: string, queued: boolean }>}
 */
export const saveStudent = async ({ schoolId, studentId = null, prevStatus = null, data }) => {
  const batch = writeBatch(db);
  const ref = studentId ? doc(db, 'students', studentId) : doc(collection(db, 'students'));

  if (studentId) {
    batch.update(ref, data);
  } else {
    batch.set(ref, data);
  }

  const before = studentId ? isAktif(prevStatus) : false;
  const after = isAktif(data.status);
  const delta = (after ? 1 : 0) - (before ? 1 : 0);
  if (delta !== 0) {
    const c = counterUpdate(schoolId, ref.id, delta);
    batch.update(c.ref, c.data);
  }

  const { queued } = await commitWrite(batch.commit());
  return { id: ref.id, queued };
};

/**
 * Hapus murid (Kepsek). Murid aktif mengembalikan 1 slot kuota.
 */
export const deleteStudent = async ({ schoolId, studentId, status }) => {
  const batch = writeBatch(db);
  batch.delete(doc(db, 'students', studentId));
  if (isAktif(status)) {
    const c = counterUpdate(schoolId, studentId, -1);
    batch.update(c.ref, c.data);
  }
  return commitWrite(batch.commit());
};

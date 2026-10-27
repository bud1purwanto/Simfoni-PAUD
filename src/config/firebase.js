import { initializeApp, getApps, getApp } from "firebase/app";
import { getAuth, createUserWithEmailAndPassword, signOut, deleteUser, connectAuthEmulator } from "firebase/auth";
import {
  getFirestore,
  connectFirestoreEmulator,
  initializeFirestore,
  persistentLocalCache,
  persistentMultipleTabManager,
  doc,
  setDoc,
  updateDoc,
  writeBatch,
  increment,
  serverTimestamp
} from "firebase/firestore";
import { getStorage, connectStorageEmulator } from "firebase/storage";
import { getAnalytics, isSupported } from "firebase/analytics";

const firebaseConfig = {
  apiKey: import.meta.env.VITE_FIREBASE_API_KEY || "dummy-api-key",
  authDomain: import.meta.env.VITE_FIREBASE_AUTH_DOMAIN || "simfoni-paud.firebaseapp.com",
  projectId: import.meta.env.VITE_FIREBASE_PROJECT_ID || "simfoni-paud",
  storageBucket: import.meta.env.VITE_FIREBASE_STORAGE_BUCKET || "simfoni-paud.appspot.com",
  messagingSenderId: import.meta.env.VITE_FIREBASE_MESSAGING_SENDER_ID || "1234567890",
  appId: import.meta.env.VITE_FIREBASE_APP_ID || "1:1234567890:web:abcdef",
  measurementId: import.meta.env.VITE_FIREBASE_MEASUREMENT_ID || undefined,
};

// 1. Inisialisasi Primary Firebase App (Untuk sesi aktif pengguna)
export const app = !getApps().length ? initializeApp(firebaseConfig) : getApp();
export const auth = getAuth(app);

// Offline Persistence (IndexedDB) agar draf, presensi & cache tetap tersedia saat sinyal hilang.
// Multi-tab manager: aplikasi tetap bisa dibuka di beberapa tab tanpa kehilangan persistence.
const createDb = () => {
  if (typeof window === "undefined") return getFirestore(app);
  try {
    return initializeFirestore(app, {
      localCache: persistentLocalCache({ tabManager: persistentMultipleTabManager() }),
    });
  } catch (err) {
    // Sudah diinisialisasi (HMR) atau browser tidak mendukung IndexedDB
    console.warn("Firestore offline persistence tidak aktif:", err?.message);
    return getFirestore(app);
  }
};
export const db = createDb();
export const storage = getStorage(app);

// 3. Firebase Local Emulator Suite (opsional, untuk uji lokal tanpa menyentuh data project dev)
//    Aktifkan dengan VITE_USE_FIREBASE_EMULATOR=true lalu jalankan `firebase emulators:start`.
const USE_EMULATOR = import.meta.env.VITE_USE_FIREBASE_EMULATOR === "true";
if (USE_EMULATOR) {
  const host = import.meta.env.VITE_FIREBASE_EMULATOR_HOST || "127.0.0.1";
  connectAuthEmulator(auth, `http://${host}:${import.meta.env.VITE_AUTH_EMULATOR_PORT || 9099}`, { disableWarnings: true });
  connectFirestoreEmulator(db, host, Number(import.meta.env.VITE_FIRESTORE_EMULATOR_PORT || 8080));
  connectStorageEmulator(storage, host, Number(import.meta.env.VITE_STORAGE_EMULATOR_PORT || 9199));
}

// Inisialisasi Firebase Analytics (jika didukung di browser)
export let analytics = null;
if (typeof window !== "undefined") {
  isSupported().then((supported) => {
    if (supported && firebaseConfig.measurementId && !USE_EMULATOR) {
      analytics = getAnalytics(app);
    }
  }).catch(() => {});
}

// 2. Inisialisasi Secondary Firebase App (Khusus pendaftaran user baru bertingkat tanpa me-logout sesi aktif)
const secondaryApp = getApps().find(a => a.name === "SecondaryApp") || initializeApp(firebaseConfig, "SecondaryApp");
export const secondaryAuth = getAuth(secondaryApp);
if (USE_EMULATOR) {
  const host = import.meta.env.VITE_FIREBASE_EMULATOR_HOST || "127.0.0.1";
  connectAuthEmulator(secondaryAuth, `http://${host}:${import.meta.env.VITE_AUTH_EMULATOR_PORT || 9099}`, { disableWarnings: true });
}

/**
 * Superadmin mendaftarkan akun Kepala Sekolah baru
 */
export const createKepsekAccountBySuperadmin = async (email, password, nama, schoolId, namaSekolah) => {
  const credential = await createUserWithEmailAndPassword(secondaryAuth, email, password);
  const newUid = credential.user.uid;

  try {
    await setDoc(doc(db, "users", newUid), {
      uid: newUid,
      nama: nama,
      email: email,
      role: "kepsek",
      school_id: schoolId,
      nama_sekolah: namaSekolah,
      kelompok_kelas: "Semua",
      status_akun: "aktif",
      wajib_ganti_password: true,
      created_at: serverTimestamp(),
      updated_at: serverTimestamp(),
    });
  } finally {
    // Selalu bersihkan sesi secondary, termasuk bila penulisan profil gagal
    await signOut(secondaryAuth);
  }
  return newUid;
};

/**
 * Kepala Sekolah mendaftarkan akun Guru baru.
 * Dokumen guru & counter `schools.jumlah_guru_aktif` ditulis dalam SATU batch agar
 * Security Rules dapat menegakkan batas `kuota_guru` di sisi server (getAfter).
 */
export const createGuruAccountByKepsek = async (email, password, nama, schoolId, namaSekolah, kelompokKelas) => {
  const credential = await createUserWithEmailAndPassword(secondaryAuth, email, password);
  const newUid = credential.user.uid;

  try {
    const batch = writeBatch(db);
    batch.set(doc(db, "users", newUid), {
      uid: newUid,
      nama: nama,
      email: email,
      role: "guru",
      school_id: schoolId,
      nama_sekolah: namaSekolah,
      kelompok_kelas: kelompokKelas || null,
      status_akun: "aktif",
      wajib_ganti_password: true,
      created_at: serverTimestamp(),
      updated_at: serverTimestamp(),
    });
    batch.update(doc(db, "schools", schoolId), {
      jumlah_guru_aktif: increment(1),
      counter_ref_uid: newUid,
      updated_at: serverTimestamp(),
    });
    await batch.commit();
  } catch (err) {
    // Profil ditolak (mis. kuota penuh): hapus akun Auth agar email tidak "terkunci" tanpa profil
    await deleteUser(credential.user).catch(() => {});
    throw err;
  } finally {
    await signOut(secondaryAuth);
  }
  return newUid;
};

/**
 * Update profil guru oleh Kepala Sekolah
 */
export const updateGuruByKepsek = async (uidGuru, dataUpdate) => {
  await updateDoc(doc(db, "users", uidGuru), {
    ...dataUpdate,
    updated_at: serverTimestamp(),
  });
};

/**
 * Soft delete / toggle status akun guru (aktif vs nonaktif), sekaligus menyesuaikan
 * counter `schools.jumlah_guru_aktif` dalam satu batch (divalidasi Security Rules).
 */
export const toggleStatusGuruByKepsek = async (uidGuru, statusBaru, schoolId) => {
  const batch = writeBatch(db);
  batch.update(doc(db, "users", uidGuru), {
    status_akun: statusBaru,
    updated_at: serverTimestamp(),
  });
  batch.update(doc(db, "schools", schoolId), {
    jumlah_guru_aktif: increment(statusBaru === "aktif" ? 1 : -1),
    counter_ref_uid: uidGuru,
    updated_at: serverTimestamp(),
  });
  await batch.commit();
};

/**
 * Reset status wajib ganti password guru setelah password direset ke default oleh Kepsek
 */
export const markPasswordResetByAdmin = async (targetUid) => {
  await updateDoc(doc(db, "users", targetUid), {
    wajib_ganti_password: true,
    updated_at: serverTimestamp(),
  });
};


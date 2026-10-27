import { initializeApp, getApps, getApp } from "firebase/app";
import { getAuth, createUserWithEmailAndPassword, signOut } from "firebase/auth";
import {
  getFirestore,
  doc,
  setDoc,
  updateDoc,
  serverTimestamp,
  enableIndexedDbPersistence
} from "firebase/firestore";
import { getStorage } from "firebase/storage";
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
export const db = getFirestore(app);
export const storage = getStorage(app);

// Inisialisasi Firebase Analytics (jika didukung di browser)
export let analytics = null;
if (typeof window !== "undefined") {
  isSupported().then((supported) => {
    if (supported && firebaseConfig.measurementId) {
      analytics = getAnalytics(app);
    }
  }).catch(() => {});
}

// Aktifkan Offline Persistence agar draf & cache tersimpan lokal di IndexedDB
if (typeof window !== "undefined") {
  enableIndexedDbPersistence(db).catch((err) => {
    if (err.code === "failed-precondition") {
      console.warn("Firestore offline persistence: multiple tabs open.");
    } else if (err.code === "unimplemented") {
      console.warn("Firestore offline persistence: browser not supported.");
    }
  });
}

// 2. Inisialisasi Secondary Firebase App (Khusus pendaftaran user baru bertingkat tanpa me-logout sesi aktif)
const secondaryApp = getApps().find(a => a.name === "SecondaryApp") || initializeApp(firebaseConfig, "SecondaryApp");
export const secondaryAuth = getAuth(secondaryApp);

/**
 * Superadmin mendaftarkan akun Kepala Sekolah baru
 */
export const createKepsekAccountBySuperadmin = async (email, password, nama, schoolId, namaSekolah) => {
  const credential = await createUserWithEmailAndPassword(secondaryAuth, email, password);
  const newUid = credential.user.uid;

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

  await signOut(secondaryAuth);
  return newUid;
};

/**
 * Kepala Sekolah mendaftarkan akun Guru baru
 */
export const createGuruAccountByKepsek = async (email, password, nama, schoolId, namaSekolah, kelompokKelas) => {
  const credential = await createUserWithEmailAndPassword(secondaryAuth, email, password);
  const newUid = credential.user.uid;

  await setDoc(doc(db, "users", newUid), {
    uid: newUid,
    nama: nama,
    email: email,
    role: "guru",
    school_id: schoolId,
    nama_sekolah: namaSekolah,
    kelompok_kelas: kelompokKelas || "TK A",
    status_akun: "aktif",
    wajib_ganti_password: true,
    created_at: serverTimestamp(),
    updated_at: serverTimestamp(),
  });

  await signOut(secondaryAuth);
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
 * Soft delete / toggle status akun guru (aktif vs nonaktif)
 */
export const toggleStatusGuruByKepsek = async (uidGuru, statusBaru) => {
  await updateDoc(doc(db, "users", uidGuru), {
    status_akun: statusBaru,
    updated_at: serverTimestamp(),
  });
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


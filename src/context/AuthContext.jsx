import React, { createContext, useContext, useState, useEffect, useRef, useCallback } from 'react';
import {
  onAuthStateChanged,
  signInWithEmailAndPassword,
  signOut,
  updatePassword,
  createUserWithEmailAndPassword,
  EmailAuthProvider,
  reauthenticateWithCredential,
} from 'firebase/auth';
import {
  doc,
  getDoc,
  getDocFromCache,
  onSnapshot,
  setDoc,
  updateDoc,
  serverTimestamp
} from 'firebase/firestore';
import { auth, db } from '../config/firebase';
import {
  DEFAULT_JAM_MASUK,
  DEFAULT_JAM_PULANG,
  DEFAULT_TOLERANSI_MENIT,
  DEFAULT_HARI_KERJA,
  isLanggananKedaluwarsa,
} from '../utils/schoolConfig';

const AuthContext = createContext();

export const useAuth = () => useContext(AuthContext);

const SYSTEM_CONFIG_REF = () => doc(db, 'system_settings', 'general_config');

/**
 * getDoc dengan batas waktu: pada sinyal lemah ("ada sinyal tapi internet tidak jalan"),
 * Firestore baru memakai cache setelah ~10 detik. Setelah `timeoutMs` kita pakai cache
 * IndexedDB lebih dulu agar aplikasi cepat terbuka; jika cache kosong, tetap tunggu jaringan.
 */
const getDocFast = (ref, timeoutMs = 4000) => {
  const network = getDoc(ref);
  const fallback = new Promise((resolve) => setTimeout(resolve, timeoutMs))
    .then(() => getDocFromCache(ref))
    .catch(() => network);
  return Promise.race([network, fallback]);
};

/**
 * Ambil dokumen users/{uid} beserta dokumen sekolahnya (jika peran tenant).
 */
const fetchProfile = async (uid, { networkOnly = false } = {}) => {
  // Saat login, sinyal pasti ada: selalu baca dari server agar flag seperti
  // wajib_ganti_password tidak diambil dari cache lama.
  const read = networkOnly ? getDoc : getDocFast;
  const userSnap = await read(doc(db, 'users', uid));
  if (!userSnap.exists()) return { status: 'missing' };

  const uData = userSnap.data();
  if (uData.status_akun === 'nonaktif') return { status: 'inactive', uData };

  let sData = null;
  if (uData.school_id) {
    const schoolSnap = await read(doc(db, 'schools', uData.school_id));
    if (schoolSnap.exists()) sData = { id: schoolSnap.id, ...schoolSnap.data() };
  }
  return { status: 'ok', uData, sData };
};

/**
 * Sekolah dianggap ditangguhkan jika: dinonaktifkan Superadmin, masa berlaku lewat,
 * atau dokumen sekolah sudah tidak ada. Superadmin tidak pernah ditangguhkan.
 */
const computeSuspended = (uData, sData) => {
  if (!uData || uData.role === 'superadmin' || !uData.school_id) return false;
  if (!sData) return true;
  return sData.status_langganan === 'nonaktif' || isLanggananKedaluwarsa(sData);
};

const MSG_INACTIVE = 'Akun Anda dinonaktifkan oleh Administrator Sekolah. Silakan hubungi Kepala Sekolah.';
const MSG_MISSING = 'Akun tidak terdaftar di basis data SIMFONI PAUD.';

export const AuthProvider = ({ children }) => {
  const [currentUser, setCurrentUser] = useState(null);
  const [userData, setUserData] = useState(null);
  const [schoolData, setSchoolData] = useState(null);
  const [loading, setLoading] = useState(true);
  const [isSuspended, setIsSuspended] = useState(false);
  const [needsPasswordChange, setNeedsPasswordChange] = useState(false);
  const [authError, setAuthError] = useState(null);

  // Saat seeder berjalan, dokumen users belum ada ketika onAuthStateChanged terpanggil.
  const seedingRef = useRef(false);
  // Saat login() berjalan, profil dimuat oleh login() sendiri. Listener auth tidak boleh
  // memuat ulang / memasang layar loading (dulu membuat modal wajib ganti sandi hilang-muncul).
  const loginInProgressRef = useRef(false);

  const resetState = () => {
    setUserData(null);
    setSchoolData(null);
    setIsSuspended(false);
    setNeedsPasswordChange(false);
  };

  const applyProfile = (uData, sData) => {
    setUserData(uData);
    setSchoolData(sData);
    setNeedsPasswordChange(!!uData.wajib_ganti_password);
    setIsSuspended(computeSuspended(uData, sData));
  };

  // Fungsi Login Universal (Single Stealth Entrypoint)
  const login = async (email, password) => {
    setAuthError(null);
    loginInProgressRef.current = true;
    try {
      const userCredential = await signInWithEmailAndPassword(auth, email, password);
      const profile = await fetchProfile(userCredential.user.uid, { networkOnly: true });

      if (profile.status === 'missing') {
        await signOut(auth);
        throw new Error(MSG_MISSING);
      }
      if (profile.status === 'inactive') {
        await signOut(auth);
        throw new Error(MSG_INACTIVE);
      }

      setCurrentUser(userCredential.user);
      applyProfile(profile.uData, profile.sData);
      return profile.uData;
    } finally {
      loginInProgressRef.current = false;
      setLoading(false);
    }
  };

  // Fungsi Logout
  const logout = async () => {
    resetState();
    await signOut(auth);
  };

  /**
   * Ganti Password Mandiri (wajib setelah di-reset, atau sukarela dari menu profil).
   * Firebase mensyaratkan login baru-baru ini, jadi sandi saat ini selalu diverifikasi ulang.
   */
  const changePassword = async (newPassword, currentPassword) => {
    if (!auth.currentUser) throw new Error('Tidak ada sesi pengguna aktif.');

    if (currentPassword) {
      const credential = EmailAuthProvider.credential(auth.currentUser.email, currentPassword);
      await reauthenticateWithCredential(auth.currentUser, credential);
    }
    await updatePassword(auth.currentUser, newPassword);

    // Hilangkan flag wajib_ganti_password di Firestore
    await updateDoc(doc(db, 'users', auth.currentUser.uid), {
      wajib_ganti_password: false,
      updated_at: serverTimestamp(),
    });

  };

  const finishPasswordChange = () => {
    setNeedsPasswordChange(false);
    setUserData((prev) => (prev ? { ...prev, wajib_ganti_password: false } : null));
  };

  /**
   * Sistem dianggap belum diinisialisasi jika dokumen system_settings/general_config belum ada.
   * Dokumen ini dapat dibaca publik (lihat firestore.rules) agar halaman login dapat mendeteksinya.
   */
  const checkIfInitialSetupNeeded = async () => {
    try {
      const snap = await getDoc(SYSTEM_CONFIG_REF());
      return !snap.exists();
    } catch (err) {
      console.warn('Gagal memeriksa initial setup:', err);
      return false;
    }
  };

  // Eksekusi Initial SaaS Seeder: Buat Superadmin & Sekolah Pilot TK DWP 8
  const runInitialSaaSSeeder = async ({ email, password, nama }) => {
    seedingRef.current = true;
    try {
      // 1. Buat akun auth Superadmin
      const userCredential = await createUserWithEmailAndPassword(auth, email, password);
      const superadminUid = userCredential.user.uid;

      // 2. Simpan data akun Superadmin TERLEBIH DAHULU agar Security Rules mengenali perannya.
      //    Rules hanya mengizinkan self-create superadmin selama general_config belum ada.
      const superadminUserData = {
        uid: superadminUid,
        nama: nama || 'Super Admin SIMFONI',
        email: email,
        role: 'superadmin',
        school_id: null,
        nama_sekolah: 'SIMFONI SaaS Platform',
        kelompok_kelas: null,
        status_akun: 'aktif',
        wajib_ganti_password: false,
        created_at: serverTimestamp(),
        updated_at: serverTimestamp(),
      };
      await setDoc(doc(db, 'users', superadminUid), superadminUserData);

      // 3. Buat Sekolah Pilot Pertama di koleksi 'schools'
      const pilotSchoolId = 'sch_tkdwp8';
      await setDoc(doc(db, 'schools', pilotSchoolId), {
        id: pilotSchoolId,
        nama_sekolah: 'TK Dharma Wanita Persatuan 8',
        npsn: '',
        alamat: '',
        kota: '',
        telepon: '',
        logo_url: null,
        stempel_url: null,
        nama_kepsek_resmi: '',
        nip_kepsek: '',
        paket_langganan: 'basic',
        status_langganan: 'aktif',
        kuota_guru: 5,
        jumlah_guru_aktif: 0,
        total_foto_terunggah: 0,
        estimasi_storage_mb: 0,
        berlaku_hingga: `${new Date().getFullYear() + 1}-12-31`,
        kelompok_tersedia: ['TK A', 'TK B'],
        jam_masuk: DEFAULT_JAM_MASUK,
        jam_pulang: DEFAULT_JAM_PULANG,
        toleransi_terlambat_menit: DEFAULT_TOLERANSI_MENIT,
        hari_kerja: DEFAULT_HARI_KERJA,
        created_at: serverTimestamp(),
        updated_at: serverTimestamp(),
      });

      // 4. System Settings: menandai sistem sudah diinisialisasi (menutup jalur self-create superadmin)
      await setDoc(SYSTEM_CONFIG_REF(), {
        platform_name: 'SIMFONI PAUD SaaS',
        log_retention_days: 60,
        auto_cleanup_enabled: true,
        last_cleanup_timestamp: serverTimestamp(),
        last_cleanup_deleted_count: 0,
        initialized_at: serverTimestamp(),
        updated_at: serverTimestamp(),
      });

      setCurrentUser(userCredential.user);
      applyProfile({ ...superadminUserData }, null);
      return superadminUserData;
    } finally {
      seedingRef.current = false;
    }
  };

  // Muat ulang data user & data sekolah (mis. setelah Superadmin mengubah paket)
  const reloadUserData = useCallback(async () => {
    if (!auth.currentUser) return;
    const profile = await fetchProfile(auth.currentUser.uid);
    if (profile.status === 'ok') {
      applyProfile(profile.uData, profile.sData);
    }
  }, []);

  useEffect(() => {
    const unsubscribe = onAuthStateChanged(auth, async (user) => {
      setCurrentUser(user);

      if (!user) {
        resetState();
        setLoading(false);
        return;
      }

      if (seedingRef.current || loginInProgressRef.current) return;

      setLoading(true);
      try {
        const profile = await fetchProfile(user.uid);
        if (profile.status === 'ok') {
          setAuthError(null);
          applyProfile(profile.uData, profile.sData);
        } else {
          setAuthError(profile.status === 'inactive' ? MSG_INACTIVE : MSG_MISSING);
          resetState();
          await signOut(auth);
        }
      } catch (err) {
        console.error('Error fetching user document:', err);
        setAuthError('Gagal memuat profil akun. Periksa koneksi internet lalu coba lagi.');
      } finally {
        setLoading(false);
      }
    });

    return () => unsubscribe();
  }, []);

  // Sinkron realtime dokumen user (hanya data terkonfirmasi server, bukan cache):
  // flag wajib ganti sandi selalu akurat dan akun yang dinonaktifkan langsung dikeluarkan.
  const uid = currentUser?.uid;
  useEffect(() => {
    if (!uid) return undefined;
    const unsubscribe = onSnapshot(
      doc(db, 'users', uid),
      (snap) => {
        if (snap.metadata.fromCache || !snap.exists()) return;
        const data = snap.data();
        if (data.status_akun === 'nonaktif') {
          setAuthError(MSG_INACTIVE);
          resetState();
          signOut(auth);
          return;
        }
        setNeedsPasswordChange(!!data.wajib_ganti_password);
        setUserData((prev) => (prev ? { ...prev, ...data } : prev));
      },
      (err) => console.warn('Gagal memantau profil akun:', err)
    );
    return () => unsubscribe();
  }, [uid]);

  const value = {
    currentUser,
    userData,
    schoolData,
    loading,
    isSuspended,
    needsPasswordChange,
    authError,
    clearAuthError: () => setAuthError(null),
    login,
    logout,
    changePassword,
    finishPasswordChange,
    reloadUserData,
    checkIfInitialSetupNeeded,
    runInitialSaaSSeeder,
  };

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
};

export default AuthContext;

import React, { createContext, useContext, useState, useEffect } from 'react';
import {
  onAuthStateChanged,
  signInWithEmailAndPassword,
  signOut,
  updatePassword,
  createUserWithEmailAndPassword
} from 'firebase/auth';
import {
  doc,
  getDoc,
  getDocs,
  setDoc,
  updateDoc,
  collection,
  limit,
  query,
  serverTimestamp
} from 'firebase/firestore';
import { auth, db } from '../config/firebase';

const AuthContext = createContext();

export const useAuth = () => useContext(AuthContext);

export const AuthProvider = ({ children }) => {
  const [currentUser, setCurrentUser] = useState(null);
  const [userData, setUserData] = useState(null);
  const [schoolData, setSchoolData] = useState(null);
  const [loading, setLoading] = useState(true);
  const [isSuspended, setIsSuspended] = useState(false);
  const [needsPasswordChange, setNeedsPasswordChange] = useState(false);

  // Fungsi Login Universal (Single Stealth Entrypoint)
  const login = async (email, password) => {
    const userCredential = await signInWithEmailAndPassword(auth, email, password);
    const user = userCredential.user;

    // Ambil data role & status akun dari Firestore
    const userDocRef = doc(db, 'users', user.uid);
    const userDocSnap = await getDoc(userDocRef);

    if (!userDocSnap.exists()) {
      await signOut(auth);
      throw new Error('Akun tidak terdaftar di basis data SIMFONI PAUD.');
    }

    const data = userDocSnap.data();

    if (data.status_akun === 'nonaktif') {
      await signOut(auth);
      throw new Error('Akun Anda dinonaktifkan oleh Administrator Sekolah. Silakan hubungi Kepala Sekolah.');
    }

    // Periksa status langganan sekolah untuk peran tenant (kepsek & guru)
    if (data.school_id) {
      const schoolDocRef = doc(db, 'schools', data.school_id);
      const schoolDocSnap = await getDoc(schoolDocRef);
      if (schoolDocSnap.exists()) {
        const sData = schoolDocSnap.data();
        if (sData.status_langganan === 'nonaktif') {
          setIsSuspended(true);
        }
        setSchoolData(sData);
      }
    }

    setUserData(data);
    setNeedsPasswordChange(!!data.wajib_ganti_password);
    return data;
  };

  // Fungsi Logout
  const logout = async () => {
    setUserData(null);
    setSchoolData(null);
    setIsSuspended(false);
    setNeedsPasswordChange(false);
    await signOut(auth);
  };

  // Ganti Password Mandiri (untuk user baru atau setelah di-reset oleh Kepsek/Admin)
  const changePassword = async (newPassword) => {
    if (!auth.currentUser) throw new Error('Tidak ada sesi pengguna aktif.');

    await updatePassword(auth.currentUser, newPassword);

    // Hilangkan flag wajib_ganti_password di Firestore
    const userDocRef = doc(db, 'users', auth.currentUser.uid);
    await updateDoc(userDocRef, {
      wajib_ganti_password: false,
      updated_at: serverTimestamp(),
    });

    setNeedsPasswordChange(false);
    setUserData((prev) => (prev ? { ...prev, wajib_ganti_password: false } : null));
  };

  // Periksa apakah database masih kosong sama sekali (memerlukan initial setup)
  const checkIfInitialSetupNeeded = async () => {
    try {
      const q = query(collection(db, 'users'), limit(1));
      const querySnapshot = await getDocs(q);
      return querySnapshot.empty;
    } catch (err) {
      console.warn('Gagal memeriksa initial setup:', err);
      return false;
    }
  };

  // Eksekusi Initial SaaS Seeder: Buat Superadmin & Sekolah Pilot TK DWP 8
  const runInitialSaaSSeeder = async ({ email, password, nama }) => {
    // 1. Buat akun auth Superadmin
    const userCredential = await createUserWithEmailAndPassword(auth, email, password);
    const superadminUid = userCredential.user.uid;

    // 2. Buat Sekolah Pilot Pertama di koleksi 'schools'
    const pilotSchoolId = 'sch_tkdwp8';
    const pilotSchoolRef = doc(db, 'schools', pilotSchoolId);
    const schoolInitialData = {
      id: pilotSchoolId,
      nama_sekolah: 'TK Dharma Wanita Persatuan 8',
      npsn: '20568901',
      alamat: 'Jl. Melati No. 8',
      kota: 'Surabaya',
      telepon: '031-8976543',
      logo_url: null,
      stempel_url: null,
      nama_kepsek_resmi: 'Hj. Siti Aminah, S.Pd., M.M.',
      nip_kepsek: '197508122005012003',
      paket_langganan: 'basic',
      status_langganan: 'aktif',
      kuota_guru: 5,
      total_foto_terunggah: 0,
      estimasi_storage_mb: 0,
      berlaku_hingga: '2028-12-31',
      kelompok_tersedia: ['TK A', 'TK B'],
      created_at: serverTimestamp(),
      updated_at: serverTimestamp(),
    };
    await setDoc(pilotSchoolRef, schoolInitialData);

    // 3. Simpan data akun Superadmin di koleksi 'users'
    const superadminDocRef = doc(db, 'users', superadminUid);
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
    await setDoc(superadminDocRef, superadminUserData);

    // 4. Inisialisasi System Settings untuk Log Retention & Cleanup
    const systemSettingsRef = doc(db, 'system_settings', 'general_config');
    await setDoc(systemSettingsRef, {
      platform_name: 'SIMFONI PAUD SaaS',
      log_retention_days: 60,
      auto_cleanup_enabled: true,
      last_cleanup_timestamp: serverTimestamp(),
      last_cleanup_deleted_count: 0,
      updated_at: serverTimestamp(),
    });

    setUserData(superadminUserData);
    setCurrentUser(userCredential.user);
    return superadminUserData;
  };

  // Muat ulang data user & data sekolah
  const reloadUserData = async () => {
    if (!auth.currentUser) return;
    const userDocRef = doc(db, 'users', auth.currentUser.uid);
    const userDocSnap = await getDoc(userDocRef);
    if (userDocSnap.exists()) {
      const uData = userDocSnap.data();
      setUserData(uData);
      setNeedsPasswordChange(!!uData.wajib_ganti_password);

      if (uData.school_id) {
        const schoolDocRef = doc(db, 'schools', uData.school_id);
        const schoolDocSnap = await getDoc(schoolDocRef);
        if (schoolDocSnap.exists()) {
          const sData = schoolDocSnap.data();
          setSchoolData(sData);
          setIsSuspended(sData.status_langganan === 'nonaktif');
        }
      }
    }
  };

  useEffect(() => {
    const unsubscribe = onAuthStateChanged(auth, async (user) => {
      setCurrentUser(user);
      if (user) {
        try {
          const userDocRef = doc(db, 'users', user.uid);
          const userDocSnap = await getDoc(userDocRef);
          if (userDocSnap.exists()) {
            const uData = userDocSnap.data();
            if (uData.status_akun === 'nonaktif') {
              await signOut(auth);
              setUserData(null);
              setSchoolData(null);
            } else {
              setUserData(uData);
              setNeedsPasswordChange(!!uData.wajib_ganti_password);

              if (uData.school_id) {
                const schoolDocRef = doc(db, 'schools', uData.school_id);
                const schoolDocSnap = await getDoc(schoolDocRef);
                if (schoolDocSnap.exists()) {
                  const sData = schoolDocSnap.data();
                  setSchoolData(sData);
                  setIsSuspended(sData.status_langganan === 'nonaktif');
                }
              }
            }
          }
        } catch (err) {
          console.error('Error fetching user document:', err);
        }
      } else {
        setUserData(null);
        setSchoolData(null);
        setIsSuspended(false);
        setNeedsPasswordChange(false);
      }
      setLoading(false);
    });

    return () => unsubscribe();
  }, []);

  const value = {
    currentUser,
    userData,
    schoolData,
    loading,
    isSuspended,
    needsPasswordChange,
    login,
    logout,
    changePassword,
    reloadUserData,
    checkIfInitialSetupNeeded,
    runInitialSaaSSeeder,
  };

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
};

export default AuthContext;


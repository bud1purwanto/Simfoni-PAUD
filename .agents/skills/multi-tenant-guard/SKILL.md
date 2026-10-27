---
name: multi-tenant-guard
description: >-
  Prosedur verifikasi dan implementasi isolasi data multi-tenant (school_id),
  pendaftaran bertingkat via secondaryAuth tanpa memutus sesi, dan penegakan batasan kuota guru di SIMFONI PAUD.
  Gunakan skill ini saat membuat atau memodifikasi kueri Firestore, mutasi user, atau pengecekan hak akses RBAC.
---

# Multi-Tenant Guard & Security Procedures (SIMFONI PAUD)

Gunakan panduan ini untuk menjamin isolasi data mutlak antar sekolah mitra (*tenants*) dan menjaga keamanan sesi pada sistem multi-tier SaaS.

## 1. Aturan Baku Kueri Firestore (Isolasi Tenant)

Setiap kueri dari peran `kepsek` dan `guru` **WAJIB** menyertakan klausul `where("school_id", "==", currentUser.school_id)`:

```javascript
import { collection, query, where } from 'firebase/firestore';
import { db } from '../../config/firebase';

// CONTOH BENAR:
const q = query(
  collection(db, 'attendance'),
  where('school_id', '==', currentUser.school_id),
  where('tanggal', '==', todayStr)
);
```

> [!CAUTION]
> Dilarang keras melakukan kueri langsung `collection(db, '...')` tanpa `school_id` untuk data operasional, karena Firestore Security Rules akan otomatis memblokir *request* tersebut dan memicu error `permission-denied`.

## 2. Pendaftaran Pengguna Bertingkat via `secondaryAuth`

Untuk mencegah sesi aktif (Superadmin atau Kepsek) ter-logout saat mendaftarkan akun baru:

1. Import `secondaryAuth` dari `src/config/firebase.js`:
   ```javascript
   import { secondaryAuth } from '../config/firebase';
   import { createUserWithEmailAndPassword, signOut } from 'firebase/auth';
   ```
2. Buat akun baru pada *secondary instance*:
   ```javascript
   const userCredential = await createUserWithEmailAndPassword(secondaryAuth, email, defaultPassword);
   const newUid = userCredential.user.uid;
   await signOut(secondaryAuth); // Langsung logout instance kedua
   ```
3. Simpan profil lengkap user ke koleksi `users` di instance utama (`db`):
   ```javascript
   await setDoc(doc(db, 'users', newUid), {
     school_id: targetSchoolId,
     nama_lengkap: nama,
     email: email,
     role: 'guru', // atau 'kepsek'
     status_aktif: true,
     wajib_ganti_password: true,
     created_at: serverTimestamp()
   });
   ```

## 3. Validasi Batas Kuota Guru

Sebelum Kepala Sekolah menambahkan guru baru, periksa jumlah guru aktif di sekolah tersebut:

```javascript
const teachersQuery = query(
  collection(db, 'users'),
  where('school_id', '==', currentUser.school_id),
  where('role', '==', 'guru'),
  where('status_aktif', '==', true)
);
const teachersSnap = await getDocs(teachersQuery);
const activeTeachersCount = teachersSnap.size;

if (activeTeachersCount >= (schoolData.kuota_guru || 5)) {
  throw new Error(`Batas kuota guru telah tercapai (${activeTeachersCount}/${schoolData.kuota_guru}). Hubungi Superadmin untuk menambah kuota.`);
}
```

## 4. Pencatatan Jejak Audit (`audit_logs`)

Setiap tindakan kritis (tambah/edit/hapus user, verifikasi koreksi presensi, persetujuan jurnal, perubahan kuota) wajib memanggil helper audit log:

```javascript
import { logActivity } from '../../utils/auditLogger';

await logActivity({
  schoolId: currentUser.school_id,
  actorId: currentUser.uid,
  actorNama: currentUser.nama_lengkap,
  action: 'ADD_GURU', // format SNAKE_CASE
  recordType: 'users',
  recordId: newUid,
});
```


# 🔒 Aturan Keamanan & Hak Akses (RBAC)

Dokumen ini memuat matriks hak akses (*Role-Based Access Control*), implementasi resmi berkas `firestore.rules` dan `storage.rules`, serta kebijakan perlindungan privasi data anak di **SIMFONI PAUD**.

---

## 1. Peran Pengguna (User Roles)

Sistem membedakan dua peran pengguna dengan batasan ketat:

1. **Kepala Sekolah (`role: "kepsek"` - Administrator):**
   * Mengelola akun guru (Tambah baru, Ubah data, Nonaktifkan akun/soft delete).
   * Memantau presensi, jurnal, dokumentasi, dan laporan seluruh guru.
   * Melakukan review laporan (Menyetujui atau mengembalikan dengan catatan perbaikan).
   * Menyetujui atau menolak permohonan koreksi presensi guru.
   * Mengatur jadwal mengajar mingguan dan mengekspor rekapitulasi sekolah ke format PDF.
   * Mengakses rekaman log audit keamanan.

2. **Guru (`role: "guru"` - Pengguna Operasional):**
   * Melakukan presensi mandiri (Datang & Pulang) serta mengajukan koreksi presensi jika ada kendala.
   * Menyusun, menyimpan draf, dan mengirimkan jurnal mengajar harian kelas masing-masing.
   * Mengunggah foto dokumentasi pembelajaran anak dengan kontrol izin privasi.
   * Mengirimkan laporan kegiatan tambahan, pemenuhan administrasi guru, dan laporan kendala kelas.
   * Memperbaiki jurnal miliknya jika berstatus `perlu_revisi` dari Kepala Sekolah.
   * Dilarang mengakses laporan guru lain atau mengubah jadwal dan akun.

---

## 2. Matriks Hak Akses (RBAC Matrix)

| Fitur / Aksi | Guru (`guru`) | Kepala Sekolah (`kepsek`) | Penegakan di Database |
| :--- | :---: | :---: | :--- |
| **Melihat & Edit Profil Pribadi** | Ya | Ya | Diizinkan via `isOwner(uid)` (dilarang ubah role/status) |
| **Mencatat Presensi Pribadi** | Ya | Ya | `isOwner(userId)` |
| **Mengajukan Koreksi Presensi** | Ya | Memeriksa & Memutuskan | Guru ajukan field `koreksi`, Kepsek validasi |
| **Menulis Jurnal & Upload Dokumentasi** | Ya | Melihat Seluruh Data | Guru buat data miliknya; Kepsek akses global |
| **Menghapus Jurnal** | Hanya saat status `draf` | Tidak disarankan | Rules: `status == 'draf' && isOwner` |
| **Melihat Laporan / Jurnal Guru Lain** | ❌ **Dilarang** | ✅ **Ya** | `resource.data.user_id == auth.uid \|\| isKepsek()` |
| **Validasi & Beri Catatan Revisi Jurnal** | ❌ **Dilarang** | ✅ **Ya** | `isKepsek()` |
| **Export / Unduh PDF Rekap Sekolah** | ❌ **Dilarang** | ✅ **Ya** | Tampilan dibatasi & query dicek role Kepsek |
| **CRUD Akun Guru (Add/Edit/Nonaktifkan)** | ❌ **Dilarang** | ✅ **Ya** | Secondary Auth + `isKepsek()` di Firestore Rules |
| **Mengatur Jadwal Mengajar Sekolah** | ❌ **Dilarang (Read-only)** | ✅ **Ya (Write)** | Rules: `allow write: if isKepsek()` |
| **Melihat Audit Trail (`audit_logs`)** | ❌ **Dilarang** | ✅ **Ya** | Rules: `allow read: if isKepsek()` |

---

## 3. Implementasi `firestore.rules`

Letakkan kode ini pada berkas `firestore.rules` di root proyek:

```javascript
rules_version = '2';
service cloud.firestore {
  match /databases/{database}/documents {
    
    // --- FUNGSI HELPER KEAMANAN ---
    function isSignedIn() {
      return request.auth != null;
    }
    
    function getUserData() {
      return get(/databases/$(database)/documents/users/$(request.auth.uid)).data;
    }
    
    function isActive() {
      return isSignedIn() && getUserData().status_akun == 'aktif';
    }
    
    function isKepsek() {
      return isActive() && getUserData().role == 'kepsek';
    }
    
    function isOwner(userId) {
      return isActive() && request.auth.uid == userId;
    }

    // --- ATURAN KOLEKSI USERS ---
    match /users/{userId} {
      allow read: if isSignedIn();
      // Izinkan registrasi admin pertama (initial setup) ATAU dibuat oleh Kepsek aktif
      allow create: if isSignedIn() && (request.auth.uid == userId || isKepsek());
      // Pemilik profil boleh update profil kecuali mengganti role dan status_akun
      allow update: if isKepsek() || (isOwner(userId) && !request.resource.data.diff(resource.data).affectedKeys().hasAny(['role', 'status_akun']));
      allow delete: if isKepsek();
    }

    // --- ATURAN KOLEKSI ATTENDANCE ---
    match /attendance/{docId} {
      allow read: if isKepsek() || (isActive() && resource.data.user_id == request.auth.uid);
      allow create: if isActive() && request.resource.data.user_id == request.auth.uid;
      allow update: if isKepsek() || (isActive() && resource.data.user_id == request.auth.uid);
      allow delete: if false; // Presensi tidak boleh dihapus secara permanen
    }

    // --- ATURAN KOLEKSI JOURNALS ---
    match /journals/{journalId} {
      allow read: if isKepsek() || (isActive() && resource.data.user_id == request.auth.uid);
      allow create: if isActive() && request.resource.data.user_id == request.auth.uid;
      allow update: if isKepsek() || (isActive() && resource.data.user_id == request.auth.uid);
      allow delete: if isActive() && resource.data.user_id == request.auth.uid && resource.data.status == 'draf';
    }

    // --- ATURAN KOLEKSI SCHEDULES ---
    match /schedules/{scheduleId} {
      allow read: if isActive();
      allow write: if isKepsek();
    }

    // --- ATURAN KOLEKSI TASKS & ISSUES ---
    match /tasks_and_issues/{itemId} {
      allow read: if isKepsek() || (isActive() && resource.data.user_id == request.auth.uid);
      allow create: if isActive() && request.resource.data.user_id == request.auth.uid;
      allow update: if isKepsek() || (isActive() && resource.data.user_id == request.auth.uid);
      allow delete: if isKepsek();
    }

    // --- ATURAN KOLEKSI AUDIT LOGS ---
    match /audit_logs/{logId} {
      allow read: if isKepsek();
      allow create: if isActive();
      allow update, delete: if false; // Audit logs bersifat immutable
    }
  }
}
```

---

## 4. Implementasi `storage.rules`

Letakkan kode ini pada berkas `storage.rules` di root proyek:

```javascript
rules_version = '2';
service firebase.storage {
  match /b/{bucket}/o {
    
    // Folder foto jurnal: journals/{userId}/{fileName}
    match /journals/{userId}/{allPaths=**} {
      allow read: if request.auth != null;
      allow write: if request.auth != null 
                   && request.auth.uid == userId
                   && request.resource.size < 2 * 1024 * 1024 // Maks 2MB
                   && request.resource.contentType.matches('image/.*');
    }
    
    // Folder berkas pendukung tugas/kendala: tasks/{userId}/{fileName}
    match /tasks/{userId}/{allPaths=**} {
      allow read: if request.auth != null;
      allow write: if request.auth != null 
                   && request.auth.uid == userId
                   && request.resource.size < 2 * 1024 * 1024;
    }
  }
}
```

---

## 5. Kebijakan Privasi Data & Perlindungan Foto Anak PAUD

TK Dharma Wanita Persatuan 8 mewajibkan perlindungan privasi anak didik secara ketat:

1. **Persetujuan Unggah (Consent Checkbox):**  
   Setiap kali guru memilih foto dokumentasi yang menampakkan wajah anak didik, formulir jurnal mewajibkan konfirmasi bahwa guru telah memverifikasi foto layak diunggah untuk arsip sekolah.
2. **Kategori Izin Publikasi:**  
   Setiap item foto memiliki label:
   * `internal`: Foto hanya untuk arsip sekolah dan evaluasi internal Kepala Sekolah / Pengawas. Dilarang dibagikan ke media sosial.
   * `publik`: Foto yang disetujui orang tua murid untuk keperluan publikasi resmi/akreditasi sekolah.
3. **Pemberian Tanda Air & Anonimisasi:**  
   Dokumen rekap PDF yang memuat foto internal tidak menyertakan identitas sensitif murid yang melanggar perlindungan data pribadi anak.


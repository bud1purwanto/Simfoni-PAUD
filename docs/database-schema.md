# 🗄️ Skema Database: Cloud Firestore (Multi-Tenant SaaS)

Dokumen ini mendefinisikan seluruh struktur koleksi, model dokumen, relasi, strategi Document ID, dan indeks pada database **Cloud Firestore** berbasis Multi-Tenant untuk **SIMFONI PAUD**.

---

## 1. Ikhtisar Koleksi Multi-Tenant

Sistem menggunakan 7 koleksi di mana seluruh dokumen operasional diisolasi menggunakan atribut **`school_id`**:

| Koleksi | Penamaan Doc ID | Deskripsi Utama |
| :--- | :--- | :--- |
| `schools` | Auto-generated ID (`sch_xxxx`) | **[Baru]** Profil sekolah mitra/tenant, kuota guru, paket, dan status langganan. |
| `users` | `{uid}` (Firebase Auth) | Profil pengguna (Superadmin, Kepala Sekolah, Guru) beserta `school_id`. |
| `attendance` | `{school_id}_{YYYY-MM-DD}_{uid}` | Presensi harian guru terisolasi per sekolah. Format ID mencegah duplikasi presensi. |
| `journals` | Auto-generated ID | Jurnal mengajar KBM harian, tagging Kurikulum Merdeka, dan dokumentasi foto. |
| `schedules` | Auto-generated ID | Jadwal KBM mingguan kelas TK A, TK B, atau kelompok bermain per sekolah. |
| `tasks_and_issues`| Auto-generated ID | Laporan kegiatan kedinasan, administrasi guru, dan pelaporan kendala sarpras. |
| `audit_logs` | Auto-generated ID | Rekam jejak audit operasional sistem berlabel `school_id`. |

---

## 2. Definisi Koleksi & Model Data

### 2.1. Koleksi `schools` (Mitra Sekolah / Tenant)
Menyimpan informasi tenant, kuota paket, dan data kop surat resmi.

* **Document ID:** Auto-generated ID (contoh: `sch_dwp8_sby`, `sch_tk_alazhar`)
* **Pengelola:** Dibuat dan dikelola oleh `superadmin`; dibaca oleh `kepsek` dan `guru` di sekolah bersangkutan.

```json
{
  "id": "string (school_id)",
  "nama_sekolah": "string (Contoh: TK Dharma Wanita Persatuan 8)",
  "npsn": "string (Nomor Pokok Sekolah Nasional)",
  "alamat": "string (Alamat lengkap sekolah)",
  "kota": "string (Kabupaten/Kota)",
  "telepon": "string (Nomor kontak resmi)",
  "logo_url": "string | null (URL logo di Cloud Storage)",
  "nama_kepsek_resmi": "string (Nama lengkap Kepsek untuk tanda tangan PDF)",
  "nip_kepsek": "string | null (NIP/NUPTK jika ada)",
  "paket_langganan": "trial | basic | pro",
  "status_langganan": "aktif | masa_tenggang | nonaktif",
  "kuota_guru": "number (Batas maksimum akun guru, misal: 5 atau 20)",
  "total_foto_terunggah": "number (Counter agregat jumlah foto untuk estimasi kuota)",
  "estimasi_storage_mb": "number (Estimasi akumulasi storage dalam MB)",
  "berlaku_hingga": "string (Format: YYYY-MM-DD)",
  "kelompok_tersedia": [
    "TK A",
    "TK B",
    "Kelompok Bermain"
  ],
  "created_at": "Timestamp (ServerTimestamp)",
  "updated_at": "Timestamp (ServerTimestamp)"
}
```

---

### 2.2. Koleksi `users`
Menyimpan profil seluruh pengguna di dalam platform.

* **Document ID:** `{uid}` (Firebase Authentication UID)
* **Aturan Soft Delete:** Pengguna dinonaktifkan dengan mengubah `status_akun` menjadi `"nonaktif"`, jangan pernah dihapus fisik (*hard delete*).

```json
{
  "uid": "string (Firebase Auth UID)",
  "nama": "string (Nama lengkap)",
  "email": "string (Email login)",
  "role": "superadmin | kepsek | guru",
  "school_id": "string | null (null HANYA untuk superadmin)",
  "nama_sekolah": "string | null",
  "kelompok_kelas": "string | null (Contoh: 'TK A', 'TK B', atau 'Semua')",
  "status_akun": "aktif | nonaktif",
  "wajib_ganti_password": "boolean (true jika baru direset oleh Kepsek/Admin, default: false)",
  "created_at": "Timestamp (ServerTimestamp)",
  "updated_at": "Timestamp (ServerTimestamp)"
}
```

---

### 2.3. Koleksi `attendance` (Presensi Guru)
Mencatat jam datang, pulang, izin, sakit, dan permohonan koreksi presensi.

* **Document ID:** `{school_id}_{YYYY-MM-DD}_{uid}`  
  *Contoh:* `sch_dwp8_2026-10-27_u9A3kF1...`  
  *Alasan Penamaan:* Format gabungan menjamin keunikan 1 record presensi per guru per hari di sekolah terkait.

```json
{
  "id": "string ({school_id}_{YYYY-MM-DD}_{uid})",
  "school_id": "string (ID sekolah tempat guru bertugas)",
  "user_id": "string (UID guru)",
  "nama_guru": "string",
  "tanggal": "string (YYYY-MM-DD)",
  "jam_datang_server": "Timestamp | null (ServerTimestamp)",
  "jam_datang_device": "string (HH:mm:ss) | null (Waktu lokal HP guru saat tombol ditekan, aman dari delay offline sync)",
  "jam_pulang_server": "Timestamp | null (ServerTimestamp)",
  "jam_pulang_device": "string (HH:mm:ss) | null",
  "status": "hadir | terlambat | izin | sakit",
  "status_pulang": "selesai | belum_absen | lupa_absen (Otomatis ditandai 'lupa_absen' jika >18:00 belum checkout)",
  "catatan": "string (Alasan izin, sakit, atau keterlambatan)",
  "lokasi": {
    "lat": "number | null",
    "lng": "number | null"
  },
  "koreksi": {
    "diajukan": "boolean (Default: false)",
    "jam_datang_ajuan": "string (HH:mm) | null",
    "jam_pulang_ajuan": "string (HH:mm) | null",
    "alasan": "string",
    "status_koreksi": "menunggu | disetujui | ditolak",
    "catatan_kepsek": "string"
  },
  "created_at": "Timestamp",
  "updated_at": "Timestamp"
}
```

---

### 2.4. Koleksi `journals` (Jurnal Mengajar & Dokumentasi Foto)
Mencatat aktivitas pembelajaran KBM harian kelas dan kurikulum.

* **Document ID:** Auto-generated ID Firestore
* **Status Siklus:** `draf` -> `dikirim` -> `perlu_revisi` -> `disetujui`

```json
{
  "school_id": "string (ID sekolah)",
  "user_id": "string (UID guru)",
  "nama_guru": "string",
  "tanggal": "string (YYYY-MM-DD)",
  "kelompok": "string (TK A | TK B | dll)",
  "topik": "string (Tema / Topik KBM)",
  "capaian_pembelajaran": [
    "Nilai Agama & Budi Pekerti",
    "Jati Diri",
    "Dasar-dasar Literasi & STEAM"
  ],
  "tujuan": "string",
  "kegiatan_pembuka": "string",
  "kegiatan_inti": "string",
  "kegiatan_penutup": "string",
  "refleksi": "string",
  "kendala": "string",
  "fotos": [
    {
      "url": "string (Download URL Firebase Storage)",
      "storage_path": "string (schools/{schoolId}/journals/{userId}/{filename})",
      "caption": "string",
      "izin_publikasi": "internal | publik"
    }
  ],
  "status": "draf | dikirim | perlu_revisi | disetujui",
  "review_note": "string (Catatan revisi dari Kepala Sekolah)",
  "reviewed_at": "Timestamp | null",
  "created_at": "Timestamp",
  "updated_at": "Timestamp"
}
```

---

### 2.5. Koleksi `schedules` (Jadwal Mengajar)
Jadwal kegiatan mingguan per sekolah.

* **Document ID:** Auto-generated ID Firestore

```json
{
  "school_id": "string (ID sekolah)",
  "hari": "Senin | Selasa | Rabu | Kamis | Jumat | Sabtu",
  "jam_mulai": "string (HH:mm)",
  "jam_selesai": "string (HH:mm)",
  "kelompok": "string (TK A | TK B | Semua)",
  "kegiatan": "string",
  "pic_guru_id": "string (UID guru spesifik atau 'all')",
  "pic_nama": "string"
}
```

---

### 2.6. Koleksi `tasks_and_issues` (Tugas Tambahan, Administrasi & Kendala)
Pelaporan kegiatan non-KBM dan sarana prasarana sekolah.

* **Document ID:** Auto-generated ID Firestore

```json
{
  "school_id": "string (ID sekolah)",
  "user_id": "string (UID guru)",
  "nama_guru": "string",
  "tanggal": "string (YYYY-MM-DD)",
  "kategori": "laporan_kegiatan | administrasi_guru | laporan_kendala",
  "judul": "string",
  "deskripsi": "string",
  "hasil_atau_tindak_lanjut": "string",
  "foto_pendukung_url": "string | null",
  "status": "dilaporkan | diproses | selesai",
  "tanggapan_kepsek": "string",
  "created_at": "Timestamp"
}
```

---

### 2.7. Koleksi `audit_logs` (Jejak Rekam Keamanan)
Mencatat aksi kritis per sekolah.

* **Document ID:** Auto-generated ID Firestore
* **Karakteristik:** *Immutable* (Hanya bisa dibuat, tidak bisa diedit atau dihapus).

```json
{
  "school_id": "string | null (null jika aksi global oleh superadmin)",
  "actor_id": "string (UID pelaksana)",
  "actor_nama": "string",
  "action": "ADD_SCHOOL | SUSPEND_SCHOOL | ADD_KEPSEK | ADD_GURU | EDIT_GURU | TOGGLE_STATUS_GURU | APPROVE_JOURNAL | REVISION_JOURNAL | APPROVE_CORRECTION",
  "record_type": "schools | users | attendance | journals | tasks_and_issues",
  "record_id": "string",
  "timestamp": "Timestamp"
}
```

---

## 3. Aturan Kueri & Indeks Majemuk (Composite Indexes)

> [!IMPORTANT]
> Setiap kueri data dari antarmuka `kepsek` dan `guru` **WAJIB** menyertakan filter isolasi tenant:
> ```javascript
> where("school_id", "==", currentUser.school_id)
> ```

### Konfigurasi Indeks Majemuk yang Diperlukan:
1. **Jurnal per Sekolah & Status:**  
   Koleksi: `journals` -> Fields: `school_id` (Asc) + `status` (Asc) + `tanggal` (Desc)
2. **Jurnal per Guru:**  
   Koleksi: `journals` -> Fields: `school_id` (Asc) + `user_id` (Asc) + `tanggal` (Desc)
3. **Presensi Harian per Sekolah:**  
   Koleksi: `attendance` -> Fields: `school_id` (Asc) + `tanggal` (Asc) + `status` (Asc)
4. **Tugas & Kendala per Kategori:**  
   Koleksi: `tasks_and_issues` -> Fields: `school_id` (Asc) + `kategori` (Asc) + `tanggal` (Desc)
5. **Daftar Guru per Sekolah (Pengecekan Kuota):**  
   Koleksi: `users` -> Fields: `school_id` (Asc) + `role` (Asc) + `status_akun` (Asc)

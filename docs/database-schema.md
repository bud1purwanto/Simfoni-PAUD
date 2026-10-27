# 🗄️ Skema Database: Cloud Firestore (Multi-Tenant SaaS)

Dokumen ini mendefinisikan seluruh struktur koleksi, model dokumen, relasi, strategi Document ID, dan indeks pada database **Cloud Firestore** berbasis Multi-Tenant untuk **SIMFONI PAUD**.

---

## 1. Ikhtisar Koleksi Multi-Tenant

Sistem menggunakan 8 koleksi di mana seluruh dokumen operasional diisolasi menggunakan atribut **`school_id`**:

| Koleksi | Penamaan Doc ID | Deskripsi Utama |
| :--- | :--- | :--- |
| `schools` | Auto-generated ID (`sch_xxxx`) | **[Baru]** Profil sekolah mitra/tenant, kuota guru, paket, dan status langganan. |
| `users` | `{uid}` (Firebase Auth) | Profil pengguna (Superadmin, Kepala Sekolah, Guru) beserta `school_id`. |
| `attendance` | `{school_id}_{YYYY-MM-DD}_{uid}` | Presensi harian guru terisolasi per sekolah. Format ID mencegah duplikasi presensi. |
| `journals` | Auto-generated ID | Jurnal mengajar KBM harian, tagging Kurikulum Merdeka, dan dokumentasi foto. |
| `schedules` | Auto-generated ID | Jadwal KBM mingguan kelas TK A, TK B, atau kelompok bermain per sekolah. |
| `tasks_and_issues`| Auto-generated ID | Laporan kegiatan kedinasan, administrasi guru, dan pelaporan kendala sarpras. |
| `audit_logs` | Auto-generated ID | Rekam jejak audit operasional sistem (dapat dibersihkan berkala oleh Superadmin). |
| `system_settings` | `general_config` | **[Baru]** Konfigurasi global platform SaaS, durasi retensi log, & jadwal auto-cleanup. |

---

## 2. Definisi Koleksi & Model Data

### 2.1. Koleksi `schools` (Mitra Sekolah / Tenant)
Menyimpan informasi tenant, kuota paket, dan data kop surat resmi.

* **Document ID:** Auto-generated ID (contoh: `sch_dwp8_sby`, `sch_tk_alazhar`)
* **Pengelola:** Dibuat dan dikelola oleh `superadmin`; dibaca oleh `kepsek` dan `guru` di sekolah bersangkutan.
* **Hak ubah terbatas:** `kepsek` hanya boleh mengubah `jam_masuk`, `jam_pulang`, `toleransi_terlambat_menit`, `hari_kerja`. Seluruh anggota sekolah hanya boleh menaikkan counter `total_foto_terunggah` (+1) dan `estimasi_storage_mb` saat mengunggah foto.
* **Relasi:** Sekolah yang masih memiliki dokumen `users` tidak dapat dihapus (gunakan suspend).
* **Counter kuota:** `jumlah_guru_aktif` disinkronkan otomatis oleh Superadmin (Dashboard / Kelola Sekolah) dengan jumlah guru aktif sebenarnya; wajib ada sebelum Kepsek dapat menambah guru.
* **Kelompok kelas:** Nilai `kelompok_tersedia` menjadi sumber tunggal opsi kelompok di form guru, jadwal, dan jurnal. Nilai khusus `"Semua"` menandai guru pendamping / kegiatan bersama.

```json
{
  "id": "string (school_id)",
  "nama_sekolah": "string (Contoh: TK Dharma Wanita Persatuan 8)",
  "npsn": "string (Nomor Pokok Sekolah Nasional)",
  "alamat": "string (Alamat lengkap sekolah)",
  "kota": "string (Kabupaten/Kota)",
  "telepon": "string (Nomor kontak resmi)",
  "logo_url": "string | null (URL logo di Cloud Storage)",
  "stempel_url": "string | null (URL cap/stempel resmi sekolah PNG transparan untuk PDF)",
  "nama_kepsek_resmi": "string (Nama lengkap Kepsek untuk tanda tangan PDF)",
  "nip_kepsek": "string | null (NIP/NUPTK jika ada)",
  "paket_langganan": "trial | basic | pro",
  "status_langganan": "aktif | masa_tenggang | nonaktif",
  "kuota_guru": "number (Batas maksimum akun guru, misal: 5 atau 20)",
  "jumlah_guru_aktif": "number (Counter guru aktif; diubah ±1 dalam batch yang sama dengan perubahan akun guru, ditegakkan rules)",
  "counter_ref_uid": "string (UID guru yang memicu perubahan counter terakhir; dipakai rules untuk verifikasi)",
  "total_foto_terunggah": "number (Counter agregat jumlah foto untuk estimasi kuota)",
  "estimasi_storage_mb": "number (Estimasi akumulasi storage dalam MB)",
  "berlaku_hingga": "string (Format: YYYY-MM-DD)",
  "kelompok_tersedia": [
    "TK A",
    "TK B",
    "Kelompok Bermain"
  ],
  "jam_masuk": "string HH:mm (Default '07:30') - dasar status terlambat",
  "jam_pulang": "string HH:mm (Default '11:30')",
  "toleransi_terlambat_menit": "number (Default 15) - terlambat jika jam HP > jam_masuk + toleransi",
  "hari_kerja": "5 | 6 (Senin–Jumat / Senin–Sabtu) - dasar hari kerja efektif rekap",
  "created_at": "Timestamp (ServerTimestamp)",
  "updated_at": "Timestamp (ServerTimestamp)"
}
```

---

### 2.2. Koleksi `users`
Menyimpan profil seluruh pengguna di dalam platform.

* **Document ID:** `{uid}` (Firebase Authentication UID)
* **Aturan Soft Delete:** Pengguna dinonaktifkan dengan mengubah `status_akun` menjadi `"nonaktif"`, jangan pernah dihapus fisik (*hard delete*).
* **Bootstrap:** Dokumen superadmin pertama hanya dapat dibuat sendiri selama `system_settings/general_config` belum ada (wizard seeder).

```json
{
  "uid": "string (Firebase Auth UID)",
  "nama": "string (Nama lengkap)",
  "email": "string (Email login)",
  "role": "superadmin | kepsek | guru",
  "school_id": "string | null (null HANYA untuk superadmin)",
  "nama_sekolah": "string | null",
  "kelompok_kelas": "string | null (salah satu kelompok_tersedia sekolah, atau 'Semua')",
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
  *Alasan Penamaan:* Format gabungan menjamin keunikan 1 record presensi per guru per hari di sekolah terkait. Format ini **divalidasi Security Rules** saat create.
* **Tanggal:** `tanggal` WAJIB tanggal lokal perangkat (`getLocalDateString()`), bukan `toISOString()` (UTC), agar absen sebelum 07:00 WIB tidak tercatat di hari sebelumnya.
* **Izin / Sakit:** Diajukan guru sendiri (status `izin`/`sakit`, jam null) untuk tanggal maks. 7 hari ke belakang s.d. 30 hari ke depan.
* **Koreksi disetujui:** Kepsek menimpa `jam_*_device` dengan jam ajuan lalu menghitung ulang `status` & `menit_terlambat`.

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
  "menit_terlambat": "number (Dihitung dari jam_datang_device vs jam_masuk + toleransi sekolah)",
  "status_pulang": "selesai | belum_absen | lupa_absen (Ditandai 'lupa_absen' otomatis untuk hari lalu yang hadir tanpa checkout)",
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
* **Status Siklus:** `draf` -> `dikirim` -> (`perlu_revisi` -> `dikirim`) -> `disetujui`
  * Guru hanya dapat menulis status `draf`/`dikirim`; jurnal `disetujui` terkunci (read-only).
  * Hanya `draf` yang dapat dihapus pemiliknya. Draf tidak tampil di antrean validasi & rekap Kepsek.
  * Maksimal 6 foto per jurnal; Portofolio PDF hanya memuat jurnal `disetujui` (maks. 2 foto per kegiatan).

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
  "reviewed_by": "string | null (UID Kepsek yang memvalidasi)",
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
  "kelompok": "string (salah satu kelompok_tersedia sekolah | 'Semua')",
  "kegiatan": "string",
  "keterangan": "string (Perlengkapan / catatan, opsional)",
  "pic_guru_id": "string (UID guru spesifik atau 'all')",
  "pic_nama": "string ('Semua Guru' bila pic_guru_id == 'all')",
  "created_at": "Timestamp",
  "updated_at": "Timestamp"
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
  "ditanggapi_at": "Timestamp | null (Diisi saat Kepsek menanggapi di tab Tugas & Kendala)",
  "created_at": "Timestamp",
  "updated_at": "Timestamp"
}
```

---

### 2.7. Koleksi `audit_logs` (Jejak Rekam Keamanan)
Mencatat aksi kritis per sekolah.

* **Document ID:** Auto-generated ID Firestore
* **Karakteristik & Kebijakan:** Data riwayat bersifat *read-only* bagi pengguna umum, namun **Superadmin memiliki hak pembersihan berkala (*log retention purge*)** baik secara manual maupun otomatis berdasarkan rentang waktu untuk menghemat kuota Firestore.

```json
{
  "school_id": "string | null (null jika aksi global oleh superadmin)",
  "actor_id": "string (UID pelaksana)",
  "actor_nama": "string",
  "action": "UPPER_SNAKE_CASE, mis. ADD_SCHOOL | UPDATE_SCHOOL | SUSPEND_SCHOOL | ACTIVATE_SCHOOL | DELETE_SCHOOL | ADD_KEPSEK | EDIT_KEPSEK | TOGGLE_STATUS_KEPSEK | RESET_PASSWORD_KEPSEK | ADD_GURU | EDIT_GURU | TOGGLE_STATUS_GURU | RESET_PASSWORD_GURU | UPDATE_JAM_SEKOLAH | ADD_JADWAL | UPDATE_JADWAL | DELETE_JADWAL | ABSEN_DATANG | ABSEN_PULANG | AJUKAN_IZIN | AJUKAN_SAKIT | AJUKAN_KOREKSI_PRESENSI | APPROVE_CORRECTION | REJECT_CORRECTION | KIRIM_JURNAL | SIMPAN_DRAF_JURNAL | APPROVE_JOURNAL | BULK_APPROVE_JOURNALS | REVISION_JOURNAL | ADD_TASK_OR_ISSUE | RESPOND_TASK_OR_ISSUE | PURGE_LOGS | AUTO_PURGE_LOGS",
  "record_type": "schools | users | attendance | journals | schedules | tasks_and_issues | audit_logs",
  "record_id": "string",
  "detail": "object | null (keterangan ringkas bernilai primitif, opsional)",
  "timestamp": "Timestamp (WAJIB serverTimestamp - divalidasi rules)"
}
```

---

### 2.8. Koleksi `system_settings` (Konfigurasi Global & Retensi Log)
Menyimpan pengaturan tingkat platform SaaS yang hanya dapat dibaca/ditulis oleh `superadmin`.

* **Document ID:** `general_config`

```json
{
  "platform_name": "SIMFONI PAUD SaaS",
  "log_retention_days": "number (30 | 60 | 90 | 180 - Default: 60)",
  "auto_cleanup_enabled": "boolean (Default: true)",
  "last_cleanup_timestamp": "Timestamp | null",
  "last_cleanup_deleted_count": "number (Jumlah dokumen log yang terhapus pada siklus terakhir)",
  "initialized_at": "Timestamp (Diisi wizard seeder)",
  "updated_at": "Timestamp"
}
```

* **Penanda inisialisasi:** Keberadaan dokumen `general_config` menandai sistem sudah di-setup. Dokumen ini dapat di-`get` tanpa login (hanya untuk mendeteksi wizard seeder di halaman login) dan menutup jalur self-create superadmin.
* **Periodic Retention Job:** Dijalankan di klien saat Superadmin membuka Dashboard/Manajemen Log, maksimal sekali per sesi dan hanya bila `last_cleanup_timestamp` > 24 jam (lihat `src/utils/logRetention.js`).

---

## 3. Aturan Kueri & Indeks Majemuk (Composite Indexes)

> [!IMPORTANT]
> Setiap kueri data dari antarmuka `kepsek` dan `guru` **WAJIB** menyertakan filter isolasi tenant:
> ```javascript
> where("school_id", "==", currentUser.school_id)
> ```

### Konfigurasi Indeks Majemuk yang Diperlukan:
Didefinisikan di [`firestore.indexes.json`](../firestore.indexes.json) dan di-deploy dengan `firebase deploy --only firestore:indexes`:
1. **Rekap Presensi per Bulan:**  
   Koleksi: `attendance` -> Fields: `school_id` (Asc) + `tanggal` (Asc) — kueri rentang `tanggal >= awal_bulan && <= akhir_bulan`.
2. **Rekap Jurnal per Bulan:**  
   Koleksi: `journals` -> Fields: `school_id` (Asc) + `tanggal` (Asc).

3. **Riwayat Aktivitas Kepsek:**  
   Koleksi: `audit_logs` -> Fields: `school_id` (Asc) + `timestamp` (Desc) — 200 aktivitas terbaru per sekolah.

Kueri lain hanya memakai filter kesetaraan (`==`) dan pengurutan dilakukan di memori, sehingga cukup dilayani indeks single-field otomatis Firestore:
* Antrean koreksi Kepsek: `attendance` where `school_id ==`, `koreksi.diajukan == true` (+ `koreksi.status_koreksi == 'menunggu'`).
* Daftar guru / cek kuota: `users` where `school_id ==`, `role == 'guru'`.
* Kendala sarpras: `tasks_and_issues` where `school_id ==`, `kategori ==`, `status ==`.
* Audit log terbaru: `audit_logs` orderBy `timestamp` desc limit 500; purge: where `timestamp <` cutoff.

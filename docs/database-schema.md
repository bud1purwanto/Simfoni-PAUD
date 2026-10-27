# 🗄️ Skema Database: Cloud Firestore

Dokumen ini mendefinisikan seluruh struktur koleksi, tipe data dokumen, relasi, strategi penamaan Document ID, dan indeks pada database **Cloud Firestore** untuk sistem **SIMFONI PAUD**.

---

## 1. Ikhtisar Koleksi

Sistem menggunakan 6 koleksi utama di Cloud Firestore:

| Koleksi | Penamaan Doc ID | Deskripsi Utama |
| :--- | :--- | :--- |
| `users` | `{uid}` (Auth UID) | Data profil pengguna, role, status aktif/nonaktif, dan kelompok kelas. |
| `attendance` | `YYYY-MM-DD_{uid}` | Pencatatan presensi harian per guru dan pengajuan koreksi presensi. |
| `journals` | Auto-generated ID | Jurnal mengajar harian, tagging Kurikulum Merdeka, dan foto dokumentasi. |
| `schedules` | Auto-generated ID | Jadwal mengajar mingguan kelas TK A, TK B, atau kegiatan gabungan. |
| `tasks_and_issues`| Auto-generated ID | Laporan kegiatan tambahan, administrasi guru, dan laporan kendala sarana/KBM. |
| `audit_logs` | Auto-generated ID | Rekam jejak (audit trail) tindakan penting yang dilakukan pengguna. |

---

## 2. Definisi Koleksi & Model Dokumen

### 2.1. Koleksi `users`
Menyimpan profil akun Kepala Sekolah dan Guru.

* **Document ID:** `{uid}` (didapat dari `user.uid` Firebase Auth)
* **Aturan Khusus:** Jangan pernah melakukan penghapusan fisik (*hard delete*). Gunakan *soft delete* (`status_akun: "nonaktif"`) agar seluruh rekap presensi dan jurnal historis tetap terhubung dengan data guru.

```json
{
  "uid": "string (Firebase Auth UID)",
  "nama": "string (Nama lengkap guru / Kepala Sekolah)",
  "email": "string (Alamat email login)",
  "role": "kepsek | guru",
  "kelompok_kelas": "TK A | TK B | Semua",
  "status_akun": "aktif | nonaktif",
  "created_at": "Timestamp (ServerTimestamp)",
  "updated_at": "Timestamp (ServerTimestamp)"
}
```

---

### 2.2. Koleksi `attendance` (Presensi Guru)
Mencatat kehadiran guru dan pengajuan koreksi jika ada kendala sistem/lupa absen.

* **Document ID:** `YYYY-MM-DD_{uid}`  
  *Contoh:* `2026-10-27_u9A3kF1...`  
  *Alasan Penamaan:* Format gabungan tanggal dan UID memastikan hanya ada **1 dokumen presensi per guru per hari**, mencegah terjadinya *double submit*.

```json
{
  "id": "string (Format: YYYY-MM-DD_{uid})",
  "user_id": "string (uid guru)",
  "nama_guru": "string",
  "tanggal": "string (YYYY-MM-DD)",
  "jam_datang": "Timestamp | null (ServerTimestamp)",
  "jam_pulang": "Timestamp | null (ServerTimestamp)",
  "status": "hadir | terlambat | izin | sakit",
  "catatan": "string (Keterangan izin, sakit, atau alasan terlambat)",
  "lokasi": {
    "lat": "number | null (Koordinat latitude opsional)",
    "lng": "number | null (Koordinat longitude opsional)"
  },
  "koreksi": {
    "diajukan": "boolean (Default: false)",
    "jam_datang_ajuan": "string (HH:mm) | null",
    "jam_pulang_ajuan": "string (HH:mm) | null",
    "alasan": "string (Alasan pengajuan koreksi oleh guru)",
    "status_koreksi": "menunggu | disetujui | ditolak",
    "catatan_kepsek": "string (Komentar dari Kepala Sekolah saat memverifikasi)"
  },
  "created_at": "Timestamp",
  "updated_at": "Timestamp"
}
```

---

### 2.3. Koleksi `journals` (Jurnal Mengajar & Dokumentasi)
Menyimpan aktivitas belajar mengajar harian, capaian kurikulum, dan lampiran dokumentasi foto.

* **Document ID:** Auto-generated ID Firestore
* **Status Siklus:** `draf` -> `dikirim` -> `perlu_revisi` -> `disetujui`

```json
{
  "user_id": "string (uid guru)",
  "nama_guru": "string",
  "tanggal": "string (YYYY-MM-DD)",
  "kelompok": "TK A | TK B",
  "topik": "string (Tema / Topik pembelajaran)",
  "capaian_pembelajaran": [
    "Nilai Agama & Budi Pekerti",
    "Jati Diri",
    "Dasar-dasar Literasi & STEAM"
  ],
  "tujuan": "string (Tujuan pembelajaran)",
  "kegiatan_pembuka": "string (Aktivitas awal / apersepsi)",
  "kegiatan_inti": "string (Aktivitas utama pembelajaran)",
  "kegiatan_penutup": "string (Aktivitas refleksi / penutup)",
  "refleksi": "string (Evaluasi guru terhadap proses KBM hari ini)",
  "kendala": "string (Hambatan yang dialami selama mengajar)",
  "fotos": [
    {
      "url": "string (Download URL Firebase Storage)",
      "storage_path": "string (Path relatif di storage: journals/{uid}/{filename})",
      "caption": "string (Keterangan foto)",
      "izin_publikasi": "internal | publik"
    }
  ],
  "status": "draf | dikirim | perlu_revisi | disetujui",
  "review_note": "string (Catatan atau instruksi perbaikan dari Kepala Sekolah)",
  "reviewed_at": "Timestamp | null",
  "created_at": "Timestamp",
  "updated_at": "Timestamp"
}
```

---

### 2.4. Koleksi `schedules` (Jadwal Mengajar)
Menyimpan jadwal mingguan kelas yang dikelola oleh Kepala Sekolah.

* **Document ID:** Auto-generated ID Firestore

```json
{
  "hari": "Senin | Selasa | Rabu | Kamis | Jumat | Sabtu",
  "jam_mulai": "string (HH:mm, contoh: '07:30')",
  "jam_selesai": "string (HH:mm, contoh: '10:30')",
  "kelompok": "TK A | TK B | Semua",
  "kegiatan": "string (Nama kegiatan / mata pelajaran)",
  "pic_guru_id": "string (uid guru spesifik atau 'all')",
  "pic_nama": "string (Nama guru PIC)"
}
```

---

### 2.5. Koleksi `tasks_and_issues` (Laporan Kegiatan, Administrasi & Kendala)
Wadah terintegrasi untuk pelaporan di luar Jurnal KBM harian.

* **Document ID:** Auto-generated ID Firestore
* **Kategori Dokumen:**
  * `laporan_kegiatan`: Rapat dinas, perlombaan anak, pentas seni, kegiatan parenting.
  * `administrasi_guru`: RPPH/Modul ajar, penilaian bulanan, kelengkapan berkas fisik.
  * `laporan_kendala`: Kerusakan sarana prasarana sekolah, alat peraga rusak, dsb.

```json
{
  "user_id": "string (uid guru)",
  "nama_guru": "string",
  "tanggal": "string (YYYY-MM-DD)",
  "kategori": "laporan_kegiatan | administrasi_guru | laporan_kendala",
  "judul": "string",
  "deskripsi": "string",
  "hasil_atau_tindak_lanjut": "string",
  "foto_pendukung_url": "string | null",
  "status": "dilaporkan | diproses | selesai",
  "tanggapan_kepsek": "string (Respon atau disposisi Kepala Sekolah)",
  "created_at": "Timestamp"
}
```

---

### 2.6. Koleksi `audit_logs` (Riwayat Aktivitas Penting)
Mencatat jejak audit untuk akuntabilitas aksi operasional penting yang dilakukan dalam sistem.

* **Document ID:** Auto-generated ID Firestore
* **Karakteristik Dokumen:** Hanya dapat dibuat (*insert-only*), dilarang diubah atau dihapus (*immutable*).

```json
{
  "actor_id": "string (uid pengguna yang mengeksekusi aksi)",
  "actor_nama": "string",
  "action": "ADD_GURU | EDIT_GURU | TOGGLE_STATUS_GURU | APPROVE_JOURNAL | REVISION_JOURNAL | APPROVE_CORRECTION | REJECT_CORRECTION",
  "record_type": "users | attendance | journals | tasks_and_issues",
  "record_id": "string (ID dokumen terkait)",
  "timestamp": "Timestamp"
}
```

---

## 3. Pola Kueri & Indeks Firestore

Untuk mendukung performa tinggi dan filter laporan, pastikan konfigurasi indeks majemuk (*composite index*) berikut disiapkan:

1. **Jurnal berdasarkan Guru dan Waktu:**
   * Koleksi: `journals`
   * Fields: `user_id` (Ascending) + `tanggal` (Descending)
2. **Jurnal berdasarkan Status dan Waktu (Dashboard Kepsek):**
   * Koleksi: `journals`
   * Fields: `status` (Ascending) + `tanggal` (Descending)
3. **Presensi berdasarkan Rentang Tanggal:**
   * Koleksi: `attendance`
   * Fields: `tanggal` (Ascending) + `status` (Ascending)
4. **Tugas & Kendala berdasarkan Kategori dan Status:**
   * Koleksi: `tasks_and_issues`
   * Fields: `kategori` (Ascending) + `status` (Ascending) + `tanggal` (Descending)


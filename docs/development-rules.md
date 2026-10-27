# 🛠️ Aturan Pengembangan & Standar Kode (Development Rules)

Dokumen ini berisi pedoman penulisan kode, konvensi teknis, standar arsitektur komponen, serta **aturan wajib sinkronisasi dokumentasi** untuk pengembangan aplikasi **SIMFONI PAUD**.

---

## 1. Aturan Emas: Sinkronisasi Dokumentasi (Documentation Sync Policy)

> [!IMPORTANT]
> **ATURAN WAJIB UNTUK AI AGENT & PENGEMBANG:**  
> Setiap kali terjadi **Perubahan Besar (*Major Change*)** pada sistem, kode sumber, skema basis data, atau arsitektur, Anda **WAJIB** secara sadar memperbarui file-file dokumentasi kecil terkait di folder `docs/*.md` dan `AGENTS.md`.  
> Tidak ada tugas yang dianggap selesai (*done*) sebelum dokumentasi yang relevan disinkronkan!

### Apa yang Tergolong "Perubahan Besar"?
1. **Perubahan Skema Database:** Menambah koleksi baru, menambah/mengubah tipe field, atau mengubah format Document ID.  
   👉 *Wajib perbarui:* [`docs/database-schema.md`](database-schema.md)
2. **Perubahan Keamanan & Hak Akses:** Mengubah permission, logika `firestore.rules` atau `storage.rules`, role pengguna, atau matriks RBAC.  
   👉 *Wajib perbarui:* [`docs/security-rules.md`](security-rules.md)
3. **Perubahan Arsitektur & Dependensi:** Menambah library baru, mengubah struktur folder `src/`, mengubah pola autentikasi (misal Secondary App), atau konfigurasi build.  
   👉 *Wajib perbarui:* [`docs/architecture.md`](architecture.md)
4. **Perubahan Modul, Alur Kerja & Fitur:** Menambah menu baru, mengubah tahapan pengajuan laporan (status lifecycle), alur presensi, atau mekanisme UI mobile.  
   👉 *Wajib perbarui:* [`docs/features-and-workflow.md`](features-and-workflow.md)
5. **Perubahan Konfigurasi Deployment:** Menambah variabel lingkungan (`.env`), konfigurasi Cloudflare Pages, atau aturan redirect.  
   👉 *Wajib perbarui:* [`docs/deployment.md`](deployment.md)
6. **Perubahan Roadmap Global:** Perubahan pada checklist pengerjaan dan milestone proyek.  
   👉 *Wajib perbarui:* [`AGENTS.md`](../AGENTS.md)

---

## 2. Standar Penamaan & Konvensi Kode

### 2.1. Penamaan File & Direktori
* **Komponen React:** Gunakan format **PascalCase** (contoh: `AppLayout.jsx`, `DashboardGuru.jsx`, `ModalConfirm.jsx`).
* **Custom Hooks:** Awali dengan `use` dan gunakan format **camelCase** (contoh: `useSpeechToText.js`, `useFirestore.js`).
* **Modul Utilitas & Helper:** Gunakan format **camelCase** (contoh: `imageCompressor.js`, `pdfExporter.js`).
* **Field Database Firestore:** Gunakan format **snake_case** (contoh: `kelompok_kelas`, `jam_datang`, `status_akun`, `review_note`).

### 2.2. Pola React & Clean Code
* Selalu gunakan komponen fungsional (*functional components*) dengan Hooks modern (`useState`, `useEffect`, `useMemo`, `useCallback`).
* Hindari menulis komponen monolitik yang terlalu panjang (> 250 baris). Pisahkan sub-komponen UI (seperti Kartu Status, Tabel Rekap, Form Input) ke file terpisah di `src/components/ui/` atau sub-direktori halaman.
* **Cleanup Subscriptions:** Semua listener Firestore (`onSnapshot`) atau Web Speech API wajib memiliki fungsi pembersih (*cleanup function*) pada return `useEffect` untuk menghindari kebocoran memori (*memory leak*):
  ```javascript
  useEffect(() => {
    const unsubscribe = onSnapshot(docRef, (docSnap) => {
      // update state
    });
    return () => unsubscribe();
  }, [docRef]);
  ```

---

## 3. Aturan Integrasi Firebase (Modular SDK v10+)

1. **Gunakan Modular Imports:** Hindari mengimpor seluruh SDK Firebase (hindari `import firebase from 'firebase/compat'`). Selalu gunakan tree-shakable modular functions:
   ```javascript
   import { doc, getDoc, setDoc, updateDoc, serverTimestamp } from "firebase/firestore";
   ```
2. **Timestamp Konsisten:** Selalu gunakan `serverTimestamp()` untuk field pencatatan waktu (`created_at`, `updated_at`, `jam_datang`, `jam_pulang`). Hindari menggunakan `new Date()` lokal klien untuk penyimpanan database karena jam di perangkat HP guru bisa tidak akurat.
3. **Pemisahan Auth Instance untuk Manajemen Guru:** Jangan pernah menggunakan instance auth utama saat Kepala Sekolah mendaftarkan guru baru. Wajib gunakan `secondaryAuth` yang diinisialisasi terpisah agar Kepala Sekolah tidak ter-logout secara mendadak.
4. **Soft Delete Pengguna:** Akun guru tidak boleh dihapus secara hard-delete. Selalu gunakan pembaruan status:
   ```javascript
   await updateDoc(doc(db, "users", guruUid), {
     status_akun: "nonaktif",
     updated_at: serverTimestamp()
   });
   ```

---

## 4. Standar Styling & Desain Mobile-First (Tailwind CSS)

1. **Pendekatan Mobile-First:** Tulis class utilitas Tailwind dengan asumsi tampilan awal adalah layar smartphone. Gunakan breakpoint `md:` (768px) atau `lg:` (1024px) hanya untuk adaptasi layar tablet dan desktop:
   ```jsx
   // Contoh: Grid 1 kolom di HP, 2 kolom di tablet, 3 kolom di laptop
   <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
   ```
2. **Area Sentuh Ramah Jempol (Touch Targets):** Setiap tombol, ikon, dan tautan yang dapat diklik di layar HP harus memiliki tinggi minimal `44px` (misal: `h-11 px-4` atau `p-3`) agar nyaman ditekan oleh jari guru tanpa salah klik.
3. **Warna & Palet Konsisten:**
   * Warna Utama (Primary): Indigo/Blue (profesional, ramah pendidikan anak).
   * Status Hijau (Success): `disetujui`, `hadir`, `selesai`.
   * Status Kuning/Orange (Warning): `perlu_revisi`, `terlambat`, `menunggu`.
   * Status Merah (Danger): `nonaktif`, `izin`, `sakit`, `ditolak`.
   * Status Abu-abu (Neutral): `draf`.

---

## 5. Standar Penanganan Galat & Notifikasi (UX Error Handling)

1. **Pesan Galat Ramah Pengguna:** Jangan pernah menampilkan pesan galat mentah Firebase (seperti `FirebaseError: auth/wrong-password`) langsung kepada guru. Terjemahkan ke Bahasa Indonesia yang sopan dan jelas (contoh: *"Kata sandi salah. Silakan periksa kembali."*).
2. **Indikator Loading:** Selalu tampilkan skeleton loader atau spinner saat mengambil data asinkron atau memproses unggahan foto, agar guru mengetahui sistem sedang bekerja.
3. **Konfirmasi Tindakan Destruktif:** Tindakan seperti menolak pengajuan, meminta revisi, atau menonaktifkan akun wajib memunculkan modal dialog konfirmasi terlebih dahulu.


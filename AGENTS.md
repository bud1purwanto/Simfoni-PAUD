# 🎶 AGENTS.md: Panduan Induk & Aturan Global AI Agent

Selamat datang di repositori **SIMFONI PAUD (Sistem Informasi Monitoring dan Pelaporan Terintegrasi PAUD)** untuk **TK Dharma Wanita Persatuan 8**.  
File ini merupakan **Master Blueprint & Global Entrypoint** yang wajib dibaca dan ditaati oleh setiap AI Agent (termasuk Antigravity) dan pengembang dalam memelihara dan membangun sistem ini.

---

## ⚠️ ATURAN EMAS: SINKRONISASI ATURAN KECIL DI `.md` JIKA ADA PERUBAHAN BESAR

> [!CAUTION]
> ### 🛑 PROTOKOL ANTI-LUPA: KEWAJIBAN SINKRONISASI DOKUMENTASI
> Setiap kali Anda melakukan **Perubahan Besar (*Major Change*)** pada arsitektur, basis data, keamanan, alur kerja, dependensi, atau konfigurasi sistem, **ANDA WAJIB MEMPERBARUI FILE ATURAN KECIL TERKAIT DI DALAM DIREKTORI `docs/`**.
>
> **Aturan Operasional:**
> 1. Dilarang menyelesaikan pekerjaan atau melapor selesai kepada pengguna sebelum seluruh file dokumentasi yang terdampak telah diperbarui agar informasinya tidak pernah usang / terlupa.
> 2. Periksa tabel sinkronisasi di bawah ini sebelum mengakhiri setiap tugas:
>
> | Jenis Perubahan Besar | File `.md` Kecil yang Wajib Diubah |
> | :--- | :--- |
> | Penambahan/perubahan field, relasi, atau skema Firestore | [`docs/database-schema.md`](docs/database-schema.md) |
> | Perubahan hak akses, peran (`role`), matriks RBAC, `firestore.rules`, atau `storage.rules` | [`docs/security-rules.md`](docs/security-rules.md) |
> | Perubahan stack, struktur folder, dual-app Firebase, atau strategi offline/PWA | [`docs/architecture.md`](docs/architecture.md) |
> | Perubahan modul, inovasi UX, siklus status laporan, atau alur kerja guru/kepsek | [`docs/features-and-workflow.md`](docs/features-and-workflow.md) |
> | Perubahan standar kode, penamaan komponen, best practices, atau aturan sinkronisasi | [`docs/development-rules.md`](docs/development-rules.md) |
> | Perubahan proses build, routing `_redirects`, environment variable, atau Cloudflare Pages | [`docs/deployment.md`](docs/deployment.md) |
> | Perubahan roadmap eksekusi global atau scope proyek | [`AGENTS.md`](AGENTS.md) (Dokumen Ini) |

---

## 🗺️ Peta Dokumentasi & Panduan Rinci (Documentation Index)

Seluruh rancangan spesifikasi teknis telah dipecah secara modular ke dalam direktori [`docs/`](docs/):

1. **Arsitektur Sistem & Topologi:**  
   👉 [`docs/architecture.md`](docs/architecture.md)  
   *Membahas: Topologi PWA Mobile-First, Firebase Dual-App Instance, Offline Persistence (IndexedDB), dan Struktur Direktori Proyek.*

2. **Skema Basis Data (Cloud Firestore):**  
   👉 [`docs/database-schema.md`](docs/database-schema.md)  
   *Membahas: Koleksi `users`, `attendance`, `journals`, `schedules`, `tasks_and_issues`, `audit_logs`, format Document ID, dan konfigurasi indeks.*

3. **Keamanan & Kontrol Akses (RBAC):**  
   👉 [`docs/security-rules.md`](docs/security-rules.md)  
   *Membahas: Matriks 10 hak akses, kode implementasi `firestore.rules`, `storage.rules`, dan etika perlindungan privasi foto anak.*

4. **Fitur Utama, Alur Kerja & Inovasi Pengguna:**  
   👉 [`docs/features-and-workflow.md`](docs/features-and-workflow.md)  
   *Membahas: 10 modul aplikasi, diagram siklus pelaporan guru ke Kepala Sekolah, Voice-to-Text (`id-ID`), kompresi foto klien (<300KB), tagging Kurikulum Merdeka PAUD, dan duplikasi jurnal.*

5. **Standar Kode & Aturan Pengembangan:**  
   👉 [`docs/development-rules.md`](docs/development-rules.md)  
   *Membahas: Penamaan berkas, pola komponen React & Hooks, penanganan listener Firestore yang aman, desain ergonomis mobile-first Tailwind, dan standar notifikasi.*

6. **Panduan Deployment Produksi:**  
   👉 [`docs/deployment.md`](docs/deployment.md)  
   *Membahas: Konfigurasi build Cloudflare Pages, routing `_redirects` SPA, pendaftaran domain di Firebase Authorized Domains, serta konfigurasi PWA `manifest.json`.*

---

## 📌 Ringkasan Parameter Sistem

* **Nama Aplikasi:** SIMFONI PAUD (Sistem Informasi Monitoring dan Pelaporan Terintegrasi PAUD)
* **Instansi Sasaran:** TK Dharma Wanita Persatuan 8
* **Tahap Awal Akun:** 5 Pengguna (1 Kepala Sekolah + 4 Guru PAUD)
* **Prinsip Tampilan:** Mobile-First UI (Bottom Navigation pada layar smartphone `< 768px`, Sidebar pada layar desktop `>= 768px`)
* **Framework:** React 18+ (Vite) + Tailwind CSS + Lucide Icons
* **BaaS (Backend):** Firebase v10+ Modular SDK (Auth, Firestore, Cloud Storage)
* **Target Hosting:** Cloudflare Pages (Gratis, Edge Global)

---

## 💡 Solusi Kritis yang Wajib Diingat

1. **Pembuatan Akun Guru oleh Kepala Sekolah:**  
   Firebase Client SDK melarang pembuatan user lain tanpa me-logout sesi aktif jika menggunakan instance utama. **Wajib gunakan `secondaryAuth`** dari instance kedua yang terpisah di `src/config/firebase.js`.
2. **Kompresi Gambar di HP Guru:**  
   Gunakan library `browser-image-compression` sebelum proses upload ke Firebase Storage. Gambar wajib ditekan hingga **< 300 KB** (maksimum resolusi 1280px) untuk menghemat kuota guru dan mempercepat akses.
3. **Cetak Dokumen Akreditasi & Supervisi:**  
   Sediakan fitur cetak PDF otomatis berbasis `jspdf` & `jspdf-autotable` yang memuat Kop Surat resmi TK Dharma Wanita Persatuan 8 dan tanda tangan digital.
4. **Pencegahan Data Hilang Saat Sinyal Drop:**  
   Aktifkan `enableIndexedDbPersistence(db)` pada Firestore dan sediakan mekanisme simpan `draf` otomatis pada Jurnal Mengajar.

---

## 📋 Roadmap & Tahapan Eksekusi untuk AI Agent

Saat diminta membangun atau menyempurnakan fitur, ikuti urutan langkah terstruktur ini:

- [ ] **Fase 1: Setup Lingkungan & Scaffold Proyek**  
  Inisialisasi React + Vite, Tailwind CSS, icon `lucide-react`, dan pustaka pendukung. Siapkan `public/_redirects` dan `public/manifest.json`.
- [ ] **Fase 2: Konfigurasi Firebase & Layanan Inti**  
  Bangun `src/config/firebase.js` (dengan dual auth instance), `imageCompressor.js`, `useSpeechToText.js`, `pdfExporter.js`, dan `auditLogger.js`.
- [ ] **Fase 3: Autentikasi & Setup Admin Awal**  
  Implementasikan `AuthContext.jsx` dan `Login.jsx` (dengan fitur cerdas *Initial Setup Akun Kepala Sekolah Pertama* jika database masih kosong).
- [ ] **Fase 4: Shell Layout Adaptif & Navigasi**  
  Bangun `AppLayout.jsx` dengan *Bottom Navigation* untuk layar smartphone dan *Sidebar Navigation* untuk layar laptop.
- [ ] **Fase 5: Modul Guru (`/guru/*`)**  
  Bangun Dashboard Guru, Presensi Cepat, Jurnal Mengajar (Form, Draf, Voice-to-Text, Kompresi Foto, Duplikasi), dan Laporan Tambahan/Kendala.
- [ ] **Fase 6: Modul Kepala Sekolah (`/kepsek/*`)**  
  Bangun Dashboard Live Monitoring, Manajemen Akun Guru (CRUD via Secondary App), Validasi Jurnal & Koreksi Absen, Pengaturan Jadwal, serta Rekapitulasi & Cetak PDF.
- [ ] **Fase 7: Verifikasi & Sinkronisasi Akhir**  
  Uji alur secara menyeluruh dan pastikan seluruh dokumen di `docs/*.md` selaras dengan kode akhir.


# 🎶 AGENTS.md: Panduan Induk & Aturan Global AI Agent (SaaS Edition)

Selamat datang di repositori **SIMFONI PAUD (Sistem Informasi Monitoring dan Pelaporan Terintegrasi PAUD - Multi-Tenant B2B SaaS Edition)**.  
File ini merupakan **Master Blueprint & Global Entrypoint** yang wajib dibaca dan ditaati oleh setiap AI Agent (termasuk Antigravity) dan pengembang dalam memelihara dan membangun sistem ini.

---

## 🛑 ATURAN MUTLAK: DILARANG AUTO-COMMIT & AUTO-PUSH KE GIT!

> [!CAUTION]
> ### ⛔ MANDATORY REVIEW POLICY: DILARANG AUTO-COMMIT & AUTO-PUSH
> **AI Agent (Antigravity) DILARANG KERAS melakukan `git commit` dan `git push` secara otomatis / sepihak.**
> 
> **Aturan Operasional:**
> 1. Setiap penambahan, penghapusan, atau perubahan kode/dokumen **HANYA** boleh diterapkan di *working directory* lokal.
> 2. AI Agent wajib menyajikan ringkasan perubahan kepada Pengguna dan **menunggu Pengguna melakukan review manual terlebih dahulu**.
> 3. Perintah `git commit` maupun `git push` **HANYA** boleh dieksekusi jika dan hanya jika Pengguna memberikan instruksi eksplisit (misal: *"commit sekarang"*, *"push ke github"*). Dilarang berinisiatif melakukan commit/push sendiri!

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
> | Penambahan/perubahan field, relasi, koleksi `schools`, atau skema Firestore | [`docs/database-schema.md`](docs/database-schema.md) |
> | Perubahan hak akses, hierarki 3 peran (`superadmin`, `kepsek`, `guru`), matriks RBAC, atau Security Rules | [`docs/security-rules.md`](docs/security-rules.md) |
> | Perubahan arsitektur multi-tenant, struktur folder, dual-app Firebase, atau strategi Dev/Prod | [`docs/architecture.md`](docs/architecture.md) |
> | Perubahan modul, inovasi UX, kuota guru, siklus status laporan, atau alur kerja | [`docs/features-and-workflow.md`](docs/features-and-workflow.md) |
> | Perubahan standar kode, penamaan komponen, kueri berfilter `school_id`, atau aturan Git | [`docs/development-rules.md`](docs/development-rules.md) |
> | Perubahan proses build, routing `_redirects`, environment variable Dev/Prod, atau Cloudflare Pages | [`docs/deployment.md`](docs/deployment.md) |
> | Perubahan roadmap eksekusi global atau scope proyek | [`AGENTS.md`](AGENTS.md) (Dokumen Ini) |

---

## 🗺️ Peta Dokumentasi & Panduan Rinci (Documentation Index)

Seluruh rancangan spesifikasi teknis telah dipecah secara modular ke dalam direktori [`docs/`](docs/):

1. **Arsitektur Sistem & Topologi Multi-Tenant:**  
   👉 [`docs/architecture.md`](docs/architecture.md)  
   *Membahas: Arsitektur SaaS Multi-Tenant (`school_id`), Firebase Dual-App Instance, Offline Persistence, dan Pipeline Dev vs Prod.*

2. **Skema Basis Data (Cloud Firestore):**  
   👉 [`docs/database-schema.md`](docs/database-schema.md)  
   *Membahas: Koleksi `schools`, `users`, `attendance`, `journals`, `schedules`, `tasks_and_issues`, `audit_logs`, format ID, dan composite indexes.*

3. **Keamanan & Kontrol Akses (3-Tier RBAC):**  
   👉 [`docs/security-rules.md`](docs/security-rules.md)  
   *Membahas: Matriks 3 peran (`superadmin`, `kepsek`, `guru`), kode implementasi `firestore.rules`, `storage.rules`, dan isolasi tenant.*

4. **Fitur Utama, Alur Kerja & Inovasi Pengguna:**  
   👉 [`docs/features-and-workflow.md`](docs/features-and-workflow.md)  
   *Membahas: Modul Superadmin, validasi kuota guru, kop surat PDF dinamis, Voice-to-Text (`id-ID`), kompresi foto klien (<300KB), dan tagging Kurikulum Merdeka.*

5. **Standar Kode & Aturan Pengembangan:**  
   👉 [`docs/development-rules.md`](docs/development-rules.md)  
   *Membahas: Kueri wajib `where("school_id", "==", currentUser.school_id)`, alur kerja Git (`dev` ➡️ `main`), standar React Hooks, dan cleanup listener.*

6. **Panduan Deployment & CI/CD Pipeline:**  
   👉 [`docs/deployment.md`](docs/deployment.md)  
   *Membahas: Konfigurasi dual-environment Cloudflare Pages (Preview vs Production), pemisahan project Firebase (`dev` vs `prod`), dan `_redirects` SPA.*

---

## 📌 Ringkasan Parameter Sistem SaaS

* **Nama Aplikasi:** SIMFONI PAUD (SaaS Edition)
* **Model Bisnis:** Multi-Tenant B2B SaaS untuk Sekolah PAUD & TK
* **Sekolah Pilot Awal:** TK Dharma Wanita Persatuan 8
* **Hierarki Peran (3-Tier):**
  1. `superadmin` (Project Owner / Baginda): Global Access, kelola tenant sekolah, atur kuota, suspend langganan, buat akun Kepsek.
  2. `kepsek` (School Admin): Dibatasi `school_id`, kelola guru (maks = `kuota_guru`), validasi laporan, download PDF kop resmi.
  3. `guru` (Teacher): Dibatasi `school_id`, presensi, jurnal mengajar, dokumentasi foto, lapor kendala.
* **Prinsip Tampilan:** Mobile-First UI (Bottom Navigation pada layar HP `< 768px`, Sidebar pada layar desktop `>= 768px`)
* **Dynamic Branding:** Logo, nama sekolah, dan nama Kepala Sekolah dimuat dinamis dari data tenant (`schoolData`).
* **Hosting & CI/CD:** Cloudflare Pages (Preview pada branch `dev` ➡️ `simfoni-paud-dev`, Production pada branch `main` ➡️ `simfoni-paud-prod`).

---

## 💡 Solusi Kritis yang Wajib Diingat

1. **Pendaftaran Akun Bertingkat via Secondary Auth:**  
   Superadmin membuat akun Kepsek dan Kepsek membuat akun Guru wajib menggunakan `secondaryAuth` dari `src/config/firebase.js` agar sesi aktif tidak ter-logout.
2. **Isolasi Data Multi-Tenant:**  
   Seluruh dokumen operasional wajib memiliki atribut `"school_id": "string"`. Seluruh kueri dari Kepsek dan Guru wajib menyertakan `where("school_id", "==", currentUser.school_id)`.
3. **Pemberlakuan Batas Kuota Guru:**  
   Sebelum Kepsek mendaftarkan guru baru, hitung total guru aktif di sekolah tersebut. Blokir penambahan jika sudah mencapai `schoolData.kuota_guru`.
4. **Kompresi Gambar di HP Guru:**  
   Gunakan library `browser-image-compression` untuk menekan ukuran foto kamera (3-10 MB) menjadi **< 300 KB** sebelum diunggah ke Firebase Storage.
5. **Dynamic Branding & Kop Surat PDF:**  
   Dilarang melakukan *hardcode* nama sekolah. Gunakan data dinamis dari `schoolData` pada `AuthContext` untuk header aplikasi dan Kop Surat di `pdfExporter.js`.
6. **Indikator DEV Mode:**  
   Tampilkan *floating badge* `DEV ENVIRONMENT` saat `VITE_APP_ENV !== 'production'`.
7. **Pintu Masuk Login Tunggal & Dashboard Terpisah:**  
   Superadmin, Kepsek, dan Guru login melalui 1 form `/login` yang identik tanpa ada dropdown/tanda role agar tidak terdeteksi publik. Sistem otomatis me-redirect ke dashboard terpisah masing-masing (`/superadmin/dashboard`, `/kepsek/dashboard`, atau `/guru/dashboard`) berdasarkan field `role` di Firestore.
8. **Presensi Dual Timestamp (Anti-Trap Offline):**  
   Catat waktu lokal perangkat (`jam_datang_device`) dan jam server (`jam_datang_server`) agar saat guru absen di zona sinyal lemah lalu tersinkron belakangan, guru tidak dirugikan sebagai terlambat.
9. **Solusi Lupa Password Guru (Tanpa Buka Email):**  
   Kepsek memiliki tombol "Reset Password ke Default" (`Guru1234!`) di panel guru dengan flag `wajib_ganti_password: true`.
10. **Multi-Format Export & Bulk Approval:**  
    Sediakan PDF Ringkas (ramah HP), PDF Lengkap Portofolio, Ekspor Excel (`.xlsx`) untuk rekap honor/transport guru, serta tombol "Setujui Sekaligus" (*Bulk Approval*) pada dashboard Kepsek.
11. **Pembersihan Log & Job Retensi Berkala:**  
    Untuk menghemat kuota Firestore, Superadmin memiliki kontrol pembersihan `audit_logs` baik manual (rentang 30/60/90 hari) maupun otomatis melalui background job retensi periodik (`system_settings`).
12. **Ekosistem Ramah Lapangan (WA Share, Banner Offline, Bank KBM & Stempel Digital):**  
    Sediakan tombol bagikan ringkasan KBM ke WhatsApp (`wa.me`), banner visual status online/offline (`NetworkStatusBanner.jsx`), bank template KBM siap pakai (`kbmTemplates.js`), serta stempel/cap digital sekolah transparan pada rekap PDF.

---

## 📋 Roadmap & Tahapan Eksekusi untuk AI Agent

Saat diminta membangun atau menyempurnakan fitur, ikuti urutan langkah terstruktur ini:

- [x] **Fase 1: Setup Lingkungan, Dependensi & Dual Environment**
  - [x] Scaffold React 18+ dengan Vite & Tailwind CSS.
  - [x] Pasang dependensi inti: `firebase`, `browser-image-compression`, `jspdf`, `jspdf-autotable`, `xlsx`, `date-fns`, `lucide-react`, `react-router-dom`.
  - [x] Konfigurasi `.gitignore` (proteksi `.env.*`), `.env.example`, `public/_redirects` (`/* /index.html 200`), dan `public/manifest.json`.

- [x] **Fase 2: Konfigurasi Firebase Modular & Layanan Inti**
  - [x] Bangun `src/config/firebase.js` (*Primary App* untuk sesi aktif + *Secondary App* untuk pendaftaran user bertingkat tanpa ter-*logout*).
  - [x] Bangun `src/utils/imageCompressor.js` (kompresi foto HP menjadi < 300 KB, resolusi maks 1280px).
  - [x] Bangun `src/hooks/useSpeechToText.js` (Voice-to-Text bahasa Indonesia `id-ID`).
  - [x] Bangun `src/utils/pdfExporter.js` (PDF dinamis dengan Kop Surat sekolah, tanda tangan Kepsek, dan stempel digital transparan).
  - [x] Bangun `src/utils/excelExporter.js` (ekspor rekapitulasi kehadiran `.xlsx` untuk honor/transport guru).
  - [x] Bangun `src/utils/kbmTemplates.js` (bank template kegiatan KBM Kurikulum Merdeka).
  - [x] Bangun `src/utils/auditLogger.js` (helper pencatatan audit log per `school_id`).
  - [x] Terapkan berkas aturan keamanan `firestore.rules` dan `storage.rules`.

- [ ] **Fase 3: Autentikasi, Context Multi-Tenant & Pilot Seeder**
  - [ ] Bangun `src/context/AuthContext.jsx` (manajemen sesi, pemuatan `schoolData`, penanganan suspensi sekolah, flag ganti password).
  - [ ] Bangun `src/pages/auth/Login.jsx` (pintu masuk tunggal *stealth*, auto-redirect sesuai role tanpa dropdown peran).
  - [ ] Bangun fitur cerdas *Initial SaaS Seeder* di halaman login jika koleksi `users` masih kosong (buat Superadmin & Sekolah Pilot TK DWP 8).
  - [ ] Bangun `src/components/ui/ModalGantiPassword.jsx` (modal wajib bagi user yang baru di-reset oleh Kepsek/Admin).
  - [ ] Bangun `src/pages/auth/SuspendedSchool.jsx` (layanan diblokir jika status langganan nonaktif).

- [ ] **Fase 4: Shell Layout Adaptif, Dynamic Branding & Network Awareness**
  - [ ] Bangun `src/components/layout/AppLayout.jsx` dengan identitas dinamis (logo & nama sekolah dari context).
  - [ ] Bangun navigasi adaptif: *Bottom Navigation* untuk HP (`< 768px`) & *Sidebar* untuk laptop (`>= 768px`).
  - [ ] Bangun `src/components/layout/NetworkStatusBanner.jsx` (indikator visual status jaringan Online / Offline).
  - [ ] Bangun `src/components/layout/DevBadge.jsx` (floating badge indikator lingkungan pengujian).
  - [ ] Bangun `src/components/layout/ProtectedRoute.jsx` (pengamanan rute 3-tier: Superadmin, Kepsek, Guru).

- [ ] **Fase 5: Modul Guru PAUD (`/guru/*`)**
  - [ ] `DashboardGuru.jsx`: Absen datang/pulang instan, status kelengkapan jurnal hari ini, dan jadwal KBM aktif.
  - [ ] `PresensiGuru.jsx`: Dual Timestamp (`jam_datang_device` vs `jam_datang_server`), riwayat presensi, form pengajuan koreksi, deteksi lupa absen pulang (> 18:00).
  - [ ] `JurnalGuru.jsx`: Form KBM Kurikulum Merdeka, Bank Template KBM (`kbmTemplates.js`), Voice-to-Text (`id-ID`), kompresi foto kamera, salin jurnal kemarin, simpan draf vs kirim, dan tombol *Share to WhatsApp* (`wa.me`).
  - [ ] `JadwalGuru.jsx`: Tampilan jadwal mingguan kelas.
  - [ ] `LaporanLainGuru.jsx`: Pelaporan tugas tambahan (rapat/lomba), administrasi guru, dan laporan kendala sarpras.

- [ ] **Fase 6: Modul Kepala Sekolah (`/kepsek/*`)**
  - [ ] `DashboardKepsek.jsx`: Monitoring live kehadiran guru hari ini, antrean review jurnal KBM, notifikasi kendala.
  - [ ] `KelolaGuru.jsx`: Daftar guru, validasi batas `kuota_guru`, tombol reset password default `Guru1234!` (tanpa email), edit profil, dan soft-delete.
  - [ ] `ValidasiLaporan.jsx`: Review jurnal dengan catatan revisi terperinci, fitur "Setujui Sekaligus / *Bulk Approval*", dan verifikasi koreksi absen.
  - [ ] `KelolaJadwal.jsx`: Penataan jadwal KBM kelas TK A & TK B.
  - [ ] `RekapDanPdf.jsx`: Unduh PDF Ringkas ramah HP, PDF Lengkap Portofolio, ekspor Excel honor `.xlsx`, dan *Share to WA*.

- [ ] **Fase 7: Modul Superadmin (`/superadmin/*`)**
  - [ ] `DashboardSuperadmin.jsx`: Metrik SaaS global, sekolah aktif vs expired, meteran estimasi pemakaian storage Firebase.
  - [ ] `KelolaSekolah.jsx`: CRUD sekolah mitra, atur kuota guru, paket langganan, upload logo & stempel cap resmi, toggle suspend sekolah.
  - [ ] `KelolaAkunKepsek.jsx`: Pembuatan akun Kepsek via *Secondary Auth* tanpa me-logout Superadmin, reset password Kepsek.
  - [ ] `ManajemenLog.jsx`: Tabel audit log global, tombol *Purge* manual 30/60/90 hari, dan konfigurasi *Periodic Retention Job* (`system_settings`).

- [ ] **Fase 8: Pengujian Menyeluruh, Optimasi & Verifikasi CI/CD**
  - [ ] Uji isolasi data antar sekolah mitra di branch `dev` (Firestore Rules verification).
  - [ ] Uji kompresi foto dan keandalan mode offline persistence.
  - [ ] Uji hasil cetak PDF (dengan kop & stempel transparan) dan ekspor Excel di HP dan laptop.
  - [ ] Verifikasi dan sinkronisasi seluruh dokumen di `docs/*.md` agar selalu selaras dengan kode akhir.

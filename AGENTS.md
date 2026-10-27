# 🎶 AGENTS.md: Panduan Induk & Aturan Global AI Agent (SaaS Edition)

Selamat datang di repositori **SIMFONI PAUD (Sistem Informasi Monitoring dan Pelaporan Terintegrasi PAUD - Multi-Tenant B2B SaaS Edition)**.  
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

---

## 📋 Roadmap & Tahapan Eksekusi untuk AI Agent

Saat diminta membangun atau menyempurnakan fitur, ikuti urutan langkah terstruktur ini:

- [ ] **Fase 1: Setup Lingkungan & Dual Environment**  
  Inisialisasi Vite + React + Tailwind + Lucide Icons. Siapkan `.gitignore` (proteksi `.env.*`), `.env.example`, `public/_redirects`, dan `public/manifest.json`.
- [ ] **Fase 2: Konfigurasi Firebase Modular & Layanan Inti**  
  Bangun `src/config/firebase.js` (Primary & Secondary App), `imageCompressor.js`, `useSpeechToText.js`, `pdfExporter.js` (dinamis), dan `auditLogger.js`.
- [ ] **Fase 3: Autentikasi, Context Multi-Tenant & Pilot Seeder**  
  Bangun `AuthContext.jsx` (memuat profil user + `schoolData`), `Login.jsx`, dan fitur cerdas *Initial Seeding SaaS (Setup Superadmin & Sekolah Pilot Pertama)* jika database masih kosong.
- [ ] **Fase 4: Shell Layout Adaptif & Dynamic Branding**  
  Bangun `AppLayout.jsx` dengan identitas dinamis (logo & nama sekolah), *Bottom Navigation* untuk HP, *Sidebar* untuk laptop, dan badge `DEV ENVIRONMENT`.
- [ ] **Fase 5: Modul Guru (`/guru/*`)**  
  Bangun Dashboard Guru, Presensi Cepat, Jurnal Mengajar (Form, Draf, Voice-to-Text, Kompresi Foto, Duplikasi), dan Laporan Tambahan/Kendala.
- [ ] **Fase 6: Modul Kepala Sekolah (`/kepsek/*`)**  
  Bangun Dashboard Monitoring Live, Manajemen Akun Guru (dengan validasi `kuota_guru` via Secondary Auth), Validasi Jurnal & Koreksi Absen, serta Rekapitulasi & Cetak PDF dinamis.
- [ ] **Fase 7: Modul Superadmin (`/superadmin/*`)**  
  Bangun Dashboard Metrik SaaS Global, Kelola Sekolah Mitra (CRUD, kuota, suspend langganan), dan Kelola Akun Kepala Sekolah.
- [ ] **Fase 8: Verifikasi & Sinkronisasi Dokumen Akhir**  
  Uji alur multi-tenant secara menyeluruh di branch `dev` dan pastikan seluruh dokumen di `docs/*.md` selalu selaras dengan kode akhir.

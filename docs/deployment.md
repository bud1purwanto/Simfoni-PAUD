# 🚀 Panduan Deployment: Cloudflare Pages & Firebase

Dokumen ini memuat panduan langkah demi langkah untuk melakukan build, deployment, dan konfigurasi lingkungan produksi **SIMFONI PAUD** menggunakan **Cloudflare Pages** dan **Firebase Console**.

---

## 1. Ikhtisar Arsitektur Hosting

* **Frontend SPA:** Cloudflare Pages (Gratis, CDN edge global, proteksi DDoS, sertifikat SSL otomatis).
* **Backend BaaS:** Firebase (Authentication, Cloud Firestore, Cloud Storage).
* **Domain Produksi:** Subdomain Cloudflare (misal: `simfoni-paud.pages.dev`) atau Custom Domain sekolah.

---

## 2. Persyaratan Routing SPA (`_redirects`)

Aplikasi React Router v6 menggunakan *client-side routing*. Ketika pengguna di HP me-refresh browser pada URL seperti `/guru/jurnal` atau `/kepsek/validasi`, server web statis biasa akan mencari file fisik `guru/jurnal.html` dan mengembalikan galat **404 Not Found**.

### Solusi Wajib:
Buat file `public/_redirects` dengan konten persis satu baris:
```text
/* /index.html 200
```
File ini menginstruksikan edge worker Cloudflare Pages untuk selalu menyajikan file `index.html` dengan kode status HTTP 200 untuk seluruh request path yang tidak cocok dengan aset statis.

---

## 3. Konfigurasi Variabel Lingkungan (Environment Variables)

Aplikasi membutuhkan konfigurasi Firebase yang disuplai melalui environment variables berawalan `VITE_`.

### A. Berkas `.env.example` (Lokal)
Simpan file `.env.example` di root proyek:
```bash
VITE_FIREBASE_API_KEY=AIzaSy...
VITE_FIREBASE_AUTH_DOMAIN=simfoni-paud.firebaseapp.com
VITE_FIREBASE_PROJECT_ID=simfoni-paud
VITE_FIREBASE_STORAGE_BUCKET=simfoni-paud.appspot.com
VITE_FIREBASE_MESSAGING_SENDER_ID=123456789012
VITE_FIREBASE_APP_ID=1:123456789012:web:abcdef...
```

Untuk pengembangan lokal, salin file tersebut menjadi `.env` dan isi dengan nilai API Key asli dari Firebase Project TK DWP 8:
```powershell
cp .env.example .env
```
*(Catatan: File `.env` wajib dimasukkan ke dalam `.gitignore` agar kredensial tidak bocor ke repositori git).*

### B. Konfigurasi di Dashboard Cloudflare Pages
1. Buka dashboard Cloudflare: **Workers & Pages** > Pilih proyek aplikasi.
2. Masuk ke tab **Settings** > **Environment variables**.
3. Tambahkan seluruh pasangan kunci dan nilai dari berkas `.env` untuk environment **Production** dan **Preview**.

---

## 4. Konfigurasi Build di Cloudflare Pages

Saat menghubungkan repositori Git (GitHub/GitLab) ke Cloudflare Pages, atur pengaturan build sebagai berikut:

| Parameter Pengaturan | Nilai Konfigurasi |
| :--- | :--- |
| **Framework Preset** | `Vite` |
| **Build Command** | `npm run build` |
| **Build Output Directory** | `dist` |
| **Root Directory** | `/` (atau direktori root proyek Anda) |
| **Node.js Version** | `18` atau `20` (diset via environment variable `NODE_VERSION=20`) |

---

## 5. Konfigurasi Wajib di Firebase Console

Setelah aplikasi berhasil ter-deploy dan memiliki URL publik di Cloudflare Pages, lakukan langkah integrasi berikut:

### 5.1. Tambahkan Authorized Domains (Firebase Authentication)
1. Buka **Firebase Console** -> Masuk ke proyek Anda.
2. Navigasi ke menu **Authentication** -> Tab **Settings** -> **Authorized domains**.
3. Klik **Add domain**.
4. Masukkan domain Cloudflare Anda, contoh: `simfoni-paud.pages.dev` (dan custom domain sekolah jika ada).
> [!IMPORTANT]
> Jika domain Cloudflare tidak ditambahkan ke daftar *Authorized Domains*, proses login dan pendaftaran pengguna baru via Firebase Auth akan diblokir dengan pesan galat `auth/unauthorized-domain`.

### 5.2. Deploy Aturan Keamanan (Firestore & Storage Rules)
Gunakan Firebase CLI dari komputer lokal untuk menerapkan berkas aturan keamanan yang telah dibuat:
```powershell
# Login ke Firebase CLI jika belum
firebase login

# Inisialisasi target proyek
firebase use <project-id-anda>

# Terapkan firestore.rules dan storage.rules
firebase deploy --only firestore:rules,storage
```

---

## 6. Verifikasi Fitur PWA (Progressive Web App)

Pastikan file `public/manifest.json` telah terdaftar di `<head>` file `index.html`:
```html
<link rel="manifest" href="/manifest.json" />
<meta name="theme-color" content="#2563eb" />
```

Uji kesiapan PWA di HP:
* **Android (Chrome):** Buka link aplikasi, tunggu pop-up bar bawah *"Tambahkan SIMFONI PAUD ke Layar Utama"*, atau klik menu titik tiga -> **Tambahkan ke Layar Utama**.
* **iOS (Safari):** Buka link aplikasi, klik ikon *Share* (kotak panah ke atas) -> pilih **Add to Home Screen**.


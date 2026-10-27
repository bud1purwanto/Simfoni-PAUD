# 🚀 Panduan Deployment: Cloudflare Pages & Firebase CI/CD Pipeline

Dokumen ini memuat panduan lengkap untuk melakukan konfigurasi pipeline CI/CD, deployment multi-environment (**DEV vs PROD**), dan pengaturan variabel lingkungan **SIMFONI PAUD (SaaS Edition)** menggunakan **Cloudflare Pages** dan dua proyek **Firebase**.

---

## 1. Arsitektur Dual Environment (DEV & PROD)

Untuk mencegah uji coba fitur baru merusak data sekolah aktif, platform menggunakan dua konfigurasi terpisah:

```mermaid
flowchart LR
    DevGit["Git Branch: dev"] -->|Push / PR| CF_Prev["Cloudflare Preview<br/>dev.simfoni-paud.pages.dev"]
    CF_Prev -->|API Calls| FB_Dev[("Firebase DEV Project<br/>simfoni-paud-dev")]

    MainGit["Git Branch: main"] -->|Merge Release| CF_Prod["Cloudflare Production<br/>simfoni-paud.pages.dev"]
    CF_Prod -->|API Calls| FB_Prod[("Firebase PROD Project<br/>simfoni-paud-prod")]
```

| Komponen | Environment DEVELOPMENT 🟡 | Environment PRODUCTION 🟢 |
| :--- | :--- | :--- |
| **Branch Git** | `dev` | `main` |
| **Proyek Firebase** | `simfoni-paud-dev` | `simfoni-paud-prod` |
| **Cloudflare Environment** | Preview Deployments | Production Deployment |
| **URL Akses** | `https://dev.simfoni-paud.pages.dev` | `https://simfoni-paud.pages.dev` |
| **Peruntukan** | Uji coba fitur baru, QA, dan eksperimen | Sekolah mitra aktif (TK DWP 8, dll.) |

---

## 2. Pengaturan Variabel Lingkungan (Environment Variables)

### 2.1. Berkas `.env.example`
File ini tersimpan di Git sebagai cetak biru struktur variabel yang dibutuhkan:
```env
VITE_APP_ENV=development
VITE_FIREBASE_API_KEY=your_api_key
VITE_FIREBASE_AUTH_DOMAIN=your_project.firebaseapp.com
VITE_FIREBASE_PROJECT_ID=your_project_id
VITE_FIREBASE_STORAGE_BUCKET=your_project.appspot.com
VITE_FIREBASE_MESSAGING_SENDER_ID=your_sender_id
VITE_FIREBASE_APP_ID=your_app_id
```

### 2.2. Pengembangan Lokal (Laptop)
Buat file `.env.local` pada direktori root proyek dan isi dengan kredensial dari proyek Firebase **`simfoni-paud-dev`**.  
File ini otomatis diabaikan oleh Git via `.gitignore`.

### 2.3. Pengaturan di Cloudflare Pages Dashboard
1. Buka dashboard Cloudflare: **Workers & Pages** -> Pilih proyek `simfoni-paud`.
2. Masuk ke **Settings** -> **Environment variables**.
3. Masukkan variabel untuk masing-masing tab:
   * **Tab Production (Branch `main`):**
     * `VITE_APP_ENV` = `production`
     * `VITE_FIREBASE_API_KEY` = *(API Key `simfoni-paud-prod`)*
     * `VITE_FIREBASE_PROJECT_ID` = `simfoni-paud-prod`
     * *(dan parameter Firebase PROD lainnya)*
   * **Tab Preview (Branch `dev`):**
     * `VITE_APP_ENV` = `development`
     * `VITE_FIREBASE_API_KEY` = *(API Key `simfoni-paud-dev`)*
     * `VITE_FIREBASE_PROJECT_ID` = `simfoni-paud-dev`
     * *(dan parameter Firebase DEV lainnya)*

---

## 3. Pengaturan Build & Branch di Cloudflare Pages

Atur konfigurasi build pada menu **Settings -> Builds & deployments**:

| Parameter | Nilai Konfigurasi |
| :--- | :--- |
| **Framework Preset** | `Vite` |
| **Build Command** | `npm run build` |
| **Build Output Directory** | `dist` |
| **Production Branch** | `main` |
| **Preview Branches** | Pilih *All non-production branches* atau spesifik branch `dev` |
| **Node.js Version** | `20` (diset via variabel `NODE_VERSION=20`) |

### Penanganan Deployment Cloudflare (Workers with Static Assets):
Proyek menggunakan Cloudflare Workers with Static Assets yang dikonfigurasi via [`wrangler.jsonc`](wrangler.jsonc):
* **Build Command (Dashboard):** `npm run build`
* **Deploy Command (Dashboard):** `npx wrangler deploy`
* **Routing SPA Tanpa 404:** Ditangani secara bawaan oleh konfigurasi `"not_found_handling": "single-page-application"` di `wrangler.jsonc`. 
  > [!NOTE]
  > File `_redirects` dengan isi `/* /index.html 200` tidak digunakan pada Cloudflare Workers Assets karena memicu error validasi *infinite loop* (Error Code `100324`). SPA routing ditangani 100% oleh Wrangler.

---

## 4. Konfigurasi Wajib di Firebase Console

### 4.1. Authorized Domains (Firebase Authentication)
Wajib mendaftarkan domain Cloudflare di masing-masing project Firebase agar proses autentikasi tidak ditolak:
* **Pada `simfoni-paud-dev`:**
  * Tambahkan `localhost`
  * Tambahkan `dev.simfoni-paud.pages.dev`
* **Pada `simfoni-paud-prod`:**
  * Tambahkan `simfoni-paud.pages.dev` (serta custom domain sekolah jika ada).

### 4.2. Penerapan Rules & Indeks
Terapkan aturan keamanan multi-tenant ke kedua proyek Firebase menggunakan Firebase CLI:
```powershell
# 1. Terapkan ke lingkungan DEV
firebase use simfoni-paud-dev
firebase deploy --only firestore:rules,storage

# 2. Terapkan ke lingkungan PROD
firebase use simfoni-paud-prod
firebase deploy --only firestore:rules,storage
```

---

## 5. Verifikasi Fitur PWA (Progressive Web App)

Pastikan file `public/manifest.json` memuat metadata aplikasi:
* Nama: `SIMFONI PAUD`
* Short Name: `SIMFONI`
* Start URL: `/`
* Display: `standalone`
* Theme Color: `#2563eb`

Uji instalasi di smartphone:
1. Akses link `https://dev.simfoni-paud.pages.dev` atau `https://simfoni-paud.pages.dev` dari Chrome Android / Safari iOS.
2. Pastikan prompt *Add to Home Screen* muncul dan aplikasi dapat dibuka dalam mode layar penuh tanpa address bar browser.

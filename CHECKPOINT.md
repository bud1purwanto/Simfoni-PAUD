# 🧭 CHECKPOINT — Fitur "Paket Langganan Dinamis & Kuota Murid" (BELUM SELESAI)

> **Untuk AI Agent / LLM berikutnya.** Baca file ini, lalu `AGENTS.md`, sebelum menyentuh kode.
> Hapus file ini setelah seluruh daftar "Sisa Pekerjaan" selesai dan dokumentasi tersinkron.

* **Tanggal checkpoint:** 2026-11-06
* **Branch saat ini:** `main` (lokal). `main` == `dev` == `ea861d7` sebelum pekerjaan ini dimulai.
* **Status git:** semua perubahan di bawah **BELUM di-commit**. Patuhi aturan AGENTS.md: commit/push hanya atas instruksi eksplisit pengguna.
  Pengguna sempat meminta: *"selesaikan 1 step dulu lalu push ke branch sendiri"* → artinya commit ke **branch baru** (mis. `feat/paket-dinamis`), **bukan** `main`, setelah langkah wajib selesai & teruji.
* **Build:** `npm run build` ✅ lulus setelah perubahan rules terakhir. Lint & uji rules **belum** dijalankan ulang (alat uji di scratchpad terhapus).

---

## 1. Tujuan

Menyelaraskan aplikasi dengan tabel paket di landing page:

| | Uji Coba | Rintisan | Sahabat PAUD | Mandiri Plus |
| :--- | :---: | :---: | :---: | :---: |
| Harga /bln (tahunan) | Gratis 14 hari | Rp 99.000 (990.000) | Rp 175.000 (1.750.000) | Rp 299.000 (2.990.000) |
| Kuota guru / murid | 3 / 25 | 3 / 25 | 6 / 60 | 12 / tanpa batas |
| Presensi, anti-trap, jurnal + suara + foto, WA, data & presensi murid, PDF ber-kop | ✅ | ✅ | ✅ | ✅ |
| RPPH / Modul Ajar, Capaian Anak (asesmen), Supervisi guru | ❌ | ❌ | ✅ | ✅ |
| Stempel digital di PDF | ❌ (kop tanpa stempel) | ❌ (kop tanpa stempel) | ✅ | ✅ |
| Excel rekap & honor | ❌ | ❌ | ✅ | ✅ |
| PDF Portofolio BAN-PDM, Setujui Jurnal Sekaligus | ❌ | ❌ | ✅ | ✅ |

**Keputusan pengguna (sudah final):**
1. Uji coba = fitur setara **Rintisan**.
2. Rintisan "Format Standar" = PDF **tetap ber-kop, tanpa stempel**.
3. Portofolio BAN-PDM & bulk approval → mulai Sahabat PAUD (default; bisa diubah admin).
4. **Paket harus bisa diubah dinamis oleh Superadmin** (nama, harga, kuota, fitur) → disimpan di Firestore koleksi `plans`, bukan hardcode.
5. Nilai lama `paket_langganan` dipetakan tanpa migrasi data: `basic → sahabat`, `pro → mandiri`, `trial → trial`.

---

## 2. Sudah Dikerjakan (uncommitted)

| File | Isi perubahan |
| :--- | :--- |
| `src/utils/planConfig.js` **(baru)** | `PLAN_FEATURES` (fitur `core` selalu aktif + fitur opsional: `rpph`, `asesmen`, `supervisi`, `stempel_pdf`, `excel`, `portofolio`, `bulk_approval`), `DEFAULT_PLANS` (trial, rintisan, sahabat, mandiri), `LEGACY_PLAN_MAP`, `resolvePlanId`, `getPlan`, `planHasFeature`, `cheapestPlanWithFeature`, `formatRupiah`, `formatKuota`. `kuota_murid: null` = tanpa batas. |
| `src/context/AuthContext.jsx` | Listener realtime `plans/{planId}` milik sekolah → expose `plan` & `hasFeature(key)` (superadmin selalu `true`). |
| `src/components/layout/FeatureGate.jsx` **(baru)** | `FeatureGate` (pembungkus rute → layar "fitur belum aktif") & `FeatureLockedCard` (kartu terkunci di dalam halaman). Tanpa `window.alert`. |
| `src/App.jsx` | Rute RPPH/asesmen/supervisi (guru & kepsek) dibungkus `FeatureGate`; rute baru `/superadmin/paket` → `KelolaPaket`. |
| `src/components/layout/AppLayout.jsx` | Menu ber-`feature` diberi ikon gembok; bottom-nav HP melewati menu terkunci & mengisi slot dengan menu desktop-only yang tersedia; label paket di sidebar; banner trial memakai `plan.is_trial`; menu Superadmin "Paket Langganan". |
| `src/pages/superadmin/KelolaPaket.jsx` **(baru)** | CRUD paket (nama, deskripsi, harga bulanan/tahunan, kuota guru/murid + "tanpa batas", trial & durasi, urutan, aktif, checklist fitur), tombol "Muat Paket Bawaan" bila koleksi kosong, tawaran menerapkan kuota baru ke sekolah pemakai paket (`ModalKonfirmasi`), hapus paket non-bawaan yang tidak dipakai. |
| `src/pages/superadmin/KelolaSekolah.jsx` | Dropdown paket dari koleksi `plans`; memilih paket mengisi `kuota_guru`, `kuota_murid` (& masa berlaku untuk trial); input kuota murid (kosong = tanpa batas); kartu sekolah menampilkan nama paket & `jumlah_murid_aktif / kuota_murid`. |
| `src/pages/superadmin/DashboardSuperadmin.jsx` | Nama paket via `getPlan()`. |
| `src/pages/kepsek/RekapDanPdf.jsx` | Excel → `hasFeature('excel')`, Portofolio → `hasFeature('portofolio')`, stempel dihapus dari data PDF bila `!hasFeature('stempel_pdf')`. |
| `src/pages/kepsek/ValidasiLaporan.jsx` | Bulk approval → `hasFeature('bulk_approval')`. |
| `src/utils/studentWrites.js` **(baru)** | `saveStudent` / `deleteStudent`: tulis murid + counter `schools.jumlah_murid_aktif` (`increment(±1)`, `murid_counter_ref`) dalam satu `writeBatch`, dibungkus `commitWrite`. Status murid `lulus`/`mutasi` tidak memakan kuota. |
| `src/pages/guru/KelolaSiswaGuru.jsx` | Memakai `saveStudent`/`deleteStudent`; cek kuota di UI sebelum tambah/aktifkan murid; tampil "Kuota murid aktif x / y". |
| `src/utils/quotaSync.js` | Hanya **menginisialisasi** counter `jumlah_guru_aktif` & `jumlah_murid_aktif` untuk sekolah yang belum punya (tidak menimpa counter yang sudah ada — menimpa berisiko race antar listener). |
| `firestore.rules` | Helper `studentDocPath`, `muridDelta`, `muridCounterUpdatedFor`; cabang update `schools` untuk counter murid (±1, ≤ `kuota_murid`, null = tanpa batas); `match /plans` (baca: login, tulis: superadmin); `match /students` eksplisit dengan penegakan kuota; `plans` & `students` ditambahkan ke daftar `isCoreCollection()` aturan wildcard. |

---

## 3. Status Sisa Pekerjaan (Pembaruan Terkini)

### WAJIB sebelum commit
1. [x] **Inisialisasi counter murid untuk sekolah baru & seeder**:
   * `src/pages/superadmin/KelolaSekolah.jsx`: `payload.jumlah_murid_aktif = 0;` telah ditambahkan.
   * `src/context/AuthContext.jsx` (seeder `runInitialSaaSSeeder`): telah ditambahkan `jumlah_murid_aktif: 0`, `kuota_murid: 60`, `paket_langganan: 'sahabat'`, `kuota_guru: 6`.
2. [x] **Lint & Pembersihan Import**: Import yang tidak terpakai di `KelolaSiswaGuru.jsx` (`addDoc`, `updateDoc`, `deleteDoc`, `doc`) telah dibersihkan. Seluruh import di `KelolaSekolah.jsx` telah divalidasi.
3. [ ] **Uji Security Rules di Firebase Emulator** (opsional/siap diuji).
4. [x] **`npm run build`** lulus sempurna (3.77s, 0 error).
5. [x] **Branch baru disiapkan**: `feat/paket-dinamis` (commit & push menunggu instruksi eksplisit pengguna).

### Kepatuhan Aturan & Standar Proyek
6. [x] **Sinkronisasi dokumentasi**:
   * `docs/database-schema.md`: koleksi `plans`, field `kuota_murid`, `jumlah_murid_aktif`, `murid_counter_ref`.
   * `docs/security-rules.md`: matriks RBAC paket & kuota murid, sinkronisasi aturan rules.
   * `docs/features-and-workflow.md`: uraian 4 paket landing page & fitur kelola paket.
   * `docs/architecture.md`: `planConfig.js`, `FeatureGate.jsx`, `studentWrites.js`, `KelolaPaket.jsx`.
   * `docs/deployment.md`: panduan inisialisasi paket & counter pasca-deploy.
7. [x] **Aturan AGENTS.md #13 (Larangan `window.alert/confirm`) — 100% TUNTAS**:
   * `KelolaJadwal.jsx`: Peringatan bentrok jadwal & konfirmasi hapus jadwal diganti `ModalKonfirmasi`.
   * `LaporanLainGuru.jsx`: Notifikasi `queued` diganti banner notifikasi responsif (tanpa alert).
   * `JurnalGuru.jsx`: Hapus draf jurnal diganti `ModalKonfirmasi`.
   * `KelolaAkunKepsek.jsx`: Peringatan kepsek ganda diganti `ModalKonfirmasi`.
   * `ManajemenLog.jsx`: Konfirmasi eksekusi purge audit log diganti `ModalKonfirmasi`.
   * `ValidasiLaporan.jsx`: Alert gagal tanggapan diganti banner notifikasi error.
8. [ ] **Langkah Lanjutan Berikutnya (Permintaan Pengguna)**:
   * Dukungan PWA 100% semua jenis HP (PNG icons 192/512 maskable, Apple touch icon, iOS standalone meta).
   * Tombol / Banner Download PWA interaktif di browser.
   * Overkill Dashboard Superadmin (Master data guru nasional, live log feed, rekapitulasi kehadiran serentak).

---

## 4. Catatan Teknis Penting

* **Pola kuota (guru & murid):** data + counter sekolah ditulis dalam **satu batch**; rules memeriksa selisih status via `get()`/`getAfter()`. Jangan pernah `updateDoc` status murid/guru secara langsung — pakai helper (`studentWrites.js`, `toggleStatusGuruByKepsek`, `createGuruAccountByKepsek`).
* Sekolah yang counter-nya belum ada akan **ditolak** saat menambah guru/murid sampai `quotaSync` (dipicu Superadmin membuka Dashboard / Kelola Sekolah) menginisialisasinya.
* `hasFeature` selalu `true` untuk superadmin; fitur `core` selalu `true` untuk semua paket.
* Mengubah fitur paket di `/superadmin/paket` langsung berlaku realtime bagi sekolah pemakai; perubahan kuota hanya diterapkan ke sekolah bila Superadmin menyetujui modal "Terapkan Kuota Baru".
* Jika koleksi `plans` kosong, aplikasi memakai `DEFAULT_PLANS` (fallback), jadi tidak ada fitur yang tiba-tiba hilang sebelum paket dimuat.

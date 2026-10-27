# 🎨 Panduan Desain Antarmuka Human-Centered & Standar Estetika PAUD (Anti-AI Slop)

Dokumen ini merupakan **Spesifikasi Acuan Visual & Pedoman UI/UX Resmi** untuk aplikasi **SIMFONI PAUD**.  
Seluruh AI Agent dan pengembang wajib menggunakan panduan ini dan file mockup interaktif sebagai standar baku saat merancang, memperbarui, atau menambahkan antarmuka komponen.

---

## 📌 1. File Acuan Visual (Interactive Benchmark Mockup)

Sistem telah menyediakan prototipe interaktif mandiri yang dapat dibuka dan diuji secara visual:

* 📄 **File Dokumen Proyek:** [`docs/mockup-ui-paud-guru.html`](mockup-ui-paud-guru.html)
* 🌐 **Preview Browser (Dev Server):** [`public/mockup-ui-paud-guru.html`](../public/mockup-ui-paud-guru.html) (bisa dibuka via `http://localhost:3000/mockup-ui-paud-guru.html`)
* 📱 **Mode Tampilan Tersedia:**
  * **Tampilan Smartphone Guru (`< 768px`)**: Shell HP mobile dengan kartu empuk dan Bottom Navigation berbentuk *floating pill*.
  * **Tampilan Layar Lebar (`>= 768px`)**: Tata letak grid responsif untuk tablet dan laptop.

---

## 🌿 2. Filosofi Human-Centered: Menolak "AI Slop Korporat"

Guru TK dan PAUD bekerja di lingkungan fisik yang sangat aktif: membimbing anak-anak, mendampingi bermain di sentra, dan sering kali hanya memiliki waktu beberapa detik untuk mencatat presensi atau mendokumentasikan kegiatan belajar menggunakan smartphone di satu tangan.

### ❌ Ciri-Ciri Desain "AI Slop Umum" yang DILARANG:
1. **Warna Dingin Korporat Kaku:** Dominasi biru tua, abu-abu semen, atau gradien ungu gelap khas dashboard perbankan / analitik kripto.
2. **Tombol Kotak Tajam & Keras:** Tombol persegi dengan sudut 90 derajat atau radius kecil (4px) yang terasa kaku dan formal.
3. **Target Sentuh Jempol yang Terlalu Kecil:** Input atau tombol berukuran kecil (< 36px) yang rawan salah tekan saat guru bergerak aktif.
4. **Micro-copy Dingin & Teknis:** Pesan konfirmasi yang tidak empatik seperti *"Record updated successfully with status code 200"*.

### ✨ Standar "Desain Ramah Guru PAUD" yang WAJIB DITERAPKAN:
1. **Palet Organik & Menenangkan:** Perpaduan warna madu cerah (*Warm Honey*), jingga terakota hangat (*Terracotta*), dan hijau daun sage (*Sage Green*) yang mencerminkan suasana taman bermain anak.
2. **Kartu Empuk Membulat (*Puffy Soft Cards*):** Radius sudut besar (`rounded-3xl` / `rounded-[28px]`) dengan border pastel halus (`border-orange-200/60`, `border-amber-200/70`) dan bayangan hangat (*warm shadow*).
3. **Ergonomi Ramah Jempol (*Thumb-Zone First*):** Tombol aksi utama berukuran minimal 44-48px dengan umpan balik sentuh (*active scale* `active:scale-95`).
4. **Apresiasi Visual & Emosional:** Menggunakan kartu "Stempel Ceria" untuk jam datang, badge capaian warna-warni, serta sapaan ramah personal (*"Semangat Pagi, Bu Siti! 🌸"*).

---

## 🔤 3. Sistem Tipografi (Font Pairing)

Aplikasi menggunakan dua keluarga font Google Fonts yang telah dikonfigurasi di `index.html` dan Tailwind CSS:

| Kategori | Font Family | Kelas CSS | Kegunaan Utama |
| :--- | :--- | :--- | :--- |
| **Brand / Display / Heading** | `Nunito`, sans-serif | `font-brand` (Weight: 700 - 900) | Judul kartu, angka metrik besar, judul header, nama sekolah, tombol utama. Memberikan kesan ramah, bersahabat, dan ceria. |
| **Body / Konten / Formulir** | `Plus Jakarta Sans`, sans-serif | Standar / `font-sans` (Weight: 400 - 600) | Teks paragraf, label input formulir, catatan refleksi, tabel administrasi. Memberikan keterbacaan (*legibility*) maksimal di layar kecil. |

---

## 🎨 4. Palet Warna Resmi (Color Palette Tokens)

```
   Warm Honey Amber        Terracotta Orange        Sage Fresh Green         Soft Warm Canvas
┌────────────────────┐  ┌────────────────────┐  ┌────────────────────┐  ┌────────────────────┐
│      #F59E0B       │  │      #F97316       │  │      #10B981       │  │    #FFFBEB (40%)   │
│  amber-500/amber-50│  │ orange-500/orange-50│ │ emerald-500/emerald│ │     amber-50/40    │
└────────────────────┘  └────────────────────┘  └────────────────────┘  └────────────────────┘
```

1. **Warna Latar Belakang Global (*Canvas Background*):**  
   `bg-amber-50/30` hingga `bg-amber-50/50`. Menghindari latar putih murni `#ffffff` yang menyilaukan mata saat dipakai di luar ruangan (halaman sekolah).
2. **Aksen Utama (*Primary Accents*):**  
   Gradien `from-amber-500 via-orange-500 to-amber-600` untuk banner sambutan dan tombol aksi penting.
3. **Aksen Keberhasilan & Presensi (*Success / Presence*):**  
   `emerald-500` / `teal-600` dengan latar `emerald-50/80` dan border `emerald-200`. Melambangkan kehadiran segar dan tepat waktu.
4. **Aksen Kurikulum Merdeka & Portofolio:**  
   `indigo-500` / `purple-600` dengan latar pastel `indigo-50/60` untuk modul KBM, buku sentra, dan Capaian Pembelajaran.
5. **Warna Teks & Hirarki:**  
   * Judul / Utama: `text-slate-900` / `text-slate-800`
   * Penjelasan / Label: `text-slate-600` / `text-slate-500`
   * Muted / Timestamp: `text-slate-400` / `text-[10px]`

---

## 📱 5. Standar Komponen & Tata Letak

### 5.1. Navigasi Melayang (*Floating Bottom Nav Pill*)
Pada perangkat smartphone (`< 768px`), navigasi bawah dilarang menempel kaku di dasar layar tanpa jarak:
* Dibangun berupa kapsul melayang (*floating pill*) dengan margin `bottom-2 left-4 right-4`.
* Background semi-transparan `bg-white/95 backdrop-blur-md` dengan border `border-slate-200/80` dan bayangan lembut `shadow-2xl`.
* 5 ikon navigasi inti dengan label ramah: `Beranda`, `Presensi`, `Jurnal`, `Jadwal`, `Laporan`.

### 5.2. Kartu Presensi "Stempel Ceria"
* Menampilkan dua kotak berdampingan: **Jam Datang** (hijau segar) dan **Jam Pulang** (kuning madu/menunggu).
* Lencana stempel digital (*flower badge* 🌸) untuk menandai kehadiran tepat waktu.
* Tombol aksi besar ramah jempol dengan bayangan empuk: `shadow-emerald-500/25` dan `active:scale-98`.

### 5.3. Kartu Jurnal KBM Kurikulum Merdeka
* Chip indikator rombongan belajar (TK A, TK B, Kelompok Bermain) dengan warna pastel.
* Tagging Capaian Pembelajaran berupa badge bulat kecil (misal: *Literasi & STEAM*, *Jati Diri*, *Nilai Agama*).
* Tombol cepat aksi lapangan:
  * 🎙️ **Dikte Suara (`id-ID`)** — Latar `bg-amber-500/10 text-amber-800 border-amber-300`
  * 📸 **Foto HP (< 300 KB)** — Latar `bg-indigo-500/10 text-indigo-800 border-indigo-200`

---

## 📐 6. Checklist Verifikasi Desain untuk Pengembang & AI Agent

Sebelum menyelesaikan pembuatan layar atau komponen baru, pastikan telah memenuhi checklist ini:

- [ ] Menggunakan font `Nunito` (`font-brand`) untuk judul/heading dan `Plus Jakarta Sans` untuk body text.
- [ ] Sudut komponen menggunakan `rounded-2xl` atau `rounded-3xl` (tidak ada kotak siku 90 derajat).
- [ ] Tombol aksi sentuh jempol berukuran minimal 44px tinggi dengan jarak antar tombol yang lega.
- [ ] Border menggunakan warna pastel lembut (`border-slate-200/80`, `border-orange-200/60`, `border-amber-200/70`).
- [ ] Bayangan menggunakan warm/soft shadow (`shadow-sm`, `shadow-orange-500/20`, bukan bayangan hitam pekat).
- [ ] Formulir menyediakan tombol aksi cepat (seperti Dikte Suara atau Bank Template) untuk meminimalkan beban ketik manual guru.
- [ ] Tampilan teruji rapi pada layar selebar 360px - 414px (smartphone standar guru).
- [ ] Desain selaras dengan prototipe acuan di [`docs/mockup-ui-paud-guru.html`](mockup-ui-paud-guru.html).


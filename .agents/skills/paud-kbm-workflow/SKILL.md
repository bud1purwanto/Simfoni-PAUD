---
name: paud-kbm-workflow
description: >-
  Prosedur dan panduan domain PAUD, integrasi Kurikulum Merdeka, Voice-to-Text id-ID,
  kompresi foto kamera HP, dan penanganan presensi Dual Timestamp di SIMFONI PAUD.
  Gunakan skill ini saat mengembangkan atau memperbaiki modul Guru dan Kepala Sekolah terkait KBM dan presensi.
---

# PAUD KBM & Mobile UX Workflow (SIMFONI PAUD)

Panduan standar untuk memastikan aplikasi dirancang secara ramah, ringan, dan sesuai dengan kebutuhan operasional guru PAUD/TK di lapangan.

## 1. Presensi Dual Timestamp (Anti-Trap Offline)

Untuk mencegah guru dirugikan akibat koneksi internet drop saat absen di pagi hari:

1. Catat `jam_datang_device` (waktu lokal HP saat tombol ditekan) dalam format ISO string.
2. Catat `jam_datang_server` menggunakan `serverTimestamp()`.
3. Hitung status keterlambatan berdasarkan `jam_datang_device` jika selisih waktu sinkronisasi signifikan:
   ```javascript
   const deviceTime = new Date().toISOString();
   // Atribut presensi:
   {
     school_id: currentUser.school_id,
     user_id: currentUser.uid,
     tanggal: format(new Date(), 'yyyy-MM-dd'),
     jam_datang_device: deviceTime,
     jam_datang_server: serverTimestamp(),
     status: 'hadir',
     // ...
   }
   ```
4. **Deteksi Lupa Absen Pulang:** Jika waktu sistem > 18:00 dan belum ada `jam_pulang`, tampilkan instruksi dan form pengajuan koreksi absen keesokan harinya.

## 2. Integrasi Kurikulum Merdeka PAUD

Struktur jurnal KBM wajib mendukung 3 elemen Capaian Pembelajaran Kurikulum Merdeka:
* **Nilai Agama & Budi Pekerti**
* **Jati Diri**
* **Dasar-dasar Literasi, Matematika, Sains, Teknologi, Rekayasa, dan Seni (STEAM)**

Gunakan template bank KBM (`src/utils/kbmTemplates.js`) untuk mempercepat pengisian kegiatan harian (Upacara & Pembiasaan Pagi, Motorik Kasar & Senam, Sentra Sains, Sentra Seni & Kreativitas, Literasi Awal).

## 3. Kompresi Foto Kamera Klien (< 300 KB)

Foto dokumentasi dari kamera smartphone beresolusi tinggi (3-10 MB) **wajib dikompresi di sisi klien** sebelum diunggah:

```javascript
import { uploadCompressedImage } from '../../utils/imageCompressor';

// Kompresi otomatis ke < 300 KB dengan resolusi maksimal 1280px
const { url, storagePath } = await uploadCompressedImage(
  photoFile,
  currentUser.school_id,
  currentUser.uid,
  'journals' // atau 'tasks'
);
```

## 4. Voice-to-Text (`id-ID`)

Gunakan hook `useSpeechToText` (`src/hooks/useSpeechToText.js`) untuk mendiktekan narasi kegiatan pembelajaran langsung melalui mikrofon HP guru.
* Tangani error mikrofon gracefully (misal jika browser tidak mendukung atau user menolak izin).
* Tampilkan indikator animasi mic aktif / mendengarkan yang jelas pada UI.

## 5. Berbagi ke WhatsApp (`wa.me`)

Gunakan helper `generateWhatsAppShareUrl` dari `src/utils/formatters.js` untuk membuat tautan pesan ringkasan pembelajaran harian yang siap dikirimkan ke grup orang tua murid atau paguyuban.


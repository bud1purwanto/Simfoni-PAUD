import imageCompression from 'browser-image-compression';
import { ref, uploadBytesResumable, getDownloadURL } from 'firebase/storage';
import { storage } from '../config/firebase';

/**
 * Mengubah file gambar (Logo / Stempel) menjadi Data URL Base64 yang dioptimasi (< 50 KB).
 * Memungkinkan penyimpanan langsung di dokumen Firestore 'schools' tanpa Firebase Storage,
 * sehingga bebas dari isu CORS dan tidak memerlukan setup Google Cloud sama sekali!
 * @param {File} file - Berkas gambar (PNG / JPEG)
 * @param {object} options
 * @param {number} options.maxWidth - Batas lebar maks (default: 320px)
 * @param {number} options.maxHeight - Batas tinggi maks (default: 320px)
 * @param {number} options.quality - Kualitas kompresi (0.1 - 1.0, default: 0.85)
 * @param {boolean} options.preserveTransparency - Pertahankan transparansi PNG (wajib untuk stempel)
 * @returns {Promise<string>} Base64 Data URL (data:image/...)
 */
export const fileToBase64Optimized = (
  file,
  {
    maxWidth = 320,
    maxHeight = 320,
    quality = 0.85,
    preserveTransparency = false,
  } = {}
) => {
  return new Promise((resolve, reject) => {
    if (!file || !file.type || !file.type.startsWith('image/')) {
      return reject(new Error('Berkas harus berupa file gambar valid.'));
    }

    const reader = new FileReader();
    reader.onload = (e) => {
      const img = new Image();
      img.onload = () => {
        let width = img.width;
        let height = img.height;

        if (width > height) {
          if (width > maxWidth) {
            height = Math.round((height * maxWidth) / width);
            width = maxWidth;
          }
        } else {
          if (height > maxHeight) {
            width = Math.round((width * maxHeight) / height);
            height = maxHeight;
          }
        }

        const canvas = document.createElement('canvas');
        canvas.width = Math.max(1, width);
        canvas.height = Math.max(1, height);
        const ctx = canvas.getContext('2d');

        const isPng = file.type === 'image/png' || preserveTransparency;

        if (!isPng) {
          ctx.fillStyle = '#ffffff';
          ctx.fillRect(0, 0, width, height);
          ctx.drawImage(img, 0, 0, width, height);
          const dataUrl = canvas.toDataURL('image/jpeg', quality);
          resolve(dataUrl);
        } else {
          ctx.clearRect(0, 0, width, height);
          ctx.drawImage(img, 0, 0, width, height);
          const dataUrl = canvas.toDataURL('image/png');
          resolve(dataUrl);
        }
      };
      img.onerror = (err) => reject(new Error('Gagal memproses gambar: ' + (err?.message || 'format tidak didukung')));
      img.src = e.target.result;
    };
    reader.onerror = (err) => reject(new Error('Gagal membaca berkas: ' + (err?.message || 'error')));
    reader.readAsDataURL(file);
  });
};

/**
 * Mengompresi file gambar dari HP guru menjadi < 300 KB dengan resolusi maksimal 1280px
 * @param {File} imageFile - File asli dari input file/kamera
 * @param {Function} onProgress - Callback persentase kompresi opsional
 * @returns {Promise<File>} - File hasil kompresi siap upload
 */
export const compressImage = async (imageFile, onProgress = null) => {
  // Jika file bukan gambar, lewati
  if (!imageFile.type.startsWith('image/')) {
    throw new Error('File yang dipilih bukan merupakan format gambar.');
  }

  const options = {
    maxSizeMB: 0.28,          // Target < 300 KB
    maxWidthOrHeight: 1280,   // Resolusi maksimal 1280px (tetap tajam untuk dokumen PAUD)
    useWebWorker: true,
    fileType: 'image/jpeg',
    initialQuality: 0.75,
    onProgress: (p) => {
      if (onProgress) onProgress(Math.round(p));
    },
  };

  try {
    const compressedFile = await imageCompression(imageFile, options);
    console.log(
      `Kompresi Berhasil: ${(imageFile.size / 1024 / 1024).toFixed(2)} MB -> ${(compressedFile.size / 1024).toFixed(0)} KB`
    );
    return compressedFile;
  } catch (error) {
    console.warn('Kompresi gagal, menggunakan file asli:', error);
    // File asli > 2 MB akan ditolak Storage Rules, beri pesan yang jelas
    if (imageFile.size > 2 * 1024 * 1024) {
      throw new Error('Foto tidak dapat dikompresi dan ukurannya melebihi 2 MB. Coba foto lain.');
    }
    return imageFile;
  }
};

/**
 * Upload file langsung ke Firebase Storage dengan tracking persentase progresif (0-100%)
 * @param {StorageReference} storageRef
 * @param {Blob|File} file
 * @param {Function} onProgress - Callback (progress: number)
 * @returns {Promise<{ url: string, snapshot: UploadTaskSnapshot }>}
 */
export const uploadWithProgress = (storageRef, file, onProgress = null) => {
  return new Promise((resolve, reject) => {
    const uploadTask = uploadBytesResumable(storageRef, file, {
      contentType: file.type || 'image/jpeg',
    });

    uploadTask.on(
      'state_changed',
      (snapshot) => {
        if (snapshot.totalBytes > 0) {
          const progress = Math.round((snapshot.bytesTransferred / snapshot.totalBytes) * 100);
          if (onProgress) onProgress(progress);
        }
      },
      (error) => {
        console.error('Firebase Storage upload error:', error);
        reject(error);
      },
      async () => {
        try {
          const url = await getDownloadURL(uploadTask.snapshot.ref);
          resolve({ url, snapshot: uploadTask.snapshot });
        } catch (urlErr) {
          reject(urlErr);
        }
      }
    );
  });
};

/**
 * Helper upload file branding (Logo / Stempel) dengan loading bar progresif
 * @param {File} file
 * @param {string} storagePath
 * @param {Function} onProgress - Callback (progress: number, statusText: string)
 */
export const uploadFileWithProgress = async (file, storagePath, onProgress = null) => {
  if (onProgress) onProgress(5, 'Mempersiapkan berkas...');
  const storageRef = ref(storage, storagePath);
  const { url } = await uploadWithProgress(storageRef, file, (pct) => {
    if (onProgress) onProgress(pct, `Mengunggah (${pct}%)...`);
  });
  if (onProgress) onProgress(100, 'Unggahan selesai!');
  return { url, storagePath };
};

/**
 * Helper untuk mengompresi gambar dan mengunggahnya ke Firebase Storage dengan indikator progresif
 * Format path: schools/{schoolId}/journals/{userId}/{timestamp}_{cleanFileName}
 * @param {File} file 
 * @param {string} schoolId 
 * @param {string} userId 
 * @param {string} folderPrefix ('journals' | 'tasks' | 'logos' | 'stempel')
 * @param {Function} onProgress - Callback (progress: number, statusText: string)
 * @returns {Promise<{ url: string, storagePath: string, sizeKb: number }>}
 */
export const uploadCompressedImage = async (
  file,
  schoolId,
  userId,
  folderPrefix = 'journals',
  onProgress = null
) => {
  if (onProgress) onProgress(10, 'Mengompresi foto < 300 KB...');

  const compressed = await compressImage(file, (compressPct) => {
    // 0 - 30% adalah tahap kompresi di browser
    const mapped = Math.round((compressPct / 100) * 30);
    if (onProgress) onProgress(mapped, `Mengompresi foto (${compressPct}%)...`);
  });

  if (onProgress) onProgress(35, 'Memulai unggahan ke cloud...');

  // Hasil kompresi selalu JPEG, jadi ekstensi disesuaikan (mis. foto HEIC iPhone)
  const baseName = file.name.replace(/\.[^.]+$/, '').replace(/[^a-zA-Z0-9]/g, '_').slice(0, 40) || 'foto';
  const cleanFileName = `${baseName}.jpg`;
  const timestamp = Date.now();
  const storagePath = `schools/${schoolId}/${folderPrefix}/${userId}/${timestamp}_${cleanFileName}`;

  const storageRef = ref(storage, storagePath);

  const { url } = await uploadWithProgress(storageRef, compressed, (storagePct) => {
    // 35% - 95% adalah tahap upload ke Firebase Storage
    const totalPct = Math.min(95, Math.round(35 + (storagePct * 0.6)));
    if (onProgress) onProgress(totalPct, `Mengunggah (${storagePct}%)...`);
  });

  if (onProgress) onProgress(100, 'Foto berhasil diunggah!');
  return { url, storagePath, sizeKb: Math.max(1, Math.round(compressed.size / 1024)) };
};


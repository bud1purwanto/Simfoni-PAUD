import imageCompression from 'browser-image-compression';
import { ref, uploadBytes, getDownloadURL } from 'firebase/storage';
import { storage } from '../config/firebase';

/**
 * Mengompresi file gambar dari HP guru menjadi < 300 KB dengan resolusi maksimal 1280px
 * @param {File} imageFile - File asli dari input file/kamera
 * @returns {Promise<File>} - File hasil kompresi siap upload
 */
export const compressImage = async (imageFile) => {
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
 * Helper untuk mengompresi gambar dan mengunggahnya ke Firebase Storage
 * Format path: schools/{schoolId}/journals/{userId}/{timestamp}_{cleanFileName}
 * @param {File} file 
 * @param {string} schoolId 
 * @param {string} userId 
 * @param {string} folderPrefix ('journals' | 'tasks' | 'logos' | 'stempel')
 * @returns {Promise<{ url: string, storagePath: string, sizeKb: number }>}
 */
export const uploadCompressedImage = async (file, schoolId, userId, folderPrefix = 'journals') => {
  const compressed = await compressImage(file);
  // Hasil kompresi selalu JPEG, jadi ekstensi disesuaikan (mis. foto HEIC iPhone)
  const baseName = file.name.replace(/\.[^.]+$/, '').replace(/[^a-zA-Z0-9]/g, '_').slice(0, 40) || 'foto';
  const cleanFileName = `${baseName}.jpg`;
  const timestamp = Date.now();
  const storagePath = `schools/${schoolId}/${folderPrefix}/${userId}/${timestamp}_${cleanFileName}`;

  const storageRef = ref(storage, storagePath);
  const snapshot = await uploadBytes(storageRef, compressed, {
    contentType: compressed.type || 'image/jpeg',
  });

  const url = await getDownloadURL(snapshot.ref);
  return { url, storagePath, sizeKb: Math.max(1, Math.round(compressed.size / 1024)) };
};


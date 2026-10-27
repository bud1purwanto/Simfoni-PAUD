/**
 * Penulisan Firestore yang ramah sinyal lemah (Anti-Trap Offline).
 *
 * Dengan offline persistence aktif, promise `setDoc/updateDoc` baru selesai saat server
 * mengonfirmasi. Saat HP guru offline, `await` biasa membuat tombol berputar selamanya,
 * padahal data sudah aman di antrean IndexedDB dan akan terkirim otomatis.
 *
 * Helper ini mengembalikan `{ queued: true }` bila perangkat offline atau server belum
 * menjawab dalam `timeoutMs`, sehingga UI bisa langsung memberi umpan balik
 * "tersimpan di HP, akan terkirim otomatis".
 */
export const commitWrite = (writePromise, { timeoutMs = 4000 } = {}) =>
  new Promise((resolve, reject) => {
    let settled = false;

    writePromise
      .then(() => {
        if (!settled) {
          settled = true;
          resolve({ queued: false });
        }
      })
      .catch((err) => {
        if (!settled) {
          settled = true;
          reject(err);
        } else {
          // Ditolak server setelah antrean tersinkron (mis. sesi kedaluwarsa / rules)
          console.error('Sinkronisasi data tertunda gagal:', err);
        }
      });

    if (typeof navigator !== 'undefined' && navigator.onLine === false) {
      settled = true;
      resolve({ queued: true });
      return;
    }

    setTimeout(() => {
      if (!settled) {
        settled = true;
        resolve({ queued: true });
      }
    }, timeoutMs);
  });

export const QUEUED_SUFFIX = ' (tersimpan di HP, otomatis terkirim saat sinyal kembali)';

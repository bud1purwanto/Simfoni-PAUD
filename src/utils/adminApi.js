import { sendPasswordResetEmail } from 'firebase/auth';
import { auth, markPasswordResetByAdmin } from '../config/firebase';

/**
 * Reset sandi akun bawahan ke password default (Guru1234! / Kepsek1234!) tanpa email.
 * Diproses oleh Cloudflare Worker `/api/admin/reset-password` (lihat worker/index.js)
 * karena Firebase client SDK tidak dapat mengganti sandi pengguna lain.
 *
 * Jika endpoint belum tersedia (mode `npm run dev` lokal atau secret belum diset),
 * fungsi otomatis jatuh ke alternatif: kirim tautan reset ke email + tandai wajib ganti sandi.
 *
 * @returns {Promise<{ mode: 'default' | 'email', defaultPassword?: string }>}
 */
export const resetPasswordAkun = async ({ targetUid, targetEmail }) => {
  if (!auth.currentUser) throw new Error('Sesi login tidak ditemukan. Silakan login ulang.');
  const idToken = await auth.currentUser.getIdToken();

  let res = null;
  try {
    res = await fetch('/api/admin/reset-password', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${idToken}` },
      body: JSON.stringify({ targetUid }),
    });
  } catch {
    res = null; // jaringan / endpoint tidak terjangkau
  }

  const isJson = res?.headers.get('content-type')?.includes('application/json');
  if (res && res.ok && isJson) {
    const data = await res.json();
    return { mode: 'default', defaultPassword: data.defaultPassword };
  }

  // 401/403/400 = ditolak oleh server: tampilkan alasannya, jangan diam-diam fallback.
  if (res && isJson && [400, 401, 403, 404].includes(res.status)) {
    const data = await res.json().catch(() => ({}));
    throw new Error(data.error || 'Permintaan reset sandi ditolak server.');
  }

  // Fallback: endpoint belum dikonfigurasi (503) / tidak ada (dev server Vite)
  await markPasswordResetByAdmin(targetUid);
  await sendPasswordResetEmail(auth, targetEmail);
  return { mode: 'email' };
};

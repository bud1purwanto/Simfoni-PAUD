/**
 * SIMFONI PAUD - Cloudflare Worker (API Admin + Static Assets SPA)
 *
 * Endpoint:
 *   POST /api/admin/reset-password  { targetUid }
 *     Header: Authorization: Bearer <Firebase ID Token pemanggil>
 *
 * Aturan otorisasi (diverifikasi ulang di server, tidak percaya klien):
 *   - superadmin aktif  -> boleh reset akun kepsek / guru mana pun
 *   - kepsek aktif      -> hanya boleh reset akun guru di school_id yang sama
 * Sandi baru selalu ditentukan server berdasarkan peran target (Guru1234! / Kepsek1234!)
 * dan target ditandai `wajib_ganti_password: true`.
 *
 * Secrets yang wajib diset (wrangler secret put ...):
 *   FIREBASE_PROJECT_ID          -> contoh: simfoni-paud-dev
 *   FIREBASE_SERVICE_ACCOUNT     -> isi JSON service account (Firebase Admin SDK)
 */

const DEFAULT_PASSWORD = { guru: 'Guru1234!', kepsek: 'Kepsek1234!' };
const JWK_URL = 'https://www.googleapis.com/service_accounts/v1/jwk/securetoken@system.gserviceaccount.com';

export default {
  async fetch(request, env) {
    const url = new URL(request.url);

    if (url.pathname === '/api/admin/reset-password') {
      if (request.method !== 'POST') return json({ error: 'Method not allowed' }, 405);
      try {
        return await handleResetPassword(request, env);
      } catch (err) {
        const status = err.status || 500;
        if (status === 500) console.error('reset-password error:', err);
        return json({ error: err.publicMessage || 'Terjadi kesalahan pada server.' }, status);
      }
    }

    if (url.pathname.startsWith('/api/')) {
      return json({ error: 'Not found' }, 404);
    }

    return env.ASSETS.fetch(request);
  },
};

async function handleResetPassword(request, env) {
  if (!env.FIREBASE_PROJECT_ID || !env.FIREBASE_SERVICE_ACCOUNT) {
    throw httpError(503, 'Layanan reset sandi belum dikonfigurasi di server.');
  }
  const projectId = env.FIREBASE_PROJECT_ID;

  const idToken = (request.headers.get('Authorization') || '').replace(/^Bearer\s+/i, '');
  if (!idToken) throw httpError(401, 'Sesi tidak valid. Silakan login ulang.');
  const caller = await verifyFirebaseIdToken(idToken, projectId);

  let body;
  try {
    body = await request.json();
  } catch {
    throw httpError(400, 'Format permintaan tidak valid.');
  }
  const targetUid = typeof body?.targetUid === 'string' ? body.targetUid : '';
  if (!/^[A-Za-z0-9_-]{1,128}$/.test(targetUid)) throw httpError(400, 'Target akun tidak valid.');
  if (targetUid === caller.uid) throw httpError(400, 'Gunakan menu Ganti Kata Sandi untuk akun Anda sendiri.');

  const accessToken = await getServiceAccountToken(JSON.parse(env.FIREBASE_SERVICE_ACCOUNT));

  const [callerDoc, targetDoc] = await Promise.all([
    getUserDoc(projectId, accessToken, caller.uid),
    getUserDoc(projectId, accessToken, targetUid),
  ]);
  if (!callerDoc || callerDoc.status_akun !== 'aktif') throw httpError(403, 'Akun Anda tidak memiliki akses.');
  if (!targetDoc) throw httpError(404, 'Akun target tidak ditemukan.');

  const isSuperadmin = callerDoc.role === 'superadmin';
  const isKepsekOfTarget =
    callerDoc.role === 'kepsek' &&
    targetDoc.role === 'guru' &&
    callerDoc.school_id &&
    callerDoc.school_id === targetDoc.school_id;
  const targetAllowed = targetDoc.role === 'guru' || targetDoc.role === 'kepsek';

  if (!targetAllowed || !(isSuperadmin || isKepsekOfTarget)) {
    throw httpError(403, 'Anda tidak berwenang mereset sandi akun ini.');
  }

  const newPassword = DEFAULT_PASSWORD[targetDoc.role];

  await googleFetch(
    `https://identitytoolkit.googleapis.com/v1/projects/${projectId}/accounts:update`,
    accessToken,
    { method: 'POST', body: JSON.stringify({ localId: targetUid, password: newPassword }) }
  );

  const nowIso = new Date().toISOString();
  await googleFetch(
    `https://firestore.googleapis.com/v1/projects/${projectId}/databases/(default)/documents/users/${targetUid}` +
      '?updateMask.fieldPaths=wajib_ganti_password&updateMask.fieldPaths=updated_at',
    accessToken,
    {
      method: 'PATCH',
      body: JSON.stringify({
        fields: {
          wajib_ganti_password: { booleanValue: true },
          updated_at: { timestampValue: nowIso },
        },
      }),
    }
  );

  return json({ ok: true, role: targetDoc.role, defaultPassword: newPassword });
}

// ---------- Verifikasi Firebase ID Token (RS256) ----------

let jwkCache = { keys: null, expiresAt: 0 };

async function getGoogleJwks() {
  if (jwkCache.keys && Date.now() < jwkCache.expiresAt) return jwkCache.keys;
  const res = await fetch(JWK_URL);
  if (!res.ok) throw new Error('Gagal mengambil kunci publik Google');
  const maxAge = Number((res.headers.get('Cache-Control') || '').match(/max-age=(\d+)/)?.[1] || 3600);
  const { keys } = await res.json();
  jwkCache = { keys, expiresAt: Date.now() + maxAge * 1000 };
  return keys;
}

async function verifyFirebaseIdToken(token, projectId) {
  const parts = token.split('.');
  if (parts.length !== 3) throw httpError(401, 'Sesi tidak valid. Silakan login ulang.');
  const header = JSON.parse(b64urlDecodeText(parts[0]));
  const payload = JSON.parse(b64urlDecodeText(parts[1]));

  if (header.alg !== 'RS256') throw httpError(401, 'Sesi tidak valid.');
  const jwk = (await getGoogleJwks()).find((k) => k.kid === header.kid);
  if (!jwk) throw httpError(401, 'Sesi kedaluwarsa. Silakan login ulang.');

  const key = await crypto.subtle.importKey(
    'jwk',
    jwk,
    { name: 'RSASSA-PKCS1-v1_5', hash: 'SHA-256' },
    false,
    ['verify']
  );
  const valid = await crypto.subtle.verify(
    'RSASSA-PKCS1-v1_5',
    key,
    b64urlDecodeBytes(parts[2]),
    new TextEncoder().encode(`${parts[0]}.${parts[1]}`)
  );
  if (!valid) throw httpError(401, 'Sesi tidak valid.');

  const now = Math.floor(Date.now() / 1000);
  if (
    payload.aud !== projectId ||
    payload.iss !== `https://securetoken.google.com/${projectId}` ||
    !payload.sub ||
    payload.exp < now ||
    payload.iat > now + 300
  ) {
    throw httpError(401, 'Sesi kedaluwarsa. Silakan login ulang.');
  }
  return { uid: payload.sub };
}

// ---------- Service Account OAuth2 Token ----------

let saTokenCache = { token: null, expiresAt: 0 };

async function getServiceAccountToken(sa) {
  if (saTokenCache.token && Date.now() < saTokenCache.expiresAt) return saTokenCache.token;

  const now = Math.floor(Date.now() / 1000);
  const header = b64urlEncodeText(JSON.stringify({ alg: 'RS256', typ: 'JWT' }));
  const claims = b64urlEncodeText(
    JSON.stringify({
      iss: sa.client_email,
      scope: 'https://www.googleapis.com/auth/cloud-platform',
      aud: 'https://oauth2.googleapis.com/token',
      iat: now,
      exp: now + 3600,
    })
  );

  const pem = sa.private_key.replace(/-----[^-]+-----/g, '').replace(/\s+/g, '');
  const der = Uint8Array.from(atob(pem), (c) => c.charCodeAt(0));
  const key = await crypto.subtle.importKey(
    'pkcs8',
    der,
    { name: 'RSASSA-PKCS1-v1_5', hash: 'SHA-256' },
    false,
    ['sign']
  );
  const signature = await crypto.subtle.sign(
    'RSASSA-PKCS1-v1_5',
    key,
    new TextEncoder().encode(`${header}.${claims}`)
  );
  const assertion = `${header}.${claims}.${b64urlEncodeBytes(new Uint8Array(signature))}`;

  const res = await fetch('https://oauth2.googleapis.com/token', {
    method: 'POST',
    headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    body: `grant_type=${encodeURIComponent('urn:ietf:params:oauth:grant-type:jwt-bearer')}&assertion=${assertion}`,
  });
  if (!res.ok) throw new Error(`OAuth token gagal: ${res.status} ${await res.text()}`);
  const data = await res.json();
  saTokenCache = { token: data.access_token, expiresAt: Date.now() + (data.expires_in - 120) * 1000 };
  return data.access_token;
}

// ---------- Firestore REST ----------

async function getUserDoc(projectId, accessToken, uid) {
  const res = await fetch(
    `https://firestore.googleapis.com/v1/projects/${projectId}/databases/(default)/documents/users/${uid}`,
    { headers: { Authorization: `Bearer ${accessToken}` } }
  );
  if (res.status === 404) return null;
  if (!res.ok) throw new Error(`Firestore read gagal: ${res.status}`);
  const { fields = {} } = await res.json();
  const str = (f) => fields[f]?.stringValue ?? null;
  return { role: str('role'), school_id: str('school_id'), status_akun: str('status_akun') };
}

async function googleFetch(url, accessToken, init) {
  const res = await fetch(url, {
    ...init,
    headers: { Authorization: `Bearer ${accessToken}`, 'Content-Type': 'application/json' },
  });
  if (!res.ok) throw new Error(`Google API ${res.status}: ${await res.text()}`);
  return res.json();
}

// ---------- Util ----------

function httpError(status, publicMessage) {
  const err = new Error(publicMessage);
  err.status = status;
  err.publicMessage = publicMessage;
  return err;
}

function json(data, status = 200) {
  return new Response(JSON.stringify(data), {
    status,
    headers: { 'Content-Type': 'application/json', 'Cache-Control': 'no-store' },
  });
}

function b64urlDecodeBytes(str) {
  const b64 = str.replace(/-/g, '+').replace(/_/g, '/').padEnd(Math.ceil(str.length / 4) * 4, '=');
  return Uint8Array.from(atob(b64), (c) => c.charCodeAt(0));
}

function b64urlDecodeText(str) {
  return new TextDecoder().decode(b64urlDecodeBytes(str));
}

function b64urlEncodeBytes(bytes) {
  let bin = '';
  for (const b of bytes) bin += String.fromCharCode(b);
  return btoa(bin).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '');
}

function b64urlEncodeText(text) {
  return b64urlEncodeBytes(new TextEncoder().encode(text));
}

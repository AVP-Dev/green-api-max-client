/**
 * backupCrypto.ts — парольное шифрование бэкапа (WebCrypto, без зависимостей).
 * KDF: PBKDF2-SHA256, 200k итераций, соль 16 байт.
 * Шифр: AES-GCM 256, iv 12 байт.
 */

export interface EncryptedBackup {
  format: 'max-backup/enc-v1';
  salt: string; // base64
  iv: string; // base64
  iterations: number;
  data: string; // base64 (ciphertext)
}

function bufToB64(buf: ArrayBuffer | Uint8Array): string {
  const bytes = buf instanceof Uint8Array ? buf : new Uint8Array(buf);
  let s = '';
  for (let i = 0; i < bytes.length; i++) s += String.fromCharCode(bytes[i]!);
  return btoa(s);
}

function b64ToBytes(b64: string): Uint8Array {
  const s = atob(b64);
  const out = new Uint8Array(s.length);
  for (let i = 0; i < s.length; i++) out[i] = s.charCodeAt(i);
  return out;
}

async function deriveKey(password: string, salt: Uint8Array, iterations: number): Promise<CryptoKey> {
  const enc = new TextEncoder();
  const base = await crypto.subtle.importKey('raw', enc.encode(password), 'PBKDF2', false, [
    'deriveKey',
  ]);
  return crypto.subtle.deriveKey(
    { name: 'PBKDF2', salt: salt as BufferSource, iterations, hash: 'SHA-256' },
    base,
    { name: 'AES-GCM', length: 256 },
    false,
    ['encrypt', 'decrypt']
  );
}

export async function encryptBackup(plaintext: string, password: string): Promise<EncryptedBackup> {
  if (!password || password.length < 4) {
    throw new Error('Password too short (min 4 chars)');
  }
  const iterations = 200_000;
  const salt = crypto.getRandomValues(new Uint8Array(16));
  const iv = crypto.getRandomValues(new Uint8Array(12));
  const key = await deriveKey(password, salt, iterations);
  const ct = await crypto.subtle.encrypt(
    { name: 'AES-GCM', iv: iv as BufferSource },
    key,
    new TextEncoder().encode(plaintext)
  );
  return {
    format: 'max-backup/enc-v1',
    salt: bufToB64(salt),
    iv: bufToB64(iv),
    iterations,
    data: bufToB64(ct),
  };
}

export async function decryptBackup(enc: EncryptedBackup, password: string): Promise<string> {
  if (!enc || enc.format !== 'max-backup/enc-v1' || !enc.salt || !enc.iv || !enc.data) {
    throw new Error('Not an encrypted MAX backup');
  }
  const key = await deriveKey(password, b64ToBytes(enc.salt), enc.iterations || 200_000);
  try {
    const pt = await crypto.subtle.decrypt(
      { name: 'AES-GCM', iv: b64ToBytes(enc.iv) as BufferSource },
      key,
      b64ToBytes(enc.data) as BufferSource
    );
    return new TextDecoder().decode(pt);
  } catch {
    throw new Error('Wrong password or corrupted backup');
  }
}

export function isEncryptedBackup(value: unknown): value is EncryptedBackup {
  return (
    !!value &&
    typeof value === 'object' &&
    (value as EncryptedBackup).format === 'max-backup/enc-v1' &&
    typeof (value as EncryptedBackup).data === 'string'
  );
}

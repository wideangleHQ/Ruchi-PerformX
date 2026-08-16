import { createCipheriv, createDecipheriv, randomBytes } from 'node:crypto';

const ALGORITHM = 'aes-256-gcm';
const KEY_BYTES = 32;
const IV_BYTES = 12;
const AUTH_TAG_BYTES = 16;

/**
 * One encrypted secret as it is stored on `company_assets`.
 *
 * `cipher` is the ciphertext with the 16 byte GCM auth tag appended, base64
 * encoded, and goes in `secret_cipher`. `iv` is the 12 byte nonce for that one
 * record, base64 encoded, and goes in `secret_iv`.
 */
export interface SealedSecret {
  cipher: string;
  iv: string;
}

/**
 * Validate a raw `ASSET_ENCRYPTION_KEY` and return it as a 32 byte buffer.
 *
 * Throws when `raw` is missing or does not decode to exactly 32 bytes. Callers
 * pass `process.env.ASSET_ENCRYPTION_KEY` themselves: reading the environment
 * from a default parameter meant `loadAssetKey(undefined)` silently fell back
 * to the ambient value, so the test for the missing case passed on a laptop and
 * failed in CI, where `pr-checks.yaml` sets the variable job wide.
 *
 * Called in the body of `assets.module.ts` so that a bad key kills the process
 * at boot the way `JWT_SECRET` does, rather than surfacing as a 500 on the
 * first reveal.
 *
 * Generate one with `openssl rand -base64 32`.
 */
export function loadAssetKey(raw: string | undefined): Buffer {
  if (!raw) {
    throw new Error('ASSET_ENCRYPTION_KEY environment variable is required');
  }

  const key = Buffer.from(raw, 'base64');
  if (key.length !== KEY_BYTES) {
    throw new Error(
      `ASSET_ENCRYPTION_KEY must be ${KEY_BYTES} bytes, base64 encoded. It decoded to ${key.length}.`,
    );
  }

  return key;
}

/**
 * Encrypt one secret under `key` with AES-256-GCM.
 *
 * The IV is fresh per call, so encrypting the same password twice produces two
 * different ciphertexts and two different IVs. Reusing an IV under one key
 * breaks GCM outright, which is why nothing here derives the IV from the
 * record.
 *
 * Assumes `key` came from `loadAssetKey`, which is the only thing that checks
 * the length. Throws whatever `createCipheriv` throws for a malformed key.
 */
export function encryptSecret(plaintext: string, key: Buffer): SealedSecret {
  const iv = randomBytes(IV_BYTES);
  const cipher = createCipheriv(ALGORITHM, key, iv);
  const encrypted = Buffer.concat([cipher.update(plaintext, 'utf8'), cipher.final()]);

  return {
    cipher: Buffer.concat([encrypted, cipher.getAuthTag()]).toString('base64'),
    iv: iv.toString('base64'),
  };
}

/**
 * Decrypt one secret produced by `encryptSecret`.
 *
 * Throws when the key is wrong, the IV is wrong, or the ciphertext was altered.
 * GCM cannot tell those three apart: the auth tag simply fails and no plaintext
 * comes back. Callers must catch this and say so, because after a key rotation
 * the throw is otherwise indistinguishable from a bug in the server.
 */
export function decryptSecret(sealed: SealedSecret, key: Buffer): string {
  const raw = Buffer.from(sealed.cipher, 'base64');
  if (raw.length <= AUTH_TAG_BYTES) {
    throw new Error('Ciphertext is too short to carry a GCM auth tag');
  }

  const body = raw.subarray(0, raw.length - AUTH_TAG_BYTES);
  const tag = raw.subarray(raw.length - AUTH_TAG_BYTES);

  const decipher = createDecipheriv(ALGORITHM, key, Buffer.from(sealed.iv, 'base64'));
  decipher.setAuthTag(tag);

  return Buffer.concat([decipher.update(body), decipher.final()]).toString('utf8');
}

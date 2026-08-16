import { randomBytes } from 'node:crypto';
import { describe, expect, it } from 'vitest';

import { decryptSecret, encryptSecret, loadAssetKey } from './asset-crypto';

const KEY = randomBytes(32);
const OTHER_KEY = randomBytes(32);

/** Flip one bit inside the ciphertext, keeping it valid base64. */
function tamper(cipher: string): string {
  const raw = Buffer.from(cipher, 'base64');
  raw[0] = (raw[0] ?? 0) ^ 0x01;
  return raw.toString('base64');
}

describe('asset-crypto', () => {
  it('round trips a secret', () => {
    const sealed = encryptSecret('bank-portal-hunter2', KEY);
    expect(decryptSecret(sealed, KEY)).toBe('bank-portal-hunter2');
  });

  it('round trips unicode and long secrets', () => {
    const plaintext = `${'₹ पासवर्ड '.repeat(50)}end`;
    expect(decryptSecret(encryptSecret(plaintext, KEY), KEY)).toBe(plaintext);
  });

  it('throws on a tampered ciphertext rather than returning altered plaintext', () => {
    const sealed = encryptSecret('bank-portal-hunter2', KEY);
    expect(() => decryptSecret({ ...sealed, cipher: tamper(sealed.cipher) }, KEY)).toThrow();
  });

  it('throws when the auth tag is stripped', () => {
    const sealed = encryptSecret('bank-portal-hunter2', KEY);
    const raw = Buffer.from(sealed.cipher, 'base64');
    const withoutTag = raw.subarray(0, raw.length - 16).toString('base64');
    expect(() => decryptSecret({ ...sealed, cipher: withoutTag }, KEY)).toThrow();
  });

  it('uses a fresh IV per record, so the same plaintext encrypts differently twice', () => {
    const first = encryptSecret('same-password', KEY);
    const second = encryptSecret('same-password', KEY);

    expect(first.iv).not.toBe(second.iv);
    expect(first.cipher).not.toBe(second.cipher);
    expect(decryptSecret(first, KEY)).toBe('same-password');
    expect(decryptSecret(second, KEY)).toBe('same-password');
  });

  it('throws under a different key rather than returning garbage', () => {
    const sealed = encryptSecret('bank-portal-hunter2', KEY);
    expect(() => decryptSecret(sealed, OTHER_KEY)).toThrow();
  });

  it('throws when the IV does not match the record', () => {
    const sealed = encryptSecret('bank-portal-hunter2', KEY);
    const wrongIv = randomBytes(12).toString('base64');
    expect(() => decryptSecret({ ...sealed, iv: wrongIv }, KEY)).toThrow();
  });

  describe('loadAssetKey', () => {
    it('accepts a 32 byte base64 key', () => {
      expect(loadAssetKey(KEY.toString('base64'))).toEqual(KEY);
    });

    it('rejects a missing key', () => {
      expect(() => loadAssetKey(undefined)).toThrow(/required/);
    });

    it('rejects a key that is not 32 bytes', () => {
      expect(() => loadAssetKey(randomBytes(16).toString('base64'))).toThrow(/32 bytes/);
    });
  });
});

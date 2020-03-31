import crypto from "crypto";

/**
 * Returns md5 hash of data.
 *
 * @param data - data to hash
 * @returns The md5 hash of `data` (16 bytes)
 */
export function hash(data: Buffer) {
  return crypto.createHash("md5").update(data).digest();
}

/**
 * Encrypts data with AES-128-CBC using provided key and iv.
 *
 * @param key - encryption key (16 bytes)
 * @param iv - initialization vector (16 bytes)
 * @param data - data to encrypt
 * @returns `data` encrypted with AES-128-CBC using provided `key` and `iv`.
 */
export function encrypt(key: Buffer, iv: Buffer, data: Buffer) {
  const cipher = crypto.createCipheriv("aes-128-cbc", key, iv);
  return Buffer.concat([cipher.update(data), cipher.final()]);
}

/**
 * Decrypts AES-128-CBC encrypted data using provided key and iv.
 *
 * @param key - encryption key (16 bytes)
 * @param iv - initialization vector (16 bytes)
 * @param data - data to decrypt (length = 16 * n)
 * @returns decrypted `data`.
 */
export function decrypt(key: Buffer, iv: Buffer, data: Buffer) {
  const decipher = crypto.createDecipheriv("aes-128-cbc", key, iv);
  return Buffer.concat([decipher.update(data), decipher.final()]);
}

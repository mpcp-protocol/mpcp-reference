/**
 * Shared AES-256-GCM encryption helper for policy document anchoring.
 * Uses globalThis.crypto.subtle (Node.js 19+ / all modern browsers).
 * No external dependencies.
 */

import type { EncryptedPolicyDocument, PolicyAnchorEncryptionOptions } from "./types.js";

/**
 * Copy a Uint8Array into a fresh ArrayBuffer so Web Crypto types are satisfied.
 * @types/node types Uint8Array.buffer as ArrayBufferLike (SharedArrayBuffer | ArrayBuffer),
 * but SubtleCrypto methods require a concrete ArrayBuffer.
 */
function toArrayBuffer(src: Uint8Array): ArrayBuffer {
  return src.buffer.slice(src.byteOffset, src.byteOffset + src.byteLength) as ArrayBuffer;
}

/**
 * Encrypt a policy document with AES-256-GCM.
 *
 * @param policyDocument - The policy document object to encrypt
 * @param options - Encryption key (Uint8Array or CryptoKey) and optional IV
 * @returns EncryptedPolicyDocument with algorithm, base64 IV, and base64 ciphertext
 */
export async function encryptPolicyDocument(
  policyDocument: object,
  options: PolicyAnchorEncryptionOptions,
): Promise<EncryptedPolicyDocument> {
  // Import key if raw bytes provided
  let cryptoKey: CryptoKey;
  if (options.key instanceof Uint8Array) {
    if (options.key.length !== 32) {
      throw new Error("AES-256 key must be exactly 32 bytes");
    }
    cryptoKey = await globalThis.crypto.subtle.importKey(
      "raw",
      toArrayBuffer(options.key),
      { name: "AES-GCM" },
      false,
      ["encrypt"],
    );
  } else {
    cryptoKey = options.key;
  }

  const ivRaw = options.iv ?? globalThis.crypto.getRandomValues(new Uint8Array(12));
  const iv = toArrayBuffer(ivRaw);
  if (ivRaw.length !== 12) {
    throw new Error("AES-GCM IV must be exactly 12 bytes");
  }

  const plaintext = new TextEncoder().encode(JSON.stringify(policyDocument));

  // AES-GCM encrypt — ciphertext includes the 16-byte authentication tag appended
  const ciphertextBuffer = await globalThis.crypto.subtle.encrypt(
    { name: "AES-GCM", iv },
    cryptoKey,
    plaintext,
  );

  return {
    algorithm: "AES-256-GCM",
    iv: Buffer.from(ivRaw).toString("base64"),
    ciphertext: Buffer.from(ciphertextBuffer).toString("base64"),
  };
}

/**
 * Decrypt an EncryptedPolicyDocument produced by encryptPolicyDocument.
 *
 * @param encrypted - The encrypted document envelope
 * @param options - Decryption key (Uint8Array or CryptoKey)
 * @returns The original policy document object
 */
export async function decryptPolicyDocument(
  encrypted: EncryptedPolicyDocument,
  options: Pick<PolicyAnchorEncryptionOptions, "key">,
): Promise<object> {
  let cryptoKey: CryptoKey;
  if (options.key instanceof Uint8Array) {
    if (options.key.length !== 32) {
      throw new Error("AES-256 key must be exactly 32 bytes");
    }
    cryptoKey = await globalThis.crypto.subtle.importKey(
      "raw",
      toArrayBuffer(options.key),
      { name: "AES-GCM" },
      false,
      ["decrypt"],
    );
  } else {
    cryptoKey = options.key;
  }

  const iv = toArrayBuffer(Buffer.from(encrypted.iv, "base64"));
  const ciphertext = toArrayBuffer(Buffer.from(encrypted.ciphertext, "base64"));

  let plaintext: ArrayBuffer;
  try {
    plaintext = await globalThis.crypto.subtle.decrypt(
      { name: "AES-GCM", iv },
      cryptoKey,
      ciphertext,
    );
  } catch {
    throw new Error("decryption_failed: wrong key or corrupted ciphertext");
  }

  const json = new TextDecoder().decode(plaintext);
  return JSON.parse(json) as object;
}

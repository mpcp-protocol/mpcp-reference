/**
 * secp256k1 low-S normalization (SECOP 8b).
 *
 * ECDSA signatures over secp256k1 are malleable: given (r, s) a valid signature,
 * (r, n − s) is also valid. MPCP requires the canonical "low-S" form where
 * s ≤ n/2. This matches Bitcoin's standardness rule (BIP 62) and prevents
 * third-party malleability.
 */

const SECP256K1_ORDER = BigInt(
  "0xFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFEBAAEDCE6AF48A03BBFD25E8CD0364141",
);
const SECP256K1_HALF_ORDER = SECP256K1_ORDER >> 1n;

/**
 * Return true if the S value in a DER-encoded secp256k1 ECDSA signature
 * is in the low half (s <= n/2).
 */
export function isLowS(derSignature: Buffer): boolean {
  const s = extractSFromDer(derSignature);
  if (s === null) return false;
  return s <= SECP256K1_HALF_ORDER;
}

/**
 * If S > n/2, replace it with n − S (canonical low-S form).
 * Returns a new DER buffer or the original if already canonical.
 */
export function ensureLowS(derSignature: Buffer): Buffer {
  const s = extractSFromDer(derSignature);
  if (s === null) return derSignature;
  if (s <= SECP256K1_HALF_ORDER) return derSignature;

  const newS = SECP256K1_ORDER - s;
  return replaceSInDer(derSignature, newS);
}

function extractSFromDer(der: Buffer): bigint | null {
  if (der.length < 8 || der[0] !== 0x30) return null;
  let offset = 2;
  if (der[1] & 0x80) offset += (der[1] & 0x7f);

  // R
  if (der[offset] !== 0x02) return null;
  const rLen = der[offset + 1]!;
  offset += 2 + rLen;

  // S
  if (offset >= der.length || der[offset] !== 0x02) return null;
  const sLen = der[offset + 1]!;
  const sBytes = der.subarray(offset + 2, offset + 2 + sLen);
  return bufToBigInt(sBytes);
}

function bufToBigInt(buf: Uint8Array): bigint {
  let result = 0n;
  for (const byte of buf) result = (result << 8n) | BigInt(byte);
  return result;
}

function bigIntToBuf(n: bigint): Buffer {
  let hex = n.toString(16);
  if (hex.length % 2) hex = "0" + hex;
  const buf = Buffer.from(hex, "hex");
  if (buf[0]! >= 0x80) return Buffer.concat([Buffer.from([0x00]), buf]);
  return buf;
}

function replaceSInDer(der: Buffer, newS: bigint): Buffer {
  let offset = 2;
  if (der[1]! & 0x80) offset += (der[1]! & 0x7f);

  // R header + body
  const rLen = der[offset + 1]!;
  const rPart = der.subarray(offset, offset + 2 + rLen);

  // Build new S TLV
  const sBuf = bigIntToBuf(newS);
  const sTlv = Buffer.concat([Buffer.from([0x02, sBuf.length]), sBuf]);

  // Reassemble
  const inner = Buffer.concat([rPart, sTlv]);
  const outerLen = inner.length;
  if (outerLen <= 127) {
    return Buffer.concat([Buffer.from([0x30, outerLen]), inner]);
  }
  const lenBytes = outerLen <= 0xff ? Buffer.from([0x81, outerLen])
    : Buffer.from([0x82, (outerLen >> 8) & 0xff, outerLen & 0xff]);
  return Buffer.concat([Buffer.from([0x30]), lenBytes, inner]);
}

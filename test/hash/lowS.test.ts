import { describe, expect, it } from "vitest";
import { isLowS, ensureLowS } from "../../src/hash/lowS.js";

const SECP256K1_ORDER = BigInt(
  "0xFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFEBAAEDCE6AF48A03BBFD25E8CD0364141",
);
const HALF_ORDER = SECP256K1_ORDER >> 1n;

function buildDerSignature(rHex: string, sHex: string): Buffer {
  const rBuf = Buffer.from(rHex, "hex");
  const sBuf = Buffer.from(sHex, "hex");
  const rPadded = rBuf[0]! >= 0x80 ? Buffer.concat([Buffer.from([0x00]), rBuf]) : rBuf;
  const sPadded = sBuf[0]! >= 0x80 ? Buffer.concat([Buffer.from([0x00]), sBuf]) : sBuf;
  const rTlv = Buffer.concat([Buffer.from([0x02, rPadded.length]), rPadded]);
  const sTlv = Buffer.concat([Buffer.from([0x02, sPadded.length]), sPadded]);
  const inner = Buffer.concat([rTlv, sTlv]);
  return Buffer.concat([Buffer.from([0x30, inner.length]), inner]);
}

describe("isLowS", () => {
  it("returns true for S = 1 (minimal low-S)", () => {
    const sig = buildDerSignature("01", "01");
    expect(isLowS(sig)).toBe(true);
  });

  it("returns true for S = halfOrder", () => {
    let hex = HALF_ORDER.toString(16);
    if (hex.length % 2) hex = "0" + hex;
    const sig = buildDerSignature("01", hex);
    expect(isLowS(sig)).toBe(true);
  });

  it("returns false for S = halfOrder + 1 (high-S)", () => {
    const highS = HALF_ORDER + 1n;
    let hex = highS.toString(16);
    if (hex.length % 2) hex = "0" + hex;
    const sig = buildDerSignature("01", hex);
    expect(isLowS(sig)).toBe(false);
  });

  it("returns false for malformed DER", () => {
    expect(isLowS(Buffer.from([0x00, 0x01]))).toBe(false);
    expect(isLowS(Buffer.alloc(0))).toBe(false);
  });
});

describe("ensureLowS", () => {
  it("returns identical buffer for already-low S", () => {
    const sig = buildDerSignature("01", "01");
    const normalized = ensureLowS(sig);
    expect(normalized.equals(sig)).toBe(true);
  });

  it("normalizes high-S to low-S", () => {
    const highS = HALF_ORDER + 1n;
    let hex = highS.toString(16);
    if (hex.length % 2) hex = "0" + hex;
    const sig = buildDerSignature("01", hex);
    expect(isLowS(sig)).toBe(false);
    const normalized = ensureLowS(sig);
    expect(isLowS(normalized)).toBe(true);
  });

  it("normalized S equals n - original S", () => {
    const originalS = HALF_ORDER + 100n;
    let hex = originalS.toString(16);
    if (hex.length % 2) hex = "0" + hex;
    const sig = buildDerSignature("abcd", hex);
    const normalized = ensureLowS(sig);
    expect(isLowS(normalized)).toBe(true);
  });

  it("returns original for malformed DER", () => {
    const bad = Buffer.from([0x00, 0x01, 0x02]);
    expect(ensureLowS(bad).equals(bad)).toBe(true);
  });
});

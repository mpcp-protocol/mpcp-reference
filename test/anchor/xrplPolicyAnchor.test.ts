import { describe, it, expect, vi } from "vitest";
import { xrplEncryptAndStorePolicyDocument } from "../../src/anchor/xrplPolicyAnchor.js";
import { decryptPolicyDocument } from "../../src/anchor/encrypt.js";
import type { PolicyDocumentIpfsStore } from "../../src/anchor/types.js";

const POLICY_DOC = {
  allowedRails: ["xrpl"],
  allowedAssets: [{ kind: "IOU", currency: "RLUSD", issuer: "rIssuer" }],
  maxAmountMinor: "80000",
};

function makeMockIpfsStore(cid = "bafybeiabc123"): PolicyDocumentIpfsStore {
  return { upload: vi.fn().mockResolvedValue(cid) };
}

describe("xrplEncryptAndStorePolicyDocument", () => {
  it("returns cid, policyHash, and encryptedDocument", async () => {
    const key = globalThis.crypto.getRandomValues(new Uint8Array(32));
    const store = makeMockIpfsStore("bafybeiabc123");

    const result = await xrplEncryptAndStorePolicyDocument(POLICY_DOC, {
      encryption: { key },
      ipfsStore: store,
    });

    expect(result.cid).toBe("bafybeiabc123");
    expect(result.policyHash).toMatch(/^[a-f0-9]{64}$/);
    expect(result.encryptedDocument.algorithm).toBe("AES-256-GCM");
    expect(typeof result.encryptedDocument.iv).toBe("string");
    expect(typeof result.encryptedDocument.ciphertext).toBe("string");
  });

  it("same document always produces same policyHash", async () => {
    const key = globalThis.crypto.getRandomValues(new Uint8Array(32));
    const store = makeMockIpfsStore();

    const r1 = await xrplEncryptAndStorePolicyDocument(POLICY_DOC, {
      encryption: { key },
      ipfsStore: store,
    });
    const r2 = await xrplEncryptAndStorePolicyDocument(POLICY_DOC, {
      encryption: { key },
      ipfsStore: store,
    });

    expect(r1.policyHash).toBe(r2.policyHash);
  });

  it("different documents produce different policyHashes", async () => {
    const key = globalThis.crypto.getRandomValues(new Uint8Array(32));
    const store = makeMockIpfsStore();

    const r1 = await xrplEncryptAndStorePolicyDocument(
      { ...POLICY_DOC, maxAmountMinor: "80000" },
      { encryption: { key }, ipfsStore: store },
    );
    const r2 = await xrplEncryptAndStorePolicyDocument(
      { ...POLICY_DOC, maxAmountMinor: "99999" },
      { encryption: { key }, ipfsStore: store },
    );

    expect(r1.policyHash).not.toBe(r2.policyHash);
  });

  it("encrypted document is decryptable with the same key", async () => {
    const key = globalThis.crypto.getRandomValues(new Uint8Array(32));
    const store = makeMockIpfsStore();

    const result = await xrplEncryptAndStorePolicyDocument(POLICY_DOC, {
      encryption: { key },
      ipfsStore: store,
    });

    const decrypted = await decryptPolicyDocument(result.encryptedDocument, { key });
    expect(decrypted).toEqual(POLICY_DOC);
  });

  it("calls ipfsStore.upload with Uint8Array payload", async () => {
    const key = globalThis.crypto.getRandomValues(new Uint8Array(32));
    const store = makeMockIpfsStore();

    await xrplEncryptAndStorePolicyDocument(POLICY_DOC, {
      encryption: { key },
      ipfsStore: store,
    });

    expect(store.upload).toHaveBeenCalledOnce();
    const [data, filename] = (store.upload as ReturnType<typeof vi.fn>).mock.calls[0];
    expect(data).toBeInstanceOf(Uint8Array);
    expect(filename).toMatch(/^policy-[a-f0-9]{64}\.json$/);
  });

  it("propagates ipfsStore upload errors", async () => {
    const key = globalThis.crypto.getRandomValues(new Uint8Array(32));
    const store: PolicyDocumentIpfsStore = {
      upload: vi.fn().mockRejectedValue(new Error("IPFS unavailable")),
    };

    await expect(
      xrplEncryptAndStorePolicyDocument(POLICY_DOC, { encryption: { key }, ipfsStore: store }),
    ).rejects.toThrow("IPFS unavailable");
  });

  it("rejects non-32-byte key", async () => {
    const key = new Uint8Array(16); // 128-bit, not 256-bit
    const store = makeMockIpfsStore();

    await expect(
      xrplEncryptAndStorePolicyDocument(POLICY_DOC, { encryption: { key }, ipfsStore: store }),
    ).rejects.toThrow("32 bytes");
  });
});

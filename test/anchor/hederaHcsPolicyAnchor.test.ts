import { describe, it, expect, vi, afterEach } from "vitest";
import { hederaHcsAnchorPolicyDocument } from "../../src/anchor/hederaHcsPolicyAnchor.js";

// Mock @hashgraph/sdk so the test doesn't require an installed package.
vi.mock("@hashgraph/sdk", () => {
  const mockReceipt = {
    topicSequenceNumber: { toString: () => "42" },
    consensusTimestamp: null,
  };
  const mockTxResponse = {
    getReceipt: vi.fn().mockResolvedValue(mockReceipt),
  };

  class MockTopicMessageSubmitTransaction {
    setTopicId() { return this; }
    setMessage() { return this; }
    execute() { return Promise.resolve(mockTxResponse); }
  }

  return {
    Client: {
      forName: vi.fn().mockReturnValue({
        setOperator: vi.fn(),
        close: vi.fn(),
      }),
    },
    TopicMessageSubmitTransaction: MockTopicMessageSubmitTransaction,
    PrivateKey: { fromString: vi.fn().mockReturnValue("mock-private-key") },
    AccountId: { fromString: vi.fn().mockReturnValue("mock-account-id") },
    TopicId: { fromString: vi.fn().mockReturnValue("mock-topic-id") },
  };
});

const POLICY_DOC = {
  allowedRails: ["xrpl"],
  allowedAssets: [{ kind: "IOU", currency: "RLUSD", issuer: "rIssuer" }],
  maxAmountMinor: "80000",
};

const OPTS = { topicId: "0.0.999", operatorId: "0.0.1234", operatorKey: "somekey" };

describe("hederaHcsAnchorPolicyDocument", () => {
  afterEach(() => {
    delete process.env.MPCP_HCS_OPERATOR_ID;
    delete process.env.MPCP_HCS_OPERATOR_KEY;
    delete process.env.MPCP_HCS_POLICY_TOPIC_ID;
  });

  // ---------------------------------------------------------------------------
  // Error cases
  // ---------------------------------------------------------------------------

  it("throws when HCS credentials are missing", async () => {
    await expect(hederaHcsAnchorPolicyDocument(POLICY_DOC)).rejects.toThrow(
      "MPCP_HCS_OPERATOR_ID",
    );
  });

  it("throws when encryption options missing for submitMode='encrypted'", async () => {
    await expect(
      hederaHcsAnchorPolicyDocument(POLICY_DOC, { ...OPTS, submitMode: "encrypted" }),
    ).rejects.toThrow("encryption options required");
  });

  // ---------------------------------------------------------------------------
  // hash-only (default)
  // ---------------------------------------------------------------------------

  it("defaults to hash-only submitMode", async () => {
    const result = await hederaHcsAnchorPolicyDocument(POLICY_DOC, OPTS);
    expect(result.submitMode).toBe("hash-only");
  });

  it("returns correct anchorRef format for hash-only", async () => {
    const result = await hederaHcsAnchorPolicyDocument(POLICY_DOC, OPTS);
    expect(result.reference).toBe("hcs:0.0.999:42");
    expect(result.rail).toBe("hedera-hcs");
  });

  it("includes policyHash in result", async () => {
    const result = await hederaHcsAnchorPolicyDocument(POLICY_DOC, OPTS);
    expect(result.policyHash).toMatch(/^[a-f0-9]{64}$/);
  });

  it("same document always produces same policyHash", async () => {
    const r1 = await hederaHcsAnchorPolicyDocument(POLICY_DOC, OPTS);
    const r2 = await hederaHcsAnchorPolicyDocument(POLICY_DOC, OPTS);
    expect(r1.policyHash).toBe(r2.policyHash);
  });

  // ---------------------------------------------------------------------------
  // full-document (opt-in)
  // ---------------------------------------------------------------------------

  it("returns submitMode='full-document' when explicitly set", async () => {
    const result = await hederaHcsAnchorPolicyDocument(POLICY_DOC, {
      ...OPTS,
      submitMode: "full-document",
    });
    expect(result.submitMode).toBe("full-document");
    expect(result.reference).toBe("hcs:0.0.999:42");
    expect(result.policyHash).toMatch(/^[a-f0-9]{64}$/);
  });

  // ---------------------------------------------------------------------------
  // encrypted
  // ---------------------------------------------------------------------------

  it("returns submitMode='encrypted' with correct reference", async () => {
    const key = globalThis.crypto.getRandomValues(new Uint8Array(32));
    const result = await hederaHcsAnchorPolicyDocument(POLICY_DOC, {
      ...OPTS,
      submitMode: "encrypted",
      encryption: { key },
    });
    expect(result.submitMode).toBe("encrypted");
    expect(result.reference).toBe("hcs:0.0.999:42");
    expect(result.policyHash).toMatch(/^[a-f0-9]{64}$/);
  });

  // ---------------------------------------------------------------------------
  // env var fallback
  // ---------------------------------------------------------------------------

  it("reads credentials from env vars when not in options", async () => {
    process.env.MPCP_HCS_OPERATOR_ID = "0.0.envId";
    process.env.MPCP_HCS_OPERATOR_KEY = "envkey";
    process.env.MPCP_HCS_POLICY_TOPIC_ID = "0.0.888";

    const result = await hederaHcsAnchorPolicyDocument(POLICY_DOC);
    expect(result.reference).toBe("hcs:0.0.888:42");
    expect(result.submitMode).toBe("hash-only");
  });

  it("options override env vars", async () => {
    process.env.MPCP_HCS_OPERATOR_ID = "0.0.envId";
    process.env.MPCP_HCS_OPERATOR_KEY = "envkey";
    process.env.MPCP_HCS_POLICY_TOPIC_ID = "0.0.envTopic";

    const result = await hederaHcsAnchorPolicyDocument(POLICY_DOC, OPTS);
    expect(result.reference).toBe("hcs:0.0.999:42");
  });
});

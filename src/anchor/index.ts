/**
 * Intent anchoring (PR10).
 * Optional support for publishing intent hashes to distributed ledgers
 * for public auditability, dispute protection, and replay protection.
 */

export type {
  AnchorOptions,
  AnchorResult,
  AnchorRail,
  PolicyAnchorResult,
  PolicyAnchorSubmitMode,
  PolicyAnchorEncryptionOptions,
  EncryptedPolicyDocument,
  PolicyDocumentIpfsStore,
  PolicyDocumentCustody,
} from "./types.js";
export { mockAnchorIntentHash } from "./mockAnchor.js";
export {
  hederaHcsAnchorIntentHash,
  verifyHederaHcsAnchor,
} from "./hederaHcsAnchor.js";
export { resolveXrplDid } from "./xrplDid.js";
export { hederaHcsAnchorPolicyDocument } from "./hederaHcsPolicyAnchor.js";
export { checkXrplNftRevocation } from "./xrplNftRevocation.js";
export { xrplEncryptAndStorePolicyDocument } from "./xrplPolicyAnchor.js";
export type { XrplPolicyAnchorPreparation } from "./xrplPolicyAnchor.js";
export { InMemoryPolicyCustody } from "./custody.js";
export { encryptPolicyDocument, decryptPolicyDocument } from "./encrypt.js";

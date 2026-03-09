import type { SessionPolicyGrant } from "../policy-core/types.js";
import type { SignedSessionBudgetAuthorization } from "./sba.js";
import type { SignedPaymentAuthorization } from "./spa.js";

export type PolicyGrant = SessionPolicyGrant;
export type SignedBudgetAuthorization = SignedSessionBudgetAuthorization;
export type SignedPaymentAuth = SignedPaymentAuthorization;

import { z } from "zod";
import {
  railSchema,
  mpcpVersionSchema,
  currencySchema,
  minorUnitSchema,
  iso8601DatetimeSchema,
} from "./shared.js";

const fleetScopeSchema = z.enum(["SESSION", "DAY", "SHIFT"]);

export const fleetPolicyAuthorizationPayloadSchema = z.strictObject({
  version: mpcpVersionSchema,
  fleetPolicyId: z.string(),
  fleetId: z.string(),
  vehicleId: z.string(),
  scope: fleetScopeSchema,
  currency: currencySchema,
  minorUnit: minorUnitSchema,
  maxAmountMinor: z.string(),
  allowedRails: z.array(railSchema),
  allowedAssets: z.array(z.string()),
  allowedOperators: z.array(z.string()),
  geoFence: z.array(z.string()).optional(),
  expiresAt: iso8601DatetimeSchema,
});

export const fleetPolicyAuthorizationSchema = z.strictObject({
  authorization: fleetPolicyAuthorizationPayloadSchema,
  issuer: z.string().optional(),
  issuerKeyId: z.string(),
  signature: z.string(),
});

export type FleetPolicyAuthorizationPayload = z.infer<typeof fleetPolicyAuthorizationPayloadSchema>;
export type FleetPolicyAuthorization = z.infer<typeof fleetPolicyAuthorizationSchema>;

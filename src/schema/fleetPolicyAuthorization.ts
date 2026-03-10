import { z } from "zod";
import { railSchema } from "./shared.js";
import { mpcpVersionSchema } from "./shared.js";

const fleetScopeSchema = z.enum(["SESSION", "DAY", "SHIFT"]);

export const fleetPolicyAuthorizationPayloadSchema = z.object({
  version: mpcpVersionSchema,
  fleetPolicyId: z.string(),
  fleetId: z.string(),
  vehicleId: z.string(),
  scope: fleetScopeSchema,
  currency: z.string(),
  minorUnit: z.number(),
  maxAmountMinor: z.string(),
  allowedRails: z.array(railSchema),
  allowedAssets: z.array(z.string()),
  allowedOperators: z.array(z.string()),
  geoFence: z.array(z.string()).optional(),
  expiresAt: z.string(),
});

export const fleetPolicyAuthorizationSchema = z.object({
  authorization: fleetPolicyAuthorizationPayloadSchema,
  signature: z.string(),
  keyId: z.string(),
});

export type FleetPolicyAuthorizationPayload = z.infer<typeof fleetPolicyAuthorizationPayloadSchema>;
export type FleetPolicyAuthorization = z.infer<typeof fleetPolicyAuthorizationSchema>;

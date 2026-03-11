# MPCP Compatibility and Versioning Policy (PR16)

This document defines the formal compatibility policy for MPCP. It tells implementers what is stable and how versions evolve. The canonical protocol specification is in [mpcp.md](../protocol/mpcp.md).

---

## Current Version

**Protocol Version: 1.0**

- Deterministic canonicalization and SettlementIntentHash
- PolicyGrant → SBA → SPA → Settlement chain
- Verification logic as specified in mpcp.md

---

## Artifact Versions

### Version Field

All MPCP artifacts MUST include a semantic version string in the `version` field (e.g. `"1.0"`), unless explicitly documented otherwise. The version identifies the protocol semantics used when producing the artifact.

### Format

MPCP uses **MAJOR.MINOR** semantic versioning. Examples: `1.0`, `1.1`, `2.0`.

### Minor Versions (1.0 → 1.1)

Minor versions may:

- Add optional fields
- Extend artifact structures
- Introduce new rails or assets

Minor upgrades **MUST** remain backward compatible. Verifiers MUST ignore unknown optional fields.

### Major Versions (1.x → 2.0)

Major versions may:

- Change artifact semantics
- Modify verification rules
- Alter canonicalization or hashing

Verifiers **MUST** reject artifacts whose major version they do not support.

---

## Verifier Behavior

### Stability Promises (1.x)

For protocol version 1.x, the reference verifier guarantees:

- Deterministic verification given valid artifact chains
- Rejection of expired grants, exceeded budgets, rail/asset/destination mismatches
- Compatibility with golden vectors in `vectors/`

### Forward Compatibility

Implementations MUST:

- Ignore unknown optional fields in artifacts
- Preserve unknown fields when forwarding artifacts (no strip-on-forward)

### Mixed-Version Chains

Artifacts SHOULD propagate the version they were produced under (PolicyGrant → SBA → SPA). A verifier MAY reject chains containing mixed incompatible versions; for 1.x, all 1.x artifacts are compatible.

---

## Profile Evolution

Reference profiles (Fleet Offline, Parking, Charging, Hosted Rail) are defined in [REFERENCE_PROFILES.md](./REFERENCE_PROFILES.md).

### Profile Stability

- New profiles may be added without a protocol version bump
- Existing profile names and expected policy shape are stable within 1.x
- Profile JSON may gain optional `_profile`-scoped fields in minor updates

### Profile Deprecation

Deprecation of a profile will be announced with at least one minor version of support before removal.

---

## Future Extensions

### Within 1.x

- New rails, assets, and destinations
- New anchor adapters
- Optional metadata fields

### Requiring 2.0

- Changes to SettlementIntentHash domain or canonical payload
- Breaking changes to verification semantics
- Removal of supported artifact fields

---

## Reference Implementation

The `mpcp-service` repository is the reference implementation. Package version (e.g. `0.1.0` in package.json) is independent of protocol version. Protocol version `1.0` is declared in artifact `version` fields and in mpcp.md.

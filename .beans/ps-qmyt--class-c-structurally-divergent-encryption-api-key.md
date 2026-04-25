---
# ps-qmyt
title: "Class C structurally-divergent encryption: api-key, session, system-snapshot"
status: draft
type: feature
priority: normal
created_at: 2026-04-25T08:07:36Z
updated_at: 2026-04-25T08:07:49Z
parent: ps-cd6x
blocked_by:
  - ps-y4tb
---

Three encrypted entities whose encrypted payload is NOT a Pick<X, K> subset of their domain type — they carry auxiliary side-data with its own type. The Class A canonical chain (lifted into ps-y4tb) doesn't apply directly; each needs bespoke design.

## Background — what makes them divergent

### api-key (apps/api/src/services/api-key/, packages/types/src/entities/api-key.ts)

- Domain ApiKey is a discriminated union (MetadataApiKey vs CryptoApiKey) — already complex
- Server row bundles 'name' and 'publicKey' inside encryptedData blob
- ApiKeyServerMetadata.encryptedKeyMaterial is a separate Uint8Array column (not in EncryptedBlob)
- Full chain has TWO encrypted payloads (the main blob + key material)

### session (packages/types/src/entities/session.ts)

- Domain Session has NO encrypted fields — it's metadata about the auth session
- DeviceInfo (separate exported interface) is what's encrypted in the blob
- DeviceInfo includes: platform, appVersion, deviceName
- SessionServerMetadata extends Session with tokenHash + encryptedData (nullable)
- Comment in session.ts:29 explicitly says 'Session is a plaintext entity (the domain type has no client-encrypted field union)'

### system-snapshot (packages/types/src/entities/system-snapshot.ts)

- Domain SystemSnapshot has plaintext metadata (id, systemId, createdAt, snapshotTrigger)
- SnapshotContent (separate type) is what's encrypted
- Comment at line 42: 'stores the T1-encrypted SnapshotContent — which lives in its own type (not as a keys-subset of SystemSnapshot)'

## Per-entity design questions (one design call each)

For each entity:

1. What is the canonical name for the encrypted-payload type? (DeviceInfo for session, SnapshotContent for system-snapshot, ?ApiKeyEncryptedPayload? for api-key)
2. Where does that type live? (already in @pluralscape/types per session.ts:20 and system-snapshot — verify api-key)
3. What's the equivalent of XEncryptedInput? (For Class A it's Pick<X, XEncryptedFields>; here it's the auxiliary type itself)
4. How is parity expressed? (z.infer<XEncryptedInputSchema> ≡ DeviceInfo, etc.)
5. What's XResult / XWire? (Same as Class A — EncryptedWire<XServerMetadata> works because the encrypted blob is in ServerMetadata)
6. Hand-rolled XRaw type in data/transforms — same cleanup as Class A?

## Acceptance

- Each of the 3 entities has a documented canonical chain in packages/types
- Parity tests cover the encrypted-payload ↔ Zod schema relationship
- packages/data/transforms/<entity>.ts (where applicable) imports canonical types
- Any service-layer cleanup (params: unknown → typed) applied consistently with the encrypted-entity epic

## Blocked-by

ps-y4tb (encrypted-entity SoT consolidation) — proves the pattern; this work extends it to bespoke cases.

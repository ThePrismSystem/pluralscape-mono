/**
 * Compile-time-only OpenAPI-Wire parity check for the types-ltel pilot.
 *
 * Asserts that OpenAPI-generated response types from `@pluralscape/api-client`
 * structurally equal their corresponding `<Entity>Wire` types from
 * `@pluralscape/types`.
 *
 * Typechecked via `pnpm types:check-sot`.
 *
 * ── Scope and deferrals ──────────────────────────────────────────────
 *
 * Two parity gaps were identified during Task 17 and deferred to
 * follow-up bean `types-tef0`:
 *
 * 1. `Member`: the OpenAPI spec exposes the on-the-wire *encrypted* entity
 *    (`MemberResponse = EncryptedEntity`). The domain `Member` type is the
 *    post-decryption client-side shape, so `Serialize<Member>` (a.k.a.
 *    `MemberWire`) lives at a different layer than what HTTP carries. A
 *    direct `Equal<components["schemas"]["MemberResponse"], MemberWire>`
 *    would fail by design. Resolving this requires either a distinct
 *    `MemberEncryptedWire` aliased to `EncryptedEntity`, or wiring plaintext
 *    (T1) shapes into the OpenAPI spec — outside pilot scope.
 *
 * 2. `AuditLogEntry`: the OpenAPI shape diverges from the domain on field
 *    names (`timestamp` vs `createdAt`), extra fields (`resourceType`,
 *    `resourceId`), and actor shape (`string | null` vs the
 *    `AuditActor` tagged union). Aligning these requires either updating
 *    the OpenAPI spec or restructuring the domain type — both are
 *    structural changes beyond Task 17 scope.
 *
 * What this file *does* enforce right now:
 *  - `MemberWire ≡ Serialize<Member>` (self-consistency of the helper).
 *  - `AuditLogEntryWire ≡ Serialize<AuditLogEntry>` (same).
 *  - `components["schemas"]["EncryptedEntity"]` is structurally equal to the
 *    hand-authored `EncryptedEntityWire` mirror below — a real OpenAPI→
 *    domain parity tripwire for the shared envelope that every T1 response
 *    (including Member) rides on.
 *
 * Adding a bogus field on either side of the `EncryptedEntity` assertion
 * will fail the gate — see `pnpm types:check-sot`.
 */

import type { components } from "../packages/api-client/src/generated/api-types.js";
import type {
  AuditLogEntry,
  AuditLogEntryWire,
  Equal,
  Member,
  MemberWire,
  Serialize,
} from "../packages/types/src/index.js";
import { expectTypeOf } from "vitest";

// ── Wire helpers self-consistency ────────────────────────────────────
//
// `<Entity>Wire` must equal `Serialize<Entity>` — no hand-authored drift
// from the helper-derived form. This bites if someone hand-redefines
// `MemberWire` to diverge from `Serialize<Member>`.

expectTypeOf<Equal<MemberWire, Serialize<Member>>>().toEqualTypeOf<true>();
expectTypeOf<Equal<AuditLogEntryWire, Serialize<AuditLogEntry>>>().toEqualTypeOf<true>();

// ── OpenAPI ↔ Wire parity: EncryptedEntity envelope ─────────────────
//
// Every T1 response rides on this envelope. This is the first real
// OpenAPI→types tripwire in the pilot: if the OpenAPI spec or the
// mirror below drifts, this assertion fails.
//
// The mirror is kept local to this file rather than exported from
// `@pluralscape/types` because the envelope is an API-layer concern,
// not a domain concept. Promoting it (and aliasing `MemberResponse`
// to it) is tracked in `types-tef0`.

interface EncryptedEntityWire {
  id: string;
  systemId: string;
  encryptedData: string;
  version: number;
  createdAt: number;
  updatedAt: number;
  archived: boolean;
  archivedAt?: number | null;
}

expectTypeOf<
  Equal<components["schemas"]["EncryptedEntity"], EncryptedEntityWire>
>().toEqualTypeOf<true>();

// ── Deferred: direct Member parity ──────────────────────────────────
//
// `components["schemas"]["MemberResponse"]` is `allOf: [EncryptedEntity]`
// (see `docs/openapi.yaml`). It represents the encrypted wire entity,
// not the decrypted domain `Member`. Tracking: bean `types-tef0`.
//
// Once a `MemberEncryptedWire` (aliased to `EncryptedEntity`) is
// introduced, replace with:
//
//   expectTypeOf<
//     Equal<components["schemas"]["MemberResponse"], MemberEncryptedWire>
//   >().toEqualTypeOf<true>();

// ── Deferred: direct AuditLogEntry parity ───────────────────────────
//
// OpenAPI shape uses `timestamp`/`resourceType`/`resourceId`/
// `actor: string`, whereas domain uses `createdAt`/(no resourceType)/
// `actor: AuditActor` (tagged union). Resolving requires spec and/or
// domain-type restructuring — tracked in bean `types-tef0`.

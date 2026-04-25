import type { EncryptedWire } from "../encrypted-wire.js";
import type { EncryptedBlob } from "../encryption-primitives.js";
import type { InnerWorldRegionId, MemberId, SystemId } from "../ids.js";
import type { UnixMillis } from "../timestamps.js";
import type { Serialize } from "../type-assertions.js";
import type { Archived, AuditMetadata } from "../utility.js";
import type { VisualProperties } from "./innerworld-entity.js";

/** A region or area within the innerworld. */
export interface InnerWorldRegion extends AuditMetadata {
  readonly id: InnerWorldRegionId;
  readonly systemId: SystemId;
  readonly name: string;
  readonly description: string | null;
  readonly parentRegionId: InnerWorldRegionId | null;
  readonly visual: VisualProperties;
  readonly boundaryData: readonly { readonly x: number; readonly y: number }[];
  readonly accessType: "open" | "gatekept";
  readonly gatekeeperMemberIds: readonly MemberId[];
  readonly archived: false;
}

/**
 * Keys of `InnerWorldRegion` that are encrypted client-side before the
 * server sees them. `parentRegionId` is a plaintext sibling (server needs
 * it for hierarchy queries) and is intentionally excluded. Consumed by:
 * - `__sot-manifest__.ts` (manifest's `encryptedFields` slot)
 * - `scripts/openapi-wire-parity.type-test.ts` (PlaintextInnerworldRegion parity)
 * - `InnerWorldRegionServerMetadata` (derived via `Omit`)
 */
export type InnerWorldRegionEncryptedFields =
  | "name"
  | "description"
  | "visual"
  | "boundaryData"
  | "accessType"
  | "gatekeeperMemberIds";

// ── Canonical chain (see ADR-023) ────────────────────────────────────
// InnerWorldRegionEncryptedInput → InnerWorldRegionServerMetadata
//                               → InnerWorldRegionResult → InnerWorldRegionWire
// Per-alias JSDoc is intentionally minimal; the alias name plus the
// chain anchor above carries the meaning. Per-alias docs only appear
// when an entity diverges from the standard pattern.

export type InnerWorldRegionEncryptedInput = Pick<
  InnerWorldRegion,
  InnerWorldRegionEncryptedFields
>;

/** An archived innerworld region. */
export type ArchivedInnerWorldRegion = Archived<InnerWorldRegion>;

/**
 * Server-visible InnerWorldRegion metadata — raw Drizzle row shape.
 *
 * Derived from `InnerWorldRegion` by stripping the encrypted field keys
 * (bundled inside `encryptedData`) plus `archived` (domain uses a
 * `false` literal that `Archived<T>` flips to `true`; the server tracks a
 * mutable boolean with a companion `archivedAt` timestamp).
 */
export type InnerWorldRegionServerMetadata = Omit<
  InnerWorldRegion,
  InnerWorldRegionEncryptedFields | "archived"
> & {
  readonly archived: boolean;
  readonly archivedAt: UnixMillis | null;
  readonly encryptedData: EncryptedBlob;
};

export type InnerWorldRegionResult = EncryptedWire<InnerWorldRegionServerMetadata>;

export type InnerWorldRegionWire = Serialize<InnerWorldRegionResult>;

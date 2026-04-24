import type { EncryptedBlob } from "../encryption-primitives.js";
import type { CustomFrontId, HexColor, SystemId } from "../ids.js";
import type { UnixMillis } from "../timestamps.js";
import type { Serialize } from "../type-assertions.js";
import type { Archived, AuditMetadata } from "../utility.js";

/** A user-defined abstract cognitive state logged like a member. */
export interface CustomFront extends AuditMetadata {
  readonly id: CustomFrontId;
  readonly systemId: SystemId;
  readonly name: string;
  readonly description: string | null;
  readonly color: HexColor | null;
  readonly emoji: string | null;
  readonly archived: false;
}

/**
 * Keys of `CustomFront` that are encrypted client-side before the server
 * sees them. Consumed by:
 * - `__sot-manifest__.ts` (manifest's `encryptedFields` slot)
 * - `scripts/openapi-wire-parity.type-test.ts` (PlaintextCustomFront parity)
 * - `CustomFrontServerMetadata` (derived via `Omit`)
 */
export type CustomFrontEncryptedFields = "name" | "description" | "color" | "emoji";

/** An archived custom front — preserves all data with archive metadata. */
export type ArchivedCustomFront = Archived<CustomFront>;

/**
 * Server-visible CustomFront metadata — raw Drizzle row shape.
 *
 * Derived from `CustomFront` by stripping the encrypted field keys bundled
 * inside `encryptedData` and `archived` (server tracks a mutable boolean
 * with a companion `archivedAt` timestamp, domain uses `false` literal).
 * Adds DB-only columns: `encryptedData` (the T1 blob),
 * `archived`/`archivedAt`. `AuditMetadata` is already on the domain.
 */
export type CustomFrontServerMetadata = Omit<
  CustomFront,
  CustomFrontEncryptedFields | "archived"
> & {
  readonly encryptedData: EncryptedBlob;
  readonly archived: boolean;
  readonly archivedAt: UnixMillis | null;
};

/**
 * JSON-wire representation of a CustomFront. Derived from the domain
 * `CustomFront` type via `Serialize<T>`; branded IDs become plain strings.
 */
export type CustomFrontWire = Serialize<CustomFront>;

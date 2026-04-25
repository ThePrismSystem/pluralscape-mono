import type { EncryptedWire } from "../encrypted-wire.js";
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

/**
 * Pre-encryption shape — what `encryptCustomFrontInput` accepts. Single source
 * of truth: derived from `CustomFront` via `Pick<>` over the encrypted-keys union.
 */
export type CustomFrontEncryptedInput = Pick<CustomFront, CustomFrontEncryptedFields>;

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
 * Server-emit shape — what `toCustomFrontResult` returns. Branded IDs and
 * timestamps preserved; `encryptedData` is wire-form `EncryptedBase64`.
 */
export type CustomFrontResult = EncryptedWire<CustomFrontServerMetadata>;

/**
 * JSON-serialized wire form of `CustomFrontResult`: branded IDs become plain strings;
 * `EncryptedBase64` becomes plain `string`; timestamps become numbers.
 */
export type CustomFrontWire = Serialize<CustomFrontResult>;

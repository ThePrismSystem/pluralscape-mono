import type { CustomFrontId, HexColor, SystemId } from "../ids.js";
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
 * - Plan 2 fleet will consume when deriving `CustomFrontServerMetadata`.
 */
export type CustomFrontEncryptedFields = "name" | "description" | "color" | "emoji";

/** An archived custom front — preserves all data with archive metadata. */
export type ArchivedCustomFront = Archived<CustomFront>;

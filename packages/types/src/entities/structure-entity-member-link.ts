import type {
  MemberId,
  SystemId,
  SystemStructureEntityId,
  SystemStructureEntityMemberLinkId,
} from "../ids.js";
import type { UnixMillis } from "../timestamps.js";
import type { Serialize } from "../type-assertions.js";

/** A link placing a member under a structure entity (or at root level). */
export interface SystemStructureEntityMemberLink {
  readonly id: SystemStructureEntityMemberLinkId;
  readonly systemId: SystemId;
  readonly parentEntityId: SystemStructureEntityId | null;
  readonly memberId: MemberId;
  readonly sortOrder: number;
  readonly createdAt: UnixMillis;
}

/**
 * Keys of `SystemStructureEntityMemberLink` that are encrypted client-side
 * before the server sees them. Links carry no encrypted payload today —
 * every field is plaintext at the API layer — so this union is `never`
 * and the OpenAPI `PlaintextStructureEntityMemberLink` schema is an empty
 * object. Consumed by:
 * - `__sot-manifest__.ts` (manifest's `encryptedFields` slot)
 * - `scripts/openapi-wire-parity.type-test.ts` (PlaintextStructureEntityMemberLink parity)
 * - `SystemStructureEntityMemberLinkServerMetadata` (identity alias for
 *   plaintext entities)
 */
export type SystemStructureEntityMemberLinkEncryptedFields = never;

/**
 * Server-visible SystemStructureEntityMemberLink metadata — raw Drizzle
 * row shape. Plaintext entity: server sees the same shape as the domain
 * type (no encryptedData column, no archive metadata).
 */
export type SystemStructureEntityMemberLinkServerMetadata = SystemStructureEntityMemberLink;

/**
 * JSON-wire representation of SystemStructureEntityMemberLink. Derived
 * from `SystemStructureEntityMemberLinkServerMetadata` via `Serialize<T>`;
 * branded IDs become plain strings, `UnixMillis` becomes `number`.
 */
export type SystemStructureEntityMemberLinkWire =
  Serialize<SystemStructureEntityMemberLinkServerMetadata>;

import type {
  MemberId,
  SystemId,
  SystemStructureEntityId,
  SystemStructureEntityMemberLinkId,
} from "../ids.js";
import type { UnixMillis } from "../timestamps.js";

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
 * - Plan 2 fleet will consume when deriving
 *   `SystemStructureEntityMemberLinkServerMetadata`.
 */
export type SystemStructureEntityMemberLinkEncryptedFields = never;

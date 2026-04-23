import type {
  SystemId,
  SystemStructureEntityAssociationId,
  SystemStructureEntityId,
} from "../ids.js";
import type { UnixMillis } from "../timestamps.js";

/** A many-to-many cross-type association between two structure entities. */
export interface SystemStructureEntityAssociation {
  readonly id: SystemStructureEntityAssociationId;
  readonly systemId: SystemId;
  readonly sourceEntityId: SystemStructureEntityId;
  readonly targetEntityId: SystemStructureEntityId;
  readonly createdAt: UnixMillis;
}

/**
 * Keys of `SystemStructureEntityAssociation` that are encrypted
 * client-side before the server sees them. Associations carry no
 * encrypted payload today — every field (`sourceEntityId`,
 * `targetEntityId`) is plaintext at the API layer — so this union is
 * `never` and the OpenAPI `PlaintextStructureEntityAssociation` schema
 * is an empty object. Consumed by:
 * - `__sot-manifest__.ts` (manifest's `encryptedFields` slot)
 * - `scripts/openapi-wire-parity.type-test.ts` (PlaintextStructureEntityAssociation parity)
 * - Plan 2 fleet will consume when deriving
 *   `SystemStructureEntityAssociationServerMetadata`.
 */
export type SystemStructureEntityAssociationEncryptedFields = never;

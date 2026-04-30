import type { SystemId, SystemStructureEntityId, SystemStructureEntityLinkId } from "../ids.js";
import type { UnixMillis } from "../timestamps.js";
import type { Serialize } from "../type-assertions.js";

/** A parent-child hierarchy link between two structure entities. */
export interface SystemStructureEntityLink {
  readonly id: SystemStructureEntityLinkId;
  readonly systemId: SystemId;
  readonly entityId: SystemStructureEntityId;
  readonly parentEntityId: SystemStructureEntityId | null;
  readonly sortOrder: number;
  readonly createdAt: UnixMillis;
}

/**
 * Server-visible SystemStructureEntityLink metadata — raw Drizzle row
 * shape. Plaintext entity: server sees the same shape as the domain
 * type (no encryptedData column, no archive metadata).
 */
export type SystemStructureEntityLinkServerMetadata = SystemStructureEntityLink;

/**
 * JSON-wire representation of SystemStructureEntityLink. Derived from
 * `SystemStructureEntityLinkServerMetadata` via `Serialize<T>`; branded IDs
 * become plain strings, `UnixMillis` becomes `number`.
 */
export type SystemStructureEntityLinkWire = Serialize<SystemStructureEntityLinkServerMetadata>;

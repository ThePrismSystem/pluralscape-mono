import type {
  SystemId,
  SystemStructureEntityId,
  SystemStructureEntityLinkId,
} from "../ids.js";
import type { UnixMillis } from "../timestamps.js";

/** A parent-child hierarchy link between two structure entities. */
export interface SystemStructureEntityLink {
  readonly id: SystemStructureEntityLinkId;
  readonly systemId: SystemId;
  readonly entityId: SystemStructureEntityId;
  readonly parentEntityId: SystemStructureEntityId | null;
  readonly sortOrder: number;
  readonly createdAt: UnixMillis;
}

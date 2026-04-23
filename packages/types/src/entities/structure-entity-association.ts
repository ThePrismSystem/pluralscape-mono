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

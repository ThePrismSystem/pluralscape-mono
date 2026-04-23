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

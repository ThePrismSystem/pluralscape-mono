import type { AcknowledgementId, MemberId, SystemId } from "../ids.js";
import type { UnixMillis } from "../timestamps.js";
import type { Archived, AuditMetadata } from "../utility.js";

/** A request for a member to acknowledge a message or decision. */
export interface AcknowledgementRequest extends AuditMetadata {
  readonly id: AcknowledgementId;
  readonly systemId: SystemId;
  readonly createdByMemberId: MemberId;
  readonly targetMemberId: MemberId;
  readonly message: string;
  readonly confirmed: boolean;
  readonly confirmedAt: UnixMillis | null;
  readonly archived: false;
}

/** An archived acknowledgement request. */
export type ArchivedAcknowledgementRequest = Archived<AcknowledgementRequest>;

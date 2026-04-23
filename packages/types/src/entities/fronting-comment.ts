import type {
  CustomFrontId,
  FrontingCommentId,
  FrontingSessionId,
  MemberId,
  SystemId,
  SystemStructureEntityId,
} from "../ids.js";
import type { Archived, AuditMetadata } from "../utility.js";

/** A comment on a fronting session — unlimited length, multiple per session. */
export interface FrontingComment extends AuditMetadata {
  readonly id: FrontingCommentId;
  readonly frontingSessionId: FrontingSessionId;
  readonly systemId: SystemId;
  readonly memberId: MemberId | null;
  readonly customFrontId: CustomFrontId | null;
  readonly structureEntityId: SystemStructureEntityId | null;
  readonly content: string;
  readonly archived: false;
}

/** An archived fronting comment. */
export type ArchivedFrontingComment = Archived<FrontingComment>;

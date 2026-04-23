import type { BoardMessageId, MemberId, SystemId } from "../ids.js";
import type { Archived, AuditMetadata } from "../utility.js";

/** A longer-form message posted to a board. */
export interface BoardMessage extends AuditMetadata {
  readonly id: BoardMessageId;
  readonly systemId: SystemId;
  readonly senderId: MemberId;
  readonly content: string;
  readonly pinned: boolean;
  readonly sortOrder: number;
  readonly archived: false;
}

/** An archived board message. */
export type ArchivedBoardMessage = Archived<BoardMessage>;

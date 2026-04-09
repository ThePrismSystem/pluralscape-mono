import type { CrdtAuditFields, CrdtOptionalString, CrdtString } from "./common.js";
import type { AcknowledgementId, BoardMessageId, PollId, PollOptionId } from "@pluralscape/types";

// ── channel ──────────────────────────────────────────────────────────

/** CRDT representation of a Channel (singleton LWW at document root). */
export interface CrdtChannel extends CrdtAuditFields {
  id: CrdtString;
  systemId: CrdtString;
  name: CrdtString;
  /** "category" | "channel" */
  type: CrdtString;
  parentId: CrdtOptionalString;
  sortOrder: number;
  archived: boolean;
}

// ── message ──────────────────────────────────────────────────────────

/**
 * CRDT representation of a ChatMessage (append-only list element).
 * Immutable once appended. Edits produce new message entries with
 * `editOf` referencing the original message ID.
 */
export interface CrdtChatMessage {
  id: CrdtString;
  channelId: CrdtString;
  systemId: CrdtString;
  senderId: CrdtString;
  content: CrdtString;
  /** JSON-serialized BlobId[] */
  attachments: CrdtString;
  /** JSON-serialized MemberId[] */
  mentions: CrdtString;
  replyToId: CrdtOptionalString;
  timestamp: number;
  /**
   * References the original message ID if this entry is an edit.
   * Null for original (non-edit) messages.
   * The canonical content of a message is the most recent entry in the editOf chain.
   */
  editOf: CrdtOptionalString;
  archived: boolean;
}

// ── board message ─────────────────────────────────────────────────────

/**
 * CRDT representation of a BoardMessage (append-lww map, keyed by BoardMessageId).
 *
 * Topology correction: was append-only in v1 spec. Modeled as map because
 * pinned and sortOrder are mutated after creation.
 */
export interface CrdtBoardMessage extends CrdtAuditFields {
  id: CrdtString;
  systemId: CrdtString;
  senderId: CrdtString;
  content: CrdtString;
  /** LWW — can be set/unset after creation. */
  pinned: boolean;
  /** LWW — can be updated during reorder. */
  sortOrder: number;
  archived: boolean;
}

// ── poll ─────────────────────────────────────────────────────────────

/** CRDT representation of a Poll (LWW map, keyed by PollId). */
export interface CrdtPoll extends CrdtAuditFields {
  id: CrdtString;
  systemId: CrdtString;
  createdByMemberId: CrdtOptionalString;
  title: CrdtString;
  description: CrdtOptionalString;
  /** PollKind string: "standard" | "custom" */
  kind: CrdtString;
  /** "open" | "closed" — LWW, set to "closed" when poll ends */
  status: CrdtString;
  closedAt: number | null;
  endsAt: number | null;
  allowMultipleVotes: boolean;
  maxVotesPerMember: number;
  allowAbstain: boolean;
  allowVeto: boolean;
  archived: boolean;
}

/**
 * CRDT representation of a PollOption (LWW map, keyed by PollOptionId).
 * Note: voteCount is omitted — compute at read time by counting votes in the
 * votes list where optionId matches.
 */
export interface CrdtPollOption {
  id: CrdtString;
  pollId: CrdtString;
  label: CrdtString;
  color: CrdtOptionalString;
  emoji: CrdtOptionalString;
}

// ── poll vote ─────────────────────────────────────────────────────────

/**
 * CRDT representation of a PollVote (append-only list element).
 * Immutable once appended — votes are permanent records.
 */
export interface CrdtPollVote {
  id: CrdtString;
  pollId: CrdtString;
  /** Null indicates abstain. */
  optionId: CrdtOptionalString;
  /** JSON-serialized EntityReference<"member"|"structure-entity"> */
  voter: CrdtString;
  comment: CrdtOptionalString;
  isVeto: boolean;
  votedAt: number;
  archived: boolean;
}

// ── acknowledgement ───────────────────────────────────────────────────

/**
 * CRDT representation of an AcknowledgementRequest (LWW map, keyed by AcknowledgementId).
 * The `confirmed` and `confirmedAt` fields are LWW — set when the target member acknowledges.
 */
export interface CrdtAcknowledgementRequest extends CrdtAuditFields {
  id: CrdtString;
  systemId: CrdtString;
  createdByMemberId: CrdtOptionalString;
  targetMemberId: CrdtString;
  message: CrdtString;
  /** LWW — set to true when target member confirms. */
  confirmed: boolean;
  /** LWW — set to the confirmation timestamp. */
  confirmedAt: number | null;
  archived: boolean;
}

// ── document ─────────────────────────────────────────────────────────

/**
 * Automerge document schema for a chat document (one per channel).
 *
 * Contains channel metadata and all communication within a single channel.
 * Time-split by calendar month when document exceeds 5 MB.
 *
 * Encryption key: Master key
 * Naming: chat-{channelId} (splits to chat-{channelId}-{YYYY-MM})
 */
export interface ChatDocument {
  /** Singleton channel metadata (LWW per field). */
  channel: CrdtChannel;
  /** Append-lww map: board messages keyed by ID; pinned/sortOrder are mutable. */
  boardMessages: Record<BoardMessageId, CrdtBoardMessage>;
  /** LWW map keyed by PollId. */
  polls: Record<PollId, CrdtPoll>;
  /** LWW map keyed by PollOptionId. Each option stores its pollId for lookup. */
  pollOptions: Record<PollOptionId, CrdtPollOption>;
  /** LWW map keyed by AcknowledgementId. */
  acknowledgements: Record<AcknowledgementId, CrdtAcknowledgementRequest>;
  /** Append-only list of chat messages. Immutable once appended. */
  messages: CrdtChatMessage[];
  /** Append-only list of poll votes. Immutable once appended. */
  votes: CrdtPollVote[];
}

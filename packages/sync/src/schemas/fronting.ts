import type { CrdtAuditFields, CrdtOptionalString, CrdtString } from "./common.js";
import type { CheckInRecordId, FrontingCommentId, FrontingSessionId } from "@pluralscape/types";

// ── fronting session ─────────────────────────────────────────────────

/**
 * CRDT representation of a FrontingSession (append-lww map, keyed by FrontingSessionId).
 * New sessions are added by assigning to the map; endTime, comment, positionality, and
 * archived are mutable after creation via LWW per field.
 */
export interface CrdtFrontingSession extends CrdtAuditFields {
  id: CrdtString;
  systemId: CrdtString;
  memberId: CrdtString;
  startTime: number;
  /** LWW — set on switch-out. Null while session is active. */
  endTime: number | null;
  comment: CrdtOptionalString;
  customFrontId: CrdtOptionalString;
  /** SystemStructureEntityId or null */
  structureEntityId: CrdtOptionalString;
  positionality: CrdtOptionalString;
  /** Free-text outtrigger reason | null */
  outtrigger: CrdtOptionalString;
  /** OuttriggerSentiment string: "positive" | "neutral" | "negative" | null */
  outtriggerSentiment: CrdtOptionalString;
  archived: boolean;
}

// ── fronting comment ─────────────────────────────────────────────────

/** CRDT representation of a FrontingComment (LWW map, keyed by FrontingCommentId). */
export interface CrdtFrontingComment extends CrdtAuditFields {
  id: CrdtString;
  frontingSessionId: CrdtString;
  systemId: CrdtString;
  memberId: CrdtOptionalString;
  customFrontId: CrdtOptionalString;
  structureEntityId: CrdtOptionalString;
  content: CrdtString;
  archived: boolean;
}

// ── check-in record ──────────────────────────────────────────────────

/**
 * CRDT representation of a CheckInRecord (append-lww map, keyed by CheckInRecordId).
 *
 * Topology correction: was append-only in v1 spec. Modeled as map because
 * respondedByMemberId, respondedAt, and dismissed are mutated after creation.
 *
 * Post-merge normalization: if respondedByMemberId is non-null, dismissed must
 * be false (response takes priority over dismiss when both happen concurrently).
 */
export interface CrdtCheckInRecord extends CrdtAuditFields {
  id: CrdtString;
  timerConfigId: CrdtString;
  systemId: CrdtString;
  scheduledAt: number;
  /** LWW — set when a member responds. */
  respondedByMemberId: CrdtOptionalString;
  /** LWW — set when a member responds. */
  respondedAt: number | null;
  /** LWW — set when dismissed. See normalization rule in conflict-resolution.md. */
  dismissed: boolean;
  archived: boolean;
}

// ── document ─────────────────────────────────────────────────────────

/**
 * Automerge document schema for the fronting document.
 *
 * Contains all fronting activity — the highest-frequency write path in the
 * application. Time-split by calendar quarter when document exceeds 5 MB.
 *
 * Encryption key: Master key
 * Naming: fronting-{systemId} (splits to fronting-{systemId}-{YYYY-QN})
 */
export interface FrontingDocument {
  /** Append-lww map: sessions are added by ID assignment; endTime/comment are mutable. */
  sessions: Record<FrontingSessionId, CrdtFrontingSession>;
  /** LWW map keyed by FrontingCommentId. */
  comments: Record<FrontingCommentId, CrdtFrontingComment>;
  /** Append-lww map: records are added by ID assignment; response fields are mutable. */
  checkInRecords: Record<CheckInRecordId, CrdtCheckInRecord>;
}

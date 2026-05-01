/**
 * Post-merge validators for fronting documents (sessions + comments).
 *
 * Both functions live here because the validators are colocated semantically:
 * the orchestrator detects "fronting documents" by the presence of
 * `sessions`, `comments`, and `checkInRecords`, then runs the two validators
 * back-to-back.
 */
import { getEntityMap, type DocRecord } from "./internal.js";

import type { EncryptedSyncSession } from "../sync-session.js";
import type { ConflictNotification, EncryptedChangeEnvelope } from "../types.js";
import type * as Automerge from "@automerge/automerge";

interface FrontingSessionLike {
  startTime: number;
  endTime: number | null;
  memberId: Automerge.ImmutableString | null;
  customFrontId: Automerge.ImmutableString | null;
  structureEntityId: Automerge.ImmutableString | null;
}

interface FrontingCommentLike {
  memberId: Automerge.ImmutableString | null;
  customFrontId: Automerge.ImmutableString | null;
  structureEntityId: Automerge.ImmutableString | null;
}

/**
 * Validates fronting sessions after merge:
 * - endTime > startTime: if violated, null out endTime (revert to active)
 * - Subject constraint: at least one of memberId/customFrontId/structureEntityId must be set
 *
 * Returns the count of corrections and the correction envelope (if any mutations were applied).
 */
export function normalizeFrontingSessions(session: EncryptedSyncSession<unknown>): {
  count: number;
  notifications: ConflictNotification[];
  envelope: Omit<EncryptedChangeEnvelope, "seq"> | null;
} {
  const doc = session.document as DocRecord;
  const now = Date.now();
  const notifications: ConflictNotification[] = [];

  const sessions = getEntityMap<FrontingSessionLike>(doc, "sessions");
  if (!sessions) return { count: 0, notifications, envelope: null };

  const endTimeFixIds: string[] = [];
  for (const [sessionId, s] of Object.entries(sessions)) {
    // Check endTime > startTime
    if (s.endTime !== null && s.endTime <= s.startTime) {
      endTimeFixIds.push(sessionId);
    }

    // Check subject constraint — notify but don't auto-fix (data loss risk)
    const hasMember = s.memberId !== null;
    const hasCustomFront = s.customFrontId !== null;
    const hasStructureEntity = s.structureEntityId !== null;
    if (!hasMember && !hasCustomFront && !hasStructureEntity) {
      notifications.push({
        entityType: "fronting-session",
        entityId: sessionId,
        fieldName: "subject",
        resolution: "notification-only",
        detectedAt: now,
        summary: `Fronting session ${sessionId} has no subject (memberId, customFrontId, structureEntityId all null)`,
      });
    }
  }

  if (endTimeFixIds.length === 0) {
    return { count: 0, notifications, envelope: null };
  }

  const envelope = session.change((d) => {
    const map = getEntityMap<FrontingSessionLike>(d as DocRecord, "sessions");
    for (const sessionId of endTimeFixIds) {
      const target = map?.[sessionId];
      if (target) {
        target.endTime = null;
      }
    }
  });

  for (const sessionId of endTimeFixIds) {
    notifications.push({
      entityType: "fronting-session",
      entityId: sessionId,
      fieldName: "endTime",
      resolution: "post-merge-endtime-normalize",
      detectedAt: now,
      summary: `Nulled invalid endTime for fronting session ${sessionId} (endTime <= startTime)`,
    });
  }

  return { count: endTimeFixIds.length, notifications, envelope };
}

/**
 * Post-merge validation for fronting comment author constraint:
 * At least one of memberId/customFrontId/structureEntityId must be non-null.
 *
 * Mirrors the DB constraint fronting_comments_author_check.
 * Notification-only — auto-fixing would mean choosing an author, risking data loss.
 */
export function normalizeFrontingCommentAuthors(session: EncryptedSyncSession<unknown>): {
  notifications: ConflictNotification[];
  envelope: Omit<EncryptedChangeEnvelope, "seq"> | null;
} {
  const doc = session.document as DocRecord;
  const now = Date.now();
  const notifications: ConflictNotification[] = [];

  const comments = getEntityMap<FrontingCommentLike>(doc, "comments");
  if (!comments) return { notifications, envelope: null };

  for (const [commentId, comment] of Object.entries(comments)) {
    const hasMember = comment.memberId !== null;
    const hasCustomFront = comment.customFrontId !== null;
    const hasStructureEntity = comment.structureEntityId !== null;
    if (!hasMember && !hasCustomFront && !hasStructureEntity) {
      notifications.push({
        entityType: "fronting-comment",
        entityId: commentId,
        fieldName: "author",
        resolution: "notification-only",
        detectedAt: now,
        summary: `Fronting comment ${commentId} has no author (memberId, customFrontId, structureEntityId all null)`,
      });
    }
  }

  return { notifications, envelope: null };
}

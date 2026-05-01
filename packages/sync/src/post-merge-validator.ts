/**
 * Post-merge validation engine.
 *
 * After two CRDT sessions merge, certain application-level invariants may be
 * violated (e.g. hierarchy cycles, sort order ties, conflicting boolean flags).
 * Individual validators detect and correct those violations via session.change(),
 * making the corrections part of CRDT history.
 *
 * Per-validator implementations live under `validators/`; this file is the
 * orchestrator that decides which validators apply to a given document and
 * the public barrel for downstream callers.
 */
import { validateBucketContentTags } from "./validators/bucket-content-tags.js";
import { normalizeCheckInRecord } from "./validators/check-in.js";
import { normalizeFriendConnection } from "./validators/friend-connection.js";
import {
  normalizeFrontingCommentAuthors,
  normalizeFrontingSessions,
} from "./validators/fronting.js";
import { detectHierarchyCycles } from "./validators/hierarchy-cycles.js";
import { ENTITY_FIELD_MAP, getEntityTypeByFieldName } from "./validators/internal.js";
import { normalizeSortOrder } from "./validators/sort-order.js";
import { normalizeTimerConfig } from "./validators/timer-config.js";
import { enforceTombstones } from "./validators/tombstones.js";
import { normalizeWebhookConfigs } from "./validators/webhook-config.js";

import type { SyncedEntityType } from "./strategies/crdt-strategies.js";
import type { EncryptedSyncSession } from "./sync-session.js";
import type {
  ConflictNotification,
  CycleBreak,
  EncryptedChangeEnvelope,
  PostMergeValidationResult,
  SortOrderPatch,
} from "./types.js";
import type { DocRecord } from "./validators/internal.js";

// Re-export individual validators so existing test imports
// (`../post-merge-validator.js`) continue to resolve unchanged.
export {
  detectHierarchyCycles,
  enforceTombstones,
  ENTITY_FIELD_MAP,
  getEntityTypeByFieldName,
  normalizeCheckInRecord,
  normalizeFriendConnection,
  normalizeFrontingCommentAuthors,
  normalizeFrontingSessions,
  normalizeSortOrder,
  normalizeTimerConfig,
  normalizeWebhookConfigs,
  validateBucketContentTags,
};

/**
 * Run all post-merge validations and return aggregate results.
 * Detects the document type from the session content and runs appropriate validators.
 * Each validator is independently try/caught so partial failures preserve prior results.
 *
 * When `dirtyEntityTypes` is supplied, validators that accept it (currently
 * `enforceTombstones`) narrow their scan to only those entity types; other
 * validators ignore the hint and run their full logic. Omit for the default
 * behaviour (full scan everywhere).
 */
export function runAllValidations(
  session: EncryptedSyncSession<unknown>,
  onError?: (message: string, error: unknown) => void,
  dirtyEntityTypes?: ReadonlySet<SyncedEntityType>,
): PostMergeValidationResult {
  const doc = session.document as DocRecord;
  const now = Date.now();

  const correctionEnvelopes: Omit<EncryptedChangeEnvelope, "seq">[] = [];
  const notifications: ConflictNotification[] = [];
  const errors: Array<{ validator: string; error: unknown }> = [];

  let cycleBreaks: CycleBreak[] = [];
  let sortOrderPatches: SortOrderPatch[] = [];
  let checkInNormalizations = 0;
  let friendConnectionNormalizations = 0;
  let frontingSessionNormalizations = 0;
  let timerConfigNormalizations = 0;
  let webhookConfigIssues = 0;
  let bucketContentTagDrops = 0;

  // Always run tombstone enforcement first
  try {
    const tombstoneResult = enforceTombstones(session, dirtyEntityTypes);
    if (tombstoneResult.envelope) {
      correctionEnvelopes.push(tombstoneResult.envelope);
    }
    notifications.push(...tombstoneResult.notifications);
  } catch (error: unknown) {
    errors.push({ validator: "enforceTombstones", error });
    onError?.("Tombstone enforcement failed", error);
  }

  if ("groups" in doc || "structureEntities" in doc || "innerWorldRegions" in doc) {
    try {
      const cycleResult = detectHierarchyCycles(session);
      cycleBreaks = cycleResult.breaks;
      if (cycleResult.envelope) {
        correctionEnvelopes.push(cycleResult.envelope);
      }
      for (const cycleBreak of cycleBreaks) {
        notifications.push({
          entityType: "hierarchy",
          entityId: cycleBreak.entityId,
          fieldName: "parentId",
          resolution: "post-merge-cycle",
          detectedAt: now,
          summary: `Cycle broken: nulled parent of ${cycleBreak.entityId} (was ${cycleBreak.formerParentId})`,
        });
      }
    } catch (error: unknown) {
      errors.push({ validator: "detectHierarchyCycles", error });
      onError?.("Cycle detection failed", error);
    }

    try {
      const sortResult = normalizeSortOrder(session);
      sortOrderPatches = sortResult.patches;
      if (sortResult.envelope) {
        correctionEnvelopes.push(sortResult.envelope);
      }
      for (const patch of sortOrderPatches) {
        notifications.push({
          entityType: "sortable",
          entityId: patch.entityId,
          fieldName: "sortOrder",
          resolution: "post-merge-sort-normalize",
          detectedAt: now,
          summary: `Sort order normalized: ${patch.entityId} → ${String(patch.newSortOrder)}`,
        });
      }
    } catch (error: unknown) {
      errors.push({ validator: "normalizeSortOrder", error });
      onError?.("Sort order normalization failed", error);
    }
  }

  if ("timers" in doc) {
    try {
      const timerResult = normalizeTimerConfig(session);
      timerConfigNormalizations = timerResult.count;
      if (timerResult.envelope) {
        correctionEnvelopes.push(timerResult.envelope);
      }
      notifications.push(...timerResult.notifications);
    } catch (error: unknown) {
      errors.push({ validator: "normalizeTimerConfig", error });
      onError?.("Timer config normalization failed", error);
    }
  }

  if ("webhookConfigs" in doc) {
    try {
      const webhookResult = normalizeWebhookConfigs(session);
      webhookConfigIssues = webhookResult.count;
      if (webhookResult.envelope) {
        correctionEnvelopes.push(webhookResult.envelope);
      }
      notifications.push(...webhookResult.notifications);
    } catch (error: unknown) {
      errors.push({ validator: "normalizeWebhookConfigs", error });
      onError?.("Webhook config validation failed", error);
    }
  }

  if ("checkInRecords" in doc) {
    try {
      const checkInResult = normalizeCheckInRecord(session);
      checkInNormalizations = checkInResult.count;
      if (checkInResult.envelope) {
        correctionEnvelopes.push(checkInResult.envelope);
      }
      if (checkInNormalizations > 0) {
        notifications.push({
          entityType: "check-in-record",
          entityId: "batch",
          fieldName: "dismissed",
          resolution: "post-merge-checkin-normalize",
          detectedAt: now,
          summary: `Normalized ${String(checkInNormalizations)} check-in record(s)`,
        });
      }
    } catch (error: unknown) {
      errors.push({ validator: "normalizeCheckInRecord", error });
      onError?.("Check-in normalization failed", error);
    }
  }

  // Fronting documents are identified by having all three of these fields.
  // If a future document type shares these field names, add its detection BEFORE this block.
  let frontingCommentAuthorIssues = 0;
  if ("sessions" in doc && "comments" in doc && "checkInRecords" in doc) {
    try {
      const frontingResult = normalizeFrontingSessions(session);
      frontingSessionNormalizations = frontingResult.count;
      if (frontingResult.envelope) {
        correctionEnvelopes.push(frontingResult.envelope);
      }
      notifications.push(...frontingResult.notifications);
    } catch (error: unknown) {
      errors.push({ validator: "normalizeFrontingSessions", error });
      onError?.("Fronting session normalization failed", error);
    }

    try {
      const commentResult = normalizeFrontingCommentAuthors(session);
      frontingCommentAuthorIssues = commentResult.notifications.length;
      notifications.push(...commentResult.notifications);
    } catch (error: unknown) {
      errors.push({ validator: "normalizeFrontingCommentAuthors", error });
      onError?.("Fronting comment author validation failed", error);
    }
  }

  if ("friendConnections" in doc) {
    try {
      const friendResult = normalizeFriendConnection(session);
      friendConnectionNormalizations = friendResult.count;
      if (friendResult.envelope) {
        correctionEnvelopes.push(friendResult.envelope);
      }
      if (friendConnectionNormalizations > 0) {
        notifications.push({
          entityType: "friend-connection",
          entityId: "batch",
          fieldName: "status",
          resolution: "post-merge-friend-status",
          detectedAt: now,
          summary: `Normalized ${String(friendConnectionNormalizations)} friend connection(s)`,
        });
      }
    } catch (error: unknown) {
      errors.push({ validator: "normalizeFriendConnection", error });
      onError?.("Friend connection normalization failed", error);
    }
  }

  if ("contentTags" in doc) {
    try {
      const tagResult = validateBucketContentTags(session);
      bucketContentTagDrops = tagResult.count;
      if (tagResult.envelope) {
        correctionEnvelopes.push(tagResult.envelope);
      }
      notifications.push(...tagResult.notifications);
    } catch (error: unknown) {
      errors.push({ validator: "validateBucketContentTags", error });
      onError?.("Bucket content tag validation failed", error);
    }
  }

  return {
    cycleBreaks,
    sortOrderPatches,
    checkInNormalizations,
    friendConnectionNormalizations,
    frontingSessionNormalizations,
    frontingCommentAuthorIssues,
    timerConfigNormalizations,
    webhookConfigIssues,
    bucketContentTagDrops,
    correctionEnvelopes,
    notifications,
    errors,
  };
}

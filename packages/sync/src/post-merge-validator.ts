/**
 * Post-merge validation engine.
 *
 * After two CRDT sessions merge, certain application-level invariants may be
 * violated (e.g. hierarchy cycles, sort order ties, conflicting boolean flags).
 * This module detects and corrects those violations via session.change(),
 * making the corrections part of CRDT history.
 */
import * as Automerge from "@automerge/automerge";
import { parseTimeToMinutes, WEBHOOK_EVENT_TYPE_VALUES } from "@pluralscape/validation";

import { ENTITY_CRDT_STRATEGIES } from "./strategies/crdt-strategies.js";

import type { EncryptedSyncSession } from "./sync-session.js";
import type {
  ConflictNotification,
  CycleBreak,
  EncryptedChangeEnvelope,
  PostMergeValidationResult,
  SortOrderPatch,
} from "./types.js";

// ── Record-based document accessors ─────────────────────────────────
// The validator uses dynamic runtime field access via ENTITY_FIELD_MAP —
// entity types are determined at runtime from ENTITY_CRDT_STRATEGIES, so
// a union type cannot be narrowed meaningfully here. Record<string, unknown>
// is the correct type for this pattern of structural duck-typing.

type DocRecord = Record<string, unknown>;

interface ArchivableEntity {
  archived: boolean;
}

interface ParentableEntity {
  id: Automerge.ImmutableString;
}

interface SortableEntity {
  id: Automerge.ImmutableString;
  sortOrder: number;
  createdAt: number;
  [key: string]: unknown;
}

interface CheckInLike {
  respondedByMemberId: Automerge.ImmutableString | null;
  dismissed: boolean;
}

interface TimerConfigLike {
  intervalMinutes: number | null;
  wakingHoursOnly: boolean | null;
  wakingStart: Automerge.ImmutableString | null;
  wakingEnd: Automerge.ImmutableString | null;
  enabled: boolean;
  archived: boolean;
}

interface WebhookConfigLike {
  url: Automerge.ImmutableString;
  eventTypes: unknown[];
  enabled: boolean;
}

/** Valid webhook event types for post-merge validation. */
const VALID_WEBHOOK_EVENT_TYPES: ReadonlySet<string> = new Set(WEBHOOK_EVENT_TYPE_VALUES);

interface FriendConnectionLike {
  status: Automerge.ImmutableString;
  assignedBuckets: Record<string, true>;
  /** JSON-serialized object (e.g. `{"showMembers":true}`). Parse `.val` with JSON.parse(). */
  visibility: Automerge.ImmutableString;
}

interface FrontingSessionLike {
  startTime: number;
  endTime: number | null;
  memberId: Automerge.ImmutableString | null;
  customFrontId: Automerge.ImmutableString | null;
  structureEntityId: Automerge.ImmutableString | null;
}

/** Typed accessor for a nested entity map within an Automerge document. */
function getEntityMap<T>(doc: DocRecord, field: string): Record<string, T> | undefined {
  const val = doc[field];
  if (val !== null && typeof val === "object") {
    return val as Record<string, T>;
  }
  return undefined;
}

/**
 * Extracts the parent ID string from an entity's parent field.
 * Handles ImmutableString unwrapping and null/undefined values.
 */
function getParentId(
  entity: Record<string, Automerge.ImmutableString | null> | undefined,
  parentField: string,
): string | null {
  const parentVal = entity?.[parentField];
  if (parentVal !== null && parentVal !== undefined && typeof parentVal === "object") {
    return parentVal.val;
  }
  return null;
}

// ── Field name mapping (derived from CRDT strategies) ───────────────

/** Maps CRDT entity type names to their field names in Automerge documents. */
const ENTITY_FIELD_MAP: ReadonlyMap<string, string> = new Map(
  Object.entries(ENTITY_CRDT_STRATEGIES).map(([type, strat]) => [type, strat.fieldName]),
);

// ── Validation functions ────────────────────────────────────────────

/**
 * Walk lww-map / append-lww entities and re-stamp `archived = true` for any
 * entity that is currently archived. This ensures tombstone wins over concurrent
 * un-archive operations by making the archive the latest CRDT write.
 *
 * Returns notifications and the correction envelope (if any mutations were applied).
 */
export function enforceTombstones(session: EncryptedSyncSession<unknown>): {
  notifications: ConflictNotification[];
  envelope: Omit<EncryptedChangeEnvelope, "seq"> | null;
} {
  const notifications: ConflictNotification[] = [];
  const doc = session.document as DocRecord;

  const lwwMapTypes = Object.entries(ENTITY_CRDT_STRATEGIES).filter(([, strategy]) => {
    return strategy.storageType === "lww-map" || strategy.storageType === "append-lww";
  });

  const mutations: Array<{ fieldName: string; entityId: string; entityType: string }> = [];

  for (const [entityType, strategy] of lwwMapTypes) {
    const { fieldName } = strategy;

    const entityMap = getEntityMap<ArchivableEntity>(doc, fieldName);
    if (!entityMap) continue;

    for (const [entityId, entity] of Object.entries(entityMap)) {
      if (entity.archived) {
        mutations.push({ fieldName, entityId, entityType });
      }
    }
  }

  if (mutations.length === 0) {
    return { notifications, envelope: null };
  }

  const envelope = session.change((d) => {
    const docMap = d as DocRecord;
    for (const { fieldName, entityId } of mutations) {
      const map = getEntityMap<ArchivableEntity>(docMap, fieldName);
      const target = map?.[entityId];
      if (target) {
        target.archived = true;
      }
    }
  });

  for (const { entityType, entityId } of mutations) {
    notifications.push({
      entityType,
      entityId,
      fieldName: "archived",
      resolution: "lww-field",
      detectedAt: Date.now(),
      summary: `Re-stamped tombstone for ${entityType} ${entityId}`,
    });
  }

  return { notifications, envelope };
}

/**
 * Generic cycle detection for a given entity field and parent field.
 * Returns pending clears (entityId + parentField to null) without mutating the session.
 */
function detectCyclesForField(
  doc: DocRecord,
  fieldName: string,
  parentField: string,
): Array<{ fieldName: string; parentField: string; entityId: string; formerParentId: string }> {
  const entityMap = getEntityMap<
    ParentableEntity & Record<string, Automerge.ImmutableString | null>
  >(doc, fieldName);
  if (!entityMap) return [];

  const pendingClears: Array<{
    fieldName: string;
    parentField: string;
    entityId: string;
    formerParentId: string;
  }> = [];
  const visited = new Set<string>();
  const inStack = new Set<string>();

  for (const entityId of Object.keys(entityMap)) {
    if (visited.has(entityId)) continue;

    const path: string[] = [];
    let current: string | null = entityId;

    while (current !== null && !visited.has(current)) {
      if (inStack.has(current)) {
        const cycleStart = path.indexOf(current);
        const cycle = path.slice(cycleStart);
        cycle.push(current);

        const lowestId = cycle.sort()[0];
        if (lowestId !== undefined) {
          const entity = entityMap[lowestId];
          const parentId = getParentId(entity, parentField);
          if (parentId !== null) {
            pendingClears.push({
              fieldName,
              parentField,
              entityId: lowestId,
              formerParentId: parentId,
            });
          }
        }
        break;
      }

      inStack.add(current);
      path.push(current);

      const currentEntity = entityMap[current];
      current = getParentId(currentEntity, parentField);

      if (current !== null && !(current in entityMap)) {
        current = null;
      }
    }

    for (const id of path) {
      visited.add(id);
      inStack.delete(id);
    }
  }

  return pendingClears;
}

/**
 * DFS on hierarchical entity parent chains (derived from strategies with parentField).
 * Break cycles by nulling the parent of the lowest-ID entity (deterministic).
 *
 * Returns cycle breaks and the correction envelope (if any mutations were applied).
 */
export function detectHierarchyCycles(session: EncryptedSyncSession<unknown>): {
  breaks: CycleBreak[];
  envelope: Omit<EncryptedChangeEnvelope, "seq"> | null;
} {
  const doc = session.document as DocRecord;
  const allPendingClears: Array<{
    fieldName: string;
    parentField: string;
    entityId: string;
    formerParentId: string;
  }> = [];

  for (const [, strategy] of Object.entries(ENTITY_CRDT_STRATEGIES)) {
    if ("parentField" in strategy) {
      const clears = detectCyclesForField(doc, strategy.fieldName, strategy.parentField);
      allPendingClears.push(...clears);
    }
  }

  if (allPendingClears.length === 0) {
    return { breaks: [], envelope: null };
  }

  const envelope = session.change((d) => {
    const docMap = d as DocRecord;
    for (const { fieldName, parentField, entityId } of allPendingClears) {
      const map = getEntityMap<Record<string, Automerge.ImmutableString | null>>(docMap, fieldName);
      const target = map?.[entityId];
      if (target) {
        target[parentField] = null;
      }
    }
  });

  const breaks = allPendingClears.map(({ entityId, formerParentId }) => ({
    entityId,
    formerParentId,
  }));

  return { breaks, envelope };
}

/** Pure computation: collect sort order patches for a single entity map. */
function collectSortOrderPatches<T extends SortableEntity>(
  entityMap: Record<string, T>,
  fieldName: string,
): Array<SortOrderPatch & { fieldName: string }> {
  const patches: Array<SortOrderPatch & { fieldName: string }> = [];
  const entities = Object.entries(entityMap);

  if (entities.length === 0) return patches;

  const sortOrders = entities.map(([, e]) => e.sortOrder);
  const uniqueOrders = new Set(sortOrders);

  if (uniqueOrders.size === sortOrders.length) {
    return patches;
  }

  const sorted = [...entities].sort(([idA, a], [idB, b]) => {
    if (a.sortOrder !== b.sortOrder) return a.sortOrder - b.sortOrder;
    if (a.createdAt !== b.createdAt) return a.createdAt - b.createdAt;
    return idA.localeCompare(idB);
  });

  for (let i = 0; i < sorted.length; i++) {
    const [entityId, entity] = sorted[i] as [string, T];
    const newOrder = i + 1;

    if (entity.sortOrder !== newOrder) {
      patches.push({ entityId, newSortOrder: newOrder, fieldName });
    }
  }

  return patches;
}

/**
 * Partitions an entity map by a grouping field (e.g. parentEntityId).
 * Entities with the same group field value are placed in the same partition,
 * allowing sort order normalization to operate independently per group.
 */
function partitionByGroupField<T extends SortableEntity>(
  entityMap: Record<string, T>,
  groupField: string,
): Record<string, Record<string, T>> {
  const NULL_GROUP = "__null_group__";
  const partitions: Record<string, Record<string, T>> = {};

  for (const [id, entity] of Object.entries(entityMap)) {
    const groupValue: unknown = entity[groupField];
    let key: string;
    if (groupValue === null || groupValue === undefined) {
      key = NULL_GROUP;
    } else if (typeof groupValue === "object" && "val" in groupValue) {
      key = (groupValue as { val: string }).val;
    } else {
      key = NULL_GROUP;
    }

    partitions[key] ??= {};
    (partitions[key] as Record<string, T>)[id] = entity;
  }

  return partitions;
}

/**
 * For entities with sortOrder (derived from strategies with hasSortOrder), detect ties
 * and re-assign sequential values by createdAt then id.
 *
 * Returns patches and the correction envelope (if any mutations were applied).
 */
export function normalizeSortOrder(session: EncryptedSyncSession<unknown>): {
  patches: SortOrderPatch[];
  envelope: Omit<EncryptedChangeEnvelope, "seq"> | null;
} {
  const doc = session.document as DocRecord;
  const allPatches: Array<SortOrderPatch & { fieldName: string }> = [];

  const sortableStrategies = Object.values(ENTITY_CRDT_STRATEGIES).filter(
    (s): s is typeof s & { hasSortOrder: true } => "hasSortOrder" in s,
  );

  for (const strategy of sortableStrategies) {
    const entityMap = getEntityMap<SortableEntity>(doc, strategy.fieldName);
    if (!entityMap) continue;

    if ("sortGroupField" in strategy && typeof strategy.sortGroupField === "string") {
      // Parent-scoped normalization: partition by group field, then normalize each group
      const partitions = partitionByGroupField(entityMap, strategy.sortGroupField);
      for (const partition of Object.values(partitions)) {
        allPatches.push(...collectSortOrderPatches(partition, strategy.fieldName));
      }
    } else {
      allPatches.push(...collectSortOrderPatches(entityMap, strategy.fieldName));
    }
  }

  if (allPatches.length === 0) {
    return { patches: [], envelope: null };
  }

  const envelope = session.change((d) => {
    const docMap = d as DocRecord;
    for (const { entityId, newSortOrder, fieldName } of allPatches) {
      const map = getEntityMap<SortableEntity>(docMap, fieldName);
      const target = map?.[entityId];
      if (target) {
        target.sortOrder = newSortOrder;
      }
    }
  });

  const patches = allPatches.map(({ entityId, newSortOrder }) => ({
    entityId,
    newSortOrder,
  }));

  return { patches, envelope };
}

/**
 * If respondedByMemberId is set AND dismissed is true, re-apply dismissed = false.
 * Response takes priority over dismissal.
 *
 * Returns the count and the correction envelope (if any mutations were applied).
 */
export function normalizeCheckInRecord(session: EncryptedSyncSession<unknown>): {
  count: number;
  envelope: Omit<EncryptedChangeEnvelope, "seq"> | null;
} {
  const doc = session.document as DocRecord;

  const checkInRecords = getEntityMap<CheckInLike>(doc, "checkInRecords");
  if (!checkInRecords) return { count: 0, envelope: null };

  const toFix: string[] = [];
  for (const [recordId, record] of Object.entries(checkInRecords)) {
    if (record.respondedByMemberId !== null && record.dismissed) {
      toFix.push(recordId);
    }
  }

  if (toFix.length === 0) {
    return { count: 0, envelope: null };
  }

  const envelope = session.change((d) => {
    const map = getEntityMap<CheckInLike>(d as DocRecord, "checkInRecords");
    for (const recordId of toFix) {
      const target = map?.[recordId];
      if (target) {
        target.dismissed = false;
      }
    }
  });

  return { count: toFix.length, envelope };
}

/**
 * If status reverted to "pending" from "accepted", re-stamp "accepted".
 * Accepted connections should not revert to pending.
 * Uses JSON.parse to check visibility instead of string comparison.
 *
 * Returns the count and the correction envelope (if any mutations were applied).
 */
export function normalizeFriendConnection(session: EncryptedSyncSession<unknown>): {
  count: number;
  envelope: Omit<EncryptedChangeEnvelope, "seq"> | null;
} {
  const doc = session.document as DocRecord;

  const friendConnections = getEntityMap<FriendConnectionLike>(doc, "friendConnections");
  if (!friendConnections) return { count: 0, envelope: null };

  const toFix: string[] = [];
  for (const [connectionId, connection] of Object.entries(friendConnections)) {
    if (connection.status.val === "pending") {
      const hasAssignedBuckets = Object.keys(connection.assignedBuckets).length > 0;
      let hasVisibility = false;
      try {
        const parsed = JSON.parse(connection.visibility.val) as Record<string, unknown>;
        hasVisibility = Object.keys(parsed).length > 0;
      } catch {
        hasVisibility = false;
      }

      if (hasAssignedBuckets || hasVisibility) {
        toFix.push(connectionId);
      }
    }
  }

  if (toFix.length === 0) {
    return { count: 0, envelope: null };
  }

  const envelope = session.change((d) => {
    const map = getEntityMap<FriendConnectionLike>(d as DocRecord, "friendConnections");
    for (const connectionId of toFix) {
      const target = map?.[connectionId];
      if (target) {
        target.status = new Automerge.ImmutableString("accepted");
      }
    }
  });

  return { count: toFix.length, envelope };
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

interface FrontingCommentLike {
  memberId: Automerge.ImmutableString | null;
  customFrontId: Automerge.ImmutableString | null;
  structureEntityId: Automerge.ImmutableString | null;
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

/**
 * Post-merge validation for timer configs:
 * - If wakingHoursOnly is true, wakingStart must be before wakingEnd
 * - intervalMinutes must be > 0 when set
 *
 * Violations are corrected by disabling the timer (enabled = false)
 * to prevent invalid check-in generation.
 */
export function normalizeTimerConfig(session: EncryptedSyncSession<unknown>): {
  count: number;
  notifications: ConflictNotification[];
  envelope: Omit<EncryptedChangeEnvelope, "seq"> | null;
} {
  const doc = session.document as DocRecord;
  const now = Date.now();
  const notifications: ConflictNotification[] = [];

  const timers = getEntityMap<TimerConfigLike>(doc, "timers");
  if (!timers) return { count: 0, notifications, envelope: null };

  const toDisable: string[] = [];
  for (const [timerId, timer] of Object.entries(timers)) {
    if (timer.archived) continue;

    // Check intervalMinutes > 0 when set
    if (timer.intervalMinutes !== null && timer.intervalMinutes <= 0) {
      toDisable.push(timerId);
      notifications.push({
        entityType: "timer",
        entityId: timerId,
        fieldName: "intervalMinutes",
        resolution: "post-merge-timer-normalize",
        detectedAt: now,
        summary: `Disabled timer ${timerId}: intervalMinutes must be > 0 (was ${String(timer.intervalMinutes)})`,
      });
      continue;
    }

    // Check wakingStart < wakingEnd when wakingHoursOnly is true
    if (timer.wakingHoursOnly === true) {
      const startStr = timer.wakingStart !== null ? timer.wakingStart.val : null;
      const endStr = timer.wakingEnd !== null ? timer.wakingEnd.val : null;
      const startMin = startStr !== null ? parseTimeToMinutes(startStr) : null;
      const endMin = endStr !== null ? parseTimeToMinutes(endStr) : null;

      if (startMin === null || endMin === null || startMin === endMin) {
        toDisable.push(timerId);
        notifications.push({
          entityType: "timer",
          entityId: timerId,
          fieldName: "wakingHours",
          resolution: "post-merge-timer-normalize",
          detectedAt: now,
          summary: `Disabled timer ${timerId}: invalid waking hours (start=${String(startStr)}, end=${String(endStr)})`,
        });
      }
    }
  }

  if (toDisable.length === 0) {
    return { count: 0, notifications, envelope: null };
  }

  const envelope = session.change((d) => {
    const map = getEntityMap<TimerConfigLike>(d as DocRecord, "timers");
    for (const timerId of toDisable) {
      const target = map?.[timerId];
      if (target) {
        target.enabled = false;
      }
    }
  });

  return { count: toDisable.length, notifications, envelope };
}

/**
 * Validates webhook configs after merge:
 * - URL format: must be a valid URL (HTTPS required in production, but post-merge
 *   only checks URL starts with http:// or https://)
 * - eventTypes: all values must be from the WebhookEventType enum
 *
 * Invalid entries generate notifications only (no auto-fix to avoid data loss).
 * Returns the count of issues and notifications.
 */
export function normalizeWebhookConfigs(session: EncryptedSyncSession<unknown>): {
  count: number;
  notifications: ConflictNotification[];
  envelope: Omit<EncryptedChangeEnvelope, "seq"> | null;
} {
  const doc = session.document as DocRecord;
  const timestamp = Date.now();
  const notifications: ConflictNotification[] = [];

  const configs = getEntityMap<WebhookConfigLike>(doc, "webhookConfigs");
  if (!configs) return { count: 0, notifications, envelope: null };

  let issueCount = 0;

  for (const [configId, config] of Object.entries(configs)) {
    const urlVal = typeof config.url === "object" ? config.url.val : null;
    if (urlVal !== null) {
      try {
        const parsed = new URL(urlVal);
        if (parsed.protocol !== "https:" && parsed.protocol !== "http:") {
          notifications.push({
            entityType: "webhook-config",
            entityId: configId,
            fieldName: "url",
            resolution: "notification-only",
            detectedAt: timestamp,
            summary: `Webhook config ${configId} has non-HTTP(S) URL: ${urlVal}`,
          });
          issueCount++;
        }
      } catch {
        notifications.push({
          entityType: "webhook-config",
          entityId: configId,
          fieldName: "url",
          resolution: "notification-only",
          detectedAt: timestamp,
          summary: `Webhook config ${configId} has invalid URL format`,
        });
        issueCount++;
      }
    }

    if (Array.isArray(config.eventTypes)) {
      for (const eventType of config.eventTypes) {
        const val =
          typeof eventType === "object" && eventType !== null && "val" in eventType
            ? (eventType as { val: string }).val
            : typeof eventType === "string"
              ? eventType
              : null;

        if (val === null || !VALID_WEBHOOK_EVENT_TYPES.has(val)) {
          notifications.push({
            entityType: "webhook-config",
            entityId: configId,
            fieldName: "eventTypes",
            resolution: "notification-only",
            detectedAt: timestamp,
            summary: `Webhook config ${configId} has unknown event type: ${String(val)}`,
          });
          issueCount++;
          break;
        }
      }
    }
  }

  return { count: issueCount, notifications, envelope: null };
}

// ── Public API ──────────────────────────────────────────────────────

/**
 * Run all post-merge validations and return aggregate results.
 * Detects the document type from the session content and runs appropriate validators.
 * Each validator is independently try/caught so partial failures preserve prior results.
 */
export function runAllValidations(
  session: EncryptedSyncSession<unknown>,
  onError?: (message: string, error: unknown) => void,
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

  // Always run tombstone enforcement first
  try {
    const tombstoneResult = enforceTombstones(session);
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

  return {
    cycleBreaks,
    sortOrderPatches,
    checkInNormalizations,
    friendConnectionNormalizations,
    frontingSessionNormalizations,
    frontingCommentAuthorIssues,
    timerConfigNormalizations,
    webhookConfigIssues,
    correctionEnvelopes,
    notifications,
    errors,
  };
}

/** Derived field map from CRDT strategies: entity type → document field name. */
export { ENTITY_FIELD_MAP };

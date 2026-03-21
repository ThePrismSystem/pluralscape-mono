/**
 * Post-merge validation engine.
 *
 * After two CRDT sessions merge, certain application-level invariants may be
 * violated (e.g. hierarchy cycles, sort order ties, conflicting boolean flags).
 * This validator detects and corrects those violations via session.change(),
 * making the corrections part of CRDT history.
 */
import * as Automerge from "@automerge/automerge";

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
}

interface CheckInLike {
  respondedByMemberId: Automerge.ImmutableString | null;
  dismissed: boolean;
}

interface FriendConnectionLike {
  status: Automerge.ImmutableString;
  assignedBuckets: Record<string, true>;
  visibility: Automerge.ImmutableString;
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

// ── Field name mapping ───────────────────────────────────────────────

/** Maps CRDT entity type names to their field names in Automerge documents. */
const ENTITY_FIELD_MAP: ReadonlyMap<string, string> = new Map(
  Object.entries({
    member: "members",
    "member-photo": "memberPhotos",
    group: "groups",
    subsystem: "subsystems",
    "side-system": "sideSystems",
    layer: "layers",
    relationship: "relationships",
    "custom-front": "customFronts",
    "field-definition": "fieldDefinitions",
    "field-value": "fieldValues",
    "innerworld-entity": "innerWorldEntities",
    "innerworld-region": "innerWorldRegions",
    timer: "timers",
    "fronting-session": "sessions",
    "fronting-comment": "comments",
    "check-in-record": "checkInRecords",
    channel: "channel",
    "board-message": "boardMessages",
    poll: "polls",
    "poll-option": "pollOptions",
    acknowledgement: "acknowledgements",
    "journal-entry": "entries",
    "wiki-page": "wikiPages",
    note: "notes",
    bucket: "buckets",
    "bucket-content-tag": "contentTags",
    "friend-connection": "friendConnections",
    "friend-code": "friendCodes",
    "key-grant": "keyGrants",
  }),
);

// ── Validator ────────────────────────────────────────────────────────

/**
 * Validates and corrects post-merge CRDT state.
 *
 * Each method takes a session, detects violations, and applies corrective
 * mutations via session.change(). The corrections become part of CRDT history.
 */
export class PostMergeValidator {
  /**
   * Walk all lww-map entities and re-stamp `archived = true` for any entity
   * that is currently archived. This ensures tombstone wins over concurrent
   * un-archive operations by making the archive the latest CRDT write.
   *
   * Returns notifications and the correction envelope (if any mutations were applied).
   */
  enforceTombstones(session: EncryptedSyncSession<unknown>): {
    notifications: ConflictNotification[];
    envelope: Omit<EncryptedChangeEnvelope, "seq"> | null;
  } {
    const notifications: ConflictNotification[] = [];
    const doc = session.document as DocRecord;

    const lwwMapTypes = Object.entries(ENTITY_CRDT_STRATEGIES).filter(
      ([, strategy]) => strategy.storageType === "lww-map" || strategy.storageType === "append-lww",
    );

    const mutations: Array<{ fieldName: string; entityId: string; entityType: string }> = [];

    for (const [entityType] of lwwMapTypes) {
      const fieldName = ENTITY_FIELD_MAP.get(entityType);
      if (!fieldName) continue;

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
   * DFS on groups/subsystems/innerWorldRegions parent chains.
   * Break cycles by nulling the parent of the lowest-ID entity (deterministic).
   *
   * Returns cycle breaks and the correction envelope (if any mutations were applied).
   */
  detectHierarchyCycles(session: EncryptedSyncSession<unknown>): {
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

    const collectClears = this.detectCyclesForField(doc, "groups", "parentGroupId");
    allPendingClears.push(...collectClears);

    const subsystemClears = this.detectCyclesForField(doc, "subsystems", "parentSubsystemId");
    allPendingClears.push(...subsystemClears);

    const regionClears = this.detectCyclesForField(doc, "innerWorldRegions", "parentRegionId");
    allPendingClears.push(...regionClears);

    if (allPendingClears.length === 0) {
      return { breaks: [], envelope: null };
    }

    const envelope = session.change((d) => {
      const docMap = d as DocRecord;
      for (const { fieldName, parentField, entityId } of allPendingClears) {
        const map = getEntityMap<Record<string, Automerge.ImmutableString | null>>(
          docMap,
          fieldName,
        );
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

  /**
   * For entities with sortOrder, detect ties and re-assign sequential values
   * by createdAt then id. Handles groups, memberPhotos, and fieldDefinitions.
   *
   * Returns patches and the correction envelope (if any mutations were applied).
   */
  normalizeSortOrder(session: EncryptedSyncSession<unknown>): {
    patches: SortOrderPatch[];
    envelope: Omit<EncryptedChangeEnvelope, "seq"> | null;
  } {
    const doc = session.document as DocRecord;
    const allPatches: Array<SortOrderPatch & { fieldName: string }> = [];

    for (const fieldName of ["groups", "memberPhotos", "fieldDefinitions"]) {
      const entityMap = getEntityMap<SortableEntity>(doc, fieldName);
      if (entityMap) {
        allPatches.push(...this.collectSortOrderPatches(entityMap, fieldName));
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
  normalizeCheckInRecord(session: EncryptedSyncSession<unknown>): {
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
  normalizeFriendConnection(session: EncryptedSyncSession<unknown>): {
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
   * Run all validations and return aggregate results.
   * Detects the document type from the session content and runs appropriate validators.
   */
  runAllValidations(session: EncryptedSyncSession<unknown>): PostMergeValidationResult {
    const doc = session.document as DocRecord;
    const now = Date.now();

    const correctionEnvelopes: Omit<EncryptedChangeEnvelope, "seq">[] = [];
    const notifications: ConflictNotification[] = [];

    // Always run tombstone enforcement first
    const tombstoneResult = this.enforceTombstones(session);
    if (tombstoneResult.envelope) {
      correctionEnvelopes.push(tombstoneResult.envelope);
    }
    notifications.push(...tombstoneResult.notifications);

    let cycleBreaks: CycleBreak[] = [];
    let sortOrderPatches: SortOrderPatch[] = [];
    let checkInNormalizations = 0;
    let friendConnectionNormalizations = 0;

    if ("groups" in doc || "subsystems" in doc || "innerWorldRegions" in doc) {
      const cycleResult = this.detectHierarchyCycles(session);
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

      const sortResult = this.normalizeSortOrder(session);
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
    }

    if ("checkInRecords" in doc) {
      const checkInResult = this.normalizeCheckInRecord(session);
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
    }

    if ("friendConnections" in doc) {
      const friendResult = this.normalizeFriendConnection(session);
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
    }

    return {
      cycleBreaks,
      sortOrderPatches,
      checkInNormalizations,
      friendConnectionNormalizations,
      tombstoneNotifications: tombstoneResult.notifications,
      correctionEnvelopes,
      notifications,
    };
  }

  // ── Private helpers ──────────────────────────────────────────────────

  /**
   * Generic cycle detection for a given entity field and parent field.
   * Returns pending clears (entityId + parentField to null) without mutating the session.
   */
  private detectCyclesForField(
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

  /** Pure computation: collect sort order patches for a single entity map. */
  private collectSortOrderPatches<T extends SortableEntity>(
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
}

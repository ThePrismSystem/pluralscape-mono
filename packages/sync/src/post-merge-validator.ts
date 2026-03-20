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
  PostMergeValidationResult,
  SortOrderPatch,
} from "./types.js";

// ── Record-based document accessors ─────────────────────────────────
// These types avoid forbidden `as unknown as ConcreteType` casts by
// using structural Record types that the Automerge documents satisfy.

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
   */
  enforceTombstones(session: EncryptedSyncSession<unknown>): ConflictNotification[] {
    const notifications: ConflictNotification[] = [];
    const doc = session.document as DocRecord;

    const lwwMapTypes = Object.entries(ENTITY_CRDT_STRATEGIES).filter(
      ([, strategy]) => strategy.storageType === "lww-map" || strategy.storageType === "append-lww",
    );

    const entityFieldMap = buildEntityFieldMap();

    for (const [entityType] of lwwMapTypes) {
      const fieldName = entityFieldMap.get(entityType);
      if (!fieldName) continue;

      const entityMap = getEntityMap<ArchivableEntity>(doc, fieldName);
      if (!entityMap) continue;

      for (const [entityId, entity] of Object.entries(entityMap)) {
        if (entity.archived) {
          session.change((d) => {
            const docMap = d as DocRecord;
            const map = getEntityMap<ArchivableEntity>(docMap, fieldName);
            const target = map?.[entityId];
            if (target) {
              target.archived = true;
            }
          });

          notifications.push({
            entityType,
            entityId,
            fieldName: "archived",
            resolution: "lww-field",
            detectedAt: Date.now(),
            summary: `Re-stamped tombstone for ${entityType} ${entityId}`,
          });
        }
      }
    }

    return notifications;
  }

  /**
   * DFS on groups/subsystems/innerWorldRegions parent chains.
   * Break cycles by nulling the parent of the lowest-ID entity (deterministic).
   */
  detectHierarchyCycles(session: EncryptedSyncSession<unknown>): CycleBreak[] {
    const doc = session.document as DocRecord;
    const breaks: CycleBreak[] = [];

    // Check groups
    const groups = getEntityMap<
      ParentableEntity & { parentGroupId: Automerge.ImmutableString | null }
    >(doc, "groups");
    if (groups) {
      breaks.push(
        ...this.breakCyclesInMap(
          groups,
          (entity) => entity.parentGroupId?.val ?? null,
          (session_, entityId) => {
            session_.change((d) => {
              const map = getEntityMap<{ parentGroupId: Automerge.ImmutableString | null }>(
                d as DocRecord,
                "groups",
              );
              const target = map?.[entityId];
              if (target) {
                target.parentGroupId = null;
              }
            });
          },
          session,
        ),
      );
    }

    // Check subsystems
    const subsystems = getEntityMap<
      ParentableEntity & { parentSubsystemId: Automerge.ImmutableString | null }
    >(doc, "subsystems");
    if (subsystems) {
      breaks.push(
        ...this.breakCyclesInMap(
          subsystems,
          (entity) => entity.parentSubsystemId?.val ?? null,
          (session_, entityId) => {
            session_.change((d) => {
              const map = getEntityMap<{ parentSubsystemId: Automerge.ImmutableString | null }>(
                d as DocRecord,
                "subsystems",
              );
              const target = map?.[entityId];
              if (target) {
                target.parentSubsystemId = null;
              }
            });
          },
          session,
        ),
      );
    }

    // Check innerworld regions
    const regions = getEntityMap<
      ParentableEntity & { parentRegionId: Automerge.ImmutableString | null }
    >(doc, "innerWorldRegions");
    if (regions) {
      breaks.push(
        ...this.breakCyclesInMap(
          regions,
          (entity) => entity.parentRegionId?.val ?? null,
          (session_, entityId) => {
            session_.change((d) => {
              const map = getEntityMap<{ parentRegionId: Automerge.ImmutableString | null }>(
                d as DocRecord,
                "innerWorldRegions",
              );
              const target = map?.[entityId];
              if (target) {
                target.parentRegionId = null;
              }
            });
          },
          session,
        ),
      );
    }

    return breaks;
  }

  /**
   * For entities with sortOrder, detect ties and re-assign sequential values
   * by createdAt then id.
   */
  normalizeSortOrder(session: EncryptedSyncSession<unknown>): SortOrderPatch[] {
    const doc = session.document as DocRecord;
    const patches: SortOrderPatch[] = [];

    const groups = getEntityMap<SortableEntity>(doc, "groups");
    if (groups) {
      patches.push(...this.normalizeSortOrderInMap(groups, "groups", session));
    }

    return patches;
  }

  /**
   * If respondedByMemberId is set AND dismissed is true, re-apply dismissed = false.
   * Response takes priority over dismissal.
   */
  normalizeCheckInRecord(session: EncryptedSyncSession<unknown>): number {
    const doc = session.document as DocRecord;
    let count = 0;

    const checkInRecords = getEntityMap<CheckInLike>(doc, "checkInRecords");
    if (!checkInRecords) return 0;

    for (const [recordId, record] of Object.entries(checkInRecords)) {
      if (record.respondedByMemberId !== null && record.dismissed) {
        session.change((d) => {
          const map = getEntityMap<CheckInLike>(d as DocRecord, "checkInRecords");
          const target = map?.[recordId];
          if (target) {
            target.dismissed = false;
          }
        });
        count++;
      }
    }

    return count;
  }

  /**
   * If status reverted to "pending" from "accepted", re-stamp "accepted".
   * Accepted connections should not revert to pending.
   */
  normalizeFriendConnection(session: EncryptedSyncSession<unknown>): number {
    const doc = session.document as DocRecord;
    let count = 0;

    const friendConnections = getEntityMap<FriendConnectionLike>(doc, "friendConnections");
    if (!friendConnections) return 0;

    for (const [connectionId, connection] of Object.entries(friendConnections)) {
      if (connection.status.val === "pending") {
        const hasAssignedBuckets = Object.keys(connection.assignedBuckets).length > 0;
        const hasVisibility = connection.visibility.val !== "{}";

        if (hasAssignedBuckets || hasVisibility) {
          session.change((d) => {
            const map = getEntityMap<FriendConnectionLike>(d as DocRecord, "friendConnections");
            const target = map?.[connectionId];
            if (target) {
              target.status = new Automerge.ImmutableString("accepted");
            }
          });
          count++;
        }
      }
    }

    return count;
  }

  /**
   * Run all validations and return aggregate results.
   * Detects the document type from the session content and runs appropriate validators.
   */
  runAllValidations(session: EncryptedSyncSession<unknown>): PostMergeValidationResult {
    const doc = session.document as DocRecord;

    const cycleBreaks: CycleBreak[] = [];
    const sortOrderPatches: SortOrderPatch[] = [];
    let checkInNormalizations = 0;
    let friendConnectionNormalizations = 0;

    if ("groups" in doc || "subsystems" in doc || "innerWorldRegions" in doc) {
      cycleBreaks.push(...this.detectHierarchyCycles(session));
      sortOrderPatches.push(...this.normalizeSortOrder(session));
    }

    if ("checkInRecords" in doc) {
      checkInNormalizations = this.normalizeCheckInRecord(session);
    }

    if ("friendConnections" in doc) {
      friendConnectionNormalizations = this.normalizeFriendConnection(session);
    }

    return {
      cycleBreaks,
      sortOrderPatches,
      checkInNormalizations,
      friendConnectionNormalizations,
    };
  }

  // ── Private helpers ──────────────────────────────────────────────────

  private breakCyclesInMap<T extends ParentableEntity>(
    entityMap: Record<string, T>,
    getParent: (entity: T) => string | null,
    clearParent: (session: EncryptedSyncSession<unknown>, entityId: string) => void,
    session: EncryptedSyncSession<unknown>,
  ): CycleBreak[] {
    const breaks: CycleBreak[] = [];
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

          const lowestId = [...cycle].sort()[0];
          if (lowestId !== undefined) {
            const entity = entityMap[lowestId];
            const parentId = entity ? getParent(entity) : null;
            if (parentId !== null) {
              clearParent(session, lowestId);
              breaks.push({ entityId: lowestId, formerParentId: parentId });
            }
          }
          break;
        }

        inStack.add(current);
        path.push(current);

        const currentEntity: T | undefined = entityMap[current];
        current = currentEntity ? getParent(currentEntity) : null;

        if (current !== null && !(current in entityMap)) {
          current = null;
        }
      }

      for (const id of path) {
        visited.add(id);
        inStack.delete(id);
      }
    }

    return breaks;
  }

  private normalizeSortOrderInMap<T extends SortableEntity>(
    entityMap: Record<string, T>,
    fieldName: string,
    session: EncryptedSyncSession<unknown>,
  ): SortOrderPatch[] {
    const patches: SortOrderPatch[] = [];
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
        session.change((d) => {
          const map = getEntityMap<SortableEntity>(d as DocRecord, fieldName);
          const target = map?.[entityId];
          if (target) {
            target.sortOrder = newOrder;
          }
        });
        patches.push({ entityId, newSortOrder: newOrder });
      }
    }

    return patches;
  }
}

// ── Field name mapping ───────────────────────────────────────────────

/** Maps CRDT entity type names to their field names in Automerge documents. */
function buildEntityFieldMap(): Map<string, string> {
  const map = new Map<string, string>();

  map.set("member", "members");
  map.set("member-photo", "memberPhotos");
  map.set("group", "groups");
  map.set("subsystem", "subsystems");
  map.set("side-system", "sideSystems");
  map.set("layer", "layers");
  map.set("relationship", "relationships");
  map.set("custom-front", "customFronts");
  map.set("field-definition", "fieldDefinitions");
  map.set("field-value", "fieldValues");
  map.set("innerworld-entity", "innerWorldEntities");
  map.set("innerworld-region", "innerWorldRegions");
  map.set("timer", "timers");
  map.set("fronting-session", "sessions");
  map.set("fronting-comment", "comments");
  map.set("check-in-record", "checkInRecords");
  map.set("channel", "channel");
  map.set("board-message", "boardMessages");
  map.set("poll", "polls");
  map.set("poll-option", "pollOptions");
  map.set("acknowledgement", "acknowledgements");
  map.set("journal-entry", "entries");
  map.set("wiki-page", "wikiPages");
  map.set("note", "notes");
  map.set("bucket", "buckets");
  map.set("bucket-content-tag", "contentTags");
  map.set("friend-connection", "friendConnections");
  map.set("friend-code", "friendCodes");
  map.set("key-grant", "keyGrants");

  return map;
}

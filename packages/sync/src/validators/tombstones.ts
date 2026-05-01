import { ENTITY_CRDT_STRATEGIES, type SyncedEntityType } from "../strategies/crdt-strategies.js";

import { getEntityMap, type ArchivableEntity, type DocRecord } from "./internal.js";

import type { EncryptedSyncSession } from "../sync-session.js";
import type { ConflictNotification, EncryptedChangeEnvelope } from "../types.js";

/**
 * Walk lww-map / append-lww entities and re-stamp `archived = true` for any
 * entity that is currently archived. This ensures tombstone wins over concurrent
 * un-archive operations by making the archive the latest CRDT write.
 *
 * When `dirtyEntityTypes` is provided, only those entity types are scanned —
 * a member-only change no longer forces a walk of all 20+ entity types.
 * Omit for the default scan of every lww-map / append-lww entity type (no
 * dirty filter).
 *
 * Returns notifications and the correction envelope (if any mutations were applied).
 */
export function enforceTombstones(
  session: EncryptedSyncSession<unknown>,
  dirtyEntityTypes?: ReadonlySet<SyncedEntityType>,
): {
  notifications: ConflictNotification[];
  envelope: Omit<EncryptedChangeEnvelope, "seq"> | null;
} {
  const notifications: ConflictNotification[] = [];
  const doc = session.document as DocRecord;

  const lwwMapTypes = Object.entries(ENTITY_CRDT_STRATEGIES).filter(([entityType, strategy]) => {
    if (strategy.storageType !== "lww-map" && strategy.storageType !== "append-lww") return false;
    if (dirtyEntityTypes !== undefined && !dirtyEntityTypes.has(entityType as SyncedEntityType)) {
      return false;
    }
    return true;
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

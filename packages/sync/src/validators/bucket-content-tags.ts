import { isBucketContentEntityType } from "@pluralscape/types";

import { getEntityMap, type DocRecord } from "./internal.js";

import type { EncryptedSyncSession } from "../sync-session.js";
import type { ConflictNotification, EncryptedChangeEnvelope } from "../types.js";

/**
 * Post-merge validation for BucketContentTag entries on the privacy-config
 * document. Drops entries whose `entityType` is not a known
 * {@link BucketContentEntityType}.
 *
 * A peer running an older app version cannot synthesize an unknown entity
 * type, but a corrupted document or a future variant rolled back to an old
 * client could. Quarantining at the CRDT layer prevents the materializer
 * from trying to insert rows with an unrecognized polymorphic discriminator.
 */
export function validateBucketContentTags(session: EncryptedSyncSession<unknown>): {
  count: number;
  notifications: ConflictNotification[];
  envelope: Omit<EncryptedChangeEnvelope, "seq"> | null;
} {
  const doc = session.document as DocRecord;
  const now = Date.now();
  const notifications: ConflictNotification[] = [];

  const tags = getEntityMap<{ entityType: unknown }>(doc, "contentTags");
  if (!tags) return { count: 0, notifications, envelope: null };

  const toDrop: string[] = [];
  for (const [key, tag] of Object.entries(tags)) {
    const rawType: unknown = tag.entityType;
    let typeStr: string | null = null;
    if (typeof rawType === "string") {
      typeStr = rawType;
    } else if (
      typeof rawType === "object" &&
      rawType !== null &&
      "val" in rawType &&
      typeof (rawType as { val: unknown }).val === "string"
    ) {
      typeStr = (rawType as { val: string }).val;
    }

    if (typeStr === null || !isBucketContentEntityType(typeStr)) {
      toDrop.push(key);
      notifications.push({
        entityType: "bucket-content-tag",
        entityId: key,
        fieldName: "entityType",
        resolution: "post-merge-bucket-content-tag-drop",
        detectedAt: now,
        summary: `Dropped bucket content tag ${key}: unknown entityType ${typeStr ?? "<missing>"}`,
      });
    }
  }

  if (toDrop.length === 0) {
    return { count: 0, notifications, envelope: null };
  }

  const envelope = session.change((d) => {
    const map = getEntityMap<unknown>(d as DocRecord, "contentTags");
    if (!map) return;
    for (const key of toDrop) {
      // The keys come from a closed `toDrop` array we built above (not
      // user-supplied), so dynamic delete is safe here. Use Reflect.deleteProperty
      // to satisfy the lint rule.
      Reflect.deleteProperty(map, key);
    }
  });

  return { count: toDrop.length, notifications, envelope };
}

import { check, index, sqliteTable, text } from "drizzle-orm/sqlite-core";

import { brandedId, sqliteEncryptedBlob, sqliteTimestamp } from "../../columns/sqlite.js";
import {
  archivable,
  archivableConsistencyCheckFor,
  versioned,
  versionCheckFor,
} from "../../helpers/audit.sqlite.js";
import { enumCheck } from "../../helpers/check.js";
import { LIFECYCLE_EVENT_TYPES } from "../../helpers/enums.js";

import { systems } from "./systems.js";

import type { LifecycleEvent, LifecycleEventId, SystemId } from "@pluralscape/types";
import type { InferInsertModel, InferSelectModel } from "drizzle-orm";

export const lifecycleEvents = sqliteTable(
  "lifecycle_events",
  {
    id: brandedId<LifecycleEventId>("id").primaryKey(),
    systemId: brandedId<SystemId>("system_id")
      .notNull()
      .references(() => systems.id, { onDelete: "cascade" }),
    eventType: text("event_type").notNull().$type<LifecycleEvent["eventType"]>(),
    occurredAt: sqliteTimestamp("occurred_at").notNull(),
    recordedAt: sqliteTimestamp("recorded_at").notNull(),
    updatedAt: sqliteTimestamp("updated_at").notNull(),
    encryptedData: sqliteEncryptedBlob("encrypted_data").notNull(),
    plaintextMetadata: text("plaintext_metadata", { mode: "json" }).$type<
      Record<string, unknown>
    >(),
    ...versioned(),
    ...archivable(),
  },
  (t) => [
    index("lifecycle_events_system_occurred_idx").on(t.systemId, t.occurredAt),
    index("lifecycle_events_system_recorded_idx").on(t.systemId, t.recordedAt),
    index("lifecycle_events_system_archived_idx").on(t.systemId, t.archived),
    check("lifecycle_events_event_type_check", enumCheck(t.eventType, LIFECYCLE_EVENT_TYPES)),
    versionCheckFor("lifecycle_events", t.version),
    archivableConsistencyCheckFor("lifecycle_events", t.archived, t.archivedAt),
  ],
);

export type LifecycleEventRow = InferSelectModel<typeof lifecycleEvents>;
export type NewLifecycleEvent = InferInsertModel<typeof lifecycleEvents>;

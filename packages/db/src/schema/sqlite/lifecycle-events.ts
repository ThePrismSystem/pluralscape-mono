import { check, index, sqliteTable, text } from "drizzle-orm/sqlite-core";

import { sqliteEncryptedBlob, sqliteTimestamp } from "../../columns/sqlite.js";
import { enumCheck } from "../../helpers/check.js";
import { LIFECYCLE_EVENT_TYPES } from "../../helpers/enums.js";

import { systems } from "./systems.js";

import type { ServerLifecycleEvent } from "@pluralscape/types";
import type { InferInsertModel, InferSelectModel } from "drizzle-orm";

// Intentionally no version column: append-only immutable. CRDT sync treats
// lifecycle_events as insert-only (version is always implicitly 1).
export const lifecycleEvents = sqliteTable(
  "lifecycle_events",
  {
    id: text("id").primaryKey(),
    systemId: text("system_id")
      .notNull()
      .references(() => systems.id, { onDelete: "cascade" }),
    eventType: text("event_type").notNull().$type<ServerLifecycleEvent["eventType"]>(),
    occurredAt: sqliteTimestamp("occurred_at").notNull(),
    recordedAt: sqliteTimestamp("recorded_at").notNull(),
    encryptedData: sqliteEncryptedBlob("encrypted_data").notNull(),
  },
  (t) => [
    index("lifecycle_events_system_occurred_idx").on(t.systemId, t.occurredAt),
    index("lifecycle_events_system_recorded_idx").on(t.systemId, t.recordedAt),
    check("lifecycle_events_event_type_check", enumCheck(t.eventType, LIFECYCLE_EVENT_TYPES)),
  ],
);

export type LifecycleEventRow = InferSelectModel<typeof lifecycleEvents>;
export type NewLifecycleEvent = InferInsertModel<typeof lifecycleEvents>;

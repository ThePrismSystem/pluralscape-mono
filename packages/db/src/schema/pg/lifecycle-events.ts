import { check, index, pgTable, varchar } from "drizzle-orm/pg-core";

import { pgEncryptedBlob, pgTimestamp } from "../../columns/pg.js";
import { enumCheck } from "../../helpers/check.js";
import { LIFECYCLE_EVENT_TYPES } from "../../helpers/enums.js";

import { systems } from "./systems.js";

import type { ServerLifecycleEvent } from "@pluralscape/types";

export const lifecycleEvents = pgTable(
  "lifecycle_events",
  {
    id: varchar("id", { length: 255 }).primaryKey(),
    systemId: varchar("system_id", { length: 255 })
      .notNull()
      .references(() => systems.id, { onDelete: "cascade" }),
    eventType: varchar("event_type", { length: 255 }).$type<ServerLifecycleEvent["eventType"]>(),
    occurredAt: pgTimestamp("occurred_at").notNull(),
    recordedAt: pgTimestamp("recorded_at").notNull(),
    encryptedData: pgEncryptedBlob("encrypted_data").notNull(),
  },
  (t) => [
    index("lifecycle_events_system_occurred_idx").on(t.systemId, t.occurredAt),
    index("lifecycle_events_system_recorded_idx").on(t.systemId, t.recordedAt),
    check("lifecycle_events_event_type_check", enumCheck(t.eventType, LIFECYCLE_EVENT_TYPES)),
  ],
);

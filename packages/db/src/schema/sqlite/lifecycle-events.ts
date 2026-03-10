import { index, sqliteTable, text } from "drizzle-orm/sqlite-core";

import { sqliteBinary, sqliteTimestamp } from "../../columns/sqlite.js";

import { systems } from "./systems.js";

export const lifecycleEvents = sqliteTable(
  "lifecycle_events",
  {
    id: text("id").primaryKey(),
    systemId: text("system_id")
      .notNull()
      .references(() => systems.id, { onDelete: "cascade" }),
    occurredAt: sqliteTimestamp("occurred_at").notNull(),
    recordedAt: sqliteTimestamp("recorded_at").notNull(),
    encryptedData: sqliteBinary("encrypted_data").notNull(),
  },
  (t) => [
    index("lifecycle_events_system_occurred_idx").on(t.systemId, t.occurredAt),
    index("lifecycle_events_system_recorded_idx").on(t.systemId, t.recordedAt),
  ],
);

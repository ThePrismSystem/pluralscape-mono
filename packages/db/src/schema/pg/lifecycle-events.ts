import { index, pgTable, varchar } from "drizzle-orm/pg-core";

import { pgBinary, pgTimestamp } from "../../columns/pg.js";

import { systems } from "./systems.js";

export const lifecycleEvents = pgTable(
  "lifecycle_events",
  {
    id: varchar("id", { length: 255 }).primaryKey(),
    systemId: varchar("system_id", { length: 255 })
      .notNull()
      .references(() => systems.id, { onDelete: "cascade" }),
    occurredAt: pgTimestamp("occurred_at").notNull(),
    recordedAt: pgTimestamp("recorded_at").notNull(),
    encryptedData: pgBinary("encrypted_data").notNull(),
  },
  (t) => [
    index("lifecycle_events_system_occurred_idx").on(t.systemId, t.occurredAt),
    index("lifecycle_events_system_recorded_idx").on(t.systemId, t.recordedAt),
  ],
);

import { check, index, jsonb, pgTable, varchar } from "drizzle-orm/pg-core";

import { pgEncryptedBlob, pgTimestamp } from "../../columns/pg.js";
import { enumCheck } from "../../helpers/check.js";
import { ENUM_MAX_LENGTH, ID_MAX_LENGTH } from "../../helpers/db.constants.js";
import { LIFECYCLE_EVENT_TYPES } from "../../helpers/enums.js";

import { systems } from "./systems.js";

import type { ServerLifecycleEvent } from "@pluralscape/types";
import type { InferInsertModel, InferSelectModel } from "drizzle-orm";

// Intentionally no version column: append-only immutable. CRDT sync treats
// lifecycle_events as insert-only (version is always implicitly 1).
export const lifecycleEvents = pgTable(
  "lifecycle_events",
  {
    id: varchar("id", { length: ID_MAX_LENGTH }).primaryKey(),
    systemId: varchar("system_id", { length: ID_MAX_LENGTH })
      .notNull()
      .references(() => systems.id, { onDelete: "cascade" }),
    eventType: varchar("event_type", { length: ENUM_MAX_LENGTH })
      .notNull()
      .$type<ServerLifecycleEvent["eventType"]>(),
    occurredAt: pgTimestamp("occurred_at").notNull(),
    recordedAt: pgTimestamp("recorded_at").notNull(),
    encryptedData: pgEncryptedBlob("encrypted_data").notNull(),
    plaintextMetadata: jsonb("plaintext_metadata").$type<Record<string, unknown>>(),
  },
  (t) => [
    index("lifecycle_events_system_occurred_idx").on(t.systemId, t.occurredAt),
    index("lifecycle_events_system_recorded_idx").on(t.systemId, t.recordedAt),
    check("lifecycle_events_event_type_check", enumCheck(t.eventType, LIFECYCLE_EVENT_TYPES)),
  ],
);

export type LifecycleEventRow = InferSelectModel<typeof lifecycleEvents>;
export type NewLifecycleEvent = InferInsertModel<typeof lifecycleEvents>;

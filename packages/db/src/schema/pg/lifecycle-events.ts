import { check, index, jsonb, pgTable, varchar } from "drizzle-orm/pg-core";

import { pgEncryptedBlob, pgTimestamp } from "../../columns/pg.js";
import {
  archivable,
  archivableConsistencyCheckFor,
  versioned,
  versionCheckFor,
} from "../../helpers/audit.pg.js";
import { enumCheck } from "../../helpers/check.js";
import { ENUM_MAX_LENGTH, ID_MAX_LENGTH } from "../../helpers/db.constants.js";
import { LIFECYCLE_EVENT_TYPES } from "../../helpers/enums.js";

import { systems } from "./systems.js";

import type { ServerLifecycleEvent } from "@pluralscape/types";
import type { InferInsertModel, InferSelectModel } from "drizzle-orm";

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
    updatedAt: pgTimestamp("updated_at").notNull(),
    encryptedData: pgEncryptedBlob("encrypted_data").notNull(),
    plaintextMetadata: jsonb("plaintext_metadata").$type<Record<string, unknown>>(),
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

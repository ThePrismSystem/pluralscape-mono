import { check, index, sqliteTable, text } from "drizzle-orm/sqlite-core";

import { sqliteTimestamp } from "../../columns/sqlite.js";
import { archivable, versioned } from "../../helpers/audit.sqlite.js";
import { enumCheck } from "../../helpers/check.js";
import {
  encryptedPayload,
  entityIdentity,
  serverEntityChecks,
} from "../../helpers/entity-shape.sqlite.js";
import { LIFECYCLE_EVENT_TYPES } from "../../helpers/enums.js";

import type { LifecycleEvent, LifecycleEventId } from "@pluralscape/types";
import type { InferInsertModel, InferSelectModel } from "drizzle-orm";

// Carve-out: this table tracks bespoke timestamps (occurredAt, recordedAt,
// updatedAt) instead of the standard `timestamps()` mixin.
export const lifecycleEvents = sqliteTable(
  "lifecycle_events",
  {
    ...entityIdentity<LifecycleEventId>(),
    eventType: text("event_type").notNull().$type<LifecycleEvent["eventType"]>(),
    occurredAt: sqliteTimestamp("occurred_at").notNull(),
    recordedAt: sqliteTimestamp("recorded_at").notNull(),
    updatedAt: sqliteTimestamp("updated_at").notNull(),
    ...encryptedPayload(),
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
    ...serverEntityChecks("lifecycle_events", t),
  ],
);

export type LifecycleEventRow = InferSelectModel<typeof lifecycleEvents>;
export type NewLifecycleEvent = InferInsertModel<typeof lifecycleEvents>;

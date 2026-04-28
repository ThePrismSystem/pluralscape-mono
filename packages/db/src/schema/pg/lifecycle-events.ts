import { check, index, jsonb, pgTable, varchar } from "drizzle-orm/pg-core";

import { pgTimestamp } from "../../columns/pg.js";
import { archivable, versioned } from "../../helpers/audit.pg.js";
import { enumCheck } from "../../helpers/check.js";
import { ENUM_MAX_LENGTH } from "../../helpers/db.constants.js";
import {
  encryptedPayload,
  entityIdentity,
  serverEntityChecks,
} from "../../helpers/entity-shape.pg.js";
import { LIFECYCLE_EVENT_TYPES } from "../../helpers/enums.js";

import type { LifecycleEvent, LifecycleEventId } from "@pluralscape/types";
import type { InferInsertModel, InferSelectModel } from "drizzle-orm";

// Carve-out: this table tracks bespoke timestamps (occurredAt, recordedAt,
// updatedAt) instead of the standard `timestamps()` mixin.
export const lifecycleEvents = pgTable(
  "lifecycle_events",
  {
    ...entityIdentity<LifecycleEventId>(),
    eventType: varchar("event_type", { length: ENUM_MAX_LENGTH })
      .notNull()
      .$type<LifecycleEvent["eventType"]>(),
    occurredAt: pgTimestamp("occurred_at").notNull(),
    recordedAt: pgTimestamp("recorded_at").notNull(),
    updatedAt: pgTimestamp("updated_at").notNull(),
    ...encryptedPayload(),
    plaintextMetadata: jsonb("plaintext_metadata").$type<Record<string, unknown>>(),
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

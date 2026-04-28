import { sqliteTable, text } from "drizzle-orm/sqlite-core";

import { sqliteJsonOf, sqliteTimestamp } from "../../columns/sqlite.js";
import { archivable } from "../../helpers/audit.sqlite.js";
import { entityIdentity } from "../../helpers/entity-shape.sqlite.js";

import type { LifecycleEvent, LifecycleEventId } from "@pluralscape/types";
import type { InferInsertModel, InferSelectModel } from "drizzle-orm";

/**
 * Decrypted client-cache projection of `LifecycleEvent` (discriminated
 * union). The variant-specific fields ride as a JSON `payload` column
 * — the entire decrypted record is stored verbatim. Carve-out: no
 * `timestamps()` mixin (uses bespoke `occurredAt` / `recordedAt`).
 */
export const lifecycleEvents = sqliteTable("lifecycle_events", {
  ...entityIdentity<LifecycleEventId>(),
  eventType: text("event_type").$type<LifecycleEvent["eventType"]>().notNull(),
  occurredAt: sqliteTimestamp("occurred_at").notNull(),
  recordedAt: sqliteTimestamp("recorded_at").notNull(),
  notes: text("notes"),
  /**
   * Variant-specific fields (e.g., sourceMemberId, resultMemberIds for
   * split events). Stored as JSON because the union is wide and the
   * fields differ per `eventType`.
   */
  payload: sqliteJsonOf<LifecycleEvent>("payload").notNull(),
  ...archivable(),
});

export type LocalLifecycleEventRow = InferSelectModel<typeof lifecycleEvents>;
export type NewLocalLifecycleEvent = InferInsertModel<typeof lifecycleEvents>;

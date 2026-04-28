import { sqliteTable, text } from "drizzle-orm/sqlite-core";

import { sqliteJsonOf, sqliteTimestamp } from "../../columns/sqlite.js";
import { archivable } from "../../helpers/audit.sqlite.js";
import { entityIdentity } from "../../helpers/entity-shape.sqlite.js";

import type { LifecycleEvent, LifecycleEventId } from "@pluralscape/types";
import type { InferInsertModel, InferSelectModel } from "drizzle-orm";

/**
 * Distributes `Omit<T, K>` over a discriminated union so each variant
 * independently drops its own subset of `K`. Naïve `Omit` would only
 * strip keys present on every variant, collapsing variant-specific
 * residuals to the common shape.
 */
type DistributiveOmit<T, K extends PropertyKey> = T extends unknown ? Omit<T, K> : never;

/**
 * Variant-specific residual of a `LifecycleEvent` after the columns
 * carried as dedicated cache fields are stripped. The CRDT writes the
 * full event; the materializer projects `id`/`systemId`/`eventType`/
 * `occurredAt`/`recordedAt`/`notes`/`archived` into typed columns and
 * stores the per-variant fields (e.g., `sourceMemberId`, `memberIds`,
 * `entity`, `previousForm`) in this typed JSON payload.
 */
type LifecycleEventPayload = DistributiveOmit<
  LifecycleEvent,
  "id" | "systemId" | "eventType" | "occurredAt" | "recordedAt" | "notes" | "archived"
>;

/**
 * Decrypted client-cache projection of `LifecycleEvent` (discriminated
 * union). Carve-out: no `timestamps()` mixin — uses bespoke
 * `occurredAt` / `recordedAt`. Cache asymmetry: the CRDT carries each
 * variant in full, but the cache splits structural fields into typed
 * columns and keeps only the variant-specific siblings in `payload`.
 */
export const lifecycleEvents = sqliteTable("lifecycle_events", {
  ...entityIdentity<LifecycleEventId>(),
  eventType: text("event_type").$type<LifecycleEvent["eventType"]>().notNull(),
  occurredAt: sqliteTimestamp("occurred_at").notNull(),
  recordedAt: sqliteTimestamp("recorded_at").notNull(),
  notes: text("notes"),
  payload: sqliteJsonOf<LifecycleEventPayload>("payload").notNull(),
  ...archivable(),
});

export type LocalLifecycleEventRow = InferSelectModel<typeof lifecycleEvents>;
export type NewLocalLifecycleEvent = InferInsertModel<typeof lifecycleEvents>;

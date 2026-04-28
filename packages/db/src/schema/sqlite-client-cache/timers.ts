import { foreignKey, integer, sqliteTable, text } from "drizzle-orm/sqlite-core";

import { brandedId, sqliteTimestamp } from "../../columns/sqlite.js";
import { archivable, timestamps } from "../../helpers/audit.sqlite.js";
import { entityIdentity } from "../../helpers/entity-shape.sqlite.js";

import { members } from "./members.js";

import type { CheckInRecordId, MemberId, TimerId } from "@pluralscape/types";
import type { InferInsertModel, InferSelectModel } from "drizzle-orm";

/**
 * Decrypted client-cache projection of `TimerConfig`.
 */
export const timerConfigs = sqliteTable("timer_configs", {
  ...entityIdentity<TimerId>(),
  intervalMinutes: integer("interval_minutes"),
  wakingHoursOnly: integer("waking_hours_only", { mode: "boolean" }),
  wakingStart: text("waking_start"),
  wakingEnd: text("waking_end"),
  promptText: text("prompt_text").notNull(),
  enabled: integer("enabled", { mode: "boolean" }).notNull(),
  ...timestamps(),
  ...archivable(),
});

/**
 * Decrypted client-cache projection of `CheckInRecord`. Carve-out: no
 * `timestamps()` mixin — the domain type tracks `scheduledAt` /
 * `respondedAt` instead. Archive metadata is part of the domain shape.
 */
export const checkInRecords = sqliteTable(
  "check_in_records",
  {
    ...entityIdentity<CheckInRecordId>(),
    timerConfigId: brandedId<TimerId>("timer_config_id").notNull(),
    scheduledAt: sqliteTimestamp("scheduled_at").notNull(),
    respondedByMemberId: brandedId<MemberId>("responded_by_member_id"),
    respondedAt: sqliteTimestamp("responded_at"),
    dismissed: integer("dismissed", { mode: "boolean" }).notNull(),
    ...archivable(),
  },
  (t) => [
    foreignKey({
      columns: [t.timerConfigId, t.systemId],
      foreignColumns: [timerConfigs.id, timerConfigs.systemId],
    }).onDelete("restrict"),
    foreignKey({
      columns: [t.respondedByMemberId, t.systemId],
      foreignColumns: [members.id, members.systemId],
    }).onDelete("restrict"),
  ],
);

export type LocalTimerConfigRow = InferSelectModel<typeof timerConfigs>;
export type NewLocalTimerConfig = InferInsertModel<typeof timerConfigs>;
export type LocalCheckInRecordRow = InferSelectModel<typeof checkInRecords>;
export type NewLocalCheckInRecord = InferInsertModel<typeof checkInRecords>;

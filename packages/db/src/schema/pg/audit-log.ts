import { sql } from "drizzle-orm";
import {
  check,
  index,
  jsonb,
  pgTable,
  primaryKey,
  text,
  unique,
  varchar,
} from "drizzle-orm/pg-core";

import { pgTimestamp } from "../../columns/pg.js";
import { enumCheck } from "../../helpers/check.js";
import { ENUM_MAX_LENGTH, ID_MAX_LENGTH } from "../../helpers/constants.js";
import { AUDIT_EVENT_TYPES } from "../../helpers/enums.js";

import { accounts } from "./auth.js";
import { systems } from "./systems.js";

import type { DbAuditActor } from "../../helpers/types.js";
import type { AuditEventType } from "@pluralscape/types";
import type { InferInsertModel, InferSelectModel } from "drizzle-orm";

export type { DbAuditActor } from "../../helpers/types.js";

// NOTE: The production migration adds PARTITION BY RANGE ("timestamp") which Drizzle
// cannot express. Running drizzle-kit generate for this table requires manual verification.
// See ADR 017 and migration 0005 for details.
export const auditLog = pgTable(
  "audit_log",
  {
    id: varchar("id", { length: ID_MAX_LENGTH }).notNull(),
    /** Denormalized for query performance — avoids joining through systems to get account. */
    accountId: varchar("account_id", { length: ID_MAX_LENGTH }).references(() => accounts.id, {
      onDelete: "set null",
    }),
    systemId: varchar("system_id", { length: ID_MAX_LENGTH }).references(() => systems.id, {
      onDelete: "set null",
    }),
    eventType: varchar("event_type", { length: ENUM_MAX_LENGTH }).notNull().$type<AuditEventType>(),
    /** Named "timestamp" (not "createdAt") to reflect when the event occurred, not row creation. */
    timestamp: pgTimestamp("timestamp").notNull(),
    /** Wider than ID_MAX_LENGTH: IPv6 addresses can exceed ID_MAX_LENGTH. GDPR personal data — subject to retention policy (ADR 017). Account purge must nullify. */
    ipAddress: varchar("ip_address", { length: 255 }),
    /** Wider than ID_MAX_LENGTH: browser User-Agent strings routinely exceed 100 chars. GDPR personal data — subject to retention policy (ADR 017). Account purge must nullify. */
    userAgent: varchar("user_agent", { length: 1024 }),
    actor: jsonb("actor").notNull().$type<DbAuditActor>(),
    detail: text("detail"),
  },
  (t) => [
    primaryKey({ columns: [t.id, t.timestamp] }),
    unique("audit_log_id_unique").on(t.id, t.timestamp),
    index("audit_log_account_timestamp_idx").on(t.accountId, t.timestamp),
    index("audit_log_system_timestamp_idx").on(t.systemId, t.timestamp),
    index("audit_log_system_event_type_timestamp_idx").on(t.systemId, t.eventType, t.timestamp),
    index("audit_log_timestamp_idx").on(t.timestamp),
    check("audit_log_event_type_check", enumCheck(t.eventType, AUDIT_EVENT_TYPES)),
    check("audit_log_detail_length_check", sql`${t.detail} IS NULL OR length(${t.detail}) <= 2048`),
  ],
);

export type AuditLogRow = InferSelectModel<typeof auditLog>;
export type NewAuditLog = InferInsertModel<typeof auditLog>;

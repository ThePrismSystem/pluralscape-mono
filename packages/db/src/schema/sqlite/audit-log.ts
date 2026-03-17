import { sql } from "drizzle-orm";
import { check, index, primaryKey, sqliteTable, text, unique } from "drizzle-orm/sqlite-core";

import { sqliteJson, sqliteTimestamp } from "../../columns/sqlite.js";
import { enumCheck } from "../../helpers/check.js";
import { AUDIT_LOG_DETAIL_MAX_LENGTH } from "../../helpers/db.constants.js";
import { AUDIT_EVENT_TYPES } from "../../helpers/enums.js";

import { accounts } from "./auth.js";
import { systems } from "./systems.js";

import type { DbAuditActor } from "../../helpers/types.js";
import type { AuditEventType } from "@pluralscape/types";
import type { InferInsertModel, InferSelectModel } from "drizzle-orm";

export type { DbAuditActor } from "../../helpers/types.js";

export const auditLog = sqliteTable(
  "audit_log",
  {
    id: text("id").notNull(),
    // ON DELETE SET NULL: audit logs survive account/system deletion with nullified references.
    // Intentional exception to the RESTRICT policy — audit history must be preserved.
    /** Denormalized for query performance — avoids joining through systems to get account. */
    accountId: text("account_id").references(() => accounts.id, { onDelete: "set null" }),
    systemId: text("system_id").references(() => systems.id, { onDelete: "set null" }),
    eventType: text("event_type").notNull().$type<AuditEventType>(),
    /** Named "timestamp" (not "createdAt") to reflect when the event occurred, not row creation. */
    timestamp: sqliteTimestamp("timestamp").notNull(),
    /** GDPR personal data — subject to retention policy (ADR 017). Account purge must nullify. */
    ipAddress: text("ip_address"),
    /** GDPR personal data — subject to retention policy (ADR 017). Account purge must nullify. */
    userAgent: text("user_agent"),
    actor: sqliteJson("actor").notNull().$type<DbAuditActor>(),
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
    check(
      "audit_log_detail_length_check",
      sql`${t.detail} IS NULL OR length(${t.detail}) <= ${sql.raw(String(AUDIT_LOG_DETAIL_MAX_LENGTH))}`,
    ),
  ],
);

export type AuditLogRow = InferSelectModel<typeof auditLog>;
export type NewAuditLog = InferInsertModel<typeof auditLog>;

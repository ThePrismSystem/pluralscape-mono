import { check, index, sqliteTable, text } from "drizzle-orm/sqlite-core";

import { sqliteJson, sqliteTimestamp } from "../../columns/sqlite.js";
import { enumCheck } from "../../helpers/check.js";
import { AUDIT_EVENT_TYPES } from "../../helpers/enums.js";

import { accounts } from "./auth.js";
import { systems } from "./systems.js";

import type { DbAuditActor } from "../../helpers/types.js";
import type { AuditEventType } from "@pluralscape/types";

export const auditLog = sqliteTable(
  "audit_log",
  {
    id: text("id").primaryKey(),
    /** Denormalized for query performance — avoids joining through systems to get account. */
    accountId: text("account_id").references(() => accounts.id, { onDelete: "set null" }),
    systemId: text("system_id").references(() => systems.id, { onDelete: "set null" }),
    eventType: text("event_type").notNull().$type<AuditEventType>(),
    /** Named "timestamp" (not "createdAt") to reflect when the event occurred, not row creation. */
    timestamp: sqliteTimestamp("timestamp").notNull(),
    ipAddress: text("ip_address"),
    userAgent: text("user_agent"),
    actor: sqliteJson("actor").notNull().$type<DbAuditActor>(),
    detail: text("detail"),
  },
  (t) => [
    index("audit_log_account_timestamp_idx").on(t.accountId, t.timestamp),
    index("audit_log_system_timestamp_idx").on(t.systemId, t.timestamp),
    index("audit_log_event_type_idx").on(t.eventType),
    index("audit_log_timestamp_idx").on(t.timestamp),
    check("audit_log_event_type_check", enumCheck(t.eventType, AUDIT_EVENT_TYPES)),
  ],
);

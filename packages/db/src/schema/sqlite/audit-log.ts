import { check, index, sqliteTable, text } from "drizzle-orm/sqlite-core";

import { sqliteJson, sqliteTimestamp } from "../../columns/sqlite.js";
import { enumCheck } from "../../helpers/check.js";
import { AUDIT_EVENT_TYPES } from "../../helpers/enums.js";

import { accounts } from "./auth.js";
import { systems } from "./systems.js";

import type { DbAuditActor } from "../pg/audit-log.js";
import type { AuditEventType } from "@pluralscape/types";

export const auditLog = sqliteTable(
  "audit_log",
  {
    id: text("id").primaryKey(),
    accountId: text("account_id").references(() => accounts.id, { onDelete: "set null" }),
    systemId: text("system_id").references(() => systems.id, { onDelete: "set null" }),
    eventType: text("event_type").notNull().$type<AuditEventType>(),
    timestamp: sqliteTimestamp("timestamp").notNull(),
    ipAddress: text("ip_address"),
    userAgent: text("user_agent"),
    actor: sqliteJson("actor").notNull().$type<DbAuditActor>(),
    detail: sqliteJson("detail").$type<string>(),
  },
  (t) => [
    index("audit_log_account_timestamp_idx").on(t.accountId, t.timestamp),
    index("audit_log_system_timestamp_idx").on(t.systemId, t.timestamp),
    index("audit_log_event_type_idx").on(t.eventType),
    check("audit_log_event_type_check", enumCheck(t.eventType, AUDIT_EVENT_TYPES)),
  ],
);

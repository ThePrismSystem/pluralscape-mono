import { check, index, jsonb, pgTable, varchar } from "drizzle-orm/pg-core";

import { pgTimestamp } from "../../columns/pg.js";
import { enumCheck } from "../../helpers/check.js";
import { AUDIT_EVENT_TYPES } from "../../helpers/enums.js";

import { accounts } from "./auth.js";
import { systems } from "./systems.js";

import type { AuditEventType } from "@pluralscape/types";

/** DB-level actor type — uses plain string IDs (branded types are an app-layer concern). */
export type DbAuditActor =
  | { readonly kind: "account"; readonly id: string }
  | { readonly kind: "api-key"; readonly id: string }
  | { readonly kind: "system"; readonly id: string };

export const auditLog = pgTable(
  "audit_log",
  {
    id: varchar("id", { length: 255 }).primaryKey(),
    accountId: varchar("account_id", { length: 255 }).references(() => accounts.id, {
      onDelete: "set null",
    }),
    systemId: varchar("system_id", { length: 255 }).references(() => systems.id, {
      onDelete: "set null",
    }),
    eventType: varchar("event_type", { length: 255 }).notNull().$type<AuditEventType>(),
    timestamp: pgTimestamp("timestamp").notNull(),
    ipAddress: varchar("ip_address", { length: 255 }),
    userAgent: varchar("user_agent", { length: 1024 }),
    actor: jsonb("actor").notNull().$type<DbAuditActor>(),
    detail: jsonb("detail").$type<string>(),
  },
  (t) => [
    index("audit_log_account_timestamp_idx").on(t.accountId, t.timestamp),
    index("audit_log_system_timestamp_idx").on(t.systemId, t.timestamp),
    index("audit_log_event_type_idx").on(t.eventType),
    check("audit_log_event_type_check", enumCheck(t.eventType, AUDIT_EVENT_TYPES)),
  ],
);

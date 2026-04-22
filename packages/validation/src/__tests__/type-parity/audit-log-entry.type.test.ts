/**
 * Zod parity for AuditLogEntry — PHASE 1 DEFERRAL.
 *
 * As of 2026-04-22, the audit-log Zod schemas in packages/validation/
 * (AuditLogQuerySchema) are filter/query schemas that don't have
 * direct domain-type counterparts in @pluralscape/types — audit log
 * entries are server-generated, not client-submitted, so there's no
 * CreateAuditLogEntryBody or similar to assert against.
 *
 * The domain types AuditEventType, AuditActor, AuditLogEntry, and
 * SetupStepName exist in packages/types but represent the read-only
 * audit log structure, not input bodies. AuditLogQuerySchema is a
 * pagination/filtering schema, which is architectural (query parameter
 * validation) rather than a domain-entity input body.
 *
 * Phase 2 fleet work may introduce an AuditLogQueryInput type in
 * @pluralscape/types to close this gap; when that happens, delete the
 * .todo in this file and add the assertion.
 *
 * Leaving this file in place (with .todo) signals the deferral and
 * makes it easy to find via grep during fleet planning.
 */

import { describe, it } from "vitest";

describe("AuditLogEntry Zod parity (deferred)", () => {
  it.todo("add when AuditLogQueryInput or similar lands in @pluralscape/types");
});

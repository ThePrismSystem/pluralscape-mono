import { expect } from "vitest";

import type { AuditWriteParams, AuditWriter } from "../../lib/audit-writer.js";

/** The return type of `spyAudit()` — an audit writer that records calls. */
export type SpyAudit = AuditWriter & { calls: AuditWriteParams[] };

/** Spy audit writer that records every call for assertion. */
export function spyAudit(): SpyAudit {
  const calls: AuditWriteParams[] = [];
  const writer: AuditWriter = (_db, params) => {
    calls.push(params);
    return Promise.resolve();
  };
  return Object.assign(writer, { calls });
}

/**
 * Assert that exactly one audit event was recorded with the expected event type.
 */
export function expectSingleAuditEvent(audit: SpyAudit, expectedEvent: string): void {
  expect(audit.calls).toHaveLength(1);
  expect(audit.calls[0]?.eventType).toBe(expectedEvent);
}

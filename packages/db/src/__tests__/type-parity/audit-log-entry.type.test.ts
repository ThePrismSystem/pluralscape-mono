/**
 * Drizzle parity check: the AuditLogEntry row shape inferred from the
 * `audit_log` table structurally matches `AuditLogEntryServerMetadata` in
 * @pluralscape/types.
 *
 * See `member.type.test.ts` for the rationale behind the brand-stripped
 * comparison. Brand drift is tracked as follow-up `db-drq1`.
 *
 * AuditLogEntry is a plaintext entity (no encryption) so its
 * ServerMetadata carries DB-internal columns (denormalized `accountId`,
 * nullable `systemId`) rather than `encryptedData`.
 */

import { describe, expectTypeOf, it } from "vitest";

import { auditLog } from "../../schema/pg/audit-log.js";

import type { AuditLogEntryServerMetadata, Equal } from "@pluralscape/types";
import type { InferSelectModel } from "drizzle-orm";

describe("AuditLogEntry Drizzle parity", () => {
  it("audit_log Drizzle row has the same property keys as AuditLogEntryServerMetadata", () => {
    type Row = InferSelectModel<typeof auditLog>;
    expectTypeOf<keyof Row>().toEqualTypeOf<keyof AuditLogEntryServerMetadata>();
  });

  it("audit_log Drizzle row equals AuditLogEntryServerMetadata", () => {
    type Row = InferSelectModel<typeof auditLog>;
    expectTypeOf<Equal<Row, AuditLogEntryServerMetadata>>().toEqualTypeOf<true>();
  });
});

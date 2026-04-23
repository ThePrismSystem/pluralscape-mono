import { describe, expectTypeOf, it } from "vitest";

import type { SotEntityManifest } from "../__sot-manifest__.js";
import type {
  AuditLogEntry,
  AuditLogEntryServerMetadata,
  AuditLogEntryWire,
} from "../entities/audit-log-entry.js";
import type { Member, MemberServerMetadata, MemberWire } from "../entities/member.js";
import type { Extends } from "../type-assertions.js";

describe("SotEntityManifest", () => {
  it("entries carry at minimum a domain + encryptedFields pair", () => {
    type Entry = SotEntityManifest[keyof SotEntityManifest];
    // Phase 2 fleet entries have the partial shape (domain + encryptedFields
    // only). Pilot entries (Member, AuditLogEntry) additionally carry
    // `server` and `wire` — asserted individually below.
    expectTypeOf<
      Extends<Entry, { domain: unknown; encryptedFields: unknown }>
    >().toEqualTypeOf<true>();
  });

  it("registers Member with the canonical triple", () => {
    expectTypeOf<SotEntityManifest["Member"]["domain"]>().toEqualTypeOf<Member>();
    expectTypeOf<SotEntityManifest["Member"]["server"]>().toEqualTypeOf<MemberServerMetadata>();
    expectTypeOf<SotEntityManifest["Member"]["wire"]>().toEqualTypeOf<MemberWire>();
  });

  it("registers AuditLogEntry with the canonical triple", () => {
    expectTypeOf<SotEntityManifest["AuditLogEntry"]["domain"]>().toEqualTypeOf<AuditLogEntry>();
    expectTypeOf<
      SotEntityManifest["AuditLogEntry"]["server"]
    >().toEqualTypeOf<AuditLogEntryServerMetadata>();
    expectTypeOf<SotEntityManifest["AuditLogEntry"]["wire"]>().toEqualTypeOf<AuditLogEntryWire>();
  });

  it("includes the pilot entities", () => {
    expectTypeOf<
      Extends<"Member" | "AuditLogEntry", keyof SotEntityManifest>
    >().toEqualTypeOf<true>();
  });
});

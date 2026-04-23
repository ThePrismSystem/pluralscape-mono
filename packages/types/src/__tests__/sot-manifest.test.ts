import { describe, expectTypeOf, it } from "vitest";

import type { SotEntityManifest } from "../__sot-manifest__.js";
import type {
  AuditLogEntryServerMetadata,
  AuditLogEntryWire,
  MemberServerMetadata,
  MemberWire,
} from "../encryption.js";
import type { AuditLogEntry } from "../entities/audit-log-entry.js";
import type { Member } from "../entities/member.js";
import type { Equal, Extends } from "../type-assertions.js";

describe("SotEntityManifest", () => {
  it("entries carry a domain/server/wire triple", () => {
    type Entry = SotEntityManifest[keyof SotEntityManifest];
    expectTypeOf<
      Extends<Entry, { domain: unknown; server: unknown; wire: unknown }>
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

  it("contains exactly the pilot entities during Phase 1", () => {
    expectTypeOf<
      Equal<keyof SotEntityManifest, "Member" | "AuditLogEntry">
    >().toEqualTypeOf<true>();
  });
});

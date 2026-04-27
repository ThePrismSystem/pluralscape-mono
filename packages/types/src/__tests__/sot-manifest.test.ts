import { describe, expectTypeOf, it } from "vitest";

import type { SotEntityManifest } from "../__sot-manifest__.js";
import type {
  ApiKey,
  ApiKeyEncryptedPayload,
  ApiKeyServerMetadata,
  ApiKeyWire,
} from "../entities/api-key.js";
import type {
  AuditLogEntry,
  AuditLogEntryServerMetadata,
  AuditLogEntryWire,
} from "../entities/audit-log-entry.js";
import type {
  CheckInRecord,
  CheckInRecordResult,
  CheckInRecordServerMetadata,
  CheckInRecordWire,
} from "../entities/check-in-record.js";
import type {
  Member,
  MemberEncryptedInput,
  MemberResult,
  MemberServerMetadata,
  MemberWire,
} from "../entities/member.js";
import type {
  DeviceInfo,
  Session,
  SessionServerMetadata,
  SessionWire,
} from "../entities/session.js";
import type {
  SnapshotContent,
  SystemSnapshot,
  SystemSnapshotServerMetadata,
  SystemSnapshotWire,
} from "../entities/system-snapshot.js";
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

  it("registers Member with the canonical chain", () => {
    expectTypeOf<SotEntityManifest["Member"]["domain"]>().toEqualTypeOf<Member>();
    expectTypeOf<
      SotEntityManifest["Member"]["encryptedInput"]
    >().toEqualTypeOf<MemberEncryptedInput>();
    expectTypeOf<SotEntityManifest["Member"]["server"]>().toEqualTypeOf<MemberServerMetadata>();
    expectTypeOf<SotEntityManifest["Member"]["result"]>().toEqualTypeOf<MemberResult>();
    expectTypeOf<SotEntityManifest["Member"]["wire"]>().toEqualTypeOf<MemberWire>();
  });

  it("registers AuditLogEntry with the canonical triple", () => {
    expectTypeOf<SotEntityManifest["AuditLogEntry"]["domain"]>().toEqualTypeOf<AuditLogEntry>();
    expectTypeOf<
      SotEntityManifest["AuditLogEntry"]["server"]
    >().toEqualTypeOf<AuditLogEntryServerMetadata>();
    expectTypeOf<SotEntityManifest["AuditLogEntry"]["wire"]>().toEqualTypeOf<AuditLogEntryWire>();
  });

  it("registers CheckInRecord (hybrid: no encryptedInput) with domain/server/result/wire", () => {
    expectTypeOf<SotEntityManifest["CheckInRecord"]["domain"]>().toEqualTypeOf<CheckInRecord>();
    expectTypeOf<
      SotEntityManifest["CheckInRecord"]["server"]
    >().toEqualTypeOf<CheckInRecordServerMetadata>();
    expectTypeOf<
      SotEntityManifest["CheckInRecord"]["result"]
    >().toEqualTypeOf<CheckInRecordResult>();
    expectTypeOf<SotEntityManifest["CheckInRecord"]["wire"]>().toEqualTypeOf<CheckInRecordWire>();
    expectTypeOf<SotEntityManifest["CheckInRecord"]["encryptedFields"]>().toEqualTypeOf<never>();
  });

  it("includes the pilot entities", () => {
    expectTypeOf<
      Extends<"Member" | "AuditLogEntry", keyof SotEntityManifest>
    >().toEqualTypeOf<true>();
  });

  it("registers ApiKey (Class C) with the auxiliary-type encryptedInput", () => {
    expectTypeOf<SotEntityManifest["ApiKey"]["domain"]>().toEqualTypeOf<ApiKey>();
    expectTypeOf<
      SotEntityManifest["ApiKey"]["encryptedInput"]
    >().toEqualTypeOf<ApiKeyEncryptedPayload>();
    expectTypeOf<SotEntityManifest["ApiKey"]["server"]>().toEqualTypeOf<ApiKeyServerMetadata>();
    expectTypeOf<SotEntityManifest["ApiKey"]["wire"]>().toEqualTypeOf<ApiKeyWire>();
    expectTypeOf<SotEntityManifest["ApiKey"]["encryptedFields"]>().toEqualTypeOf<never>();
  });

  it("registers Session (Class C) with DeviceInfo as encryptedInput", () => {
    expectTypeOf<SotEntityManifest["Session"]["domain"]>().toEqualTypeOf<Session>();
    expectTypeOf<SotEntityManifest["Session"]["encryptedInput"]>().toEqualTypeOf<DeviceInfo>();
    expectTypeOf<SotEntityManifest["Session"]["server"]>().toEqualTypeOf<SessionServerMetadata>();
    expectTypeOf<SotEntityManifest["Session"]["wire"]>().toEqualTypeOf<SessionWire>();
    expectTypeOf<SotEntityManifest["Session"]["encryptedFields"]>().toEqualTypeOf<never>();
  });

  it("registers SystemSnapshot (Class C) with SnapshotContent as encryptedInput", () => {
    expectTypeOf<SotEntityManifest["SystemSnapshot"]["domain"]>().toEqualTypeOf<SystemSnapshot>();
    expectTypeOf<
      SotEntityManifest["SystemSnapshot"]["encryptedInput"]
    >().toEqualTypeOf<SnapshotContent>();
    expectTypeOf<
      SotEntityManifest["SystemSnapshot"]["server"]
    >().toEqualTypeOf<SystemSnapshotServerMetadata>();
    expectTypeOf<SotEntityManifest["SystemSnapshot"]["wire"]>().toEqualTypeOf<SystemSnapshotWire>();
    expectTypeOf<SotEntityManifest["SystemSnapshot"]["encryptedFields"]>().toEqualTypeOf<never>();
  });
});

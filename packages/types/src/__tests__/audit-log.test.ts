import { assertType, describe, expectTypeOf, it } from "vitest";

import type { AuditEventType, AuditLogEntry } from "../audit-log.js";
import type { Plaintext } from "../encryption.js";
import type { AuditLogEntryId, SystemId } from "../ids.js";
import type { UnixMillis } from "../timestamps.js";

describe("AuditEventType", () => {
  it("accepts valid event types", () => {
    assertType<AuditEventType>("auth.login");
    assertType<AuditEventType>("auth.logout");
    assertType<AuditEventType>("data.export");
    assertType<AuditEventType>("member.created");
    assertType<AuditEventType>("sharing.granted");
  });

  it("rejects invalid event types", () => {
    // @ts-expect-error invalid event type
    assertType<AuditEventType>("auth.delete");
  });

  it("is exhaustive in a switch", () => {
    function handleType(type: AuditEventType): string {
      switch (type) {
        case "auth.login":
        case "auth.logout":
        case "auth.key-created":
        case "auth.key-revoked":
        case "data.export":
        case "data.import":
        case "data.purge":
        case "settings.changed":
        case "member.created":
        case "member.archived":
        case "sharing.granted":
        case "sharing.revoked":
          return type;
        default: {
          const _exhaustive: never = type;
          return _exhaustive;
        }
      }
    }
    expectTypeOf(handleType).toBeFunction();
  });
});

describe("AuditLogEntry", () => {
  it("has correct field types", () => {
    expectTypeOf<AuditLogEntry["id"]>().toEqualTypeOf<AuditLogEntryId>();
    expectTypeOf<AuditLogEntry["systemId"]>().toEqualTypeOf<SystemId>();
    expectTypeOf<AuditLogEntry["eventType"]>().toEqualTypeOf<AuditEventType>();
    expectTypeOf<AuditLogEntry["timestamp"]>().toEqualTypeOf<UnixMillis>();
    expectTypeOf<AuditLogEntry["actorId"]>().toBeString();
    expectTypeOf<AuditLogEntry["detail"]>().toEqualTypeOf<Plaintext<string> | null>();
    expectTypeOf<AuditLogEntry["ipAddress"]>().toEqualTypeOf<string | null>();
    expectTypeOf<AuditLogEntry["userAgent"]>().toEqualTypeOf<string | null>();
  });

  it("detail uses Plaintext branded type", () => {
    // Plaintext<string> should extend string but not vice versa
    expectTypeOf<Plaintext<string>>().toExtend<string>();
    expectTypeOf<string>().not.toExtend<Plaintext<string>>();
  });
});

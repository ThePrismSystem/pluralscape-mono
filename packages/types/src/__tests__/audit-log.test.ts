import { assertType, describe, expectTypeOf, it } from "vitest";

import type { AuditEventType, AuditLogEntry } from "../audit-log.js";
import type { Plaintext } from "../encryption.js";
import type { AccountId, ApiKeyId, AuditLogEntryId, SystemId } from "../ids.js";
import type { UnixMillis } from "../timestamps.js";

describe("AuditEventType", () => {
  it("accepts valid event types", () => {
    assertType<AuditEventType>("auth.login");
    assertType<AuditEventType>("auth.logout");
    assertType<AuditEventType>("data.export");
    assertType<AuditEventType>("member.created");
    assertType<AuditEventType>("sharing.granted");
    assertType<AuditEventType>("bucket.key_rotation.initiated");
    assertType<AuditEventType>("bucket.key_rotation.chunk_completed");
    assertType<AuditEventType>("bucket.key_rotation.completed");
    assertType<AuditEventType>("bucket.key_rotation.failed");
    assertType<AuditEventType>("device.security.jailbreak_warning_shown");
  });

  it("rejects invalid event types", () => {
    // @ts-expect-error invalid event type
    assertType<AuditEventType>("auth.delete");
  });

  it("is exhaustive in a switch", () => {
    function handleType(type: AuditEventType): string {
      switch (type) {
        case "auth.login":
        case "auth.login-failed":
        case "auth.logout":
        case "auth.password-changed":
        case "auth.recovery-key-used":
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
        case "bucket.key_rotation.initiated":
        case "bucket.key_rotation.chunk_completed":
        case "bucket.key_rotation.completed":
        case "bucket.key_rotation.failed":
        case "device.security.jailbreak_warning_shown":
        case "auth.password-reset-via-recovery":
        case "auth.recovery-key-regenerated":
        case "auth.device-transfer-initiated":
        case "auth.device-transfer-completed":
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
    expectTypeOf<AuditLogEntry["createdAt"]>().toEqualTypeOf<UnixMillis>();
    expectTypeOf<AuditLogEntry["detail"]>().toEqualTypeOf<Plaintext<string> | null>();
    expectTypeOf<AuditLogEntry["ipAddress"]>().toEqualTypeOf<string | null>();
    expectTypeOf<AuditLogEntry["userAgent"]>().toEqualTypeOf<string | null>();
  });

  it("actor is a discriminated union", () => {
    type Actor = AuditLogEntry["actor"];
    function handleActor(actor: Actor): string {
      switch (actor.kind) {
        case "account":
          expectTypeOf(actor.id).toEqualTypeOf<AccountId>();
          return actor.id;
        case "api-key":
          expectTypeOf(actor.id).toEqualTypeOf<ApiKeyId>();
          return actor.id;
        case "system":
          expectTypeOf(actor.id).toEqualTypeOf<SystemId>();
          return actor.id;
        default: {
          const _exhaustive: never = actor;
          return _exhaustive;
        }
      }
    }
    expectTypeOf(handleActor).toBeFunction();
  });

  it("detail uses Plaintext branded type", () => {
    // Plaintext<string> should extend string but not vice versa
    expectTypeOf<Plaintext<string>>().toExtend<string>();
    expectTypeOf<string>().not.toExtend<Plaintext<string>>();
  });
});

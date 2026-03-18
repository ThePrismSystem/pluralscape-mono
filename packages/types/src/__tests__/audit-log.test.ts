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
        case "auth.register":
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
        case "auth.email-changed":
        case "system.created":
        case "system.profile-updated":
        case "system.deleted":
        case "group.created":
        case "group.updated":
        case "group.archived":
        case "group.restored":
        case "group.moved":
        case "group-membership.added":
        case "group-membership.removed":
        case "custom-front.created":
        case "custom-front.updated":
        case "custom-front.archived":
        case "custom-front.restored":
        case "group.deleted":
        case "custom-front.deleted":
        case "auth.biometric-enrolled":
        case "auth.biometric-verified":
        case "settings.pin-set":
        case "settings.pin-removed":
        case "settings.pin-verified":
        case "settings.nomenclature-updated":
        case "setup.step-completed":
        case "setup.completed":
        case "member.updated":
        case "member.duplicated":
        case "member.restored":
        case "member-photo.created":
        case "member-photo.archived":
        case "member-photo.restored":
        case "member-photo.reordered":
        case "field-definition.created":
        case "field-definition.updated":
        case "field-definition.archived":
        case "field-definition.restored":
        case "field-value.set":
        case "field-value.updated":
        case "field-value.deleted":
        case "subsystem.created":
        case "subsystem.updated":
        case "subsystem.archived":
        case "subsystem.restored":
        case "subsystem.deleted":
        case "side-system.created":
        case "side-system.updated":
        case "side-system.archived":
        case "side-system.restored":
        case "side-system.deleted":
        case "layer.created":
        case "layer.updated":
        case "layer.archived":
        case "layer.restored":
        case "layer.deleted":
        case "relationship.created":
        case "relationship.updated":
        case "relationship.archived":
        case "relationship.restored":
        case "relationship.deleted":
        case "lifecycle-event.created":
        case "subsystem-membership.added":
        case "subsystem-membership.removed":
        case "side-system-membership.added":
        case "side-system-membership.removed":
        case "layer-membership.added":
        case "layer-membership.removed":
        case "structure-link.created":
        case "structure-link.deleted":
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

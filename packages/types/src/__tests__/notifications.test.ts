import { assertType, describe, expectTypeOf, it } from "vitest";

import type { EncryptedString } from "../encryption.js";
import type { DeviceTokenId, NotificationConfigId, SystemId } from "../ids.js";
import type {
  DeviceToken,
  NotificationConfig,
  NotificationEventType,
  NotificationPayload,
} from "../notifications.js";
import type { UnixMillis } from "../timestamps.js";
import type { AuditMetadata } from "../utility.js";

describe("DeviceToken", () => {
  it("extends AuditMetadata", () => {
    expectTypeOf<DeviceToken>().toExtend<AuditMetadata>();
  });

  it("has correct field types", () => {
    expectTypeOf<DeviceToken["id"]>().toEqualTypeOf<DeviceTokenId>();
    expectTypeOf<DeviceToken["systemId"]>().toEqualTypeOf<SystemId>();
    expectTypeOf<DeviceToken["platform"]>().toEqualTypeOf<"ios" | "android" | "web">();
    expectTypeOf<DeviceToken["token"]>().toEqualTypeOf<EncryptedString>();
    expectTypeOf<DeviceToken["lastActiveAt"]>().toEqualTypeOf<UnixMillis>();
  });
});

describe("NotificationEventType", () => {
  it("accepts valid event types", () => {
    assertType<NotificationEventType>("switch-reminder");
    assertType<NotificationEventType>("check-in-due");
    assertType<NotificationEventType>("sync-conflict");
  });

  it("rejects invalid event types", () => {
    // @ts-expect-error invalid event type
    assertType<NotificationEventType>("email-sent");
  });

  it("is exhaustive in a switch", () => {
    function handleType(type: NotificationEventType): string {
      switch (type) {
        case "switch-reminder":
        case "check-in-due":
        case "acknowledgement-requested":
        case "message-received":
        case "sync-conflict":
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

describe("NotificationConfig", () => {
  it("extends AuditMetadata", () => {
    expectTypeOf<NotificationConfig>().toExtend<AuditMetadata>();
  });

  it("has correct field types", () => {
    expectTypeOf<NotificationConfig["id"]>().toEqualTypeOf<NotificationConfigId>();
    expectTypeOf<NotificationConfig["systemId"]>().toEqualTypeOf<SystemId>();
    expectTypeOf<NotificationConfig["eventType"]>().toEqualTypeOf<NotificationEventType>();
    expectTypeOf<NotificationConfig["enabled"]>().toEqualTypeOf<boolean>();
    expectTypeOf<NotificationConfig["pushEnabled"]>().toEqualTypeOf<boolean>();
  });
});

describe("NotificationPayload", () => {
  it("has correct field types", () => {
    expectTypeOf<NotificationPayload["systemId"]>().toEqualTypeOf<SystemId>();
    expectTypeOf<NotificationPayload["eventType"]>().toEqualTypeOf<NotificationEventType>();
    expectTypeOf<NotificationPayload["title"]>().toBeString();
    expectTypeOf<NotificationPayload["body"]>().toBeString();
    expectTypeOf<NotificationPayload["data"]>().toEqualTypeOf<Readonly<
      Record<string, string>
    > | null>();
    expectTypeOf<NotificationPayload["createdAt"]>().toEqualTypeOf<UnixMillis>();
  });
});

describe("DeviceToken platform", () => {
  it("is exhaustive in a switch", () => {
    function handlePlatform(platform: DeviceToken["platform"]): string {
      switch (platform) {
        case "ios":
        case "android":
        case "web":
          return platform;
        default: {
          const _exhaustive: never = platform;
          return _exhaustive;
        }
      }
    }
    expectTypeOf(handlePlatform).toBeFunction();
  });
});

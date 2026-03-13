import { assertType, describe, expectTypeOf, it } from "vitest";

import type {
  AccountId,
  DeviceTokenId,
  FriendConnectionId,
  FriendNotificationPreferenceId,
  NotificationConfigId,
  SystemId,
} from "../ids.js";
import type {
  DeviceToken,
  FriendNotificationEventType,
  FriendNotificationPreference,
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
    expectTypeOf<DeviceToken["token"]>().toEqualTypeOf<string>();
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
        case "friend-switch-alert":
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

describe("FriendNotificationEventType", () => {
  it("accepts valid event types", () => {
    assertType<FriendNotificationEventType>("friend-switch-alert");
  });

  it("rejects invalid event types", () => {
    // @ts-expect-error invalid friend notification event type
    assertType<FriendNotificationEventType>("message-received");
  });

  it("is a subset of NotificationEventType", () => {
    expectTypeOf<FriendNotificationEventType>().toExtend<NotificationEventType>();
  });
});

describe("FriendNotificationPreference", () => {
  it("extends AuditMetadata", () => {
    expectTypeOf<FriendNotificationPreference>().toExtend<AuditMetadata>();
  });

  it("has correct field types", () => {
    expectTypeOf<
      FriendNotificationPreference["id"]
    >().toEqualTypeOf<FriendNotificationPreferenceId>();
    expectTypeOf<
      FriendNotificationPreference["friendConnectionId"]
    >().toEqualTypeOf<FriendConnectionId>();
    expectTypeOf<FriendNotificationPreference["accountId"]>().toEqualTypeOf<AccountId>();
    expectTypeOf<FriendNotificationPreference["enabledEventTypes"]>().toEqualTypeOf<
      readonly FriendNotificationEventType[]
    >();
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

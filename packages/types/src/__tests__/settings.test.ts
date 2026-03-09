import { assertType, describe, expectTypeOf, it } from "vitest";

import type { Locale } from "../i18n.js";
import type { BucketId, SystemId, SystemSettingsId } from "../ids.js";
import type { LittlesSafeModeConfig } from "../littles-safe-mode.js";
import type { NomenclatureSettings } from "../nomenclature.js";
import type {
  AppLockConfig,
  FriendRequestPolicy,
  NotificationPreferences,
  PrivacyDefaults,
  SyncPreferences,
  SystemSettings,
  ThemePreference,
} from "../settings.js";
import type { AuditMetadata } from "../utility.js";

describe("ThemePreference", () => {
  it("accepts valid values", () => {
    assertType<ThemePreference>("light");
    assertType<ThemePreference>("dark");
    assertType<ThemePreference>("high-contrast");
    assertType<ThemePreference>("system");
  });

  it("rejects invalid values", () => {
    // @ts-expect-error invalid theme
    assertType<ThemePreference>("auto");
  });

  it("is exhaustive in a switch", () => {
    function handleTheme(theme: ThemePreference): string {
      switch (theme) {
        case "light":
        case "dark":
        case "high-contrast":
        case "system":
          return theme;
        default: {
          const _exhaustive: never = theme;
          return _exhaustive;
        }
      }
    }
    expectTypeOf(handleTheme).toBeFunction();
  });
});

describe("AppLockConfig", () => {
  it("has correct field types", () => {
    expectTypeOf<AppLockConfig["pinEnabled"]>().toEqualTypeOf<boolean>();
    expectTypeOf<AppLockConfig["biometricEnabled"]>().toEqualTypeOf<boolean>();
    expectTypeOf<AppLockConfig["lockTimeout"]>().toEqualTypeOf<number>();
  });
});

describe("NotificationPreferences", () => {
  it("has all boolean fields", () => {
    expectTypeOf<NotificationPreferences["pushEnabled"]>().toEqualTypeOf<boolean>();
    expectTypeOf<NotificationPreferences["emailEnabled"]>().toEqualTypeOf<boolean>();
    expectTypeOf<NotificationPreferences["switchReminders"]>().toEqualTypeOf<boolean>();
    expectTypeOf<NotificationPreferences["checkInReminders"]>().toEqualTypeOf<boolean>();
  });
});

describe("SyncPreferences", () => {
  it("has correct field types", () => {
    expectTypeOf<SyncPreferences["syncEnabled"]>().toEqualTypeOf<boolean>();
    expectTypeOf<SyncPreferences["syncOnCellular"]>().toEqualTypeOf<boolean>();
  });
});

describe("FriendRequestPolicy", () => {
  it("accepts valid values", () => {
    assertType<FriendRequestPolicy>("open");
    assertType<FriendRequestPolicy>("code-only");
  });

  it("rejects invalid values", () => {
    // @ts-expect-error invalid policy
    assertType<FriendRequestPolicy>("invite-only");
  });

  it("is exhaustive in a switch", () => {
    function handlePolicy(policy: FriendRequestPolicy): string {
      switch (policy) {
        case "open":
        case "code-only":
          return policy;
        default: {
          const _exhaustive: never = policy;
          return _exhaustive;
        }
      }
    }
    expectTypeOf(handlePolicy).toBeFunction();
  });
});

describe("PrivacyDefaults", () => {
  it("has defaultBucketForNewContent as nullable BucketId", () => {
    expectTypeOf<PrivacyDefaults["defaultBucketForNewContent"]>().toEqualTypeOf<BucketId | null>();
  });

  it("has friendRequestPolicy", () => {
    expectTypeOf<PrivacyDefaults["friendRequestPolicy"]>().toEqualTypeOf<FriendRequestPolicy>();
  });
});

describe("SystemSettings", () => {
  it("extends AuditMetadata", () => {
    expectTypeOf<SystemSettings>().toExtend<AuditMetadata>();
  });

  it("has correct ID fields", () => {
    expectTypeOf<SystemSettings["id"]>().toEqualTypeOf<SystemSettingsId>();
    expectTypeOf<SystemSettings["systemId"]>().toEqualTypeOf<SystemId>();
  });

  it("has theme as ThemePreference", () => {
    expectTypeOf<SystemSettings["theme"]>().toEqualTypeOf<ThemePreference>();
  });

  it("has fontScale as number", () => {
    expectTypeOf<SystemSettings["fontScale"]>().toEqualTypeOf<number>();
  });

  it("has locale as nullable Locale", () => {
    expectTypeOf<SystemSettings["locale"]>().toEqualTypeOf<Locale | null>();
  });

  it("has defaultBucketId as nullable BucketId", () => {
    expectTypeOf<SystemSettings["defaultBucketId"]>().toEqualTypeOf<BucketId | null>();
  });

  it("has nested config objects", () => {
    expectTypeOf<SystemSettings["appLock"]>().toEqualTypeOf<AppLockConfig>();
    expectTypeOf<SystemSettings["notifications"]>().toEqualTypeOf<NotificationPreferences>();
    expectTypeOf<SystemSettings["syncPreferences"]>().toEqualTypeOf<SyncPreferences>();
    expectTypeOf<SystemSettings["privacyDefaults"]>().toEqualTypeOf<PrivacyDefaults>();
    expectTypeOf<SystemSettings["littlesSafeMode"]>().toEqualTypeOf<LittlesSafeModeConfig>();
    expectTypeOf<SystemSettings["nomenclature"]>().toEqualTypeOf<NomenclatureSettings>();
  });

  it("has onboardingComplete boolean", () => {
    expectTypeOf<SystemSettings["onboardingComplete"]>().toEqualTypeOf<boolean>();
  });
});

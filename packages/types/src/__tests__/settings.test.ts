import { assertType, describe, expectTypeOf, it } from "vitest";

import type { Locale } from "../i18n.js";
import type { SystemId, SystemSettingsId } from "../ids.js";
import type { LittlesSafeModeConfig } from "../littles-safe-mode.js";
import type { NomenclatureSettings } from "../nomenclature.js";
import type {
  AppLockConfig,
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
    assertType<ThemePreference>("system");
  });

  it("rejects invalid values", () => {
    // @ts-expect-error invalid theme
    assertType<ThemePreference>("auto");
  });
});

describe("AppLockConfig", () => {
  it("has correct field types", () => {
    expectTypeOf<AppLockConfig["enabled"]>().toEqualTypeOf<boolean>();
    expectTypeOf<AppLockConfig["timeoutSeconds"]>().toEqualTypeOf<number>();
    expectTypeOf<AppLockConfig["biometricEnabled"]>().toEqualTypeOf<boolean>();
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
    expectTypeOf<SyncPreferences["syncOnWifiOnly"]>().toEqualTypeOf<boolean>();
    expectTypeOf<SyncPreferences["syncIntervalSeconds"]>().toEqualTypeOf<number>();
  });
});

describe("PrivacyDefaults", () => {
  it("has defaultBucketVisibility as string union", () => {
    assertType<PrivacyDefaults["defaultBucketVisibility"]>("private");
    assertType<PrivacyDefaults["defaultBucketVisibility"]>("friends");
    assertType<PrivacyDefaults["defaultBucketVisibility"]>("public");
  });

  it("rejects invalid visibility", () => {
    // @ts-expect-error invalid visibility
    assertType<PrivacyDefaults["defaultBucketVisibility"]>("unlisted");
  });

  it("has requireExplicitSharing boolean", () => {
    expectTypeOf<PrivacyDefaults["requireExplicitSharing"]>().toEqualTypeOf<boolean>();
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

  it("has locale as Locale branded type", () => {
    expectTypeOf<SystemSettings["locale"]>().toEqualTypeOf<Locale>();
  });

  it("has nested config objects", () => {
    expectTypeOf<SystemSettings["appLock"]>().toEqualTypeOf<AppLockConfig>();
    expectTypeOf<SystemSettings["notifications"]>().toEqualTypeOf<NotificationPreferences>();
    expectTypeOf<SystemSettings["sync"]>().toEqualTypeOf<SyncPreferences>();
    expectTypeOf<SystemSettings["privacyDefaults"]>().toEqualTypeOf<PrivacyDefaults>();
    expectTypeOf<SystemSettings["littlesSafeMode"]>().toEqualTypeOf<LittlesSafeModeConfig>();
    expectTypeOf<SystemSettings["nomenclature"]>().toEqualTypeOf<NomenclatureSettings>();
  });
});

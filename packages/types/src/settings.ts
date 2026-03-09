import type { Locale } from "./i18n.js";
import type { SystemSettingsId, SystemId } from "./ids.js";
import type { LittlesSafeModeConfig } from "./littles-safe-mode.js";
import type { NomenclatureSettings } from "./nomenclature.js";
import type { AuditMetadata } from "./utility.js";

/** User preference for the application theme. */
export type ThemePreference = "light" | "dark" | "system";

/** Configuration for app-level locking / authentication. */
export interface AppLockConfig {
  readonly enabled: boolean;
  readonly timeoutSeconds: number;
  readonly biometricEnabled: boolean;
}

/** Notification preference toggles. */
export interface NotificationPreferences {
  readonly pushEnabled: boolean;
  readonly emailEnabled: boolean;
  readonly switchReminders: boolean;
  readonly checkInReminders: boolean;
}

/** Sync-related user preferences. */
export interface SyncPreferences {
  readonly syncEnabled: boolean;
  readonly syncOnWifiOnly: boolean;
  readonly syncIntervalSeconds: number;
}

/** Default privacy settings for new entities. */
export interface PrivacyDefaults {
  readonly defaultBucketVisibility: "private" | "friends" | "public";
  readonly requireExplicitSharing: boolean;
}

/** The top-level system settings entity. */
export interface SystemSettings extends AuditMetadata {
  readonly id: SystemSettingsId;
  readonly systemId: SystemId;
  readonly theme: ThemePreference;
  readonly locale: Locale;
  readonly appLock: AppLockConfig;
  readonly notifications: NotificationPreferences;
  readonly sync: SyncPreferences;
  readonly privacyDefaults: PrivacyDefaults;
  readonly littlesSafeMode: LittlesSafeModeConfig;
  readonly nomenclature: NomenclatureSettings;
}

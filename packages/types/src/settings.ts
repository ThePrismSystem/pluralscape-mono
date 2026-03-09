import type { Locale } from "./i18n.js";
import type { BucketId, SystemSettingsId, SystemId } from "./ids.js";
import type { LittlesSafeModeConfig } from "./littles-safe-mode.js";
import type { NomenclatureSettings } from "./nomenclature.js";
import type { AuditMetadata } from "./utility.js";

/** User preference for the application theme. */
export type ThemePreference = "light" | "dark" | "high-contrast" | "system";

/** Configuration for app-level locking / authentication. */
export interface AppLockConfig {
  readonly pinEnabled: boolean;
  readonly biometricEnabled: boolean;
  /** Lock timeout in minutes. */
  readonly lockTimeout: number;
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
  readonly syncOnCellular: boolean;
}

/** Friend request acceptance policy. */
export type FriendRequestPolicy = "open" | "code-only";

/** Default privacy settings for new entities. */
export interface PrivacyDefaults {
  readonly defaultBucketForNewContent: BucketId | null;
  readonly friendRequestPolicy: FriendRequestPolicy;
}

/** The top-level system settings entity. */
export interface SystemSettings extends AuditMetadata {
  readonly id: SystemSettingsId;
  readonly systemId: SystemId;
  readonly theme: ThemePreference;
  readonly fontScale: number;
  readonly locale: Locale | null;
  readonly defaultBucketId: BucketId | null;
  readonly appLock: AppLockConfig;
  readonly notifications: NotificationPreferences;
  readonly syncPreferences: SyncPreferences;
  readonly privacyDefaults: PrivacyDefaults;
  readonly littlesSafeMode: LittlesSafeModeConfig;
  readonly nomenclature: NomenclatureSettings;
  readonly onboardingComplete: boolean;
}

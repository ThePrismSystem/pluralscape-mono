import type { Locale } from "../i18n.js";
import type { BucketId, SystemSettingsId, SystemId } from "../ids.js";
import type { LittlesSafeModeConfig } from "../littles-safe-mode.js";
import type { NomenclatureSettings } from "../nomenclature.js";
import type { AuditMetadata } from "../utility.js";
import type { SnapshotSchedule } from "./system-snapshot.js";

/** User preference for the application theme. */
export type ThemePreference = "light" | "dark" | "high-contrast" | "system";

/** Configuration for app-level locking / authentication. */
export interface AppLockConfig {
  readonly pinEnabled: boolean;
  readonly biometricEnabled: boolean;
  /** Lock timeout in minutes. @range 1-30 */
  readonly lockTimeout: number;
  /** Seconds to keep keys in memory after app backgrounds. 0 = immediate clear. @range 0-300 */
  readonly backgroundGraceSeconds: number;
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
  readonly saturationLevelsEnabled: boolean;
  /** Automatically capture a fronting snapshot when creating a journal entry. */
  readonly autoCaptureFrontingOnJournal: boolean;
  /**
   * Schedule for automatic system structure snapshots.
   * Stored in the T1 encrypted blob. Scheduling is client-triggered:
   * the client reads this value and fires snapshots locally, so the
   * server never learns the schedule (zero-knowledge preservation).
   */
  readonly snapshotSchedule: SnapshotSchedule;
  readonly onboardingComplete: boolean;
}

/**
 * Keys of `SystemSettings` that are encrypted client-side before the
 * server sees them. `locale`, `defaultBucketId`, and `nomenclature` are
 * excluded: `locale` travels as a separate plaintext field (server needs
 * it for locale-aware operations), `defaultBucketId` is a bucket FK that
 * the server references, and `nomenclature` has its own
 * `PlaintextNomenclature` schema on dedicated endpoints. Consumed by:
 * - `__sot-manifest__.ts` (manifest's `encryptedFields` slot)
 * - `scripts/openapi-wire-parity.type-test.ts` (PlaintextSystemSettings parity)
 * - Plan 2 fleet will consume when deriving
 *   `SystemSettingsServerMetadata`.
 */
export type SystemSettingsEncryptedFields =
  | "theme"
  | "fontScale"
  | "appLock"
  | "notifications"
  | "syncPreferences"
  | "privacyDefaults"
  | "littlesSafeMode"
  | "saturationLevelsEnabled"
  | "autoCaptureFrontingOnJournal"
  | "snapshotSchedule"
  | "onboardingComplete";

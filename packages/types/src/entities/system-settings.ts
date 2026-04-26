import type { EncryptedWire } from "../encrypted-wire.js";
import type { EncryptedBlob } from "../encryption-primitives.js";
import type { Locale } from "../i18n.js";
import type { Brand, BucketId, SystemSettingsId, SystemId } from "../ids.js";
import type { LittlesSafeModeConfig } from "../littles-safe-mode.js";
import type { NomenclatureSettings } from "../nomenclature.js";
import type { Serialize } from "../type-assertions.js";
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

// ── Canonical chain (see ADR-023) ────────────────────────────────────
// SystemSettingsEncryptedInput → SystemSettingsServerMetadata
//                             → SystemSettingsResult → SystemSettingsWire
// Per-alias JSDoc is intentionally minimal; the alias name plus the
// chain anchor above carries the meaning. Per-alias docs only appear
// when an entity diverges from the standard pattern.

export type SystemSettingsEncryptedInput = Pick<SystemSettings, SystemSettingsEncryptedFields>;

/**
 * Server-visible SystemSettings metadata — raw Drizzle row shape.
 *
 * Derived from `SystemSettings` by stripping the encrypted field keys
 * (bundled inside `encryptedData`) plus `defaultBucketId` (not stored on
 * the `system_settings` table — the default bucket is wired through the
 * encrypted payload) and `nomenclature` (stored in its own
 * `nomenclature_settings` table). Adds `pinHash` and `biometricEnabled`
 * (server-visible for device-transfer policy enforcement without
 * decrypting the settings blob) and `encryptedData`.
 */
/**
 * Argon2id-hashed PIN. Branded `string` to prevent assigning an unhashed PIN
 * by mistake. Constructed only at the hashing call site (`hashPinOffload` in
 * `apps/api/src/services/pin.service.ts` and `account-pin.service.ts`); never
 * exposed to clients.
 */
export type PinHash = Brand<string, "PinHash">;

export type SystemSettingsServerMetadata = Omit<
  SystemSettings,
  SystemSettingsEncryptedFields | "defaultBucketId" | "nomenclature"
> & {
  readonly pinHash: PinHash | null;
  readonly biometricEnabled: boolean;
  readonly encryptedData: EncryptedBlob;
};

export type SystemSettingsResult = EncryptedWire<SystemSettingsServerMetadata>;

export type SystemSettingsWire = Serialize<SystemSettingsResult>;

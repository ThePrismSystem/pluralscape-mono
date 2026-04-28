import { integer, real, sqliteTable, text } from "drizzle-orm/sqlite-core";

import { brandedId, sqliteJsonOf } from "../../columns/sqlite.js";
import { timestamps } from "../../helpers/audit.sqlite.js";

import type {
  AppLockConfig,
  BucketId,
  LittlesSafeModeConfig,
  Locale,
  NomenclatureSettings,
  NotificationPreferences,
  PrivacyDefaults,
  SnapshotSchedule,
  SyncPreferences,
  SystemId,
  SystemSettingsId,
  ThemePreference,
} from "@pluralscape/types";
import type { InferInsertModel, InferSelectModel } from "drizzle-orm";

/**
 * Decrypted client-cache projection of `SystemSettings`. Carve-out:
 * singleton per system (server uses `systemId` UNIQUE) — entityIdentity
 * does not fit because entityIdentity does not produce a UNIQUE on
 * systemId. Not archivable.
 */
export const systemSettings = sqliteTable("system_settings", {
  id: brandedId<SystemSettingsId>("id").primaryKey(),
  systemId: brandedId<SystemId>("system_id").notNull().unique(),
  theme: text("theme").$type<ThemePreference>().notNull(),
  fontScale: real("font_scale").notNull(),
  locale: text("locale").$type<Locale | null>(),
  defaultBucketId: brandedId<BucketId>("default_bucket_id"),
  appLock: sqliteJsonOf<AppLockConfig>("app_lock").notNull(),
  notifications: sqliteJsonOf<NotificationPreferences>("notifications").notNull(),
  syncPreferences: sqliteJsonOf<SyncPreferences>("sync_preferences").notNull(),
  privacyDefaults: sqliteJsonOf<PrivacyDefaults>("privacy_defaults").notNull(),
  littlesSafeMode: sqliteJsonOf<LittlesSafeModeConfig>("littles_safe_mode").notNull(),
  nomenclature: sqliteJsonOf<NomenclatureSettings>("nomenclature").notNull(),
  saturationLevelsEnabled: integer("saturation_levels_enabled", { mode: "boolean" }).notNull(),
  autoCaptureFrontingOnJournal: integer("auto_capture_fronting_on_journal", {
    mode: "boolean",
  }).notNull(),
  snapshotSchedule: sqliteJsonOf<SnapshotSchedule>("snapshot_schedule").notNull(),
  onboardingComplete: integer("onboarding_complete", { mode: "boolean" }).notNull(),
  ...timestamps(),
});

export type LocalSystemSettingsRow = InferSelectModel<typeof systemSettings>;
export type NewLocalSystemSettings = InferInsertModel<typeof systemSettings>;

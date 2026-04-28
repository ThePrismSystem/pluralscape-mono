import { sqliteTable, text } from "drizzle-orm/sqlite-core";

import { brandedId, sqliteJsonOf } from "../../columns/sqlite.js";
import { archivable, timestamps } from "../../helpers/audit.sqlite.js";

import type { ImageSource, SystemId, SystemSettingsId } from "@pluralscape/types";
import type { InferInsertModel, InferSelectModel } from "drizzle-orm";

/**
 * CARVE-OUT (ADR-038): root entity, no `systemId` column. The system entity
 * IS the system. Decrypted client-cache projection of `System` from
 * `@pluralscape/types`. Authored per the encoding rules in ADR-038.
 */
export const systems = sqliteTable("systems", {
  id: brandedId<SystemId>("id").primaryKey(),
  name: text("name").notNull(),
  displayName: text("display_name"),
  description: text("description"),
  avatarSource: sqliteJsonOf<ImageSource | null>("avatar_source"),
  settingsId: brandedId<SystemSettingsId>("settings_id").notNull(),
  ...timestamps(),
  ...archivable(),
});

export type LocalSystemRow = InferSelectModel<typeof systems>;
export type NewLocalSystem = InferInsertModel<typeof systems>;

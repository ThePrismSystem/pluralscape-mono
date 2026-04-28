import { index, integer, sqliteTable } from "drizzle-orm/sqlite-core";

import { timestamps, versionCheckFor, versioned } from "../../helpers/audit.sqlite.js";
import { encryptedPayload, entityIdentity } from "../../helpers/entity-shape.sqlite.js";

import type { SafeModeContentId } from "@pluralscape/types";
import type { InferInsertModel, InferSelectModel } from "drizzle-orm";

// Carve-out: not archivable (curated content list, replaced wholesale on edit).
export const safeModeContent = sqliteTable(
  "safe_mode_content",
  {
    ...entityIdentity<SafeModeContentId>(),
    sortOrder: integer("sort_order").notNull().default(0),
    ...encryptedPayload(),
    ...timestamps(),
    ...versioned(),
  },
  (t) => [
    index("safe_mode_content_system_sort_idx").on(t.systemId, t.sortOrder),
    versionCheckFor("safe_mode_content", t.version),
  ],
);

export type SafeModeContentRow = InferSelectModel<typeof safeModeContent>;
export type NewSafeModeContent = InferInsertModel<typeof safeModeContent>;

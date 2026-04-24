import { index, integer, pgTable } from "drizzle-orm/pg-core";

import { brandedId, pgEncryptedBlob } from "../../columns/pg.js";
import { timestamps, versioned, versionCheckFor } from "../../helpers/audit.pg.js";

import { systems } from "./systems.js";

import type { SafeModeContentId, SystemId } from "@pluralscape/types";
import type { InferInsertModel, InferSelectModel } from "drizzle-orm";

export const safeModeContent = pgTable(
  "safe_mode_content",
  {
    id: brandedId<SafeModeContentId>("id").primaryKey(),
    systemId: brandedId<SystemId>("system_id")
      .notNull()
      .references(() => systems.id, { onDelete: "cascade" }),
    sortOrder: integer("sort_order").notNull().default(0),
    encryptedData: pgEncryptedBlob("encrypted_data").notNull(),
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

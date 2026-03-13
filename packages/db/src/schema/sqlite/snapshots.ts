import { check, index, sqliteTable, text } from "drizzle-orm/sqlite-core";

import { sqliteEncryptedBlob, sqliteTimestamp } from "../../columns/sqlite.js";
import { enumCheck } from "../../helpers/check.js";
import { SNAPSHOT_TRIGGERS } from "../../helpers/enums.js";

import { systems } from "./systems.js";

import type { SnapshotTrigger } from "@pluralscape/types";
import type { InferInsertModel, InferSelectModel } from "drizzle-orm";

export const systemSnapshots = sqliteTable(
  "system_snapshots",
  {
    id: text("id").primaryKey(),
    systemId: text("system_id")
      .notNull()
      .references(() => systems.id, { onDelete: "cascade" }),
    trigger: text("trigger").notNull().$type<SnapshotTrigger>(),
    encryptedData: sqliteEncryptedBlob("encrypted_data").notNull(),
    createdAt: sqliteTimestamp("created_at").notNull(),
  },
  (t) => [
    index("system_snapshots_system_created_idx").on(t.systemId, t.createdAt),
    check("system_snapshots_trigger_check", enumCheck(t.trigger, SNAPSHOT_TRIGGERS)),
  ],
);

export type SystemSnapshotRow = InferSelectModel<typeof systemSnapshots>;
export type NewSystemSnapshot = InferInsertModel<typeof systemSnapshots>;

import { check, index, pgTable, varchar } from "drizzle-orm/pg-core";

import { pgEncryptedBlob, pgTimestamp } from "../../columns/pg.js";
import { enumCheck } from "../../helpers/check.js";
import { ENUM_MAX_LENGTH, ID_MAX_LENGTH } from "../../helpers/constants.js";
import { SNAPSHOT_TRIGGERS } from "../../helpers/enums.js";

import { systems } from "./systems.js";

import type { SnapshotTrigger } from "@pluralscape/types";
import type { InferInsertModel, InferSelectModel } from "drizzle-orm";

export const systemSnapshots = pgTable(
  "system_snapshots",
  {
    id: varchar("id", { length: ID_MAX_LENGTH }).primaryKey(),
    systemId: varchar("system_id", { length: ID_MAX_LENGTH })
      .notNull()
      .references(() => systems.id, { onDelete: "cascade" }),
    trigger: varchar("trigger", { length: ENUM_MAX_LENGTH }).notNull().$type<SnapshotTrigger>(),
    encryptedData: pgEncryptedBlob("encrypted_data").notNull(),
    createdAt: pgTimestamp("created_at").notNull(),
  },
  (t) => [
    index("system_snapshots_system_created_idx").on(t.systemId, t.createdAt),
    check("system_snapshots_trigger_check", enumCheck(t.trigger, SNAPSHOT_TRIGGERS)),
  ],
);

export type SystemSnapshotRow = InferSelectModel<typeof systemSnapshots>;
export type NewSystemSnapshot = InferInsertModel<typeof systemSnapshots>;

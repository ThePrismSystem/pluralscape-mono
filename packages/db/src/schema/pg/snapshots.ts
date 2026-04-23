import { check, index, pgTable, varchar } from "drizzle-orm/pg-core";

import { brandedId, pgEncryptedBlob, pgTimestamp } from "../../columns/pg.js";
import { enumCheck } from "../../helpers/check.js";
import { ENUM_MAX_LENGTH } from "../../helpers/db.constants.js";
import { SNAPSHOT_TRIGGERS } from "../../helpers/enums.js";

import { systems } from "./systems.js";

import type { SnapshotTrigger, SystemId, SystemSnapshotId } from "@pluralscape/types";
import type { InferInsertModel, InferSelectModel } from "drizzle-orm";

export const systemSnapshots = pgTable(
  "system_snapshots",
  {
    id: brandedId<SystemSnapshotId>("id").primaryKey(),
    systemId: brandedId<SystemId>("system_id")
      .notNull()
      .references(() => systems.id, { onDelete: "cascade" }),
    snapshotTrigger: varchar("snapshot_trigger", { length: ENUM_MAX_LENGTH })
      .notNull()
      .$type<SnapshotTrigger>(),
    encryptedData: pgEncryptedBlob("encrypted_data").notNull(),
    createdAt: pgTimestamp("created_at").notNull(),
  },
  (t) => [
    index("system_snapshots_system_created_idx").on(t.systemId, t.createdAt),
    check(
      "system_snapshots_snapshot_trigger_check",
      enumCheck(t.snapshotTrigger, SNAPSHOT_TRIGGERS),
    ),
  ],
);

export type SystemSnapshotRow = InferSelectModel<typeof systemSnapshots>;
export type NewSystemSnapshot = InferInsertModel<typeof systemSnapshots>;

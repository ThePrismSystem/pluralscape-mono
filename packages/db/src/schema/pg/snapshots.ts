import { check, index, pgTable, varchar } from "drizzle-orm/pg-core";

import { pgTimestamp } from "../../columns/pg.js";
import { enumCheck } from "../../helpers/check.js";
import { ENUM_MAX_LENGTH } from "../../helpers/db.constants.js";
import { encryptedPayload, entityIdentity } from "../../helpers/entity-shape.pg.js";
import { SNAPSHOT_TRIGGERS } from "../../helpers/enums.js";

import type { SnapshotTrigger, SystemSnapshotId } from "@pluralscape/types";
import type { InferInsertModel, InferSelectModel } from "drizzle-orm";

// Carve-out: append-only snapshot history; no audit columns, only createdAt.
export const systemSnapshots = pgTable(
  "system_snapshots",
  {
    ...entityIdentity<SystemSnapshotId>(),
    snapshotTrigger: varchar("snapshot_trigger", { length: ENUM_MAX_LENGTH })
      .notNull()
      .$type<SnapshotTrigger>(),
    ...encryptedPayload(),
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

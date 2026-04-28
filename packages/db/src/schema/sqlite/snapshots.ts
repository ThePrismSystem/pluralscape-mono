import { check, index, sqliteTable, text } from "drizzle-orm/sqlite-core";

import { sqliteTimestamp } from "../../columns/sqlite.js";
import { enumCheck } from "../../helpers/check.js";
import { encryptedPayload, entityIdentity } from "../../helpers/entity-shape.sqlite.js";
import { SNAPSHOT_TRIGGERS } from "../../helpers/enums.js";

import type { SnapshotTrigger, SystemSnapshotId } from "@pluralscape/types";
import type { InferInsertModel, InferSelectModel } from "drizzle-orm";

// Carve-out: append-only snapshot history; no audit columns, only createdAt.
export const systemSnapshots = sqliteTable(
  "system_snapshots",
  {
    ...entityIdentity<SystemSnapshotId>(),
    snapshotTrigger: text("snapshot_trigger").notNull().$type<SnapshotTrigger>(),
    ...encryptedPayload(),
    createdAt: sqliteTimestamp("created_at").notNull(),
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

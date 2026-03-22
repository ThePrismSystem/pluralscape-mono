/**
 * Schema-type parity tests.
 *
 * Verifies that:
 * 1. PG and SQLite schemas have identical column sets for shared tables.
 * 2. Key columns changed in Fixes 1-8 exist with the expected names.
 * 3. Compile-time type assertions confirm inferred row types match expectations.
 */

import { getTableColumns } from "drizzle-orm";
import { getTableConfig as getPgTableConfig } from "drizzle-orm/pg-core";
import { getTableConfig as getSqliteTableConfig } from "drizzle-orm/sqlite-core";
import { describe, expect, expectTypeOf, it } from "vitest";

import { BUCKET_CONTENT_ENTITY_TYPES } from "../helpers/enums.js";
import * as pg from "../schema/pg/index.js";
import * as sqlite from "../schema/sqlite/index.js";

import type {
  DbChartData,
  DbChartDataset,
  DbDateRange,
  DbMemberFrontingBreakdown,
} from "../schema/shared/analytics-types.js";
import type {
  BucketContentEntityType,
  ChartData,
  ChartDataset,
  DateRange,
  EntityType,
  MemberFrontingBreakdown,
} from "@pluralscape/types";
import type { InferSelectModel } from "drizzle-orm";

// ---------------------------------------------------------------------------
// DB-only columns — present in schema but not in canonical domain types.
// These are internal persistence concerns (encryption, versioning, archival).
// ---------------------------------------------------------------------------
const DB_ONLY_COLUMNS = new Set(["encryptedData", "version", "archived", "archivedAt"]);

// ---------------------------------------------------------------------------
// PG-only columns — present in PG but intentionally absent from SQLite.
// These support server-side concerns like partitioning (ADR 019).
// ---------------------------------------------------------------------------
const PG_ONLY_COLUMNS: Record<string, Set<string>> = {
  frontingComments: new Set(["sessionStartTime"]),
};

// ---------------------------------------------------------------------------
// Table pairs shared between PG and SQLite.
// SQLite-only tables (jobs, search index) are intentionally excluded.
// ---------------------------------------------------------------------------
const TABLE_PAIRS: Array<{
  name: string;
  pgTable: Record<string, { name: string }>;
  sqliteTable: Record<string, { name: string }>;
}> = [
  // Auth
  {
    name: "accounts",
    pgTable: getTableColumns(pg.accounts),
    sqliteTable: getTableColumns(sqlite.accounts),
  },
  {
    name: "authKeys",
    pgTable: getTableColumns(pg.authKeys),
    sqliteTable: getTableColumns(sqlite.authKeys),
  },
  {
    name: "sessions",
    pgTable: getTableColumns(pg.sessions),
    sqliteTable: getTableColumns(sqlite.sessions),
  },
  {
    name: "recoveryKeys",
    pgTable: getTableColumns(pg.recoveryKeys),
    sqliteTable: getTableColumns(sqlite.recoveryKeys),
  },
  {
    name: "deviceTransferRequests",
    pgTable: getTableColumns(pg.deviceTransferRequests),
    sqliteTable: getTableColumns(sqlite.deviceTransferRequests),
  },
  // Systems & Members
  {
    name: "systems",
    pgTable: getTableColumns(pg.systems),
    sqliteTable: getTableColumns(sqlite.systems),
  },
  {
    name: "members",
    pgTable: getTableColumns(pg.members),
    sqliteTable: getTableColumns(sqlite.members),
  },
  {
    name: "memberPhotos",
    pgTable: getTableColumns(pg.memberPhotos),
    sqliteTable: getTableColumns(sqlite.memberPhotos),
  },
  // Fronting
  {
    name: "frontingSessions",
    pgTable: getTableColumns(pg.frontingSessions),
    sqliteTable: getTableColumns(sqlite.frontingSessions),
  },
  {
    name: "customFronts",
    pgTable: getTableColumns(pg.customFronts),
    sqliteTable: getTableColumns(sqlite.customFronts),
  },
  {
    name: "frontingComments",
    pgTable: getTableColumns(pg.frontingComments),
    sqliteTable: getTableColumns(sqlite.frontingComments),
  },
  // Analytics
  {
    name: "frontingReports",
    pgTable: getTableColumns(pg.frontingReports),
    sqliteTable: getTableColumns(sqlite.frontingReports),
  },
  // Privacy
  {
    name: "buckets",
    pgTable: getTableColumns(pg.buckets),
    sqliteTable: getTableColumns(sqlite.buckets),
  },
  {
    name: "bucketContentTags",
    pgTable: getTableColumns(pg.bucketContentTags),
    sqliteTable: getTableColumns(sqlite.bucketContentTags),
  },
  {
    name: "keyGrants",
    pgTable: getTableColumns(pg.keyGrants),
    sqliteTable: getTableColumns(sqlite.keyGrants),
  },
  {
    name: "friendConnections",
    pgTable: getTableColumns(pg.friendConnections),
    sqliteTable: getTableColumns(sqlite.friendConnections),
  },
  {
    name: "friendCodes",
    pgTable: getTableColumns(pg.friendCodes),
    sqliteTable: getTableColumns(sqlite.friendCodes),
  },
  {
    name: "friendBucketAssignments",
    pgTable: getTableColumns(pg.friendBucketAssignments),
    sqliteTable: getTableColumns(sqlite.friendBucketAssignments),
  },
  // Config & Settings
  {
    name: "systemSettings",
    pgTable: getTableColumns(pg.systemSettings),
    sqliteTable: getTableColumns(sqlite.systemSettings),
  },
  {
    name: "nomenclatureSettings",
    pgTable: getTableColumns(pg.nomenclatureSettings),
    sqliteTable: getTableColumns(sqlite.nomenclatureSettings),
  },
  // API Keys
  {
    name: "apiKeys",
    pgTable: getTableColumns(pg.apiKeys),
    sqliteTable: getTableColumns(sqlite.apiKeys),
  },
  // Audit & Lifecycle
  {
    name: "auditLog",
    pgTable: getTableColumns(pg.auditLog),
    sqliteTable: getTableColumns(sqlite.auditLog),
  },
  {
    name: "lifecycleEvents",
    pgTable: getTableColumns(pg.lifecycleEvents),
    sqliteTable: getTableColumns(sqlite.lifecycleEvents),
  },
  // Communication
  {
    name: "channels",
    pgTable: getTableColumns(pg.channels),
    sqliteTable: getTableColumns(sqlite.channels),
  },
  {
    name: "messages",
    pgTable: getTableColumns(pg.messages),
    sqliteTable: getTableColumns(sqlite.messages),
  },
  {
    name: "boardMessages",
    pgTable: getTableColumns(pg.boardMessages),
    sqliteTable: getTableColumns(sqlite.boardMessages),
  },
  { name: "notes", pgTable: getTableColumns(pg.notes), sqliteTable: getTableColumns(sqlite.notes) },
  { name: "polls", pgTable: getTableColumns(pg.polls), sqliteTable: getTableColumns(sqlite.polls) },
  {
    name: "pollVotes",
    pgTable: getTableColumns(pg.pollVotes),
    sqliteTable: getTableColumns(sqlite.pollVotes),
  },
  {
    name: "acknowledgements",
    pgTable: getTableColumns(pg.acknowledgements),
    sqliteTable: getTableColumns(sqlite.acknowledgements),
  },
  // Custom Fields
  {
    name: "fieldDefinitions",
    pgTable: getTableColumns(pg.fieldDefinitions),
    sqliteTable: getTableColumns(sqlite.fieldDefinitions),
  },
  {
    name: "fieldValues",
    pgTable: getTableColumns(pg.fieldValues),
    sqliteTable: getTableColumns(sqlite.fieldValues),
  },
  {
    name: "fieldBucketVisibility",
    pgTable: getTableColumns(pg.fieldBucketVisibility),
    sqliteTable: getTableColumns(sqlite.fieldBucketVisibility),
  },
  // Groups
  {
    name: "groups",
    pgTable: getTableColumns(pg.groups),
    sqliteTable: getTableColumns(sqlite.groups),
  },
  {
    name: "groupMemberships",
    pgTable: getTableColumns(pg.groupMemberships),
    sqliteTable: getTableColumns(sqlite.groupMemberships),
  },
  // Innerworld
  {
    name: "innerworldCanvas",
    pgTable: getTableColumns(pg.innerworldCanvas),
    sqliteTable: getTableColumns(sqlite.innerworldCanvas),
  },
  {
    name: "innerworldEntities",
    pgTable: getTableColumns(pg.innerworldEntities),
    sqliteTable: getTableColumns(sqlite.innerworldEntities),
  },
  {
    name: "innerworldRegions",
    pgTable: getTableColumns(pg.innerworldRegions),
    sqliteTable: getTableColumns(sqlite.innerworldRegions),
  },
  // Journal
  {
    name: "journalEntries",
    pgTable: getTableColumns(pg.journalEntries),
    sqliteTable: getTableColumns(sqlite.journalEntries),
  },
  {
    name: "wikiPages",
    pgTable: getTableColumns(pg.wikiPages),
    sqliteTable: getTableColumns(sqlite.wikiPages),
  },
  // Notifications
  {
    name: "deviceTokens",
    pgTable: getTableColumns(pg.deviceTokens),
    sqliteTable: getTableColumns(sqlite.deviceTokens),
  },
  {
    name: "friendNotificationPreferences",
    pgTable: getTableColumns(pg.friendNotificationPreferences),
    sqliteTable: getTableColumns(sqlite.friendNotificationPreferences),
  },
  {
    name: "notificationConfigs",
    pgTable: getTableColumns(pg.notificationConfigs),
    sqliteTable: getTableColumns(sqlite.notificationConfigs),
  },
  // PK Bridge
  {
    name: "pkBridgeConfigs",
    pgTable: getTableColumns(pg.pkBridgeConfigs),
    sqliteTable: getTableColumns(sqlite.pkBridgeConfigs),
  },
  // Safe Mode
  {
    name: "safeModeContent",
    pgTable: getTableColumns(pg.safeModeContent),
    sqliteTable: getTableColumns(sqlite.safeModeContent),
  },
  // Structure
  {
    name: "relationships",
    pgTable: getTableColumns(pg.relationships),
    sqliteTable: getTableColumns(sqlite.relationships),
  },
  {
    name: "subsystems",
    pgTable: getTableColumns(pg.subsystems),
    sqliteTable: getTableColumns(sqlite.subsystems),
  },
  {
    name: "subsystemMemberships",
    pgTable: getTableColumns(pg.subsystemMemberships),
    sqliteTable: getTableColumns(sqlite.subsystemMemberships),
  },
  {
    name: "subsystemLayerLinks",
    pgTable: getTableColumns(pg.subsystemLayerLinks),
    sqliteTable: getTableColumns(sqlite.subsystemLayerLinks),
  },
  {
    name: "subsystemSideSystemLinks",
    pgTable: getTableColumns(pg.subsystemSideSystemLinks),
    sqliteTable: getTableColumns(sqlite.subsystemSideSystemLinks),
  },
  {
    name: "sideSystems",
    pgTable: getTableColumns(pg.sideSystems),
    sqliteTable: getTableColumns(sqlite.sideSystems),
  },
  {
    name: "sideSystemMemberships",
    pgTable: getTableColumns(pg.sideSystemMemberships),
    sqliteTable: getTableColumns(sqlite.sideSystemMemberships),
  },
  {
    name: "sideSystemLayerLinks",
    pgTable: getTableColumns(pg.sideSystemLayerLinks),
    sqliteTable: getTableColumns(sqlite.sideSystemLayerLinks),
  },
  {
    name: "layers",
    pgTable: getTableColumns(pg.layers),
    sqliteTable: getTableColumns(sqlite.layers),
  },
  {
    name: "layerMemberships",
    pgTable: getTableColumns(pg.layerMemberships),
    sqliteTable: getTableColumns(sqlite.layerMemberships),
  },
  // Blob Metadata
  {
    name: "blobMetadata",
    pgTable: getTableColumns(pg.blobMetadata),
    sqliteTable: getTableColumns(sqlite.blobMetadata),
  },
  // Timers
  {
    name: "timerConfigs",
    pgTable: getTableColumns(pg.timerConfigs),
    sqliteTable: getTableColumns(sqlite.timerConfigs),
  },
  {
    name: "checkInRecords",
    pgTable: getTableColumns(pg.checkInRecords),
    sqliteTable: getTableColumns(sqlite.checkInRecords),
  },
  // Webhooks
  {
    name: "webhookConfigs",
    pgTable: getTableColumns(pg.webhookConfigs),
    sqliteTable: getTableColumns(sqlite.webhookConfigs),
  },
  {
    name: "webhookDeliveries",
    pgTable: getTableColumns(pg.webhookDeliveries),
    sqliteTable: getTableColumns(sqlite.webhookDeliveries),
  },
  // Import/Export
  {
    name: "importJobs",
    pgTable: getTableColumns(pg.importJobs),
    sqliteTable: getTableColumns(sqlite.importJobs),
  },
  {
    name: "exportRequests",
    pgTable: getTableColumns(pg.exportRequests),
    sqliteTable: getTableColumns(sqlite.exportRequests),
  },
  {
    name: "accountPurgeRequests",
    pgTable: getTableColumns(pg.accountPurgeRequests),
    sqliteTable: getTableColumns(sqlite.accountPurgeRequests),
  },
  // Sync
  {
    name: "syncDocuments",
    pgTable: getTableColumns(pg.syncDocuments),
    sqliteTable: getTableColumns(sqlite.syncDocuments),
  },
  {
    name: "syncChanges",
    pgTable: getTableColumns(pg.syncChanges),
    sqliteTable: getTableColumns(sqlite.syncChanges),
  },
  {
    name: "syncSnapshots",
    pgTable: getTableColumns(pg.syncSnapshots),
    sqliteTable: getTableColumns(sqlite.syncSnapshots),
  },
  // Key Rotation
  {
    name: "bucketKeyRotations",
    pgTable: getTableColumns(pg.bucketKeyRotations),
    sqliteTable: getTableColumns(sqlite.bucketKeyRotations),
  },
  {
    name: "bucketRotationItems",
    pgTable: getTableColumns(pg.bucketRotationItems),
    sqliteTable: getTableColumns(sqlite.bucketRotationItems),
  },
];

// ---------------------------------------------------------------------------
// 1. PG / SQLite column parity
// ---------------------------------------------------------------------------
describe("PG and SQLite column parity", () => {
  for (const { name, pgTable, sqliteTable } of TABLE_PAIRS) {
    it(`${name} has identical column sets in PG and SQLite`, () => {
      const pgCols = new Set(Object.keys(pgTable));
      const sqliteCols = new Set(Object.keys(sqliteTable));
      const pgOnly = PG_ONLY_COLUMNS[name] ?? new Set<string>();

      const onlyInPg = [...pgCols].filter((c) => !sqliteCols.has(c) && !pgOnly.has(c));
      const onlyInSqlite = [...sqliteCols].filter((c) => !pgCols.has(c));

      expect(onlyInPg, `columns only in PG ${name}`).toEqual([]);
      expect(onlyInSqlite, `columns only in SQLite ${name}`).toEqual([]);
    });
  }
});

// ---------------------------------------------------------------------------
// 2. Column existence — key tables touched in Fixes 1-8
// ---------------------------------------------------------------------------
describe("Column existence", () => {
  // Fix 1 — bucketContentTags.entityType typed as EntityType
  describe("bucketContentTags (Fix 1)", () => {
    it("PG has entityType, entityId, bucketId columns", () => {
      const cols = getTableColumns(pg.bucketContentTags);
      expect(cols).toHaveProperty("entityType");
      expect(cols).toHaveProperty("entityId");
      expect(cols).toHaveProperty("bucketId");
    });

    it("SQLite has entityType, entityId, bucketId columns", () => {
      const cols = getTableColumns(sqlite.bucketContentTags);
      expect(cols).toHaveProperty("entityType");
      expect(cols).toHaveProperty("entityId");
      expect(cols).toHaveProperty("bucketId");
    });

    it("no unexpected columns exist beyond the canonical four", () => {
      const pgCols = new Set(Object.keys(getTableColumns(pg.bucketContentTags)));
      const canonical = new Set(["entityType", "entityId", "bucketId", "systemId"]);
      const extra = [...pgCols].filter((c) => !canonical.has(c) && !DB_ONLY_COLUMNS.has(c));
      expect(extra).toEqual([]);
    });
  });

  // Fix 2 — memberPhotos.sortOrder non-nullable
  describe("memberPhotos (Fix 2)", () => {
    it("PG has sortOrder column", () => {
      const cols = getTableColumns(pg.memberPhotos);
      expect(cols).toHaveProperty("sortOrder");
    });

    it("SQLite has sortOrder column", () => {
      const cols = getTableColumns(sqlite.memberPhotos);
      expect(cols).toHaveProperty("sortOrder");
    });

    it("PG sortOrder column is named sort_order", () => {
      const cols = getTableColumns(pg.memberPhotos);
      expect(cols.sortOrder.name).toBe("sort_order");
    });
  });

  // Fix 3 — frontingComments has frontingSessionId (not a legacy name)
  describe("frontingComments (Fix 3)", () => {
    it("PG has frontingSessionId column", () => {
      const cols = getTableColumns(pg.frontingComments);
      expect(cols).toHaveProperty("frontingSessionId");
    });

    it("SQLite has frontingSessionId column", () => {
      const cols = getTableColumns(sqlite.frontingComments);
      expect(cols).toHaveProperty("frontingSessionId");
    });

    it("PG frontingSessionId DB column is named fronting_session_id", () => {
      const cols = getTableColumns(pg.frontingComments);
      expect(cols.frontingSessionId.name).toBe("fronting_session_id");
    });

    it("has expected canonical columns: id, frontingSessionId, systemId, sessionStartTime, memberId, encryptedData", () => {
      const cols = getTableColumns(pg.frontingComments);
      const expected = [
        "id",
        "frontingSessionId",
        "systemId",
        "sessionStartTime",
        "memberId",
        "encryptedData",
      ];
      for (const col of expected) {
        expect(cols, `expected column ${col}`).toHaveProperty(col);
      }
    });
  });

  // Fix 6 — systemSettings has a separate id PK
  describe("systemSettings (Fix 6)", () => {
    it("PG has id column as primary key", () => {
      const cols = getTableColumns(pg.systemSettings);
      expect(cols).toHaveProperty("id");
      expect(cols.id.primary).toBe(true);
    });

    it("SQLite has id column as primary key", () => {
      const cols = getTableColumns(sqlite.systemSettings);
      expect(cols).toHaveProperty("id");
      expect(cols.id.primary).toBe(true);
    });

    it("PG also has systemId as a separate column", () => {
      const cols = getTableColumns(pg.systemSettings);
      expect(cols).toHaveProperty("systemId");
    });

    it("has expected columns: id, systemId, locale, pinHash, biometricEnabled, encryptedData", () => {
      const cols = getTableColumns(pg.systemSettings);
      const expected = ["id", "systemId", "locale", "pinHash", "biometricEnabled", "encryptedData"];
      for (const col of expected) {
        expect(cols, `expected column ${col}`).toHaveProperty(col);
      }
    });

    it("does not have littlesSafeModeEnabled (moved to T1 encrypted)", () => {
      const cols = getTableColumns(pg.systemSettings);
      expect(cols).not.toHaveProperty("littlesSafeModeEnabled");
    });
  });

  // Fix 7 — importJobs and exportRequests have updatedAt non-nullable
  describe("importJobs (Fix 7)", () => {
    it("PG has updatedAt column", () => {
      const cols = getTableColumns(pg.importJobs);
      expect(cols).toHaveProperty("updatedAt");
    });

    it("SQLite has updatedAt column", () => {
      const cols = getTableColumns(sqlite.importJobs);
      expect(cols).toHaveProperty("updatedAt");
    });

    it("PG updatedAt DB column is named updated_at", () => {
      const cols = getTableColumns(pg.importJobs);
      expect(cols.updatedAt.name).toBe("updated_at");
    });
  });

  describe("exportRequests (Fix 7)", () => {
    it("PG has updatedAt column", () => {
      const cols = getTableColumns(pg.exportRequests);
      expect(cols).toHaveProperty("updatedAt");
    });

    it("SQLite has updatedAt column", () => {
      const cols = getTableColumns(sqlite.exportRequests);
      expect(cols).toHaveProperty("updatedAt");
    });

    it("PG updatedAt DB column is named updated_at", () => {
      const cols = getTableColumns(pg.exportRequests);
      expect(cols.updatedAt.name).toBe("updated_at");
    });
  });

  // Fix 8 — frontingReports new table exists in both schemas
  describe("frontingReports (Fix 8)", () => {
    it("PG frontingReports table is defined", () => {
      expect(pg.frontingReports).toBeDefined();
    });

    it("SQLite frontingReports table is defined", () => {
      expect(sqlite.frontingReports).toBeDefined();
    });

    it("has expected columns: id, systemId, encryptedData, format, generatedAt", () => {
      const cols = getTableColumns(pg.frontingReports);
      const expected = ["id", "systemId", "encryptedData", "format", "generatedAt"];
      for (const col of expected) {
        expect(cols, `expected column ${col}`).toHaveProperty(col);
      }
    });

    it("does not have plaintext JSONB columns — report data is T1 encrypted", () => {
      const pgCols = getTableColumns(pg.frontingReports);
      const sqliteCols = getTableColumns(sqlite.frontingReports);
      expect(pgCols).not.toHaveProperty("dateRange");
      expect(pgCols).not.toHaveProperty("memberBreakdowns");
      expect(pgCols).not.toHaveProperty("chartData");
      expect(sqliteCols).not.toHaveProperty("dateRange");
      expect(sqliteCols).not.toHaveProperty("memberBreakdowns");
      expect(sqliteCols).not.toHaveProperty("chartData");
    });
  });
});

// ---------------------------------------------------------------------------
// 3. DB-only column allowlist — verify allowlisted columns don't appear on
//    tables that should be plaintext/simple records.
// ---------------------------------------------------------------------------
describe("DB-only column allowlist", () => {
  it("frontingReports has encryptedData but no other DB-only columns", () => {
    const cols = getTableColumns(pg.frontingReports);
    expect(cols).toHaveProperty("encryptedData");
    for (const dbOnly of DB_ONLY_COLUMNS) {
      if (dbOnly === "encryptedData") continue;
      expect(cols, `frontingReports should not have ${dbOnly}`).not.toHaveProperty(dbOnly);
    }
  });

  it("members has the expected DB-only columns: encryptedData, version, archived, archivedAt", () => {
    const cols = getTableColumns(pg.members);
    expect(cols).toHaveProperty("encryptedData");
    expect(cols).toHaveProperty("version");
    expect(cols).toHaveProperty("archived");
    expect(cols).toHaveProperty("archivedAt");
  });

  it("accounts has kdfSalt as a non-nullable column", () => {
    const cols = getTableColumns(pg.accounts);
    expect(cols).toHaveProperty("kdfSalt");
    expect(cols.kdfSalt.notNull).toBe(true);
  });
});

// ---------------------------------------------------------------------------
// 4. Type-level assertions
//    Use expectTypeOf + InferSelectModel to verify compile-time correctness
//    for the columns changed in Fixes 1-8.
// ---------------------------------------------------------------------------
describe("Type-level assertions", () => {
  // Fix 1 — bucketContentTags.entityType is BucketContentEntityType
  it("PG bucketContentTags.entityType infers as BucketContentEntityType", () => {
    type Row = InferSelectModel<typeof pg.bucketContentTags>;
    expectTypeOf<Row["entityType"]>().toEqualTypeOf<BucketContentEntityType>();
  });

  it("SQLite bucketContentTags.entityType infers as BucketContentEntityType", () => {
    type Row = InferSelectModel<typeof sqlite.bucketContentTags>;
    expectTypeOf<Row["entityType"]>().toEqualTypeOf<BucketContentEntityType>();
  });

  it("BucketContentEntityType is a subset of EntityType", () => {
    expectTypeOf<BucketContentEntityType>().toExtend<EntityType>();
  });

  it("infrastructure types are not assignable to BucketContentEntityType", () => {
    expectTypeOf<"session">().not.toExtend<BucketContentEntityType>();
    expectTypeOf<"account">().not.toExtend<BucketContentEntityType>();
    expectTypeOf<"job">().not.toExtend<BucketContentEntityType>();
  });

  // Fix 2 — memberPhotos.sortOrder is number (non-nullable)
  it("PG memberPhotos.sortOrder infers as number (non-nullable)", () => {
    type Row = InferSelectModel<typeof pg.memberPhotos>;
    expectTypeOf<Row["sortOrder"]>().toEqualTypeOf<number>();
  });

  it("SQLite memberPhotos.sortOrder infers as number (non-nullable)", () => {
    type Row = InferSelectModel<typeof sqlite.memberPhotos>;
    expectTypeOf<Row["sortOrder"]>().toEqualTypeOf<number>();
  });

  // Fix 3 — frontingComments.frontingSessionId is string (non-nullable)
  it("PG frontingComments.frontingSessionId infers as string", () => {
    type Row = InferSelectModel<typeof pg.frontingComments>;
    expectTypeOf<Row["frontingSessionId"]>().toEqualTypeOf<string>();
  });

  it("SQLite frontingComments.frontingSessionId infers as string", () => {
    type Row = InferSelectModel<typeof sqlite.frontingComments>;
    expectTypeOf<Row["frontingSessionId"]>().toEqualTypeOf<string>();
  });

  // Fix 6 — systemSettings has both id and systemId as string
  it("PG systemSettings.id infers as string", () => {
    type Row = InferSelectModel<typeof pg.systemSettings>;
    expectTypeOf<Row["id"]>().toEqualTypeOf<string>();
  });

  it("PG systemSettings.systemId infers as string", () => {
    type Row = InferSelectModel<typeof pg.systemSettings>;
    expectTypeOf<Row["systemId"]>().toEqualTypeOf<string>();
  });

  // Fix 7 — importJobs.updatedAt is number (non-nullable, custom pgTimestamp returns UnixMillis)
  it("PG importJobs.updatedAt infers as number (non-nullable)", () => {
    type Row = InferSelectModel<typeof pg.importJobs>;
    expectTypeOf<Row["updatedAt"]>().toEqualTypeOf<number>();
  });

  it("SQLite importJobs.updatedAt infers as number (non-nullable)", () => {
    type Row = InferSelectModel<typeof sqlite.importJobs>;
    expectTypeOf<Row["updatedAt"]>().toEqualTypeOf<number>();
  });

  it("PG exportRequests.updatedAt infers as number (non-nullable)", () => {
    type Row = InferSelectModel<typeof pg.exportRequests>;
    expectTypeOf<Row["updatedAt"]>().toEqualTypeOf<number>();
  });

  it("SQLite exportRequests.updatedAt infers as number (non-nullable)", () => {
    type Row = InferSelectModel<typeof sqlite.exportRequests>;
    expectTypeOf<Row["updatedAt"]>().toEqualTypeOf<number>();
  });

  // Fix 8 — frontingReports has expected field types
  it("PG frontingReports.format infers as 'html' | 'pdf'", () => {
    type Row = InferSelectModel<typeof pg.frontingReports>;
    expectTypeOf<Row["format"]>().toEqualTypeOf<"html" | "pdf">();
  });

  it("SQLite frontingReports.format infers as 'html' | 'pdf'", () => {
    type Row = InferSelectModel<typeof sqlite.frontingReports>;
    expectTypeOf<Row["format"]>().toEqualTypeOf<"html" | "pdf">();
  });

  it("PG frontingReports.generatedAt infers as number", () => {
    type Row = InferSelectModel<typeof pg.frontingReports>;
    expectTypeOf<Row["generatedAt"]>().toEqualTypeOf<number>();
  });

  // Auth session security — new nullable columns
  it("PG sessions.expiresAt infers as number | null", () => {
    type Row = InferSelectModel<typeof pg.sessions>;
    expectTypeOf<Row["expiresAt"]>().toEqualTypeOf<number | null>();
  });

  it("SQLite sessions.expiresAt infers as number | null", () => {
    type Row = InferSelectModel<typeof sqlite.sessions>;
    expectTypeOf<Row["expiresAt"]>().toEqualTypeOf<number | null>();
  });

  it("PG recoveryKeys.revokedAt infers as number | null", () => {
    type Row = InferSelectModel<typeof pg.recoveryKeys>;
    expectTypeOf<Row["revokedAt"]>().toEqualTypeOf<number | null>();
  });

  it("SQLite recoveryKeys.revokedAt infers as number | null", () => {
    type Row = InferSelectModel<typeof sqlite.recoveryKeys>;
    expectTypeOf<Row["revokedAt"]>().toEqualTypeOf<number | null>();
  });
});

// ---------------------------------------------------------------------------
// 5. Analytics type structural parity
// ---------------------------------------------------------------------------
describe("analytics type structural parity", () => {
  it("DbDateRange has same keys as DateRange", () => {
    expectTypeOf<keyof DbDateRange>().toEqualTypeOf<keyof DateRange>();
  });

  it("DbMemberFrontingBreakdown has same keys as MemberFrontingBreakdown", () => {
    expectTypeOf<keyof DbMemberFrontingBreakdown>().toEqualTypeOf<keyof MemberFrontingBreakdown>();
  });

  it("DbChartDataset has same keys as ChartDataset", () => {
    expectTypeOf<keyof DbChartDataset>().toEqualTypeOf<keyof ChartDataset>();
  });

  it("DbChartData has same keys as ChartData", () => {
    expectTypeOf<keyof DbChartData>().toEqualTypeOf<keyof ChartData>();
  });
});

// ---------------------------------------------------------------------------
// 6. BUCKET_CONTENT_ENTITY_TYPES array invariants
// ---------------------------------------------------------------------------
describe("BUCKET_CONTENT_ENTITY_TYPES invariants", () => {
  it("has exactly 21 entries", () => {
    expect(BUCKET_CONTENT_ENTITY_TYPES).toHaveLength(21);
  });

  it("has no duplicate values", () => {
    const unique = new Set(BUCKET_CONTENT_ENTITY_TYPES);
    expect(unique.size).toBe(BUCKET_CONTENT_ENTITY_TYPES.length);
  });
});

// ---------------------------------------------------------------------------
// 7. Index name parity
// ---------------------------------------------------------------------------

/**
 * Known legitimate index divergences between PG and SQLite.
 * Key: index name, Value: reason for the divergence.
 */
const KNOWN_PG_ONLY_INDEXES = new Set([
  // Expression index using EXTRACT(EPOCH …) — not available in SQLite
  "sessions_ttl_duration_ms_idx",
  // Denormalized session_start_time index for partitioned FK — not needed in SQLite
  "fronting_comments_session_start_idx",
  // PG serial column uses a simple seq index; SQLite integer uses system_id-prefixed index
  "sync_queue_seq_idx",
]);

const KNOWN_SQLITE_ONLY_INDEXES = new Set([
  // SQLite uses system_id-prefixed seq index (integer, not serial)
  "sync_queue_system_id_seq_idx",
]);

/**
 * Known FK count divergences between PG and SQLite.
 * Key: table name, Value: [expectedPg, expectedSqlite].
 */
const KNOWN_FK_DIVERGENCES: Record<string, [number, number]> = {
  // SQLite adds an FK to fronting_sessions that PG can't enforce (non-partitioned FK ref)
  journalEntries: [1, 2],
};

interface StructuralPair {
  name: string;
  pgIndexNames: string[];
  sqliteIndexNames: string[];
  pgFkCount: number;
  sqliteFkCount: number;
  pgCheckCount: number;
  sqliteCheckCount: number;
}

/**
 * Build parallel arrays of StructuralPair
 * at module level so that test iterations can reference them without runtime casts.
 */
function buildStructuralPairs(): StructuralPair[] {
  const results: StructuralPair[] = [];

  for (const { name } of TABLE_PAIRS) {
    // Access the table objects directly from the namespace imports
    const pgTableObj = pg[name as keyof typeof pg];
    const sqlTableObj = sqlite[name as keyof typeof sqlite];
    if (typeof pgTableObj !== "object" || typeof sqlTableObj !== "object") continue;

    // getTableConfig accepts any table-like object — the column structure is sufficient
    const pgConfig = getPgTableConfig(pgTableObj as Parameters<typeof getPgTableConfig>[0]);
    const sqlConfig = getSqliteTableConfig(
      sqlTableObj as Parameters<typeof getSqliteTableConfig>[0],
    );

    const pgIdxNames = pgConfig.indexes.map((i) => i.config.name);
    const sqlIdxNames = sqlConfig.indexes.map((i) => i.config.name);

    results.push({
      name,
      pgIndexNames: pgIdxNames.filter((n): n is string => typeof n === "string"),
      sqliteIndexNames: sqlIdxNames.filter((n): n is string => typeof n === "string"),
      pgFkCount: pgConfig.foreignKeys.length,
      sqliteFkCount: sqlConfig.foreignKeys.length,
      pgCheckCount: pgConfig.checks.length,
      sqliteCheckCount: sqlConfig.checks.length,
    });
  }

  return results;
}

const STRUCTURAL_PAIRS = buildStructuralPairs();

describe("PG and SQLite index name parity", () => {
  for (const pair of STRUCTURAL_PAIRS) {
    it(`${pair.name} has matching index names`, () => {
      const pgNames = new Set(pair.pgIndexNames);
      const sqlNames = new Set(pair.sqliteIndexNames);

      const pgOnly = [...pgNames].filter((n) => !sqlNames.has(n) && !KNOWN_PG_ONLY_INDEXES.has(n));
      const sqlOnly = [...sqlNames].filter(
        (n) => !pgNames.has(n) && !KNOWN_SQLITE_ONLY_INDEXES.has(n),
      );

      expect(pgOnly, `unexpected PG-only indexes in ${pair.name}`).toEqual([]);
      expect(sqlOnly, `unexpected SQLite-only indexes in ${pair.name}`).toEqual([]);
    });
  }
});

// ---------------------------------------------------------------------------
// 8. FK count parity
// ---------------------------------------------------------------------------
describe("PG and SQLite FK count parity", () => {
  for (const pair of STRUCTURAL_PAIRS) {
    it(`${pair.name} has matching FK count`, () => {
      const known = KNOWN_FK_DIVERGENCES[pair.name];
      if (known) {
        expect(pair.pgFkCount, `${pair.name} PG FK count`).toBe(known[0]);
        expect(pair.sqliteFkCount, `${pair.name} SQLite FK count`).toBe(known[1]);
      } else {
        expect(pair.pgFkCount, `FK count mismatch in ${pair.name}`).toBe(pair.sqliteFkCount);
      }
    });
  }
});

// ---------------------------------------------------------------------------
// 9. CHECK constraint count parity
// ---------------------------------------------------------------------------
describe("PG and SQLite CHECK constraint count parity", () => {
  for (const pair of STRUCTURAL_PAIRS) {
    it(`${pair.name} has matching CHECK constraint count`, () => {
      expect(pair.pgCheckCount, `CHECK count mismatch in ${pair.name}`).toBe(pair.sqliteCheckCount);
    });
  }
});

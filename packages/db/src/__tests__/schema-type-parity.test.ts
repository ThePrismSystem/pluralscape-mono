/**
 * Schema-type parity tests.
 *
 * Verifies that:
 * 1. PG and SQLite schemas have identical column sets for shared tables.
 * 2. Key columns changed in Fixes 1-8 exist with the expected names.
 * 3. Compile-time type assertions confirm inferred row types match expectations.
 */

import { getTableColumns } from "drizzle-orm";
import { describe, expect, expectTypeOf, it } from "vitest";

import * as pg from "../schema/pg/index.js";
import * as sqlite from "../schema/sqlite/index.js";

import type { DeviceInfo, EntityType } from "@pluralscape/types";
import type { InferSelectModel } from "drizzle-orm";

// ---------------------------------------------------------------------------
// DB-only columns — present in schema but not in canonical domain types.
// These are internal persistence concerns (encryption, versioning, archival).
// ---------------------------------------------------------------------------
const DB_ONLY_COLUMNS = new Set(["encryptedData", "version", "archived", "archivedAt", "kdfSalt"]);

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
    name: "switches",
    pgTable: getTableColumns(pg.switches),
    sqliteTable: getTableColumns(sqlite.switches),
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
    name: "pkBridgeState",
    pgTable: getTableColumns(pg.pkBridgeState),
    sqliteTable: getTableColumns(sqlite.pkBridgeState),
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
    name: "syncQueue",
    pgTable: getTableColumns(pg.syncQueue),
    sqliteTable: getTableColumns(sqlite.syncQueue),
  },
  {
    name: "syncConflicts",
    pgTable: getTableColumns(pg.syncConflicts),
    sqliteTable: getTableColumns(sqlite.syncConflicts),
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

      const onlyInPg = [...pgCols].filter((c) => !sqliteCols.has(c));
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

    it("no unexpected columns exist beyond the canonical three", () => {
      const pgCols = new Set(Object.keys(getTableColumns(pg.bucketContentTags)));
      const canonical = new Set(["entityType", "entityId", "bucketId"]);
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

    it("has expected canonical columns: id, frontingSessionId, systemId, memberId, encryptedData", () => {
      const cols = getTableColumns(pg.frontingComments);
      const expected = ["id", "frontingSessionId", "systemId", "memberId", "encryptedData"];
      for (const col of expected) {
        expect(cols, `expected column ${col}`).toHaveProperty(col);
      }
    });
  });

  // Fix 4 — sessions.deviceInfo is DeviceInfo | null
  describe("sessions (Fix 4)", () => {
    it("PG has deviceInfo column", () => {
      const cols = getTableColumns(pg.sessions);
      expect(cols).toHaveProperty("deviceInfo");
    });

    it("SQLite has deviceInfo column", () => {
      const cols = getTableColumns(sqlite.sessions);
      expect(cols).toHaveProperty("deviceInfo");
    });

    it("PG deviceInfo DB column is named device_info", () => {
      const cols = getTableColumns(pg.sessions);
      expect(cols.deviceInfo.name).toBe("device_info");
    });
  });

  // Fix 5 — switches has memberIds (not encryptedData)
  describe("switches (Fix 5)", () => {
    it("PG has memberIds column", () => {
      const cols = getTableColumns(pg.switches);
      expect(cols).toHaveProperty("memberIds");
    });

    it("SQLite has memberIds column", () => {
      const cols = getTableColumns(sqlite.switches);
      expect(cols).toHaveProperty("memberIds");
    });

    it("switches does not have an encryptedData column", () => {
      const pgCols = getTableColumns(pg.switches);
      const sqliteCols = getTableColumns(sqlite.switches);
      expect(pgCols).not.toHaveProperty("encryptedData");
      expect(sqliteCols).not.toHaveProperty("encryptedData");
    });

    it("PG memberIds DB column is named member_ids", () => {
      const cols = getTableColumns(pg.switches);
      expect(cols.memberIds.name).toBe("member_ids");
    });

    it("has expected canonical columns: id, systemId, timestamp, memberIds, createdAt", () => {
      const cols = getTableColumns(pg.switches);
      const expected = ["id", "systemId", "timestamp", "memberIds", "createdAt"];
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

    it("has expected columns: id, systemId, dateRange, memberBreakdowns, chartData, format, generatedAt", () => {
      const cols = getTableColumns(pg.frontingReports);
      const expected = [
        "id",
        "systemId",
        "dateRange",
        "memberBreakdowns",
        "chartData",
        "format",
        "generatedAt",
      ];
      for (const col of expected) {
        expect(cols, `expected column ${col}`).toHaveProperty(col);
      }
    });

    it("does not have encryptedData — it is a plaintext analytics table", () => {
      const pgCols = getTableColumns(pg.frontingReports);
      const sqliteCols = getTableColumns(sqlite.frontingReports);
      expect(pgCols).not.toHaveProperty("encryptedData");
      expect(sqliteCols).not.toHaveProperty("encryptedData");
    });
  });
});

// ---------------------------------------------------------------------------
// 3. DB-only column allowlist — verify allowlisted columns don't appear on
//    tables that should be plaintext/simple records.
// ---------------------------------------------------------------------------
describe("DB-only column allowlist", () => {
  it("switches does not have any DB-only columns (it is a simple event record)", () => {
    const cols = getTableColumns(pg.switches);
    for (const dbOnly of DB_ONLY_COLUMNS) {
      expect(cols, `switches should not have ${dbOnly}`).not.toHaveProperty(dbOnly);
    }
  });

  it("frontingReports does not have any DB-only columns (it is a plaintext analytics record)", () => {
    const cols = getTableColumns(pg.frontingReports);
    for (const dbOnly of DB_ONLY_COLUMNS) {
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

  it("accounts has kdfSalt as a DB-only column", () => {
    const cols = getTableColumns(pg.accounts);
    expect(cols).toHaveProperty("kdfSalt");
  });
});

// ---------------------------------------------------------------------------
// 4. Type-level assertions
//    Use expectTypeOf + InferSelectModel to verify compile-time correctness
//    for the columns changed in Fixes 1-8.
// ---------------------------------------------------------------------------
describe("Type-level assertions", () => {
  // Fix 1 — bucketContentTags.entityType is EntityType
  it("PG bucketContentTags.entityType infers as EntityType", () => {
    type Row = InferSelectModel<typeof pg.bucketContentTags>;
    expectTypeOf<Row["entityType"]>().toEqualTypeOf<EntityType>();
  });

  it("SQLite bucketContentTags.entityType infers as EntityType", () => {
    type Row = InferSelectModel<typeof sqlite.bucketContentTags>;
    expectTypeOf<Row["entityType"]>().toEqualTypeOf<EntityType>();
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

  // Fix 4 — sessions.deviceInfo is DeviceInfo | null
  it("PG sessions.deviceInfo infers as DeviceInfo | null", () => {
    type Row = InferSelectModel<typeof pg.sessions>;
    expectTypeOf<Row["deviceInfo"]>().toEqualTypeOf<DeviceInfo | null>();
  });

  it("SQLite sessions.deviceInfo infers as DeviceInfo | null", () => {
    type Row = InferSelectModel<typeof sqlite.sessions>;
    expectTypeOf<Row["deviceInfo"]>().toEqualTypeOf<DeviceInfo | null>();
  });

  // Fix 5 — switches.memberIds is a non-empty readonly tuple
  it("PG switches.memberIds infers as readonly [string, ...string[]]", () => {
    type Row = InferSelectModel<typeof pg.switches>;
    expectTypeOf<Row["memberIds"]>().toEqualTypeOf<readonly [string, ...string[]]>();
  });

  it("SQLite switches.memberIds infers as readonly [string, ...string[]]", () => {
    type Row = InferSelectModel<typeof sqlite.switches>;
    expectTypeOf<Row["memberIds"]>().toEqualTypeOf<readonly [string, ...string[]]>();
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
});

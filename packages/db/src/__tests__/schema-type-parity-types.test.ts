/**
 * Schema-type parity: compile-time type assertions and structural invariants.
 *
 * Verifies:
 * 1. Inferred row types match expected branded / nullable / enum shapes.
 * 2. Analytics types share structure between domain and DB types.
 * 3. BUCKET_CONTENT_ENTITY_TYPES tuple matches the BucketContentEntityType union.
 */

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
  FrontingSessionId,
  MemberFrontingBreakdown,
  SystemId,
  SystemSettingsId,
  UnixMillis,
} from "@pluralscape/types";
import type { InferSelectModel } from "drizzle-orm";

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

  // Fix 3 — frontingComments.frontingSessionId is branded (FrontingSessionId, non-nullable)
  it("PG frontingComments.frontingSessionId is branded (FrontingSessionId)", () => {
    type Row = InferSelectModel<typeof pg.frontingComments>;
    expectTypeOf<Row["frontingSessionId"]>().toEqualTypeOf<FrontingSessionId>();
  });

  it("SQLite frontingComments.frontingSessionId is branded (FrontingSessionId)", () => {
    type Row = InferSelectModel<typeof sqlite.frontingComments>;
    expectTypeOf<Row["frontingSessionId"]>().toEqualTypeOf<FrontingSessionId>();
  });

  // Fix 6 — systemSettings has both id and systemId as branded IDs
  // (was `string` before fleet Cluster 1 applied `brandedId<>` to the ID columns).
  it("PG systemSettings.id is branded (SystemSettingsId)", () => {
    type Row = InferSelectModel<typeof pg.systemSettings>;
    expectTypeOf<Row["id"]>().toEqualTypeOf<SystemSettingsId>();
  });

  it("PG systemSettings.systemId is branded (SystemId)", () => {
    type Row = InferSelectModel<typeof pg.systemSettings>;
    expectTypeOf<Row["systemId"]>().toEqualTypeOf<SystemId>();
  });

  // Fix 7 — importJobs.updatedAt is UnixMillis (non-nullable, custom pgTimestamp returns UnixMillis)
  it("PG importJobs.updatedAt infers as UnixMillis (non-nullable)", () => {
    type Row = InferSelectModel<typeof pg.importJobs>;
    expectTypeOf<Row["updatedAt"]>().toEqualTypeOf<UnixMillis>();
  });

  it("SQLite importJobs.updatedAt infers as UnixMillis (non-nullable)", () => {
    type Row = InferSelectModel<typeof sqlite.importJobs>;
    expectTypeOf<Row["updatedAt"]>().toEqualTypeOf<UnixMillis>();
  });

  it("PG exportRequests.updatedAt infers as UnixMillis (non-nullable)", () => {
    type Row = InferSelectModel<typeof pg.exportRequests>;
    expectTypeOf<Row["updatedAt"]>().toEqualTypeOf<UnixMillis>();
  });

  it("SQLite exportRequests.updatedAt infers as UnixMillis (non-nullable)", () => {
    type Row = InferSelectModel<typeof sqlite.exportRequests>;
    expectTypeOf<Row["updatedAt"]>().toEqualTypeOf<UnixMillis>();
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

  it("PG frontingReports.generatedAt infers as UnixMillis", () => {
    type Row = InferSelectModel<typeof pg.frontingReports>;
    expectTypeOf<Row["generatedAt"]>().toEqualTypeOf<UnixMillis>();
  });

  // Auth session security — new nullable columns
  it("PG sessions.expiresAt infers as UnixMillis | null", () => {
    type Row = InferSelectModel<typeof pg.sessions>;
    expectTypeOf<Row["expiresAt"]>().toEqualTypeOf<UnixMillis | null>();
  });

  it("SQLite sessions.expiresAt infers as UnixMillis | null", () => {
    type Row = InferSelectModel<typeof sqlite.sessions>;
    expectTypeOf<Row["expiresAt"]>().toEqualTypeOf<UnixMillis | null>();
  });

  it("PG recoveryKeys.revokedAt infers as UnixMillis | null", () => {
    type Row = InferSelectModel<typeof pg.recoveryKeys>;
    expectTypeOf<Row["revokedAt"]>().toEqualTypeOf<UnixMillis | null>();
  });

  it("SQLite recoveryKeys.revokedAt infers as UnixMillis | null", () => {
    type Row = InferSelectModel<typeof sqlite.recoveryKeys>;
    expectTypeOf<Row["revokedAt"]>().toEqualTypeOf<UnixMillis | null>();
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

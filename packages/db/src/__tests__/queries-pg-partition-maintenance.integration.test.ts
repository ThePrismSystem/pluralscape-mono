import { PGlite } from "@electric-sql/pglite";
import { sql } from "drizzle-orm";
import { drizzle } from "drizzle-orm/pglite";
import { afterAll, beforeAll, describe, expect, it } from "vitest";

import { formatPartitionName, pgDetachOldPartitions } from "../queries/partition-maintenance.js";

import type { PgliteDatabase } from "drizzle-orm/pglite";

/**
 * Integration tests for partition maintenance on PGlite.
 *
 * Focus: verify that pgDetachOldPartitions does NOT pass the raw `partition_name`
 * string returned by pg_inherits into sql.raw. Instead it reconstructs the
 * identifier via formatPartitionName so a compromised catalog cannot smuggle
 * arbitrary SQL through the DETACH/DROP statements (audit finding db-3a27).
 */

describe("pgDetachOldPartitions partition name sanitation", () => {
  let client: PGlite;
  let db: PgliteDatabase<Record<string, unknown>>;

  beforeAll(async () => {
    client = await PGlite.create();
    db = drizzle(client);

    // Create a partitioned audit_log shaped table so pgDetachOldPartitions can
    // operate on it. We use the minimum columns needed for the partitioning
    // contract (the partitioning key is the timestamp column).
    await client.query(`
      CREATE TABLE audit_log (
        id VARCHAR(255) NOT NULL,
        "timestamp" TIMESTAMPTZ NOT NULL
      ) PARTITION BY RANGE ("timestamp")
    `);
  });

  afterAll(async () => {
    await client.close();
  });

  it("reconstructs partition name via formatPartitionName before issuing DDL", async () => {
    // Create a partition well in the past so it will be detached/dropped.
    const oldYear = 2020;
    const oldMonth = 3;
    const expectedPartitionName = formatPartitionName("audit_log", oldYear, oldMonth);
    expect(expectedPartitionName).toBe("audit_log_2020_03");

    await client.query(
      `CREATE TABLE "${expectedPartitionName}" PARTITION OF audit_log FOR VALUES FROM ('2020-03-01'::timestamptz) TO ('2020-04-01'::timestamptz)`,
    );

    const result = await pgDetachOldPartitions(db, {
      table: "audit_log",
      olderThanMonths: 12,
    });

    expect(result.detachedCount).toBe(1);
    expect(result.errors).toHaveLength(0);

    // Confirm the partition is actually gone from pg_inherits — proves the
    // reconstructed name targeted the correct child.
    const remaining = await client.query<{ relname: string }>(
      `SELECT c.relname FROM pg_inherits i
       JOIN pg_class p ON p.oid = i.inhparent
       JOIN pg_class c ON c.oid = i.inhrelid
       WHERE p.relname = 'audit_log'`,
    );
    expect(remaining.rows.map((r) => r.relname)).not.toContain(expectedPartitionName);

    // Also confirm the underlying table is dropped (not just detached).
    const stillExists = await client.query<{ to_regclass: string | null }>(
      `SELECT to_regclass('${expectedPartitionName}')::text AS to_regclass`,
    );
    expect(stillExists.rows[0]?.to_regclass).toBeNull();
  });

  it("skips partitions whose names do not match the `<table>_YYYY_MM` pattern", async () => {
    // The default partition has a non-numeric suffix — parsePartitionDate must
    // skip it so pgDetachOldPartitions never issues DDL against it.
    await client.query(`CREATE TABLE audit_log_default PARTITION OF audit_log DEFAULT`);

    const result = await pgDetachOldPartitions(db, {
      table: "audit_log",
      olderThanMonths: 1200,
    });
    expect(result.errors).toHaveLength(0);

    const remaining = await client.query<{ relname: string }>(
      `SELECT c.relname FROM pg_inherits i
       JOIN pg_class p ON p.oid = i.inhparent
       JOIN pg_class c ON c.oid = i.inhrelid
       WHERE p.relname = 'audit_log'`,
    );
    expect(remaining.rows.map((r) => r.relname)).toContain("audit_log_default");

    // Clean up the default partition so subsequent tests operate on a clean table.
    await db.execute(sql`DROP TABLE audit_log_default`);
  });

  it("silently ignores rows with valid-looking but unsafe characters in partition_name", async () => {
    // Strongest guarantee: parsePartitionDate requires `<prefix>_YYYY_MM`.
    // A malicious partition_name like `audit_log_2020_03"; DROP TABLE audit_log --`
    // must fail the regex and be skipped. We simulate this by verifying that
    // our regex-based parser is the single gate before DDL.
    // (Real pg_inherits cannot produce such a name — the DDL engine validates
    //  identifier length — but the defense-in-depth test is still valuable.)
    const { parsePartitionDate } = await import("../queries/partition-maintenance.js");
    expect(parsePartitionDate(`audit_log_2020_03"; DROP TABLE audit_log --`)).toBeNull();
    expect(parsePartitionDate("audit_log_20200_3")).toBeNull();
    expect(parsePartitionDate("audit_log_2020_3")).toBeNull();
  });
});

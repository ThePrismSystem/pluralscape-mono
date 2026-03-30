import { buckets, systems } from "@pluralscape/db/pg";
import { ID_PREFIXES, createId, now, toUnixMillis, toUnixMillisOrNull } from "@pluralscape/types";
import {
  BucketQuerySchema,
  CreateBucketBodySchema,
  UpdateBucketBodySchema,
} from "@pluralscape/validation";
import { and, count, desc, eq, lt, or, sql } from "drizzle-orm";

import { HTTP_BAD_REQUEST, HTTP_CONFLICT, HTTP_NOT_FOUND } from "../http.constants.js";
import { ApiHttpError } from "../lib/api-error.js";
import { encryptedBlobToBase64, parseAndValidateBlob } from "../lib/encrypted-blob.js";
import { archiveEntity, deleteEntity, restoreEntity } from "../lib/entity-lifecycle.js";
import { assertOccUpdated } from "../lib/occ-update.js";
import { buildCompositePaginatedResult, fromCompositeCursor } from "../lib/pagination.js";
import { parseQuery } from "../lib/query-parse.js";
import { withTenantRead, withTenantTransaction } from "../lib/rls-context.js";
import { assertSystemOwnership } from "../lib/system-ownership.js";
import { tenantCtx } from "../lib/tenant-context.js";
import {
  DEFAULT_PAGE_LIMIT,
  MAX_ENCRYPTED_DATA_BYTES,
  MAX_PAGE_LIMIT,
} from "../service.constants.js";

import { MAX_BUCKETS_PER_SYSTEM } from "./bucket.constants.js";
import { dispatchWebhookEvent } from "./webhook-dispatcher.js";

import type { AuditWriter } from "../lib/audit-writer.js";
import type { AuthContext } from "../lib/auth-context.js";
import type { ArchivableEntityConfig, DeletableEntityConfig } from "../lib/entity-lifecycle.js";
import type { BucketId, PaginatedResult, SystemId, UnixMillis } from "@pluralscape/types";
import type { PostgresJsDatabase } from "drizzle-orm/postgres-js";

// ── Types ───────────────────────────────────────────────────────────

export interface BucketResult {
  readonly id: BucketId;
  readonly systemId: SystemId;
  readonly encryptedData: string;
  readonly version: number;
  readonly archived: boolean;
  readonly archivedAt: UnixMillis | null;
  readonly createdAt: UnixMillis;
  readonly updatedAt: UnixMillis;
}

interface ListBucketOpts {
  readonly cursor?: string;
  readonly limit?: number;
  readonly includeArchived?: boolean;
  readonly archivedOnly?: boolean;
}

// ── Helpers ─────────────────────────────────────────────────────────

function toBucketResult(row: typeof buckets.$inferSelect): BucketResult {
  return {
    id: row.id as BucketId,
    systemId: row.systemId as SystemId,
    encryptedData: encryptedBlobToBase64(row.encryptedData),
    version: row.version,
    archived: row.archived,
    archivedAt: toUnixMillisOrNull(row.archivedAt),
    createdAt: toUnixMillis(row.createdAt),
    updatedAt: toUnixMillis(row.updatedAt),
  };
}

/** Assert a non-archived bucket exists for the given system. Throws NOT_FOUND if missing. */
export async function assertBucketExists(
  tx: PostgresJsDatabase,
  systemId: SystemId,
  bucketId: BucketId,
): Promise<void> {
  const [existing] = await tx
    .select({ id: buckets.id })
    .from(buckets)
    .where(
      and(eq(buckets.id, bucketId), eq(buckets.systemId, systemId), eq(buckets.archived, false)),
    )
    .limit(1);

  if (!existing) {
    throw new ApiHttpError(HTTP_NOT_FOUND, "NOT_FOUND", "Bucket not found");
  }
}

async function checkBucketDependents(
  tx: PostgresJsDatabase,
  systemId: SystemId,
  bucketId: BucketId,
): Promise<void> {
  const result = await tx.execute<{ type: string; count: number }>(sql`
    SELECT 'bucketContentTags' AS type, COUNT(*)::int AS count
      FROM bucket_content_tags WHERE bucket_id = ${bucketId} AND system_id = ${systemId}
    UNION ALL
    SELECT 'keyGrants', COUNT(*)::int
      FROM key_grants WHERE bucket_id = ${bucketId} AND system_id = ${systemId}
    UNION ALL
    SELECT 'friendBucketAssignments', COUNT(*)::int
      FROM friend_bucket_assignments WHERE bucket_id = ${bucketId} AND system_id = ${systemId}
    UNION ALL
    SELECT 'fieldBucketVisibility', COUNT(*)::int
      FROM field_bucket_visibility WHERE bucket_id = ${bucketId} AND system_id = ${systemId}
    UNION ALL
    SELECT 'bucketKeyRotations', COUNT(*)::int
      FROM bucket_key_rotations WHERE bucket_id = ${bucketId} AND system_id = ${systemId}
  `);

  const rows = Array.isArray(result)
    ? result
    : (result as { rows: { type: string; count: number }[] }).rows;
  const dependents = rows.filter((r) => r.count > 0).map((r) => ({ type: r.type, count: r.count }));

  if (dependents.length > 0) {
    throw new ApiHttpError(
      HTTP_CONFLICT,
      "HAS_DEPENDENTS",
      "Bucket has dependents. Remove all dependents before deleting.",
      { dependents },
    );
  }
}

// ── CREATE ──────────────────────────────────────────────────────────

export async function createBucket(
  db: PostgresJsDatabase,
  systemId: SystemId,
  params: unknown,
  auth: AuthContext,
  audit: AuditWriter,
): Promise<BucketResult> {
  assertSystemOwnership(systemId, auth);

  const { blob } = parseAndValidateBlob(params, CreateBucketBodySchema, MAX_ENCRYPTED_DATA_BYTES);

  const bucketId = createId(ID_PREFIXES.bucket);
  const timestamp = now();

  return withTenantTransaction(db, tenantCtx(systemId, auth), async (tx) => {
    // Lock the system row to serialize concurrent bucket creation per system (prevents TOCTOU race)
    await tx.select({ id: systems.id }).from(systems).where(eq(systems.id, systemId)).for("update");

    const [existing] = await tx
      .select({ count: count() })
      .from(buckets)
      .where(and(eq(buckets.systemId, systemId), eq(buckets.archived, false)));

    if ((existing?.count ?? 0) >= MAX_BUCKETS_PER_SYSTEM) {
      throw new ApiHttpError(
        HTTP_BAD_REQUEST,
        "QUOTA_EXCEEDED",
        `Maximum of ${String(MAX_BUCKETS_PER_SYSTEM)} buckets per system`,
      );
    }

    const [row] = await tx
      .insert(buckets)
      .values({
        id: bucketId,
        systemId,
        encryptedData: blob,
        createdAt: timestamp,
        updatedAt: timestamp,
      })
      .returning();

    if (!row) {
      throw new Error("Failed to create bucket — INSERT returned no rows");
    }

    await audit(tx, {
      eventType: "bucket.created",
      actor: { kind: "account", id: auth.accountId },
      detail: "Bucket created",
      systemId,
    });
    const result = toBucketResult(row);
    await dispatchWebhookEvent(tx, systemId, "bucket.created", {
      bucketId: result.id,
    });

    return result;
  });
}

// ── GET ─────────────────────────────────────────────────────────────

export async function getBucket(
  db: PostgresJsDatabase,
  systemId: SystemId,
  bucketId: BucketId,
  auth: AuthContext,
): Promise<BucketResult> {
  assertSystemOwnership(systemId, auth);

  return withTenantRead(db, tenantCtx(systemId, auth), async (tx) => {
    const [row] = await tx
      .select()
      .from(buckets)
      .where(
        and(eq(buckets.id, bucketId), eq(buckets.systemId, systemId), eq(buckets.archived, false)),
      )
      .limit(1);

    if (!row) {
      throw new ApiHttpError(HTTP_NOT_FOUND, "NOT_FOUND", "Bucket not found");
    }

    return toBucketResult(row);
  });
}

// ── LIST ────────────────────────────────────────────────────────────

export async function listBuckets(
  db: PostgresJsDatabase,
  systemId: SystemId,
  auth: AuthContext,
  opts: ListBucketOpts = {},
): Promise<PaginatedResult<BucketResult>> {
  assertSystemOwnership(systemId, auth);

  const effectiveLimit = Math.min(opts.limit ?? DEFAULT_PAGE_LIMIT, MAX_PAGE_LIMIT);

  return withTenantRead(db, tenantCtx(systemId, auth), async (tx) => {
    const conditions = [eq(buckets.systemId, systemId)];

    if (opts.archivedOnly) {
      // archivedOnly takes precedence: show only archived buckets
      conditions.push(eq(buckets.archived, true));
    } else if (!opts.includeArchived) {
      conditions.push(eq(buckets.archived, false));
    }

    if (opts.cursor) {
      const decoded = fromCompositeCursor(opts.cursor, "bucket");
      const cursorCondition = or(
        lt(buckets.createdAt, decoded.sortValue),
        and(eq(buckets.createdAt, decoded.sortValue), lt(buckets.id, decoded.id)),
      );
      if (cursorCondition) {
        conditions.push(cursorCondition);
      }
    }

    const rows = await tx
      .select()
      .from(buckets)
      .where(and(...conditions))
      .orderBy(desc(buckets.createdAt), desc(buckets.id))
      .limit(effectiveLimit + 1);

    return buildCompositePaginatedResult(rows, effectiveLimit, toBucketResult, (i) => i.createdAt);
  });
}

// ── UPDATE ──────────────────────────────────────────────────────────

export async function updateBucket(
  db: PostgresJsDatabase,
  systemId: SystemId,
  bucketId: BucketId,
  params: unknown,
  auth: AuthContext,
  audit: AuditWriter,
): Promise<BucketResult> {
  assertSystemOwnership(systemId, auth);

  const { parsed, blob } = parseAndValidateBlob(
    params,
    UpdateBucketBodySchema,
    MAX_ENCRYPTED_DATA_BYTES,
  );
  const version = parsed.version;
  const timestamp = now();

  return withTenantTransaction(db, tenantCtx(systemId, auth), async (tx) => {
    const updated = await tx
      .update(buckets)
      .set({
        encryptedData: blob,
        updatedAt: timestamp,
        version: sql`${buckets.version} + 1`,
      })
      .where(
        and(
          eq(buckets.id, bucketId),
          eq(buckets.systemId, systemId),
          eq(buckets.version, version),
          eq(buckets.archived, false),
        ),
      )
      .returning();

    const row = await assertOccUpdated(
      updated,
      async () => {
        const [existing] = await tx
          .select({ id: buckets.id })
          .from(buckets)
          .where(and(eq(buckets.id, bucketId), eq(buckets.systemId, systemId)))
          .limit(1);
        return existing;
      },
      "Bucket",
    );

    await audit(tx, {
      eventType: "bucket.updated",
      actor: { kind: "account", id: auth.accountId },
      detail: "Bucket updated",
      systemId,
    });
    const result = toBucketResult(row);
    await dispatchWebhookEvent(tx, systemId, "bucket.updated", {
      bucketId: result.id,
    });

    return result;
  });
}

// ── DELETE ───────────────────────────────────────────────────────────

const BUCKET_DELETE: DeletableEntityConfig<BucketId> = {
  table: buckets,
  columns: buckets,
  entityName: "Bucket",
  deleteEvent: "bucket.deleted",
  onDelete: (tx, sId, eid) => dispatchWebhookEvent(tx, sId, "bucket.deleted", { bucketId: eid }),
  checkDependents: checkBucketDependents,
};

export async function deleteBucket(
  db: PostgresJsDatabase,
  systemId: SystemId,
  bucketId: BucketId,
  auth: AuthContext,
  audit: AuditWriter,
): Promise<void> {
  await deleteEntity(db, systemId, bucketId, auth, audit, BUCKET_DELETE);
}

// ── ARCHIVE ─────────────────────────────────────────────────────────

const BUCKET_LIFECYCLE: ArchivableEntityConfig<BucketId> = {
  table: buckets,
  columns: buckets,
  entityName: "Bucket",
  archiveEvent: "bucket.archived" as const,
  restoreEvent: "bucket.restored" as const,
  onArchive: (tx, sId, eid) => dispatchWebhookEvent(tx, sId, "bucket.archived", { bucketId: eid }),
  onRestore: (tx, sId, eid) => dispatchWebhookEvent(tx, sId, "bucket.restored", { bucketId: eid }),
};

export async function archiveBucket(
  db: PostgresJsDatabase,
  systemId: SystemId,
  bucketId: BucketId,
  auth: AuthContext,
  audit: AuditWriter,
): Promise<void> {
  await archiveEntity(db, systemId, bucketId, auth, audit, BUCKET_LIFECYCLE);
}

// ── RESTORE ─────────────────────────────────────────────────────────

export async function restoreBucket(
  db: PostgresJsDatabase,
  systemId: SystemId,
  bucketId: BucketId,
  auth: AuthContext,
  audit: AuditWriter,
): Promise<BucketResult> {
  return restoreEntity(db, systemId, bucketId, auth, audit, BUCKET_LIFECYCLE, (row) =>
    toBucketResult(row as typeof buckets.$inferSelect),
  );
}

// ── PARSE QUERY PARAMS ──────────────────────────────────────────────

export function parseBucketQuery(query: Record<string, string | undefined>): {
  includeArchived: boolean;
  archivedOnly: boolean;
} {
  return parseQuery(BucketQuerySchema, query);
}

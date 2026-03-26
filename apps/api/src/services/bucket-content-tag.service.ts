import { bucketContentTags, buckets } from "@pluralscape/db/pg";
import { BucketContentTagQuerySchema, TagContentBodySchema } from "@pluralscape/validation";
import { and, eq } from "drizzle-orm";

import { HTTP_NOT_FOUND } from "../http.constants.js";
import { ApiHttpError } from "../lib/api-error.js";
import { parseQuery } from "../lib/query-parse.js";
import { withTenantRead, withTenantTransaction } from "../lib/rls-context.js";
import { assertSystemOwnership } from "../lib/system-ownership.js";
import { tenantCtx } from "../lib/tenant-context.js";

import { dispatchWebhookEvent } from "./webhook-dispatcher.js";

import type { AuditWriter } from "../lib/audit-writer.js";
import type { AuthContext } from "../lib/auth-context.js";
import type { BucketContentEntityType, BucketId, SystemId } from "@pluralscape/types";
import type { PostgresJsDatabase } from "drizzle-orm/postgres-js";

// ── Types ───────────────────────────────────────────────────────────

export interface BucketContentTagResult {
  readonly entityType: BucketContentEntityType;
  readonly entityId: string;
  readonly bucketId: BucketId;
}

interface ListTagOpts {
  readonly entityType?: BucketContentEntityType;
}

// ── Helpers ─────────────────────────────────────────────────────────

function toTagResult(row: typeof bucketContentTags.$inferSelect): BucketContentTagResult {
  return {
    entityType: row.entityType,
    entityId: row.entityId,
    bucketId: row.bucketId as BucketId,
  };
}

async function assertBucketExists(
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

// ── TAG ─────────────────────────────────────────────────────────────

export async function tagContent(
  db: PostgresJsDatabase,
  systemId: SystemId,
  bucketId: BucketId,
  params: unknown,
  auth: AuthContext,
  audit: AuditWriter,
): Promise<BucketContentTagResult> {
  assertSystemOwnership(systemId, auth);

  const parsed = parseQuery(TagContentBodySchema, params as Record<string, string | undefined>);

  return withTenantTransaction(db, tenantCtx(systemId, auth), async (tx) => {
    await assertBucketExists(tx, systemId, bucketId);

    await tx
      .insert(bucketContentTags)
      .values({
        entityType: parsed.entityType,
        entityId: parsed.entityId,
        bucketId,
        systemId,
      })
      .onConflictDoNothing();

    await audit(tx, {
      eventType: "bucket-content-tag.tagged",
      actor: { kind: "account", id: auth.accountId },
      detail: `Tagged ${parsed.entityType} ${parsed.entityId} in bucket`,
      systemId,
    });
    await dispatchWebhookEvent(tx, systemId, "bucket-content-tag.tagged", {
      bucketId,
      entityType: parsed.entityType,
      entityId: parsed.entityId,
    });

    return {
      entityType: parsed.entityType,
      entityId: parsed.entityId,
      bucketId,
    };
  });
}

// ── UNTAG ───────────────────────────────────────────────────────────

export async function untagContent(
  db: PostgresJsDatabase,
  systemId: SystemId,
  bucketId: BucketId,
  entityType: BucketContentEntityType,
  entityId: string,
  auth: AuthContext,
  audit: AuditWriter,
): Promise<void> {
  assertSystemOwnership(systemId, auth);

  await withTenantTransaction(db, tenantCtx(systemId, auth), async (tx) => {
    const deleted = await tx
      .delete(bucketContentTags)
      .where(
        and(
          eq(bucketContentTags.entityType, entityType),
          eq(bucketContentTags.entityId, entityId),
          eq(bucketContentTags.bucketId, bucketId),
          eq(bucketContentTags.systemId, systemId),
        ),
      )
      .returning();

    if (deleted.length === 0) {
      throw new ApiHttpError(HTTP_NOT_FOUND, "NOT_FOUND", "Content tag not found");
    }

    await audit(tx, {
      eventType: "bucket-content-tag.untagged",
      actor: { kind: "account", id: auth.accountId },
      detail: `Untagged ${entityType} ${entityId} from bucket`,
      systemId,
    });
    await dispatchWebhookEvent(tx, systemId, "bucket-content-tag.untagged", {
      bucketId,
      entityType,
      entityId,
    });
  });
}

// ── LIST BY BUCKET ──────────────────────────────────────────────────

export async function listTagsByBucket(
  db: PostgresJsDatabase,
  systemId: SystemId,
  bucketId: BucketId,
  auth: AuthContext,
  opts: ListTagOpts = {},
): Promise<readonly BucketContentTagResult[]> {
  assertSystemOwnership(systemId, auth);

  return withTenantRead(db, tenantCtx(systemId, auth), async (tx) => {
    const conditions = [
      eq(bucketContentTags.bucketId, bucketId),
      eq(bucketContentTags.systemId, systemId),
    ];

    if (opts.entityType) {
      conditions.push(eq(bucketContentTags.entityType, opts.entityType));
    }

    const rows = await tx
      .select()
      .from(bucketContentTags)
      .where(and(...conditions));

    return rows.map(toTagResult);
  });
}

// ── LIST BUCKETS BY ENTITY ──────────────────────────────────────────

export async function listBucketsByEntity(
  db: PostgresJsDatabase,
  systemId: SystemId,
  entityType: BucketContentEntityType,
  entityId: string,
  auth: AuthContext,
): Promise<readonly BucketId[]> {
  assertSystemOwnership(systemId, auth);

  return withTenantRead(db, tenantCtx(systemId, auth), async (tx) => {
    const rows = await tx
      .select({ bucketId: bucketContentTags.bucketId })
      .from(bucketContentTags)
      .where(
        and(
          eq(bucketContentTags.entityType, entityType),
          eq(bucketContentTags.entityId, entityId),
          eq(bucketContentTags.systemId, systemId),
        ),
      );

    return rows.map((r) => r.bucketId as BucketId);
  });
}

// ── PARSE QUERY ─────────────────────────────────────────────────────

export function parseTagQuery(query: Record<string, string | undefined>): {
  entityType?: BucketContentEntityType;
} {
  return parseQuery(BucketContentTagQuerySchema, query);
}

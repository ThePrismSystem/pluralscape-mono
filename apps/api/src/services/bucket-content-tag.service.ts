import { bucketContentTags } from "@pluralscape/db/pg";
import {
  BucketContentTagQuerySchema,
  TagContentBodySchema,
  UntagContentParamsSchema,
} from "@pluralscape/validation";
import { and, eq } from "drizzle-orm";
import { z } from "zod/v4";

import { HTTP_BAD_REQUEST, HTTP_NOT_FOUND } from "../http.constants.js";
import { ApiHttpError } from "../lib/api-error.js";
import { logger } from "../lib/logger.js";
import { parseQuery } from "../lib/query-parse.js";
import { withTenantRead, withTenantTransaction } from "../lib/rls-context.js";
import { assertSystemOwnership } from "../lib/system-ownership.js";
import { tenantCtx } from "../lib/tenant-context.js";
import { DEFAULT_PAGE_LIMIT, MAX_PAGE_LIMIT } from "../service.constants.js";

import { assertBucketExists } from "./bucket/internal.js";
import {
  decodeBucketContentTagRow,
  decodeBucketContentTagRowSafe,
} from "./bucket-content-tag/decode.js";
import { dispatchWebhookEvent } from "./webhook-dispatcher.js";

import type { AuditWriter } from "../lib/audit-writer.js";
import type { AuthContext } from "../lib/auth-context.js";
import type {
  BucketContentEntityType,
  BucketContentTag,
  BucketId,
  SystemId,
  TaggedEntityRef,
} from "@pluralscape/types";
import type { PostgresJsDatabase } from "drizzle-orm/postgres-js";

// ── Types ───────────────────────────────────────────────────────────

interface ListTagOpts {
  readonly entityType?: BucketContentEntityType;
  readonly limit?: number;
}

// ── TAG ─────────────────────────────────────────────────────────────

export async function tagContent(
  db: PostgresJsDatabase,
  systemId: SystemId,
  bucketId: BucketId,
  params: unknown,
  auth: AuthContext,
  audit: AuditWriter,
): Promise<BucketContentTag> {
  assertSystemOwnership(systemId, auth);

  const parsed = TagContentBodySchema.safeParse(params);
  if (!parsed.success) {
    throw new ApiHttpError(
      HTTP_BAD_REQUEST,
      "VALIDATION_ERROR",
      "Invalid tag content payload",
      z.treeifyError(parsed.error),
    );
  }

  return withTenantTransaction(db, tenantCtx(systemId, auth), async (tx) => {
    await assertBucketExists(tx, systemId, bucketId);

    const [inserted] = await tx
      .insert(bucketContentTags)
      .values({
        entityType: parsed.data.entityType,
        entityId: parsed.data.entityId,
        bucketId,
        systemId,
      })
      .onConflictDoNothing()
      .returning();

    if (inserted) {
      await audit(tx, {
        eventType: "bucket-content-tag.tagged",
        actor: { kind: "account", id: auth.accountId },
        detail: `Tagged ${parsed.data.entityType} ${parsed.data.entityId} in bucket`,
        systemId,
      });
      await dispatchWebhookEvent(tx, systemId, "bucket-content-tag.tagged", {
        bucketId,
        entityType: parsed.data.entityType,
        entityId: parsed.data.entityId,
      });
    }

    return decodeBucketContentTagRow({
      entityType: parsed.data.entityType,
      entityId: parsed.data.entityId,
      bucketId,
    });
  });
}

// ── UNTAG ───────────────────────────────────────────────────────────

export async function untagContent(
  db: PostgresJsDatabase,
  systemId: SystemId,
  bucketId: BucketId,
  params: unknown,
  auth: AuthContext,
  audit: AuditWriter,
): Promise<void> {
  assertSystemOwnership(systemId, auth);

  const parsed = UntagContentParamsSchema.safeParse(params);
  if (!parsed.success) {
    throw new ApiHttpError(
      HTTP_BAD_REQUEST,
      "VALIDATION_ERROR",
      "Invalid (entityType, entityId) pair",
      z.treeifyError(parsed.error),
    );
  }
  const ref: TaggedEntityRef = parsed.data;

  await withTenantTransaction(db, tenantCtx(systemId, auth), async (tx) => {
    const deleted = await tx
      .delete(bucketContentTags)
      .where(
        and(
          eq(bucketContentTags.entityType, ref.entityType),
          eq(bucketContentTags.entityId, ref.entityId),
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
      detail: `Untagged ${ref.entityType} ${ref.entityId} from bucket`,
      systemId,
    });
    await dispatchWebhookEvent(tx, systemId, "bucket-content-tag.untagged", {
      bucketId,
      entityType: ref.entityType,
      entityId: ref.entityId,
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
): Promise<readonly BucketContentTag[]> {
  assertSystemOwnership(systemId, auth);

  const effectiveLimit = Math.min(opts.limit ?? DEFAULT_PAGE_LIMIT, MAX_PAGE_LIMIT);

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
      .where(and(...conditions))
      .limit(effectiveLimit);

    const decoded: BucketContentTag[] = [];
    for (const row of rows) {
      const tag = decodeBucketContentTagRowSafe(row);
      if (tag === null) {
        logger.warn("bucket-content-tag: skipping corrupt row", {
          systemId: row.systemId,
          bucketId: row.bucketId,
          entityType: row.entityType,
          entityId: row.entityId,
        });
        continue;
      }
      decoded.push(tag);
    }
    return decoded;
  });
}

// ── PARSE QUERY ─────────────────────────────────────────────────────

export function parseTagQuery(query: Record<string, string | undefined>): {
  entityType?: BucketContentEntityType;
} {
  return parseQuery(BucketContentTagQuerySchema, query);
}

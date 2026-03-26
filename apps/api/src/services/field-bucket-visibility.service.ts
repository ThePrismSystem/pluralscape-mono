import { fieldBucketVisibility, fieldDefinitions } from "@pluralscape/db/pg";
import { and, eq } from "drizzle-orm";

import { HTTP_NOT_FOUND } from "../http.constants.js";
import { ApiHttpError } from "../lib/api-error.js";
import { withTenantRead, withTenantTransaction } from "../lib/rls-context.js";
import { assertSystemOwnership } from "../lib/system-ownership.js";
import { tenantCtx } from "../lib/tenant-context.js";
import { DEFAULT_PAGE_LIMIT, MAX_PAGE_LIMIT } from "../service.constants.js";

import { assertBucketExists } from "./bucket.service.js";
import { dispatchWebhookEvent } from "./webhook-dispatcher.js";

import type { AuditWriter } from "../lib/audit-writer.js";
import type { AuthContext } from "../lib/auth-context.js";
import type { BucketId, FieldDefinitionId, SystemId } from "@pluralscape/types";
import type { PostgresJsDatabase } from "drizzle-orm/postgres-js";

// ── Types ───────────────────────────────────────────────────────────

export interface FieldBucketVisibilityResult {
  readonly fieldDefinitionId: FieldDefinitionId;
  readonly bucketId: BucketId;
}

// ── Helpers ─────────────────────────────────────────────────────────

function toResult(row: typeof fieldBucketVisibility.$inferSelect): FieldBucketVisibilityResult {
  return {
    fieldDefinitionId: row.fieldDefinitionId as FieldDefinitionId,
    bucketId: row.bucketId as BucketId,
  };
}

// ── SET ─────────────────────────────────────────────────────────────

export async function setFieldBucketVisibility(
  db: PostgresJsDatabase,
  systemId: SystemId,
  fieldDefinitionId: FieldDefinitionId,
  bucketId: BucketId,
  auth: AuthContext,
  audit: AuditWriter,
): Promise<FieldBucketVisibilityResult> {
  assertSystemOwnership(systemId, auth);

  return withTenantTransaction(db, tenantCtx(systemId, auth), async (tx) => {
    // Validate field exists
    const [field] = await tx
      .select({ id: fieldDefinitions.id })
      .from(fieldDefinitions)
      .where(
        and(
          eq(fieldDefinitions.id, fieldDefinitionId),
          eq(fieldDefinitions.systemId, systemId),
          eq(fieldDefinitions.archived, false),
        ),
      )
      .limit(1);

    if (!field) {
      throw new ApiHttpError(HTTP_NOT_FOUND, "NOT_FOUND", "Field definition not found");
    }

    // Validate bucket exists
    await assertBucketExists(tx, systemId, bucketId);

    const [inserted] = await tx
      .insert(fieldBucketVisibility)
      .values({ fieldDefinitionId, bucketId, systemId })
      .onConflictDoNothing()
      .returning();

    if (inserted) {
      await audit(tx, {
        eventType: "field-bucket-visibility.set",
        actor: { kind: "account", id: auth.accountId },
        detail: `Field ${fieldDefinitionId} visibility set for bucket`,
        systemId,
      });
      await dispatchWebhookEvent(tx, systemId, "field-bucket-visibility.set", {
        fieldDefinitionId,
        bucketId,
      });
    }

    return { fieldDefinitionId, bucketId };
  });
}

// ── REMOVE ──────────────────────────────────────────────────────────

export async function removeFieldBucketVisibility(
  db: PostgresJsDatabase,
  systemId: SystemId,
  fieldDefinitionId: FieldDefinitionId,
  bucketId: BucketId,
  auth: AuthContext,
  audit: AuditWriter,
): Promise<void> {
  assertSystemOwnership(systemId, auth);

  await withTenantTransaction(db, tenantCtx(systemId, auth), async (tx) => {
    const deleted = await tx
      .delete(fieldBucketVisibility)
      .where(
        and(
          eq(fieldBucketVisibility.fieldDefinitionId, fieldDefinitionId),
          eq(fieldBucketVisibility.bucketId, bucketId),
          eq(fieldBucketVisibility.systemId, systemId),
        ),
      )
      .returning();

    if (deleted.length === 0) {
      throw new ApiHttpError(HTTP_NOT_FOUND, "NOT_FOUND", "Field bucket visibility not found");
    }

    await audit(tx, {
      eventType: "field-bucket-visibility.removed",
      actor: { kind: "account", id: auth.accountId },
      detail: `Field ${fieldDefinitionId} visibility removed from bucket`,
      systemId,
    });
    await dispatchWebhookEvent(tx, systemId, "field-bucket-visibility.removed", {
      fieldDefinitionId,
      bucketId,
    });
  });
}

// ── LIST ────────────────────────────────────────────────────────────

export async function listFieldBucketVisibility(
  db: PostgresJsDatabase,
  systemId: SystemId,
  fieldDefinitionId: FieldDefinitionId,
  auth: AuthContext,
  opts: { limit?: number } = {},
): Promise<readonly FieldBucketVisibilityResult[]> {
  assertSystemOwnership(systemId, auth);

  const effectiveLimit = Math.min(opts.limit ?? DEFAULT_PAGE_LIMIT, MAX_PAGE_LIMIT);

  return withTenantRead(db, tenantCtx(systemId, auth), async (tx) => {
    const rows = await tx
      .select()
      .from(fieldBucketVisibility)
      .where(
        and(
          eq(fieldBucketVisibility.fieldDefinitionId, fieldDefinitionId),
          eq(fieldBucketVisibility.systemId, systemId),
        ),
      )
      .limit(effectiveLimit);

    return rows.map(toResult);
  });
}

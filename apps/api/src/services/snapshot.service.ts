import { systemSnapshots } from "@pluralscape/db/pg";
import { brandId, ID_PREFIXES, createId, now, toUnixMillis } from "@pluralscape/types";
import { and, desc, eq, lt } from "drizzle-orm";

import { HTTP_NOT_FOUND } from "../http.constants.js";
import { ApiHttpError } from "../lib/api-error.js";
import { encryptedBlobToBase64, validateEncryptedBlob } from "../lib/encrypted-blob.js";
import { buildPaginatedResult } from "../lib/pagination.js";
import { withTenantRead, withTenantTransaction } from "../lib/rls-context.js";
import { assertSystemOwnership } from "../lib/system-ownership.js";
import { tenantCtx } from "../lib/tenant-context.js";
import {
  DEFAULT_PAGE_LIMIT,
  MAX_ENCRYPTED_DATA_BYTES,
  MAX_PAGE_LIMIT,
} from "../service.constants.js";

import type { AuditWriter } from "../lib/audit-writer.js";
import type { AuthContext } from "../lib/auth-context.js";
import type {
  EncryptedBlob,
  EncryptedWire,
  PaginatedResult,
  SnapshotTrigger,
  SystemId,
  SystemSnapshotId,
  SystemSnapshotServerMetadata,
} from "@pluralscape/types";
import type { CreateSnapshotBodySchema } from "@pluralscape/validation";
import type { PostgresJsDatabase } from "drizzle-orm/postgres-js";
import type { z } from "zod/v4";

// ── Types ───────────────────────────────────────────────────────────

export type SnapshotResult = EncryptedWire<SystemSnapshotServerMetadata>;

// ── Helpers ─────────────────────────────────────────────────────────

function toSnapshotResult(row: {
  id: string;
  systemId: string;
  snapshotTrigger: string;
  encryptedData: EncryptedBlob;
  createdAt: number;
}): SnapshotResult {
  return {
    id: brandId<SystemSnapshotId>(row.id),
    systemId: brandId<SystemId>(row.systemId),
    snapshotTrigger: row.snapshotTrigger as SnapshotTrigger,
    encryptedData: encryptedBlobToBase64(row.encryptedData),
    createdAt: toUnixMillis(row.createdAt),
  };
}

// ── CREATE ──────────────────────────────────────────────────────────

export async function createSnapshot(
  db: PostgresJsDatabase,
  systemId: SystemId,
  body: z.infer<typeof CreateSnapshotBodySchema>,
  auth: AuthContext,
  audit: AuditWriter,
): Promise<SnapshotResult> {
  assertSystemOwnership(systemId, auth);

  const blob = validateEncryptedBlob(body.encryptedData, MAX_ENCRYPTED_DATA_BYTES);

  const snapshotId = createId(ID_PREFIXES.systemSnapshot);
  const timestamp = now();

  return withTenantTransaction(db, tenantCtx(systemId, auth), async (tx) => {
    const [row] = await tx
      .insert(systemSnapshots)
      .values({
        id: brandId<SystemSnapshotId>(snapshotId),
        systemId,
        snapshotTrigger: body.snapshotTrigger,
        encryptedData: blob,
        createdAt: timestamp,
      })
      .returning();

    if (!row) {
      throw new Error("Failed to create snapshot — INSERT returned no rows");
    }

    await audit(tx, {
      eventType: "snapshot.created",
      actor: { kind: "account", id: auth.accountId },
      detail: `Snapshot created (trigger: ${body.snapshotTrigger})`,
      systemId,
    });

    return toSnapshotResult(row);
  });
}

// ── LIST ────────────────────────────────────────────────────────────

export async function listSnapshots(
  db: PostgresJsDatabase,
  systemId: SystemId,
  auth: AuthContext,
  cursor?: string,
  limit = DEFAULT_PAGE_LIMIT,
): Promise<PaginatedResult<SnapshotResult>> {
  assertSystemOwnership(systemId, auth);

  const effectiveLimit = Math.min(limit, MAX_PAGE_LIMIT);

  return withTenantRead(db, tenantCtx(systemId, auth), async (tx) => {
    const conditions = [eq(systemSnapshots.systemId, systemId)];

    if (cursor) {
      conditions.push(lt(systemSnapshots.id, brandId<SystemSnapshotId>(cursor)));
    }

    const rows = await tx
      .select()
      .from(systemSnapshots)
      .where(and(...conditions))
      .orderBy(desc(systemSnapshots.id))
      .limit(effectiveLimit + 1);

    return buildPaginatedResult(rows, effectiveLimit, toSnapshotResult);
  });
}

// ── GET ─────────────────────────────────────────────────────────────

export async function getSnapshot(
  db: PostgresJsDatabase,
  systemId: SystemId,
  snapshotId: SystemSnapshotId,
  auth: AuthContext,
): Promise<SnapshotResult> {
  assertSystemOwnership(systemId, auth);

  return withTenantRead(db, tenantCtx(systemId, auth), async (tx) => {
    const [row] = await tx
      .select()
      .from(systemSnapshots)
      .where(and(eq(systemSnapshots.id, snapshotId), eq(systemSnapshots.systemId, systemId)))
      .limit(1);

    if (!row) {
      throw new ApiHttpError(HTTP_NOT_FOUND, "NOT_FOUND", "Snapshot not found");
    }

    return toSnapshotResult(row);
  });
}

// ── DELETE ──────────────────────────────────────────────────────────

export async function deleteSnapshot(
  db: PostgresJsDatabase,
  systemId: SystemId,
  snapshotId: SystemSnapshotId,
  auth: AuthContext,
  audit: AuditWriter,
): Promise<void> {
  assertSystemOwnership(systemId, auth);

  await withTenantTransaction(db, tenantCtx(systemId, auth), async (tx) => {
    const [deleted] = await tx
      .delete(systemSnapshots)
      .where(and(eq(systemSnapshots.id, snapshotId), eq(systemSnapshots.systemId, systemId)))
      .returning({ id: systemSnapshots.id });

    if (!deleted) {
      throw new ApiHttpError(HTTP_NOT_FOUND, "NOT_FOUND", "Snapshot not found");
    }

    await audit(tx, {
      eventType: "snapshot.deleted",
      actor: { kind: "account", id: auth.accountId },
      detail: "Snapshot deleted",
      systemId,
    });
  });
}

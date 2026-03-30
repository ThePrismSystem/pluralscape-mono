import { systemSnapshots, systems } from "@pluralscape/db/pg";
import { ID_PREFIXES, createId, now, toUnixMillis } from "@pluralscape/types";
import { CreateSnapshotBodySchema } from "@pluralscape/validation";
import { and, eq, gt } from "drizzle-orm";

import { HTTP_NOT_FOUND } from "../http.constants.js";
import { ApiHttpError } from "../lib/api-error.js";
import { encryptedBlobToBase64, parseAndValidateBlob } from "../lib/encrypted-blob.js";
import { buildPaginatedResult } from "../lib/pagination.js";
import { withTenantRead, withTenantTransaction } from "../lib/rls-context.js";
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
  PaginatedResult,
  SnapshotTrigger,
  SystemId,
  SystemSnapshotId,
  UnixMillis,
} from "@pluralscape/types";
import type { PostgresJsDatabase } from "drizzle-orm/postgres-js";

// ── Types ───────────────────────────────────────────────────────────

export interface SnapshotResult {
  readonly id: SystemSnapshotId;
  readonly systemId: SystemId;
  readonly snapshotTrigger: SnapshotTrigger;
  readonly encryptedData: string;
  readonly createdAt: UnixMillis;
}

// ── Helpers ─────────────────────────────────────────────────────────

function toSnapshotResult(row: {
  id: string;
  systemId: string;
  snapshotTrigger: string;
  encryptedData: EncryptedBlob;
  createdAt: number;
}): SnapshotResult {
  return {
    id: row.id as SystemSnapshotId,
    systemId: row.systemId as SystemId,
    snapshotTrigger: row.snapshotTrigger as SnapshotTrigger,
    encryptedData: encryptedBlobToBase64(row.encryptedData),
    createdAt: toUnixMillis(row.createdAt),
  };
}

// ── CREATE ──────────────────────────────────────────────────────────

export async function createSnapshot(
  db: PostgresJsDatabase,
  systemId: SystemId,
  params: unknown,
  auth: AuthContext,
  audit: AuditWriter,
): Promise<SnapshotResult> {
  const { parsed, blob } = parseAndValidateBlob(
    params,
    CreateSnapshotBodySchema,
    MAX_ENCRYPTED_DATA_BYTES,
  );

  const snapshotId = createId(ID_PREFIXES.systemSnapshot);
  const timestamp = now();

  return withTenantTransaction(db, tenantCtx(systemId, auth), async (tx) => {
    // Verify system exists and is not archived
    const [system] = await tx
      .select({ id: systems.id })
      .from(systems)
      .where(
        and(
          eq(systems.id, systemId),
          eq(systems.accountId, auth.accountId),
          eq(systems.archived, false),
        ),
      )
      .limit(1);

    if (!system) {
      throw new ApiHttpError(HTTP_NOT_FOUND, "NOT_FOUND", "System not found");
    }

    const [row] = await tx
      .insert(systemSnapshots)
      .values({
        id: snapshotId,
        systemId,
        snapshotTrigger: parsed.snapshotTrigger,
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
      detail: `Snapshot created (trigger: ${parsed.snapshotTrigger})`,
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
  const effectiveLimit = Math.min(limit, MAX_PAGE_LIMIT);

  return withTenantRead(db, tenantCtx(systemId, auth), async (tx) => {
    const conditions = [eq(systemSnapshots.systemId, systemId)];

    if (cursor) {
      conditions.push(gt(systemSnapshots.id, cursor));
    }

    const rows = await tx
      .select()
      .from(systemSnapshots)
      .where(and(...conditions))
      .orderBy(systemSnapshots.id)
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

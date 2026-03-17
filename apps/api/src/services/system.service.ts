import {
  deserializeEncryptedBlob,
  InvalidInputError,
  serializeEncryptedBlob,
} from "@pluralscape/crypto";
import { members, systems } from "@pluralscape/db/pg";
import { ID_PREFIXES, createId, now, toCursor } from "@pluralscape/types";
import { UpdateSystemBodySchema } from "@pluralscape/validation";
import { and, count, eq, gt, sql } from "drizzle-orm";

import {
  HTTP_BAD_REQUEST,
  HTTP_CONFLICT,
  HTTP_FORBIDDEN,
  HTTP_NOT_FOUND,
} from "../http.constants.js";
import { ApiHttpError } from "../lib/api-error.js";
import { writeAuditLog } from "../lib/audit-log.js";
import {
  DEFAULT_SYSTEM_LIMIT,
  MAX_ENCRYPTED_DATA_BYTES,
  MAX_SYSTEM_LIMIT,
} from "../routes/systems/systems.constants.js";

import type { AuthContext } from "../lib/auth-context.js";
import type { RequestMeta } from "../lib/request-meta.js";
import type {
  AccountId,
  EncryptedBlob,
  PaginatedResult,
  PaginationCursor,
  SystemId,
  UnixMillis,
} from "@pluralscape/types";
import type { PostgresJsDatabase } from "drizzle-orm/postgres-js";

// ── Types ───────────────────────────────────────────────────────────

export interface SystemProfileResult {
  readonly id: SystemId;
  readonly encryptedData: string | null;
  readonly version: number;
  readonly createdAt: UnixMillis;
  readonly updatedAt: UnixMillis;
}

// ── Helpers ─────────────────────────────────────────────────────────

function encryptedBlobToBase64(blob: EncryptedBlob | null): string | null {
  if (blob === null) return null;
  return Buffer.from(serializeEncryptedBlob(blob)).toString("base64");
}

function toSystemProfileResult(row: {
  id: string;
  encryptedData: EncryptedBlob | null;
  version: number;
  createdAt: number;
  updatedAt: number;
}): SystemProfileResult {
  return {
    id: row.id as SystemId,
    encryptedData: encryptedBlobToBase64(row.encryptedData),
    version: row.version,
    createdAt: row.createdAt as UnixMillis,
    updatedAt: row.updatedAt as UnixMillis,
  };
}

// ── LIST ────────────────────────────────────────────────────────────

export async function listSystems(
  db: PostgresJsDatabase,
  accountId: AccountId,
  cursor?: PaginationCursor,
  limit = DEFAULT_SYSTEM_LIMIT,
): Promise<PaginatedResult<SystemProfileResult>> {
  const effectiveLimit = Math.min(limit, MAX_SYSTEM_LIMIT);

  const conditions = [eq(systems.accountId, accountId), eq(systems.archived, false)];

  if (cursor) {
    conditions.push(gt(systems.id, cursor));
  }

  const rows = await db
    .select()
    .from(systems)
    .where(and(...conditions))
    .orderBy(systems.id)
    .limit(effectiveLimit + 1);

  const hasMore = rows.length > effectiveLimit;
  const items = (hasMore ? rows.slice(0, effectiveLimit) : rows).map(toSystemProfileResult);
  const lastItem = items[items.length - 1];
  const nextCursor = hasMore && lastItem ? toCursor(lastItem.id) : null;

  return {
    items,
    nextCursor,
    hasMore,
    totalCount: null,
  };
}

// ── GET ─────────────────────────────────────────────────────────────

export async function getSystemProfile(
  db: PostgresJsDatabase,
  systemId: SystemId,
  auth: AuthContext,
): Promise<SystemProfileResult> {
  const [row] = await db
    .select()
    .from(systems)
    .where(
      and(
        eq(systems.id, systemId),
        eq(systems.accountId, auth.accountId),
        eq(systems.archived, false),
      ),
    )
    .limit(1);

  if (!row) {
    throw new ApiHttpError(HTTP_NOT_FOUND, "NOT_FOUND", "System not found");
  }

  return toSystemProfileResult(row);
}

// ── PUT ─────────────────────────────────────────────────────────────

export async function updateSystemProfile(
  db: PostgresJsDatabase,
  systemId: SystemId,
  params: unknown,
  auth: AuthContext,
  requestMeta: RequestMeta,
): Promise<SystemProfileResult> {
  const parsed = UpdateSystemBodySchema.safeParse(params);
  if (!parsed.success) {
    throw new ApiHttpError(HTTP_BAD_REQUEST, "VALIDATION_ERROR", "Invalid update payload");
  }

  // Decode base64 → Uint8Array
  const rawBytes = Buffer.from(parsed.data.encryptedData, "base64");

  if (rawBytes.length > MAX_ENCRYPTED_DATA_BYTES) {
    throw new ApiHttpError(
      HTTP_BAD_REQUEST,
      "BLOB_TOO_LARGE",
      `encryptedData exceeds maximum size of ${String(MAX_ENCRYPTED_DATA_BYTES)} bytes`,
    );
  }

  // Validate blob structure — deserialize round-trips to verify integrity
  let blob: EncryptedBlob;
  try {
    blob = deserializeEncryptedBlob(new Uint8Array(rawBytes));
  } catch (error) {
    if (error instanceof InvalidInputError) {
      throw new ApiHttpError(HTTP_BAD_REQUEST, "VALIDATION_ERROR", error.message);
    }
    throw error;
  }

  const timestamp = now();

  return db.transaction(async (tx) => {
    const updated = await tx
      .update(systems)
      .set({
        encryptedData: blob,
        updatedAt: timestamp,
        version: sql`${systems.version} + 1`,
      })
      .where(
        and(
          eq(systems.id, systemId),
          eq(systems.accountId, auth.accountId),
          eq(systems.version, parsed.data.version),
          eq(systems.archived, false),
        ),
      )
      .returning();

    if (updated.length === 0) {
      const [existing] = await tx
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

      if (existing) {
        throw new ApiHttpError(HTTP_CONFLICT, "CONFLICT", "Version conflict");
      }
      throw new ApiHttpError(HTTP_NOT_FOUND, "NOT_FOUND", "System not found");
    }

    // Safe: we've verified updated.length > 0 above
    const [row] = updated as [(typeof updated)[number], ...typeof updated];

    await writeAuditLog(tx, {
      accountId: auth.accountId,
      systemId,
      eventType: "system.profile-updated",
      actor: { kind: "account", id: auth.accountId },
      detail: "System profile updated",
      ipAddress: requestMeta.ipAddress,
      userAgent: requestMeta.userAgent,
    });

    return toSystemProfileResult(row);
  });
}

// ── DELETE (soft-delete) ────────────────────────────────────────────

export async function archiveSystem(
  db: PostgresJsDatabase,
  systemId: SystemId,
  auth: AuthContext,
  requestMeta: RequestMeta,
): Promise<void> {
  await db.transaction(async (tx) => {
    // 1. Verify ownership of non-archived system
    const [existing] = await tx
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

    if (!existing) {
      throw new ApiHttpError(HTTP_NOT_FOUND, "NOT_FOUND", "System not found");
    }

    // 2. Prevent archiving the last active system
    const [systemCount] = await tx
      .select({ count: count() })
      .from(systems)
      .where(and(eq(systems.accountId, auth.accountId), eq(systems.archived, false)));

    if ((systemCount?.count ?? 0) <= 1) {
      throw new ApiHttpError(
        HTTP_CONFLICT,
        "CONFLICT",
        "Cannot delete the only system on the account",
      );
    }

    // 3. Check for non-archived members
    const [memberCount] = await tx
      .select({ count: count() })
      .from(members)
      .where(and(eq(members.systemId, systemId), eq(members.archived, false)));

    if ((memberCount?.count ?? 0) > 0) {
      throw new ApiHttpError(
        HTTP_CONFLICT,
        "HAS_DEPENDENTS",
        `System has ${String(memberCount?.count ?? 0)} active member(s). Delete all members before deleting the system.`,
      );
    }

    // 4. Audit log BEFORE archive (FK satisfied since system still exists)
    await writeAuditLog(tx, {
      accountId: auth.accountId,
      systemId,
      eventType: "system.deleted",
      actor: { kind: "account", id: auth.accountId },
      detail: "System archived (soft-delete)",
      ipAddress: requestMeta.ipAddress,
      userAgent: requestMeta.userAgent,
    });

    // 5. Archive instead of hard delete
    const timestamp = now();
    const [archived] = await tx
      .update(systems)
      .set({ archived: true, archivedAt: timestamp, updatedAt: timestamp })
      .where(and(eq(systems.id, systemId), eq(systems.accountId, auth.accountId)))
      .returning({ id: systems.id });

    if (!archived) {
      throw new ApiHttpError(HTTP_NOT_FOUND, "NOT_FOUND", "System not found");
    }
  });
}

// ── POST ────────────────────────────────────────────────────────────

export async function createSystem(
  db: PostgresJsDatabase,
  auth: AuthContext,
  requestMeta: RequestMeta,
): Promise<SystemProfileResult> {
  if (auth.accountType !== "system") {
    throw new ApiHttpError(HTTP_FORBIDDEN, "FORBIDDEN", "Only system accounts can create systems");
  }

  const systemId = createId(ID_PREFIXES.system);
  const timestamp = now();

  const [row] = await db.transaction(async (tx) => {
    const inserted = await tx
      .insert(systems)
      .values({
        id: systemId,
        accountId: auth.accountId,
        createdAt: timestamp,
        updatedAt: timestamp,
      })
      .returning();

    await writeAuditLog(tx, {
      accountId: auth.accountId,
      systemId,
      eventType: "system.created",
      actor: { kind: "account", id: auth.accountId },
      detail: "System created",
      ipAddress: requestMeta.ipAddress,
      userAgent: requestMeta.userAgent,
    });

    return inserted;
  });

  if (!row) {
    throw new Error("Failed to create system — INSERT returned no rows");
  }

  return toSystemProfileResult(row);
}

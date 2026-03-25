import { members, systems } from "@pluralscape/db/pg";
import { ID_PREFIXES, createId, now, toUnixMillis } from "@pluralscape/types";
import { UpdateSystemBodySchema } from "@pluralscape/validation";
import { and, count, eq, gt, sql } from "drizzle-orm";

import { HTTP_CONFLICT, HTTP_FORBIDDEN, HTTP_NOT_FOUND } from "../http.constants.js";
import { ApiHttpError } from "../lib/api-error.js";
import { encryptedBlobToBase64OrNull, parseAndValidateBlob } from "../lib/encrypted-blob.js";
import { assertOccUpdated } from "../lib/occ-update.js";
import { buildPaginatedResult } from "../lib/pagination.js";
import {
  withAccountRead,
  withAccountTransaction,
  withTenantRead,
  withTenantTransaction,
} from "../lib/rls-context.js";
import { tenantCtx } from "../lib/tenant-context.js";
import {
  DEFAULT_PAGE_LIMIT,
  MAX_ENCRYPTED_SYSTEM_DATA_BYTES,
  MAX_PAGE_LIMIT,
} from "../service.constants.js";

import type { AuditWriter } from "../lib/audit-writer.js";
import type { AuthContext } from "../lib/auth-context.js";
import type {
  AccountId,
  EncryptedBlob,
  PaginatedResult,
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

function toSystemProfileResult(row: {
  id: string;
  encryptedData: EncryptedBlob | null;
  version: number;
  createdAt: number;
  updatedAt: number;
}): SystemProfileResult {
  return {
    id: row.id as SystemId,
    encryptedData: encryptedBlobToBase64OrNull(row.encryptedData),
    version: row.version,
    createdAt: toUnixMillis(row.createdAt),
    updatedAt: toUnixMillis(row.updatedAt),
  };
}

// ── LIST ────────────────────────────────────────────────────────────

export async function listSystems(
  db: PostgresJsDatabase,
  accountId: AccountId,
  cursor?: string,
  limit = DEFAULT_PAGE_LIMIT,
): Promise<PaginatedResult<SystemProfileResult>> {
  const effectiveLimit = Math.min(limit, MAX_PAGE_LIMIT);

  return withAccountRead(db, accountId, async (tx) => {
    const conditions = [eq(systems.accountId, accountId), eq(systems.archived, false)];

    if (cursor) {
      conditions.push(gt(systems.id, cursor));
    }

    const rows = await tx
      .select()
      .from(systems)
      .where(and(...conditions))
      .orderBy(systems.id)
      .limit(effectiveLimit + 1);

    return buildPaginatedResult(rows, effectiveLimit, toSystemProfileResult);
  });
}

// ── GET ─────────────────────────────────────────────────────────────

export async function getSystemProfile(
  db: PostgresJsDatabase,
  systemId: SystemId,
  auth: AuthContext,
): Promise<SystemProfileResult> {
  return withTenantRead(db, tenantCtx(systemId, auth), async (tx) => {
    const [row] = await tx
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
  });
}

// ── PUT ─────────────────────────────────────────────────────────────

export async function updateSystemProfile(
  db: PostgresJsDatabase,
  systemId: SystemId,
  params: unknown,
  auth: AuthContext,
  audit: AuditWriter,
): Promise<SystemProfileResult> {
  const { parsed, blob } = parseAndValidateBlob(
    params,
    UpdateSystemBodySchema,
    MAX_ENCRYPTED_SYSTEM_DATA_BYTES,
  );

  const timestamp = now();

  return withTenantTransaction(db, tenantCtx(systemId, auth), async (tx) => {
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
          eq(systems.version, parsed.version),
          eq(systems.archived, false),
        ),
      )
      .returning();

    const row = await assertOccUpdated(
      updated,
      async () => {
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
        return existing;
      },
      "System",
    );

    await audit(tx, {
      eventType: "system.profile-updated",
      actor: { kind: "account", id: auth.accountId },
      detail: "System profile updated",
      systemId,
    });

    return toSystemProfileResult(row);
  });
}

// ── DELETE (soft-delete) ────────────────────────────────────────────

export async function archiveSystem(
  db: PostgresJsDatabase,
  systemId: SystemId,
  auth: AuthContext,
  audit: AuditWriter,
): Promise<void> {
  await withTenantTransaction(db, tenantCtx(systemId, auth), async (tx) => {
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

    if (!systemCount) {
      throw new Error("Unexpected: count query returned no rows");
    }

    if (systemCount.count <= 1) {
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

    if (!memberCount) {
      throw new Error("Unexpected: count query returned no rows");
    }

    if (memberCount.count > 0) {
      throw new ApiHttpError(
        HTTP_CONFLICT,
        "HAS_DEPENDENTS",
        `System has ${String(memberCount.count)} active member(s). Delete all members before deleting the system.`,
      );
    }

    // 4. Audit log BEFORE archive (FK satisfied since system still exists)
    await audit(tx, {
      eventType: "system.deleted",
      actor: { kind: "account", id: auth.accountId },
      detail: "System archived (soft-delete)",
      systemId,
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
  audit: AuditWriter,
): Promise<SystemProfileResult> {
  if (auth.accountType !== "system") {
    throw new ApiHttpError(HTTP_FORBIDDEN, "FORBIDDEN", "Only system accounts can create systems");
  }

  const systemId = createId(ID_PREFIXES.system);
  const timestamp = now();

  const [row] = await withAccountTransaction(db, auth.accountId, async (tx) => {
    const inserted = await tx
      .insert(systems)
      .values({
        id: systemId,
        accountId: auth.accountId,
        createdAt: timestamp,
        updatedAt: timestamp,
      })
      .returning();

    await audit(tx, {
      eventType: "system.created",
      actor: { kind: "account", id: auth.accountId },
      detail: "System created",
      systemId: systemId as SystemId,
    });

    return inserted;
  });

  if (!row) {
    throw new Error("Failed to create system — INSERT returned no rows");
  }

  return toSystemProfileResult(row);
}

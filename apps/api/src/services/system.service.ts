import {
  deserializeEncryptedBlob,
  InvalidInputError,
  serializeEncryptedBlob,
} from "@pluralscape/crypto";
import { members, systems } from "@pluralscape/db/pg";
import { ID_PREFIXES, createId, now } from "@pluralscape/types";
import { UpdateSystemBodySchema } from "@pluralscape/validation";
import { and, count, eq } from "drizzle-orm";

import { ApiHttpError } from "../lib/api-error.js";
import { writeAuditLog } from "../lib/audit-log.js";
import {
  HTTP_BAD_REQUEST,
  HTTP_CONFLICT,
  HTTP_FORBIDDEN,
  HTTP_NOT_FOUND,
  MAX_ENCRYPTED_DATA_BYTES,
} from "../routes/systems/systems.constants.js";

import type { RequestMeta } from "./auth.service.js";
import type { AuthContext } from "../lib/auth-context.js";
import type { EncryptedBlob } from "@pluralscape/types";
import type { PostgresJsDatabase } from "drizzle-orm/postgres-js";

// ── Types ───────────────────────────────────────────────────────────

export interface SystemProfileResult {
  readonly id: string;
  readonly encryptedData: string | null;
  readonly version: number;
  readonly createdAt: number;
  readonly updatedAt: number;
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
    id: row.id,
    encryptedData: encryptedBlobToBase64(row.encryptedData),
    version: row.version,
    createdAt: row.createdAt,
    updatedAt: row.updatedAt,
  };
}

// ── GET ─────────────────────────────────────────────────────────────

export async function getSystemProfile(
  db: PostgresJsDatabase,
  systemId: string,
  auth: AuthContext,
): Promise<SystemProfileResult> {
  const [row] = await db
    .select()
    .from(systems)
    .where(and(eq(systems.id, systemId), eq(systems.accountId, auth.accountId)))
    .limit(1);

  if (!row) {
    throw new ApiHttpError(HTTP_NOT_FOUND, "NOT_FOUND", "System not found");
  }

  return toSystemProfileResult(row);
}

// ── PUT ─────────────────────────────────────────────────────────────

export interface UpdateSystemParams {
  readonly encryptedData: string;
  readonly version: number;
}

export async function updateSystemProfile(
  db: PostgresJsDatabase,
  systemId: string,
  params: UpdateSystemParams,
  auth: AuthContext,
  requestMeta: RequestMeta,
): Promise<SystemProfileResult> {
  const parsed = UpdateSystemBodySchema.parse(params);

  // Decode base64 → Uint8Array
  const rawBytes = Buffer.from(parsed.encryptedData, "base64");

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
  const updated = await db
    .update(systems)
    .set({
      encryptedData: blob,
      updatedAt: timestamp,
    })
    .where(
      and(
        eq(systems.id, systemId),
        eq(systems.accountId, auth.accountId),
        eq(systems.version, parsed.version),
      ),
    )
    .returning();

  if (updated.length === 0) {
    // Distinguish 404 vs 409
    const [existing] = await db
      .select({ id: systems.id })
      .from(systems)
      .where(and(eq(systems.id, systemId), eq(systems.accountId, auth.accountId)))
      .limit(1);

    if (existing) {
      throw new ApiHttpError(HTTP_CONFLICT, "CONFLICT", "Version conflict");
    }
    throw new ApiHttpError(HTTP_NOT_FOUND, "NOT_FOUND", "System not found");
  }

  const row = updated[0];
  if (!row) {
    throw new ApiHttpError(HTTP_NOT_FOUND, "NOT_FOUND", "System not found");
  }

  await writeAuditLog(db, {
    accountId: auth.accountId,
    systemId,
    eventType: "system.profile-updated",
    actor: { kind: "account", id: auth.accountId },
    detail: "System profile updated",
    ipAddress: requestMeta.ipAddress,
    userAgent: requestMeta.userAgent,
  });

  return toSystemProfileResult(row);
}

// ── DELETE ───────────────────────────────────────────────────────────

export async function deleteSystem(
  db: PostgresJsDatabase,
  systemId: string,
  auth: AuthContext,
  requestMeta: RequestMeta,
): Promise<void> {
  // Verify ownership
  const [existing] = await db
    .select({ id: systems.id })
    .from(systems)
    .where(and(eq(systems.id, systemId), eq(systems.accountId, auth.accountId)))
    .limit(1);

  if (!existing) {
    throw new ApiHttpError(HTTP_NOT_FOUND, "NOT_FOUND", "System not found");
  }

  // Prevent deleting the last system
  const [systemCount] = await db
    .select({ count: count() })
    .from(systems)
    .where(eq(systems.accountId, auth.accountId));

  const systemTotal = systemCount?.count ?? 0;
  if (systemTotal <= 1) {
    throw new ApiHttpError(
      HTTP_CONFLICT,
      "CONFLICT",
      "Cannot delete the only system on the account",
    );
  }

  // Check for dependent members
  const [memberCount] = await db
    .select({ count: count() })
    .from(members)
    .where(eq(members.systemId, systemId));

  const memberTotal = memberCount?.count ?? 0;
  if (memberTotal > 0) {
    throw new ApiHttpError(
      HTTP_CONFLICT,
      "CONFLICT",
      `System has ${String(memberTotal)} member(s). Delete all members before deleting the system.`,
    );
  }

  await db
    .delete(systems)
    .where(and(eq(systems.id, systemId), eq(systems.accountId, auth.accountId)));

  await writeAuditLog(db, {
    accountId: auth.accountId,
    systemId,
    eventType: "system.deleted",
    actor: { kind: "account", id: auth.accountId },
    detail: "System deleted",
    ipAddress: requestMeta.ipAddress,
    userAgent: requestMeta.userAgent,
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

    await writeAuditLog(tx as PostgresJsDatabase, {
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

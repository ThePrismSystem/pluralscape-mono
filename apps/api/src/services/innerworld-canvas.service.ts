import { innerworldCanvas } from "@pluralscape/db/pg";
import { now } from "@pluralscape/types";
import { UpdateCanvasBodySchema } from "@pluralscape/validation";
import { eq, sql } from "drizzle-orm";

import { HTTP_CONFLICT, HTTP_NOT_FOUND } from "../http.constants.js";
import { ApiHttpError } from "../lib/api-error.js";
import { encryptedBlobToBase64, parseAndValidateBlob } from "../lib/encrypted-blob.js";
import { assertSystemOwnership } from "../lib/system-ownership.js";
import { MAX_ENCRYPTED_DATA_BYTES } from "../service.constants.js";

import type { AuditWriter } from "../lib/audit-writer.js";
import type { AuthContext } from "../lib/auth-context.js";
import type { EncryptedBlob, SystemId, UnixMillis } from "@pluralscape/types";
import type { PostgresJsDatabase } from "drizzle-orm/postgres-js";

// ── Types ───────────────────────────────────────────────────────────

export interface CanvasResult {
  readonly systemId: SystemId;
  readonly encryptedData: string;
  readonly version: number;
  readonly createdAt: UnixMillis;
  readonly updatedAt: UnixMillis;
}

// ── Helpers ─────────────────────────────────────────────────────────

function toCanvasResult(row: {
  systemId: string;
  encryptedData: EncryptedBlob;
  version: number;
  createdAt: number;
  updatedAt: number;
}): CanvasResult {
  return {
    systemId: row.systemId as SystemId,
    encryptedData: encryptedBlobToBase64(row.encryptedData),
    version: row.version,
    createdAt: row.createdAt as UnixMillis,
    updatedAt: row.updatedAt as UnixMillis,
  };
}

// ── GET ─────────────────────────────────────────────────────────────

export async function getCanvas(
  db: PostgresJsDatabase,
  systemId: SystemId,
  auth: AuthContext,
): Promise<CanvasResult> {
  assertSystemOwnership(systemId, auth);

  const [row] = await db
    .select()
    .from(innerworldCanvas)
    .where(eq(innerworldCanvas.systemId, systemId))
    .limit(1);

  if (!row) {
    throw new ApiHttpError(HTTP_NOT_FOUND, "NOT_FOUND", "Canvas not found");
  }

  return toCanvasResult(row);
}

// ── UPSERT ──────────────────────────────────────────────────────────

export async function upsertCanvas(
  db: PostgresJsDatabase,
  systemId: SystemId,
  params: unknown,
  auth: AuthContext,
  audit: AuditWriter,
): Promise<CanvasResult> {
  assertSystemOwnership(systemId, auth);

  const { parsed, blob } = parseAndValidateBlob(
    params,
    UpdateCanvasBodySchema,
    MAX_ENCRYPTED_DATA_BYTES,
  );

  const timestamp = now();

  return db.transaction(async (tx) => {
    const [existing] = await tx
      .select({ version: innerworldCanvas.version })
      .from(innerworldCanvas)
      .where(eq(innerworldCanvas.systemId, systemId))
      .limit(1);

    if (!existing) {
      // First write — require version=1
      if (parsed.version !== 1) {
        throw new ApiHttpError(HTTP_NOT_FOUND, "NOT_FOUND", "Canvas not found");
      }

      const [row] = await tx
        .insert(innerworldCanvas)
        .values({
          systemId,
          encryptedData: blob,
          createdAt: timestamp,
          updatedAt: timestamp,
        })
        .returning();

      if (!row) {
        throw new Error("Failed to create canvas — INSERT returned no rows");
      }

      await audit(tx, {
        eventType: "innerworld-canvas.created",
        actor: { kind: "account", id: auth.accountId },
        detail: "Canvas created",
        systemId,
      });

      return toCanvasResult(row);
    }

    // Existing canvas — OCC update
    if (existing.version !== parsed.version) {
      throw new ApiHttpError(HTTP_CONFLICT, "CONFLICT", "Version conflict");
    }

    const [row] = await tx
      .update(innerworldCanvas)
      .set({
        encryptedData: blob,
        updatedAt: timestamp,
        version: sql`${innerworldCanvas.version} + 1`,
      })
      .where(eq(innerworldCanvas.systemId, systemId))
      .returning();

    if (!row) {
      throw new Error("Failed to update canvas — UPDATE returned no rows");
    }

    await audit(tx, {
      eventType: "innerworld-canvas.updated",
      actor: { kind: "account", id: auth.accountId },
      detail: "Canvas updated",
      systemId,
    });

    return toCanvasResult(row);
  });
}

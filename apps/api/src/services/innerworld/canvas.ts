import { innerworldCanvas } from "@pluralscape/db/pg";
import { brandId, now, toUnixMillis } from "@pluralscape/types";
import { UpdateCanvasBodySchema } from "@pluralscape/validation";
import { eq, sql } from "drizzle-orm";

import { HTTP_CONFLICT, HTTP_NOT_FOUND } from "../../http.constants.js";
import { ApiHttpError } from "../../lib/api-error.js";
// eslint-disable-next-line pluralscape/no-params-unknown
import { encryptedBlobToBase64, parseAndValidateBlob } from "../../lib/encrypted-blob.js";
import { withTenantRead, withTenantTransaction } from "../../lib/rls-context.js";
import { assertSystemOwnership } from "../../lib/system-ownership.js";
import { tenantCtx } from "../../lib/tenant-context.js";
import { MAX_ENCRYPTED_DATA_BYTES } from "../../service.constants.js";

import type { AuditWriter } from "../../lib/audit-writer.js";
import type { AuthContext } from "../../lib/auth-context.js";
import type {
  EncryptedBlob,
  EncryptedWire,
  InnerWorldCanvasServerMetadata,
  SystemId,
} from "@pluralscape/types";
import type { PostgresJsDatabase } from "drizzle-orm/postgres-js";

// ── Types ───────────────────────────────────────────────────────────

export type CanvasResult = EncryptedWire<InnerWorldCanvasServerMetadata>;

// ── Helpers ─────────────────────────────────────────────────────────

function toCanvasResult(row: {
  systemId: string;
  encryptedData: EncryptedBlob;
  version: number;
  createdAt: number;
  updatedAt: number;
}): CanvasResult {
  return {
    systemId: brandId<SystemId>(row.systemId),
    encryptedData: encryptedBlobToBase64(row.encryptedData),
    version: row.version,
    createdAt: toUnixMillis(row.createdAt),
    updatedAt: toUnixMillis(row.updatedAt),
  };
}

// ── GET ─────────────────────────────────────────────────────────────

export async function getCanvas(
  db: PostgresJsDatabase,
  systemId: SystemId,
  auth: AuthContext,
): Promise<CanvasResult> {
  assertSystemOwnership(systemId, auth);

  return withTenantRead(db, tenantCtx(systemId, auth), async (tx) => {
    const [row] = await tx
      .select()
      .from(innerworldCanvas)
      .where(eq(innerworldCanvas.systemId, systemId))
      .limit(1);

    if (!row) {
      throw new ApiHttpError(HTTP_NOT_FOUND, "NOT_FOUND", "Canvas not found");
    }

    return toCanvasResult(row);
  });
}

// ── UPSERT ──────────────────────────────────────────────────────────

export async function upsertCanvas(
  db: PostgresJsDatabase,
  systemId: SystemId,
  // eslint-disable-next-line pluralscape/no-params-unknown
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

  return withTenantTransaction(db, tenantCtx(systemId, auth), async (tx) => {
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

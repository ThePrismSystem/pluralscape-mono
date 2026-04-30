import { systemSnapshots, systems } from "@pluralscape/db/pg";
import { brandId, ID_PREFIXES, createId, now } from "@pluralscape/types";
import { and, eq } from "drizzle-orm";

import { HTTP_FORBIDDEN, HTTP_NOT_FOUND } from "../http.constants.js";
import { ApiHttpError } from "../lib/api-error.js";
import { withAccountTransaction } from "../lib/rls-context.js";

import type { AuditWriter } from "../lib/audit-writer.js";
import type { AuthContext } from "../lib/auth-context.js";
import type { SystemId, SystemSnapshotId } from "@pluralscape/types";
import type { DuplicateSystemBodySchema } from "@pluralscape/validation";
import type { PostgresJsDatabase } from "drizzle-orm/postgres-js";
import type { z } from "zod/v4";

export interface DuplicateSystemResult {
  readonly id: SystemId;
  readonly sourceSnapshotId: SystemSnapshotId;
}

/**
 * Duplicate a system by creating a new system seeded with encrypted data
 * from an existing snapshot.
 *
 * The new system's encryptedData is populated from the snapshot blob.
 * Client-side re-encryption is expected for a full deep-copy — this
 * endpoint handles the server-side record creation only.
 */
export async function duplicateSystem(
  db: PostgresJsDatabase,
  sourceSystemId: SystemId,
  body: z.infer<typeof DuplicateSystemBodySchema>,
  auth: AuthContext,
  audit: AuditWriter,
): Promise<DuplicateSystemResult> {
  if (auth.accountType !== "system") {
    throw new ApiHttpError(
      HTTP_FORBIDDEN,
      "FORBIDDEN",
      "Only system accounts can duplicate systems",
    );
  }

  const { snapshotId } = body;

  const newSystemId = brandId<SystemId>(createId(ID_PREFIXES.system));
  const timestamp = now();

  return withAccountTransaction(db, auth.accountId, async (tx) => {
    // Verify source system belongs to account
    const [sourceSystem] = await tx
      .select({ id: systems.id })
      .from(systems)
      .where(and(eq(systems.id, sourceSystemId), eq(systems.accountId, auth.accountId)))
      .limit(1);

    if (!sourceSystem) {
      throw new ApiHttpError(HTTP_NOT_FOUND, "NOT_FOUND", "Source system not found");
    }

    // Fetch snapshot data
    const [snapshot] = await tx
      .select({ id: systemSnapshots.id, encryptedData: systemSnapshots.encryptedData })
      .from(systemSnapshots)
      .where(and(eq(systemSnapshots.id, snapshotId), eq(systemSnapshots.systemId, sourceSystemId)))
      .limit(1);

    if (!snapshot) {
      throw new ApiHttpError(HTTP_NOT_FOUND, "NOT_FOUND", "Snapshot not found");
    }

    // Create new system with snapshot's encrypted data
    await tx.insert(systems).values({
      id: newSystemId,
      accountId: auth.accountId,
      encryptedData: snapshot.encryptedData,
      createdAt: timestamp,
      updatedAt: timestamp,
    });

    await audit(tx, {
      eventType: "system.duplicated",
      actor: { kind: "account", id: auth.accountId },
      detail: `System duplicated from snapshot ${snapshotId}`,
      systemId: newSystemId,
    });

    return {
      id: newSystemId,
      sourceSnapshotId: snapshot.id,
    };
  });
}

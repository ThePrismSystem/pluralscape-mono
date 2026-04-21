import { innerworldRegions } from "@pluralscape/db/pg";
import { now } from "@pluralscape/types";
import { UpdateRegionBodySchema } from "@pluralscape/validation";
import { and, eq, sql } from "drizzle-orm";

import { parseAndValidateBlob } from "../../lib/encrypted-blob.js";
import { assertOccUpdated } from "../../lib/occ-update.js";
import { withTenantTransaction } from "../../lib/rls-context.js";
import { assertSystemOwnership } from "../../lib/system-ownership.js";
import { tenantCtx } from "../../lib/tenant-context.js";
import { MAX_ENCRYPTED_DATA_BYTES } from "../../service.constants.js";

import { toRegionResult } from "./internal.js";

import type { RegionResult } from "./internal.js";
import type { AuditWriter } from "../../lib/audit-writer.js";
import type { AuthContext } from "../../lib/auth-context.js";
import type { InnerWorldRegionId, SystemId } from "@pluralscape/types";
import type { PostgresJsDatabase } from "drizzle-orm/postgres-js";

export async function updateRegion(
  db: PostgresJsDatabase,
  systemId: SystemId,
  regionId: InnerWorldRegionId,
  params: unknown,
  auth: AuthContext,
  audit: AuditWriter,
): Promise<RegionResult> {
  assertSystemOwnership(systemId, auth);

  const { parsed, blob } = parseAndValidateBlob(
    params,
    UpdateRegionBodySchema,
    MAX_ENCRYPTED_DATA_BYTES,
  );

  const timestamp = now();

  return withTenantTransaction(db, tenantCtx(systemId, auth), async (tx) => {
    const updated = await tx
      .update(innerworldRegions)
      .set({
        encryptedData: blob,
        updatedAt: timestamp,
        version: sql`${innerworldRegions.version} + 1`,
      })
      .where(
        and(
          eq(innerworldRegions.id, regionId),
          eq(innerworldRegions.systemId, systemId),
          eq(innerworldRegions.version, parsed.version),
          eq(innerworldRegions.archived, false),
        ),
      )
      .returning();

    const row = await assertOccUpdated(
      updated,
      async () => {
        const [existing] = await tx
          .select({ id: innerworldRegions.id })
          .from(innerworldRegions)
          .where(
            and(
              eq(innerworldRegions.id, regionId),
              eq(innerworldRegions.systemId, systemId),
              eq(innerworldRegions.archived, false),
            ),
          )
          .limit(1);
        return existing;
      },
      "Region",
    );

    await audit(tx, {
      eventType: "innerworld-region.updated",
      actor: { kind: "account", id: auth.accountId },
      detail: "Region updated",
      systemId,
    });

    return toRegionResult(row);
  });
}

import { innerworldRegions, systems } from "@pluralscape/db/pg";
import { ID_PREFIXES, brandId, createId, now } from "@pluralscape/types";
import { CreateRegionBodySchema } from "@pluralscape/validation";
import { and, count, eq } from "drizzle-orm";

import { HTTP_NOT_FOUND, HTTP_TOO_MANY_REQUESTS } from "../../../http.constants.js";
import { ApiHttpError } from "../../../lib/api-error.js";
// eslint-disable-next-line pluralscape/no-params-unknown
import { parseAndValidateBlob } from "../../../lib/encrypted-blob.js";
import { withTenantTransaction } from "../../../lib/rls-context.js";
import { assertSystemOwnership } from "../../../lib/system-ownership.js";
import { tenantCtx } from "../../../lib/tenant-context.js";
import { MAX_INNERWORLD_REGIONS_PER_SYSTEM } from "../../../quota.constants.js";
import { MAX_ENCRYPTED_DATA_BYTES } from "../../../service.constants.js";

import { toRegionResult } from "./internal.js";

import type { RegionResult } from "./internal.js";
import type { AuditWriter } from "../../../lib/audit-writer.js";
import type { AuthContext } from "../../../lib/auth-context.js";
import type { InnerWorldRegionId, SystemId } from "@pluralscape/types";
import type { PostgresJsDatabase } from "drizzle-orm/postgres-js";

export async function createRegion(
  db: PostgresJsDatabase,
  systemId: SystemId,
  // eslint-disable-next-line pluralscape/no-params-unknown
  params: unknown,
  auth: AuthContext,
  audit: AuditWriter,
): Promise<RegionResult> {
  assertSystemOwnership(systemId, auth);

  const { parsed, blob } = parseAndValidateBlob(
    params,
    CreateRegionBodySchema,
    MAX_ENCRYPTED_DATA_BYTES,
  );

  const regionId = brandId<InnerWorldRegionId>(createId(ID_PREFIXES.innerWorldRegion));
  const timestamp = now();

  return withTenantTransaction(db, tenantCtx(systemId, auth), async (tx) => {
    // Enforce per-system region quota
    await tx.select({ id: systems.id }).from(systems).where(eq(systems.id, systemId)).for("update");

    const [existingCount] = await tx
      .select({ count: count() })
      .from(innerworldRegions)
      .where(and(eq(innerworldRegions.systemId, systemId), eq(innerworldRegions.archived, false)));

    if ((existingCount?.count ?? 0) >= MAX_INNERWORLD_REGIONS_PER_SYSTEM) {
      throw new ApiHttpError(
        HTTP_TOO_MANY_REQUESTS,
        "QUOTA_EXCEEDED",
        `Maximum of ${String(MAX_INNERWORLD_REGIONS_PER_SYSTEM)} innerworld regions per system`,
      );
    }

    // Validate parentRegionId exists in same system if provided
    const parentRegionId = parsed.parentRegionId ?? null;
    if (parentRegionId !== null) {
      const [parent] = await tx
        .select({ id: innerworldRegions.id })
        .from(innerworldRegions)
        .where(
          and(
            eq(innerworldRegions.id, parentRegionId),
            eq(innerworldRegions.systemId, systemId),
            eq(innerworldRegions.archived, false),
          ),
        )
        .limit(1);

      if (!parent) {
        throw new ApiHttpError(HTTP_NOT_FOUND, "NOT_FOUND", "Parent region not found");
      }
    }

    const [row] = await tx
      .insert(innerworldRegions)
      .values({
        id: regionId,
        systemId,
        parentRegionId,
        encryptedData: blob,
        createdAt: timestamp,
        updatedAt: timestamp,
      })
      .returning();

    if (!row) {
      throw new Error("Failed to create region — INSERT returned no rows");
    }

    await audit(tx, {
      eventType: "innerworld-region.created",
      actor: { kind: "account", id: auth.accountId },
      detail: "Region created",
      systemId,
    });

    return toRegionResult(row);
  });
}

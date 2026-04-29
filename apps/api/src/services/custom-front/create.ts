import { customFronts, systems } from "@pluralscape/db/pg";
import { brandId, ID_PREFIXES, createId, now } from "@pluralscape/types";
import { CreateCustomFrontBodySchema } from "@pluralscape/validation";
import { and, count, eq } from "drizzle-orm";

import { HTTP_TOO_MANY_REQUESTS } from "../../http.constants.js";
import { ApiHttpError } from "../../lib/api-error.js";
// eslint-disable-next-line pluralscape/no-params-unknown
import { parseAndValidateBlob } from "../../lib/encrypted-blob.js";
import { withTenantTransaction } from "../../lib/rls-context.js";
import { assertSystemOwnership } from "../../lib/system-ownership.js";
import { tenantCtx } from "../../lib/tenant-context.js";
import { MAX_CUSTOM_FRONTS_PER_SYSTEM } from "../../quota.constants.js";
import { MAX_ENCRYPTED_DATA_BYTES } from "../../service.constants.js";
import { dispatchWebhookEvent } from "../webhook-dispatcher.js";

import { toCustomFrontResult } from "./internal.js";

import type { CustomFrontResult } from "./internal.js";
import type { AuditWriter } from "../../lib/audit-writer.js";
import type { AuthContext } from "../../lib/auth-context.js";
import type { CustomFrontId, SystemId } from "@pluralscape/types";
import type { PostgresJsDatabase } from "drizzle-orm/postgres-js";

export async function createCustomFront(
  db: PostgresJsDatabase,
  systemId: SystemId,
  // eslint-disable-next-line pluralscape/no-params-unknown
  params: unknown,
  auth: AuthContext,
  audit: AuditWriter,
): Promise<CustomFrontResult> {
  assertSystemOwnership(systemId, auth);

  const { blob } = parseAndValidateBlob(
    params,
    CreateCustomFrontBodySchema,
    MAX_ENCRYPTED_DATA_BYTES,
  );

  const cfId = brandId<CustomFrontId>(createId(ID_PREFIXES.customFront));
  const timestamp = now();

  return withTenantTransaction(db, tenantCtx(systemId, auth), async (tx) => {
    // Enforce per-system custom front quota
    await tx.select({ id: systems.id }).from(systems).where(eq(systems.id, systemId)).for("update");

    const [existing] = await tx
      .select({ count: count() })
      .from(customFronts)
      .where(and(eq(customFronts.systemId, systemId), eq(customFronts.archived, false)));

    if ((existing?.count ?? 0) >= MAX_CUSTOM_FRONTS_PER_SYSTEM) {
      throw new ApiHttpError(
        HTTP_TOO_MANY_REQUESTS,
        "QUOTA_EXCEEDED",
        `Maximum of ${String(MAX_CUSTOM_FRONTS_PER_SYSTEM)} custom fronts per system`,
      );
    }

    const [row] = await tx
      .insert(customFronts)
      .values({
        id: cfId,
        systemId,
        encryptedData: blob,
        createdAt: timestamp,
        updatedAt: timestamp,
      })
      .returning();

    if (!row) {
      throw new Error("Failed to create custom front — INSERT returned no rows");
    }

    await audit(tx, {
      eventType: "custom-front.created",
      actor: { kind: "account", id: auth.accountId },
      detail: "Custom front created",
      systemId,
    });
    await dispatchWebhookEvent(tx, systemId, "custom-front.changed", {
      customFrontId: brandId<CustomFrontId>(row.id),
    });

    return toCustomFrontResult(row);
  });
}

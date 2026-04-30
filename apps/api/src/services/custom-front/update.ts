import { customFronts } from "@pluralscape/db/pg";
import { now } from "@pluralscape/types";
import { UpdateCustomFrontBodySchema } from "@pluralscape/validation";
import { and, eq, sql } from "drizzle-orm";

import { validateEncryptedBlob } from "../../lib/encrypted-blob.js";
import { assertOccUpdated } from "../../lib/occ-update.js";
import { withTenantTransaction } from "../../lib/rls-context.js";
import { assertSystemOwnership } from "../../lib/system-ownership.js";
import { tenantCtx } from "../../lib/tenant-context.js";
import { MAX_ENCRYPTED_DATA_BYTES } from "../../service.constants.js";
import { dispatchWebhookEvent } from "../webhook-dispatcher.js";

import { toCustomFrontResult } from "./internal.js";

import type { CustomFrontResult } from "./internal.js";
import type { AuditWriter } from "../../lib/audit-writer.js";
import type { AuthContext } from "../../lib/auth-context.js";
import type { CustomFrontId, SystemId } from "@pluralscape/types";
import type { PostgresJsDatabase } from "drizzle-orm/postgres-js";
import type { z } from "zod/v4";

export async function updateCustomFront(
  db: PostgresJsDatabase,
  systemId: SystemId,
  customFrontId: CustomFrontId,
  body: z.infer<typeof UpdateCustomFrontBodySchema>,
  auth: AuthContext,
  audit: AuditWriter,
): Promise<CustomFrontResult> {
  assertSystemOwnership(systemId, auth);

  const blob = validateEncryptedBlob(body.encryptedData, MAX_ENCRYPTED_DATA_BYTES);
  const version = body.version;
  const timestamp = now();

  return withTenantTransaction(db, tenantCtx(systemId, auth), async (tx) => {
    const updated = await tx
      .update(customFronts)
      .set({
        encryptedData: blob,
        updatedAt: timestamp,
        version: sql`${customFronts.version} + 1`,
      })
      .where(
        and(
          eq(customFronts.id, customFrontId),
          eq(customFronts.systemId, systemId),
          eq(customFronts.version, version),
          eq(customFronts.archived, false),
        ),
      )
      .returning();

    const row = await assertOccUpdated(
      updated,
      async () => {
        const [existing] = await tx
          .select({ id: customFronts.id })
          .from(customFronts)
          .where(
            and(
              eq(customFronts.id, customFrontId),
              eq(customFronts.systemId, systemId),
              eq(customFronts.archived, false),
            ),
          )
          .limit(1);
        return existing;
      },
      "Custom front",
    );

    await audit(tx, {
      eventType: "custom-front.updated",
      actor: { kind: "account", id: auth.accountId },
      detail: "Custom front updated",
      systemId,
    });
    await dispatchWebhookEvent(tx, systemId, "custom-front.changed", { customFrontId });

    return toCustomFrontResult(row);
  });
}

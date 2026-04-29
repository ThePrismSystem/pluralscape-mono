import { systems } from "@pluralscape/db/pg";
import { now } from "@pluralscape/types";
import { UpdateSystemBodySchema } from "@pluralscape/validation";
import { and, eq, sql } from "drizzle-orm";

// eslint-disable-next-line pluralscape/no-params-unknown
import { parseAndValidateBlob } from "../../lib/encrypted-blob.js";
import { assertOccUpdated } from "../../lib/occ-update.js";
import { withTenantTransaction } from "../../lib/rls-context.js";
import { tenantCtx } from "../../lib/tenant-context.js";
import { MAX_ENCRYPTED_SYSTEM_DATA_BYTES } from "../../service.constants.js";

import { toSystemProfileResult } from "./internal.js";

import type { SystemProfileResult } from "./internal.js";
import type { AuditWriter } from "../../lib/audit-writer.js";
import type { AuthContext } from "../../lib/auth-context.js";
import type { SystemId } from "@pluralscape/types";
import type { PostgresJsDatabase } from "drizzle-orm/postgres-js";

export async function updateSystemProfile(
  db: PostgresJsDatabase,
  systemId: SystemId,
  // eslint-disable-next-line pluralscape/no-params-unknown
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

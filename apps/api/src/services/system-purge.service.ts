import { fromHex, verifyAuthKey } from "@pluralscape/crypto";
import { accounts, systems } from "@pluralscape/db/pg";
import { PurgeSystemBodySchema } from "@pluralscape/validation";
import { and, eq } from "drizzle-orm";

import { HTTP_BAD_REQUEST, HTTP_CONFLICT, HTTP_NOT_FOUND } from "../http.constants.js";
import { ApiHttpError } from "../lib/api-error.js";
import { withTenantTransaction } from "../lib/rls-context.js";
import { tenantCtx } from "../lib/tenant-context.js";

import type { AuditWriter } from "../lib/audit-writer.js";
import type { AuthContext } from "../lib/auth-context.js";
import type { SystemId } from "@pluralscape/types";
import type { PostgresJsDatabase } from "drizzle-orm/postgres-js";

/**
 * Permanently hard-delete a system and all dependents.
 *
 * Preconditions:
 * - System must be archived (soft-deleted) first
 * - Auth key confirmation required to prevent accidental purge
 *
 * CASCADE on system_id FKs handles all dependent data removal.
 */
export async function purgeSystem(
  db: PostgresJsDatabase,
  systemId: SystemId,
  params: unknown,
  auth: AuthContext,
  audit: AuditWriter,
): Promise<void> {
  const parsed = PurgeSystemBodySchema.parse(params);

  await withTenantTransaction(db, tenantCtx(systemId, auth), async (tx) => {
    // Verify system exists and belongs to account
    const [system] = await tx
      .select({ id: systems.id, archived: systems.archived })
      .from(systems)
      .where(and(eq(systems.id, systemId), eq(systems.accountId, auth.accountId)))
      .limit(1);

    if (!system) {
      throw new ApiHttpError(HTTP_NOT_FOUND, "NOT_FOUND", "System not found");
    }

    // System must be archived before permanent purge
    if (!system.archived) {
      throw new ApiHttpError(
        HTTP_CONFLICT,
        "NOT_ARCHIVED",
        "System must be archived before permanent deletion",
      );
    }

    // Verify auth key
    const [account] = await tx
      .select({ authKeyHash: accounts.authKeyHash })
      .from(accounts)
      .where(eq(accounts.id, auth.accountId))
      .limit(1);

    if (!account) {
      throw new ApiHttpError(HTTP_BAD_REQUEST, "VALIDATION_ERROR", "Account not found");
    }

    const authKeyHash =
      account.authKeyHash instanceof Uint8Array
        ? account.authKeyHash
        : new Uint8Array(account.authKeyHash);
    const valid = verifyAuthKey(fromHex(parsed.authKey), authKeyHash);
    if (!valid) {
      throw new ApiHttpError(HTTP_BAD_REQUEST, "VALIDATION_ERROR", "Incorrect password");
    }

    // Write audit event before cascade delete so it is briefly preserved
    await audit(tx, {
      eventType: "system.purged",
      actor: { kind: "account", id: auth.accountId },
      detail: "System permanently deleted",
      systemId,
    });

    // Hard delete — CASCADE handles all dependent tables
    const [deleted] = await tx
      .delete(systems)
      .where(and(eq(systems.id, systemId), eq(systems.accountId, auth.accountId)))
      .returning({ id: systems.id });

    if (!deleted) {
      throw new ApiHttpError(HTTP_NOT_FOUND, "NOT_FOUND", "System not found");
    }
  });
}

import { fromHex, verifyAuthKey } from "@pluralscape/crypto";
import { accounts, sessions } from "@pluralscape/db/pg";
import { DeleteAccountBodySchema } from "@pluralscape/validation";
import { eq } from "drizzle-orm";

import { HTTP_BAD_REQUEST } from "../http.constants.js";
import { assertAccountOwnership } from "../lib/account-ownership.js";
import { ApiHttpError } from "../lib/api-error.js";
import { ensureUint8Array } from "../lib/binary.js";
import { withAccountTransaction } from "../lib/rls-context.js";

import type { AuditWriter } from "../lib/audit-writer.js";
import type { AuthContext } from "../lib/auth-context.js";
import type { PostgresJsDatabase } from "drizzle-orm/postgres-js";

/**
 * Permanently delete an account and all associated data.
 *
 * The DB schema uses CASCADE on account_id for most tables, so deleting the
 * account row removes systems, members, sessions, keys, and all dependent data.
 * Auth key confirmation prevents accidental or unauthorized purges.
 */
export async function deleteAccount(
  db: PostgresJsDatabase,
  params: unknown,
  auth: AuthContext,
  audit: AuditWriter,
): Promise<void> {
  const parsed = DeleteAccountBodySchema.parse(params);

  assertAccountOwnership(auth.accountId, auth);

  await withAccountTransaction(db, auth.accountId, async (tx) => {
    // Fetch auth key hash for verification
    const [account] = await tx
      .select({ authKeyHash: accounts.authKeyHash })
      .from(accounts)
      .where(eq(accounts.id, auth.accountId))
      .limit(1);

    if (!account) {
      throw new ApiHttpError(HTTP_BAD_REQUEST, "VALIDATION_ERROR", "Account not found");
    }

    const authKeyHash = ensureUint8Array(account.authKeyHash);
    const valid = verifyAuthKey(fromHex(parsed.authKey), authKeyHash);
    if (!valid) {
      throw new ApiHttpError(HTTP_BAD_REQUEST, "VALIDATION_ERROR", "Incorrect password");
    }

    // Write audit event before cascade delete so it is briefly preserved
    await audit(tx, {
      eventType: "data.purge",
      actor: { kind: "account", id: auth.accountId },
      detail: "Account permanently deleted",
      accountId: auth.accountId,
    });

    // Revoke all sessions before deleting the account
    await tx.delete(sessions).where(eq(sessions.accountId, auth.accountId));

    // Delete account — CASCADE handles all dependent tables
    await tx.delete(accounts).where(eq(accounts.id, auth.accountId));
  });
}

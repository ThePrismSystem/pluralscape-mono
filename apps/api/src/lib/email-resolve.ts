import { accounts } from "@pluralscape/db/pg";
import { eq } from "drizzle-orm";

import { decryptEmail } from "./email-encrypt.js";

import type { PostgresJsDatabase } from "drizzle-orm/postgres-js";

/**
 * Resolve the plaintext email for an account by decrypting the stored encrypted email.
 *
 * Returns null when:
 * - The account does not exist
 * - The account predates the encrypted_email column (null value)
 * - EMAIL_ENCRYPTION_KEY is not configured
 *
 * @throws {Error} if decryption fails (wrong key, corrupted data)
 */
export async function resolveAccountEmail(
  db: PostgresJsDatabase,
  accountId: string,
): Promise<string | null> {
  const rows = await db
    .select({ encryptedEmail: accounts.encryptedEmail })
    .from(accounts)
    .where(eq(accounts.id, accountId))
    .limit(1);

  const row = rows[0];
  if (!row?.encryptedEmail) {
    return null;
  }

  return decryptEmail(row.encryptedEmail);
}

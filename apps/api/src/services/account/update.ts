import {
  assertAuthKey,
  assertAuthKeyHash,
  assertSignPublicKey,
  assertSignature,
  getSodium,
  hashAuthKey,
  verify,
  verifyAuthKey,
} from "@pluralscape/crypto";
import { accounts, authKeys, sessions } from "@pluralscape/db/pg";
import { now } from "@pluralscape/types";
import {
  ChangeEmailSchema,
  ChangePasswordSchema,
  UpdateAccountSettingsSchema,
} from "@pluralscape/validation";
import { and, eq } from "drizzle-orm";

import { ensureUint8Array } from "../../lib/binary.js";
import { hashEmail } from "../../lib/email-hash.js";
import { resolveAccountEmail } from "../../lib/email-resolve.js";
import { fromHex, toHex } from "../../lib/hex.js";
import { withAccountRead, withAccountTransaction } from "../../lib/rls-context.js";
import { EMAIL_CHANGE_FAILED_ERROR } from "../../routes/account/account.constants.js";
import { EMAIL_SALT_BYTES } from "../../routes/auth/auth.constants.js";
import { isDuplicateEmailError, ValidationError } from "../auth/register.js";
import { INCORRECT_PASSWORD_ERROR } from "../auth.constants.js";

import { ConcurrencyError } from "./internal.js";

import type { AuditWriter } from "../../lib/audit-writer.js";
import type { AccountId } from "@pluralscape/types";
import type { PostgresJsDatabase } from "drizzle-orm/postgres-js";

// ── Change Email ──────────────────────────────────────────────────

/**
 * Outcome of a successful `changeEmail` call.
 *
 * Discriminated on `kind` so callers can branch on whether the change actually
 * mutated anything. The "changed" variant carries the plaintext addresses and
 * the post-change `version` — the version is the idempotency-key suffix used by
 * {@link enqueueAccountEmailChangedNotification} so retries of the same change
 * deduplicate and a subsequent legitimate change (different version) enqueues
 * a fresh notification.
 */
export type ChangeEmailResult =
  | { readonly kind: "noop" }
  | {
      readonly kind: "changed";
      /**
       * Plaintext OLD email before the change. `null` when it could not be
       * resolved (no encryptedEmail on file, or `EMAIL_ENCRYPTION_KEY`
       * missing) — in which case no notification is sent to the prior
       * address.
       */
      readonly oldEmail: string | null;
      /** Plaintext NEW email (post-change). */
      readonly newEmail: string;
      /**
       * Post-change `accounts.version`. Used as the idempotency-key suffix
       * for the fire-and-forget notification enqueue.
       */
      readonly version: number;
    };

export async function changeEmail(
  db: PostgresJsDatabase,
  accountId: AccountId,
  params: unknown,
  audit: AuditWriter,
): Promise<ChangeEmailResult> {
  const parsed = ChangeEmailSchema.parse(params);

  const account = await withAccountRead(db, accountId, async (tx) => {
    const [row] = await tx
      .select({
        authKeyHash: accounts.authKeyHash,
        emailHash: accounts.emailHash,
        version: accounts.version,
      })
      .from(accounts)
      .where(eq(accounts.id, accountId))
      .limit(1);
    return row ?? null;
  });

  if (!account) {
    throw new ValidationError(INCORRECT_PASSWORD_ERROR);
  }

  const authKeyBytes = fromHex(parsed.authKey);
  assertAuthKey(authKeyBytes);
  const storedHash = ensureUint8Array(account.authKeyHash);
  assertAuthKeyHash(storedHash);
  const valid = verifyAuthKey(authKeyBytes, storedHash);
  if (!valid) {
    throw new ValidationError(INCORRECT_PASSWORD_ERROR);
  }

  const newEmailHash = hashEmail(parsed.email);
  if (newEmailHash === account.emailHash) {
    return { kind: "noop" };
  }

  // Capture the plaintext OLD email before mutating anything. This is the
  // address we need to notify after the change commits. Resolution may return
  // null (pre-encrypted-email accounts, missing EMAIL_ENCRYPTION_KEY) — in
  // which case the route skips the notification rather than failing the change.
  const oldEmail = await resolveAccountEmail(db, accountId);

  const adapter = getSodium();
  /** Stored for potential future per-account salting; current hashEmail() uses global pepper. */
  const newEmailSalt = toHex(adapter.randomBytes(EMAIL_SALT_BYTES));
  const timestamp = now();

  try {
    await withAccountTransaction(db, accountId, async (tx) => {
      const updated = await tx
        .update(accounts)
        .set({
          emailHash: newEmailHash,
          emailSalt: newEmailSalt,
          updatedAt: timestamp,
          version: account.version + 1,
        })
        .where(and(eq(accounts.id, accountId), eq(accounts.version, account.version)))
        .returning({ id: accounts.id });

      if (updated.length === 0) {
        throw new ConcurrencyError("Account was modified concurrently");
      }

      await audit(tx, {
        eventType: "auth.email-changed",
        actor: { kind: "account", id: accountId },
        detail: "Email changed",
      });
    });
  } catch (error: unknown) {
    if (isDuplicateEmailError(error)) {
      throw new ValidationError(EMAIL_CHANGE_FAILED_ERROR);
    }
    throw error;
  }

  return {
    kind: "changed",
    oldEmail,
    newEmail: parsed.email,
    // The UPDATE above set version = account.version + 1, so this is the
    // post-change value — stable across the commit, safe to key on.
    version: account.version + 1,
  };
}

// ── Change Password ───────────────────────────────────────────────

export interface ChangePasswordResult {
  readonly ok: true;
  readonly revokedSessionCount: number;
  readonly sessionRevoked: boolean;
}

export async function changePassword(
  db: PostgresJsDatabase,
  accountId: AccountId,
  params: unknown,
  audit: AuditWriter,
): Promise<ChangePasswordResult> {
  const parsed = ChangePasswordSchema.parse(params);

  const account = await withAccountRead(db, accountId, async (tx) => {
    const [row] = await tx
      .select({
        authKeyHash: accounts.authKeyHash,
        version: accounts.version,
      })
      .from(accounts)
      .where(eq(accounts.id, accountId))
      .limit(1);
    return row ?? null;
  });

  if (!account) {
    throw new ValidationError(INCORRECT_PASSWORD_ERROR);
  }

  const oldAuthKeyBytes = fromHex(parsed.oldAuthKey);
  assertAuthKey(oldAuthKeyBytes);
  const storedHash = ensureUint8Array(account.authKeyHash);
  assertAuthKeyHash(storedHash);
  const valid = verifyAuthKey(oldAuthKeyBytes, storedHash);
  if (!valid) {
    throw new ValidationError(INCORRECT_PASSWORD_ERROR);
  }

  // Hash the new auth key (BLAKE2B) — server never sees the raw key again after this point
  const newAuthKeyBytes = fromHex(parsed.newAuthKey);
  assertAuthKey(newAuthKeyBytes);
  const newAuthKeyHash = hashAuthKey(newAuthKeyBytes);

  // Client sends the re-wrapped master key blob; server stores it opaquely
  const newEncMasterKeyBytes = fromHex(parsed.newEncryptedMasterKey);

  // Look up the signing public key for challenge verification
  const [signingKey] = await withAccountRead(db, accountId, async (tx) => {
    return tx
      .select({ publicKey: authKeys.publicKey })
      .from(authKeys)
      .where(and(eq(authKeys.accountId, accountId), eq(authKeys.keyType, "signing")))
      .limit(1);
  });

  if (!signingKey) {
    throw new ValidationError("No signing key found");
  }

  const sigPublicKey = ensureUint8Array(signingKey.publicKey);
  assertSignPublicKey(sigPublicKey);

  const signatureBytes = fromHex(parsed.challengeSignature);
  assertSignature(signatureBytes);

  // Client signs the new auth key hash as proof of key derivation
  const signatureValid = verify(newAuthKeyHash, signatureBytes, sigPublicKey);
  if (!signatureValid) {
    throw new ValidationError("Invalid challenge signature");
  }

  const timestamp = now();

  const revokedSessionCount = await withAccountTransaction(db, accountId, async (tx) => {
    const updated = await tx
      .update(accounts)
      .set({
        authKeyHash: newAuthKeyHash,
        kdfSalt: parsed.newKdfSalt,
        encryptedMasterKey: newEncMasterKeyBytes,
        updatedAt: timestamp,
        version: account.version + 1,
      })
      .where(and(eq(accounts.id, accountId), eq(accounts.version, account.version)))
      .returning({ id: accounts.id });

    if (updated.length === 0) {
      throw new ConcurrencyError("Account was modified concurrently");
    }

    // Revoke ALL sessions (forces re-auth on every device)
    const revoked = await tx
      .update(sessions)
      .set({ revoked: true })
      .where(and(eq(sessions.accountId, accountId), eq(sessions.revoked, false)))
      .returning({ id: sessions.id });

    await audit(tx, {
      eventType: "auth.password-changed",
      actor: { kind: "account", id: accountId },
      detail: `Password changed, all ${String(revoked.length)} sessions revoked`,
    });

    return revoked.length;
  });

  return { ok: true, revokedSessionCount, sessionRevoked: revokedSessionCount > 0 };
}

// ── Update Account Settings ──────────────────────────────────────

export interface UpdateAccountSettingsResult {
  readonly ok: true;
  readonly auditLogIpTracking: boolean;
  readonly version: number;
}

export async function updateAccountSettings(
  db: PostgresJsDatabase,
  accountId: AccountId,
  params: unknown,
  audit: AuditWriter,
): Promise<UpdateAccountSettingsResult> {
  const parsed = UpdateAccountSettingsSchema.parse(params);

  const timestamp = now();

  const updated = await withAccountTransaction(db, accountId, async (tx) => {
    const [row] = await tx
      .update(accounts)
      .set({
        auditLogIpTracking: parsed.auditLogIpTracking,
        updatedAt: timestamp,
        version: parsed.version + 1,
      })
      .where(and(eq(accounts.id, accountId), eq(accounts.version, parsed.version)))
      .returning({
        auditLogIpTracking: accounts.auditLogIpTracking,
        version: accounts.version,
      });

    if (!row) {
      throw new ConcurrencyError("Account was modified concurrently");
    }

    const detail = parsed.auditLogIpTracking
      ? "Audit log IP tracking enabled"
      : "Audit log IP tracking disabled";

    await audit(tx, {
      eventType: "settings.changed",
      actor: { kind: "account", id: accountId },
      detail,
      overrideTrackIp: parsed.auditLogIpTracking,
    });

    return row;
  });

  return {
    ok: true,
    auditLogIpTracking: updated.auditLogIpTracking,
    version: updated.version,
  };
}

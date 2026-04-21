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
import { accounts, authKeys, sessions, systems } from "@pluralscape/db/pg";
import { brandId, now, toUnixMillis } from "@pluralscape/types";
import {
  ChangeEmailSchema,
  ChangePasswordSchema,
  UpdateAccountSettingsSchema,
} from "@pluralscape/validation";
import { and, eq } from "drizzle-orm";

import { ensureUint8Array } from "../lib/binary.js";
import { hashEmail } from "../lib/email-hash.js";
import { resolveAccountEmail } from "../lib/email-resolve.js";
import { fromHex, toHex } from "../lib/hex.js";
import { logger } from "../lib/logger.js";
import { withAccountRead, withAccountTransaction } from "../lib/rls-context.js";
import {
  buildAccountEmailChangeIdempotencyKey,
  EMAIL_CHANGE_FAILED_ERROR,
} from "../routes/account/account.constants.js";
import { EMAIL_SALT_BYTES } from "../routes/auth/auth.constants.js";

import { isDuplicateEmailError, ValidationError } from "./auth/register.js";
import { INCORRECT_PASSWORD_ERROR } from "./auth.constants.js";

import type { AuditWriter } from "../lib/audit-writer.js";
import type { JobQueue } from "@pluralscape/queue";
import type { AccountId, AccountType, SystemId, UnixMillis } from "@pluralscape/types";
import type { PostgresJsDatabase } from "drizzle-orm/postgres-js";

// ── Get Account Info ──────────────────────────────────────────────

export interface AccountInfo {
  readonly accountId: AccountId;
  readonly accountType: AccountType;
  readonly systemId: SystemId | null;
  readonly auditLogIpTracking: boolean;
  readonly version: number;
  readonly createdAt: UnixMillis;
  readonly updatedAt: UnixMillis;
}

export async function getAccountInfo(
  db: PostgresJsDatabase,
  accountId: AccountId,
): Promise<AccountInfo | null> {
  return withAccountRead(db, accountId, async (tx) => {
    const [row] = await tx
      .select({
        accountId: accounts.id,
        accountType: accounts.accountType,
        auditLogIpTracking: accounts.auditLogIpTracking,
        version: accounts.version,
        createdAt: accounts.createdAt,
        updatedAt: accounts.updatedAt,
      })
      .from(accounts)
      .where(eq(accounts.id, accountId))
      .limit(1);

    if (!row) return null;

    let systemId: SystemId | null = null;
    if (row.accountType === "system") {
      const [system] = await tx
        .select({ id: systems.id })
        .from(systems)
        .where(eq(systems.accountId, accountId))
        .limit(1);
      systemId = system ? brandId<SystemId>(system.id) : null;
    }

    return {
      accountId: brandId<AccountId>(row.accountId),
      accountType: row.accountType,
      systemId,
      auditLogIpTracking: row.auditLogIpTracking,
      version: row.version,
      createdAt: toUnixMillis(row.createdAt),
      updatedAt: toUnixMillis(row.updatedAt),
    };
  });
}

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

// ── Email Change Notification ─────────────────────────────────────

/** Arguments describing which notification to enqueue. */
export interface EnqueueAccountEmailChangedNotificationArgs {
  readonly accountId: AccountId;
  /** Plaintext prior address. `null` disables the enqueue. */
  readonly oldEmail: string | null;
  /** Plaintext new address (post-change). */
  readonly newEmail: string;
  /** Post-change `accounts.version` — the idempotency-key suffix. */
  readonly version: number;
  /** Caller IP, surfaced in the template vars when non-null. */
  readonly ipAddress: string | null;
}

/**
 * Fire-and-forget enqueue of the `account-change-email` notification to the
 * OLD email address after a successful email change.
 *
 * Short-circuits when (a) the queue is null (local dev / queue disabled) or
 * (b) `oldEmail` is null (unresolvable via `resolveAccountEmail`). Enqueue
 * failures are caught, logged, and persisted as an audit event under the
 * `auth.email-change-notification-enqueue-failed` type so SOC/IR tooling can
 * query per-account for a missed breach-alert signal.
 *
 * Idempotency: keyed on `accountId + version`. Retries of the same change
 * produce identical keys and deduplicate; a later legitimate change bumps
 * `version` and gets its own key.
 *
 * `db` is only consulted if the enqueue fails (to write the audit row). It is
 * deliberately a positional parameter so callers do not nest the connection
 * handle inside the args shape that tests assert against.
 *
 * This helper never throws — callers should `void` the returned promise.
 */
export async function enqueueAccountEmailChangedNotification(
  queue: JobQueue | null,
  audit: AuditWriter,
  db: PostgresJsDatabase,
  args: EnqueueAccountEmailChangedNotificationArgs,
): Promise<void> {
  if (!queue || !args.oldEmail) return;

  const { accountId, oldEmail, newEmail, version, ipAddress } = args;

  try {
    await queue.enqueue({
      type: "email-send",
      systemId: null,
      payload: {
        accountId,
        template: "account-change-email",
        vars: {
          oldEmail,
          newEmail,
          timestamp: new Date().toISOString(),
          ...(ipAddress ? { ipAddress } : {}),
        },
        recipientOverride: oldEmail,
      },
      idempotencyKey: buildAccountEmailChangeIdempotencyKey(accountId, version),
    });
  } catch (err: unknown) {
    const errorMessage = err instanceof Error ? err.message : String(err);
    logger.warn("[account-notify] change-email enqueue failed", {
      accountId,
      error: errorMessage,
    });
    // Persist a forensic trail so ops can query which accounts missed a
    // breach-alert signal. Swallow secondary failures — we are already in a
    // fire-and-forget path and cannot surface errors to the caller.
    try {
      await audit(db, {
        eventType: "auth.email-change-notification-enqueue-failed",
        actor: { kind: "account", id: accountId },
        detail: `Enqueue failed: ${errorMessage}`,
      });
    } catch (auditErr: unknown) {
      const auditMessage = auditErr instanceof Error ? auditErr.message : String(auditErr);
      logger.error("[account-notify] audit write failed after enqueue failure", {
        accountId,
        error: auditMessage,
      });
    }
  }
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

// ── Helpers ───────────────────────────────────────────────────────

export class ConcurrencyError extends Error {
  override readonly name = "ConcurrencyError" as const;
}

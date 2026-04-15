import {
  AUTH_KEY_HASH_BYTES,
  assertSignPublicKey,
  assertSignature,
  generateChallengeNonce,
  generateSalt,
  getSodium,
  hashAuthKey,
  verifyAuthKey,
  verifyChallenge,
} from "@pluralscape/crypto";
import { accounts, authKeys, recoveryKeys, sessions, systems } from "@pluralscape/db/pg";
import { ID_PREFIXES, SESSION_TIMEOUTS, createId, now, toUnixMillis } from "@pluralscape/types";
import {
  LoginSchema,
  RegistrationCommitSchema,
  RegistrationInitiateSchema,
} from "@pluralscape/validation";
import { and, asc, eq, gt, isNotNull, isNull, lt, ne, or, sql } from "drizzle-orm";

import { equalizeAntiEnumTiming } from "../lib/anti-enum-timing.js";
import { encryptEmail, getEmailEncryptionKey } from "../lib/email-encrypt.js";
import { hashEmail } from "../lib/email-hash.js";
import { fromHex, toHex } from "../lib/hex.js";
import { toCursor } from "../lib/pagination.js";
import { withAccountRead, withAccountTransaction } from "../lib/rls-context.js";
import { buildIdleTimeoutFilter } from "../lib/session-idle-filter.js";
import { generateSessionToken, hashSessionToken } from "../lib/session-token.js";
import { isUniqueViolation } from "../lib/unique-violation.js";
import { getAccountLoginStore } from "../middleware/stores/account-login-store.js";
import { MAX_SESSIONS_PER_ACCOUNT } from "../quota.constants.js";
import {
  CHALLENGE_NONCE_TTL_MS,
  DEFAULT_SESSION_LIMIT,
  EMAIL_SALT_BYTES,
  MAX_SESSION_LIMIT,
} from "../routes/auth/auth.constants.js";

import { ANTI_ENUM_SENTINEL_ACCOUNT_ID } from "./auth.constants.js";

import type { AuditWriter } from "../lib/audit-writer.js";
import type { AppLogger } from "../lib/logger.js";
import type { ClientPlatform } from "../routes/auth/auth.constants.js";
import type { PaginationCursor } from "@pluralscape/types";
import type { AccountId, AccountType, SystemId, UnixMillis } from "@pluralscape/types";
import type { PostgresJsDatabase } from "drizzle-orm/postgres-js";

// ── Registration Phase 1: Initiate ────────────────────────────────

export interface RegistrationInitiateResult {
  readonly accountId: string;
  readonly kdfSalt: string;
  readonly challengeNonce: string;
}

export async function initiateRegistration(
  db: PostgresJsDatabase,
  params: unknown,
): Promise<RegistrationInitiateResult> {
  const startTime = performance.now();

  const parsed = RegistrationInitiateSchema.parse(params);

  const accountType = parsed.accountType;
  const emailHash = hashEmail(parsed.email);
  const adapter = getSodium();

  const emailSalt = toHex(adapter.randomBytes(EMAIL_SALT_BYTES));
  const kdfSalt = generateSalt();
  const challengeNonce = generateChallengeNonce();
  const challengeExpiresAt = now() + CHALLENGE_NONCE_TTL_MS;

  // Placeholder: 32 zero bytes indicate incomplete registration
  const placeholderAuthKeyHash = new Uint8Array(AUTH_KEY_HASH_BYTES);
  // Empty encrypted master key placeholder
  const placeholderEncryptedMasterKey = new Uint8Array(0);

  // Encrypt email for server-side storage (null if key not configured)
  const encryptedEmailBytes = getEmailEncryptionKey() ? encryptEmail(parsed.email) : null;

  const accountId = createId(ID_PREFIXES.account);
  const kdfSaltHex = toHex(kdfSalt);
  const timestamp = now();

  try {
    await withAccountTransaction(db, accountId as AccountId, async (tx) => {
      await tx.insert(accounts).values({
        id: accountId,
        accountType,
        emailHash,
        emailSalt,
        authKeyHash: placeholderAuthKeyHash,
        kdfSalt: kdfSaltHex,
        encryptedMasterKey: placeholderEncryptedMasterKey,
        challengeNonce,
        challengeExpiresAt,
        encryptedEmail: encryptedEmailBytes,
        createdAt: timestamp,
        updatedAt: timestamp,
      });
    });
  } catch (error: unknown) {
    if (isDuplicateEmailError(error)) {
      // Check if the existing account is an abandoned placeholder
      const [existing] = await db
        .select({
          id: accounts.id,
          authKeyHash: accounts.authKeyHash,
          challengeExpiresAt: accounts.challengeExpiresAt,
        })
        .from(accounts)
        .where(eq(accounts.emailHash, emailHash))
        .limit(1);

      if (existing) {
        const isPlaceholder = existing.authKeyHash.every((b) => b === 0);
        const isExpired =
          existing.challengeExpiresAt !== null && existing.challengeExpiresAt < now();

        if (isPlaceholder && isExpired) {
          // Delete the abandoned placeholder and retry
          await db.delete(accounts).where(eq(accounts.id, existing.id));
          return initiateRegistration(db, params);
        }
      }

      // Real account or unexpired placeholder — anti-enum fake response
      await equalizeAntiEnumTiming(startTime);
      return {
        accountId: createId(ID_PREFIXES.account),
        kdfSalt: toHex(generateSalt()),
        challengeNonce: toHex(generateChallengeNonce()),
      };
    }
    throw error;
  }

  await equalizeAntiEnumTiming(startTime);
  return {
    accountId,
    kdfSalt: kdfSaltHex,
    challengeNonce: toHex(challengeNonce),
  };
}

// ── Registration Phase 2: Commit ──────────────────────────────────

export interface RegistrationCommitResult {
  readonly sessionToken: string;
  readonly accountId: string;
  readonly accountType: AccountType;
}

export async function commitRegistration(
  db: PostgresJsDatabase,
  params: unknown,
  platform: ClientPlatform,
  audit: AuditWriter,
): Promise<RegistrationCommitResult> {
  const parsed = RegistrationCommitSchema.parse(params);

  if (!parsed.recoveryKeyBackupConfirmed) {
    throw new ValidationError("Recovery key backup must be confirmed");
  }

  // Look up the account shell created in phase 1
  const [account] = await db
    .select()
    .from(accounts)
    .where(eq(accounts.id, parsed.accountId))
    .limit(1);

  if (!account) {
    throw new ValidationError("Invalid or expired registration");
  }

  // Verify registration is still in phase 1 (placeholder auth key hash = all zeros)
  const isPlaceholder = account.authKeyHash.every((b) => b === 0);
  if (!isPlaceholder) {
    throw new ValidationError("Registration already completed");
  }

  // Verify challenge nonce hasn't expired
  if (!account.challengeNonce || !account.challengeExpiresAt) {
    throw new ValidationError("Invalid or expired registration");
  }
  if (account.challengeExpiresAt < now()) {
    throw new ValidationError("Registration challenge expired");
  }

  // Verify challenge signature against the provided public signing key
  const publicSigningKeyBytes = fromHex(parsed.publicSigningKey);
  assertSignPublicKey(publicSigningKeyBytes);

  const signatureBytes = fromHex(parsed.challengeSignature);
  assertSignature(signatureBytes);

  const signatureValid = verifyChallenge(
    account.challengeNonce,
    signatureBytes,
    publicSigningKeyBytes,
  );
  if (!signatureValid) {
    throw new ValidationError("Invalid challenge signature");
  }

  // Hash the auth key for storage
  const authKeyHash = hashAuthKey(fromHex(parsed.authKey));

  // Decode all encrypted blobs from hex; public keys are base64url-encoded
  const encryptedMasterKeyBytes = fromHex(parsed.encryptedMasterKey);
  const encSignPrivKeyBytes = fromHex(parsed.encryptedSigningPrivateKey);
  const encEncPrivKeyBytes = fromHex(parsed.encryptedEncryptionPrivateKey);
  const publicEncKeyBytes = fromHex(parsed.publicEncryptionKey);
  const recoveryEncMasterKeyBytes = fromHex(parsed.recoveryEncryptedMasterKey);

  const sessionId = createId(ID_PREFIXES.session);
  const rawToken = generateSessionToken();
  const tokenHash = hashSessionToken(rawToken);
  const timestamp = now();
  const timeouts = SESSION_TIMEOUTS[platform];
  const expiresAt = timestamp + timeouts.absoluteTtlMs;

  await withAccountTransaction(db, account.id as AccountId, async (tx) => {
    // Fill in the account shell with real crypto data
    // TOCTOU guard: isNotNull(challengeNonce) ensures concurrent commits can't both succeed
    const updated = await tx
      .update(accounts)
      .set({
        authKeyHash,
        encryptedMasterKey: encryptedMasterKeyBytes,
        challengeNonce: null,
        challengeExpiresAt: null,
        updatedAt: timestamp,
      })
      .where(and(eq(accounts.id, account.id), isNotNull(accounts.challengeNonce)))
      .returning({ id: accounts.id });

    if (updated.length === 0) {
      throw new ValidationError("Registration already completed");
    }

    if (account.accountType === "system") {
      await tx.insert(systems).values({
        id: createId(ID_PREFIXES.system),
        accountId: account.id,
        createdAt: timestamp,
        updatedAt: timestamp,
      });
    }

    await tx.insert(authKeys).values([
      {
        id: createId(ID_PREFIXES.authKey),
        accountId: account.id,
        encryptedPrivateKey: encEncPrivKeyBytes,
        publicKey: publicEncKeyBytes,
        keyType: "encryption",
        createdAt: timestamp,
      },
      {
        id: createId(ID_PREFIXES.authKey),
        accountId: account.id,
        encryptedPrivateKey: encSignPrivKeyBytes,
        publicKey: publicSigningKeyBytes,
        keyType: "signing",
        createdAt: timestamp,
      },
    ]);

    await tx.insert(recoveryKeys).values({
      id: createId(ID_PREFIXES.recoveryKey),
      accountId: account.id,
      encryptedMasterKey: recoveryEncMasterKeyBytes,
      createdAt: timestamp,
    });

    await tx.insert(sessions).values({
      id: sessionId,
      accountId: account.id,
      tokenHash,
      createdAt: timestamp,
      lastActive: timestamp,
      expiresAt,
    });

    await audit(tx, {
      eventType: "auth.register",
      actor: { kind: "account", id: account.id },
      detail: "Account registered",
      accountId: account.id as AccountId,
    });
  });

  return {
    sessionToken: rawToken,
    accountId: account.id,
    accountType: account.accountType,
  };
}

// ── Login ──────────────────────────────────────────────────────────

export interface LoginResult {
  readonly sessionToken: string;
  readonly accountId: string;
  readonly systemId: string | null;
  readonly accountType: AccountType;
  readonly encryptedMasterKey: string;
  readonly kdfSalt: string;
}

export async function loginAccount(
  db: PostgresJsDatabase,
  credentials: unknown,
  platform: ClientPlatform,
  audit: AuditWriter,
  log: AppLogger,
): Promise<LoginResult | null> {
  const startTime = performance.now();
  const parsed = LoginSchema.parse(credentials);
  const emailHash = hashEmail(parsed.email);

  // Check throttle BEFORE DB lookup, keyed on emailHash (not account.id)
  // to prevent account existence enumeration via 429 vs 401 responses
  const loginStore = getAccountLoginStore();
  const throttleState = await loginStore.check(emailHash);
  if (throttleState.throttled) {
    throw new LoginThrottledError(throttleState.windowResetAt);
  }

  // Pre-auth lookup by emailHash — intentionally outside RLS (no accountId known yet)
  const [account] = await db
    .select()
    .from(accounts)
    .where(eq(accounts.emailHash, emailHash))
    .limit(1);

  if (!account) {
    // Anti-enumeration: compute a dummy hash to equalize timing
    hashAuthKey(getSodium().randomBytes(AUTH_KEY_HASH_BYTES));
    // Record failure for throttling
    try {
      await loginStore.recordFailure(emailHash);
    } catch (throttleErr: unknown) {
      log.error(
        "Failed to record login failure for throttle",
        throttleErr instanceof Error ? { err: throttleErr } : { error: String(throttleErr) },
      );
    }
    // Fire-and-forget audit
    void audit(db, {
      eventType: "auth.login-failed",
      actor: { kind: "account", id: ANTI_ENUM_SENTINEL_ACCOUNT_ID },
      detail: "Account not found",
    }).catch((auditError: unknown) => {
      log.error("[audit] Failed to write auth.login-failed:", {
        err: auditError instanceof Error ? auditError : { message: String(auditError) },
      });
    });
    await equalizeAntiEnumTiming(startTime);
    return null;
  }

  // Verify auth key: BLAKE2B(auth_key) vs stored hash
  const valid = verifyAuthKey(fromHex(parsed.authKey), account.authKeyHash);
  if (!valid) {
    // Record failed attempt
    try {
      await loginStore.recordFailure(emailHash);
    } catch (throttleErr: unknown) {
      log.error(
        "Failed to record login failure for throttle",
        throttleErr instanceof Error ? { err: throttleErr } : { error: String(throttleErr) },
      );
    }

    // Fire-and-forget audit
    void audit(db, {
      eventType: "auth.login-failed",
      actor: { kind: "account", id: account.id },
      detail: "Invalid auth key",
      accountId: account.id as AccountId,
      overrideTrackIp: account.auditLogIpTracking,
    }).catch((auditError: unknown) => {
      log.error(
        "Failed to write auth.login-failed audit event",
        auditError instanceof Error ? { err: auditError } : { error: String(auditError) },
      );
    });
    await equalizeAntiEnumTiming(startTime);
    return null;
  }

  // Successful login: reset the throttle counter.
  try {
    await loginStore.reset(emailHash);
  } catch (throttleErr: unknown) {
    log.error(
      "Failed to reset login throttle after successful login",
      throttleErr instanceof Error ? { err: throttleErr } : { error: String(throttleErr) },
    );
  }

  const sessionId = createId(ID_PREFIXES.session);
  const rawToken = generateSessionToken();
  const tokenHash = hashSessionToken(rawToken);
  const timestamp = now();
  const timeouts = SESSION_TIMEOUTS[platform];
  const expiresAt = timestamp + timeouts.absoluteTtlMs;

  const systemId = await withAccountTransaction(db, account.id as AccountId, async (tx) => {
    // Enforce per-account session limit: evict oldest session if at capacity
    const currentTime = now();
    const notExpired = or(isNull(sessions.expiresAt), gt(sessions.expiresAt, currentTime));
    const activeFilter = and(
      eq(sessions.accountId, account.id),
      eq(sessions.revoked, false),
      notExpired,
    );

    // Count active sessions (no lock needed — avoids FOR UPDATE + window function conflict)
    const [countResult] = await tx
      .select({ total: sql<number>`count(*)::int` })
      .from(sessions)
      .where(activeFilter)
      .limit(1);

    if (countResult && countResult.total >= MAX_SESSIONS_PER_ACCOUNT) {
      const [oldest] = await tx
        .select({ id: sessions.id })
        .from(sessions)
        .where(activeFilter)
        .orderBy(asc(sessions.lastActive))
        .for("update", { skipLocked: true })
        .limit(1);

      if (oldest) {
        await tx.update(sessions).set({ revoked: true }).where(eq(sessions.id, oldest.id));
      }
    }

    // System lookup inside the transaction so it uses the RLS context
    let sysId: string | null = null;
    if (account.accountType === "system") {
      const [system] = await tx
        .select({ id: systems.id })
        .from(systems)
        .where(eq(systems.accountId, account.id))
        .limit(1);
      sysId = system?.id ?? null;
    }

    await tx.insert(sessions).values({
      id: sessionId,
      accountId: account.id,
      tokenHash,
      createdAt: timestamp,
      lastActive: timestamp,
      expiresAt,
    });

    await audit(tx, {
      eventType: "auth.login",
      actor: { kind: "account", id: account.id },
      detail: `Login via ${platform}`,
      accountId: account.id as AccountId,
      systemId: sysId as SystemId | null,
      overrideTrackIp: account.auditLogIpTracking,
    });

    return sysId;
  });

  return {
    sessionToken: rawToken,
    accountId: account.id,
    systemId,
    accountType: account.accountType,
    encryptedMasterKey: toHex(account.encryptedMasterKey),
    kdfSalt: account.kdfSalt,
  };
}

// ── Session management ─────────────────────────────────────────────

export interface SessionInfo {
  readonly id: string;
  readonly createdAt: number;
  readonly lastActive: number | null;
  readonly expiresAt: number | null;
}

export async function listSessions(
  db: PostgresJsDatabase,
  accountId: AccountId,
  cursor?: string,
  limit = DEFAULT_SESSION_LIMIT,
): Promise<{ sessions: SessionInfo[]; nextCursor: PaginationCursor | null }> {
  const effectiveLimit = Math.min(limit, MAX_SESSION_LIMIT);

  return withAccountRead(db, accountId, async (tx) => {
    const currentTime = now();
    const notExpired = or(isNull(sessions.expiresAt), gt(sessions.expiresAt, currentTime));

    const conditions = [
      eq(sessions.accountId, accountId),
      eq(sessions.revoked, false),
      notExpired,
      buildIdleTimeoutFilter(currentTime),
    ];
    if (cursor) {
      conditions.push(gt(sessions.id, cursor));
    }

    const rows = await tx
      .select({
        id: sessions.id,
        createdAt: sessions.createdAt,
        lastActive: sessions.lastActive,
        expiresAt: sessions.expiresAt,
      })
      .from(sessions)
      .where(and(...conditions))
      .orderBy(sessions.id)
      .limit(effectiveLimit + 1);

    const hasMore = rows.length > effectiveLimit;
    const result = hasMore ? rows.slice(0, effectiveLimit) : rows;
    const lastId = result[result.length - 1]?.id;
    const nextCursor = hasMore && lastId ? toCursor(lastId) : null;

    return { sessions: result, nextCursor };
  });
}

export async function revokeSession(
  db: PostgresJsDatabase,
  sessionId: string,
  actorAccountId: AccountId,
  audit: AuditWriter,
): Promise<boolean> {
  return withAccountTransaction(db, actorAccountId, async (tx) => {
    const updated = await tx
      .update(sessions)
      .set({ revoked: true })
      .where(
        and(
          eq(sessions.id, sessionId),
          eq(sessions.accountId, actorAccountId),
          eq(sessions.revoked, false),
        ),
      )
      .returning({ id: sessions.id });

    if (updated.length === 0) {
      return false;
    }

    await audit(tx, {
      eventType: "auth.logout",
      actor: { kind: "account", id: actorAccountId },
      detail: `Session ${sessionId} revoked`,
    });

    return true;
  });
}

export async function revokeAllSessions(
  db: PostgresJsDatabase,
  accountId: AccountId,
  exceptSessionId: string,
  audit: AuditWriter,
): Promise<number> {
  return withAccountTransaction(db, accountId, async (tx) => {
    const result = await tx
      .update(sessions)
      .set({ revoked: true })
      .where(
        and(
          eq(sessions.accountId, accountId),
          ne(sessions.id, exceptSessionId),
          eq(sessions.revoked, false),
        ),
      )
      .returning({ id: sessions.id });

    await audit(tx, {
      eventType: "auth.logout",
      actor: { kind: "account", id: accountId },
      detail: `All sessions revoked except ${exceptSessionId} (${String(result.length)} sessions)`,
    });

    return result.length;
  });
}

export async function logoutCurrentSession(
  db: PostgresJsDatabase,
  sessionId: string,
  accountId: AccountId,
  audit: AuditWriter,
): Promise<void> {
  await withAccountTransaction(db, accountId, async (tx) => {
    await tx
      .update(sessions)
      .set({ revoked: true })
      .where(and(eq(sessions.id, sessionId), eq(sessions.accountId, accountId)));

    await audit(tx, {
      eventType: "auth.logout",
      actor: { kind: "account", id: accountId },
      detail: "Logged out",
    });
  });
}

// ── Cleanup ──────────────────────────────────────────────────────

/**
 * Delete abandoned registration placeholders.
 *
 * An abandoned placeholder has an all-zero authKeyHash (never committed)
 * and an expired challenge nonce. Safe to call on a schedule.
 */
export async function cleanupExpiredRegistrations(db: PostgresJsDatabase): Promise<number> {
  const threshold = now();
  const zeroes = new Uint8Array(AUTH_KEY_HASH_BYTES);

  const deleted = await db
    .delete(accounts)
    .where(and(eq(accounts.authKeyHash, zeroes), lt(accounts.challengeExpiresAt, threshold)))
    .returning({ id: accounts.id });

  return deleted.length;
}

// ── Helpers ────────────────────────────────────────────────────────

class ValidationError extends Error {
  override readonly name = "ValidationError" as const;
}

/** Thrown when an account exceeds the failed login attempt threshold. */
class LoginThrottledError extends Error {
  override readonly name = "LoginThrottledError" as const;
  /** UnixMillis when the throttle window resets. */
  readonly windowResetAt: UnixMillis;

  constructor(windowResetAt: number) {
    super("Too many failed login attempts");
    this.windowResetAt = toUnixMillis(windowResetAt);
  }
}

export { LoginThrottledError, ValidationError };

export function isDuplicateEmailError(error: unknown): boolean {
  if (!isUniqueViolation(error)) return false;
  // constraint_name may be on the error itself (raw driver) or on .cause (DrizzleQueryError wrapper)
  const targets = [error, error instanceof Error ? error.cause : undefined].filter(Boolean);
  return targets.some(
    (e) =>
      typeof e === "object" &&
      e !== null &&
      "constraint_name" in e &&
      (e as { constraint_name: string }).constraint_name === "accounts_email_hash_idx",
  );
}

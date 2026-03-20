import {
  PWHASH_OPSLIMIT_SENSITIVE,
  derivePasswordKey,
  encryptPrivateKey,
  generateIdentityKeypair,
  generateMasterKey,
  generateRecoveryKey,
  generateSalt,
  getSodium,
  hashPassword,
  serializePublicKey,
  verifyPassword,
  wrapMasterKey,
} from "@pluralscape/crypto";
import { accounts, authKeys, recoveryKeys, sessions, systems } from "@pluralscape/db/pg";
import { ID_PREFIXES, SESSION_TIMEOUTS, createId, now } from "@pluralscape/types";
import { LoginCredentialsSchema, RegistrationInputSchema } from "@pluralscape/validation";
import { and, eq, gt, isNull, ne, or } from "drizzle-orm";

import { hashEmail } from "../lib/email-hash.js";
import { serializeEncryptedPayload } from "../lib/encrypted-payload.js";
import { toHex } from "../lib/hex.js";
import { buildIdleTimeoutFilter } from "../lib/session-idle-filter.js";
import { generateSessionToken, hashSessionToken } from "../lib/session-token.js";
import { isUniqueViolation } from "../lib/unique-violation.js";
import { getAccountLoginStore } from "../middleware/stores/account-login-store.js";
import {
  ANTI_ENUM_TARGET_MS,
  DEFAULT_SESSION_LIMIT,
  DUMMY_ARGON2_HASH,
  EMAIL_SALT_BYTES,
  MAX_SESSION_LIMIT,
  RECOVERY_KEY_GROUP_COUNT,
  RECOVERY_KEY_GROUP_SIZE,
} from "../routes/auth/auth.constants.js";

import { ANTI_ENUM_SENTINEL_ACCOUNT_ID } from "./auth.constants.js";

import type { AuditWriter } from "../lib/audit-writer.js";
import type { AppLogger } from "../lib/logger.js";
import type { ClientPlatform } from "../routes/auth/auth.constants.js";
import type { AccountId, AccountType, SystemId, UnixMillis } from "@pluralscape/types";
import type { PostgresJsDatabase } from "drizzle-orm/postgres-js";

// ── Registration ───────────────────────────────────────────────────

export interface RegistrationResult {
  readonly sessionToken: string;
  readonly recoveryKey: string;
  readonly accountId: string;
  readonly accountType: AccountType;
}

export async function registerAccount(
  db: PostgresJsDatabase,
  params: unknown,
  platform: ClientPlatform,
  audit: AuditWriter,
): Promise<RegistrationResult> {
  const startTime = performance.now();

  const parsed = RegistrationInputSchema.parse(params);

  if (!parsed.recoveryKeyBackupConfirmed) {
    throw new ValidationError("Recovery key backup must be confirmed");
  }

  const accountType = parsed.accountType;
  const emailHash = hashEmail(parsed.email);
  const adapter = getSodium();

  // Generate all cryptographic material
  const emailSalt = toHex(adapter.randomBytes(EMAIL_SALT_BYTES));
  const kdfSalt = generateSalt();
  const passwordHash = hashPassword(parsed.password, "server");
  const masterKey = generateMasterKey();

  let passwordKey: Awaited<ReturnType<typeof derivePasswordKey>> | undefined;
  let keypair: ReturnType<typeof generateIdentityKeypair> | undefined;
  let encryptedMasterKey, encryptedEncPrivateKey, encryptedSignPrivateKey, recovery;
  try {
    passwordKey = await derivePasswordKey(parsed.password, kdfSalt, "server");
    encryptedMasterKey = wrapMasterKey(masterKey, passwordKey);
    keypair = generateIdentityKeypair(masterKey);
    encryptedEncPrivateKey = encryptPrivateKey(keypair.encryption.secretKey, masterKey);
    encryptedSignPrivateKey = encryptPrivateKey(keypair.signing.secretKey, masterKey);
    recovery = generateRecoveryKey(masterKey);
  } finally {
    adapter.memzero(masterKey);
    if (passwordKey) adapter.memzero(passwordKey);
    if (keypair) {
      adapter.memzero(keypair.encryption.secretKey);
      adapter.memzero(keypair.signing.secretKey);
    }
  }

  // Serialize keys for DB storage
  const kdfSaltHex = toHex(kdfSalt);
  const encMasterKeyBytes = serializeEncryptedPayload(encryptedMasterKey);
  const encEncPrivKeyBytes = serializeEncryptedPayload(encryptedEncPrivateKey);
  const encSignPrivKeyBytes = serializeEncryptedPayload(encryptedSignPrivateKey);
  const recoveryEncMasterKeyBytes = serializeEncryptedPayload(recovery.encryptedMasterKey);

  const accountId = createId(ID_PREFIXES.account);
  const sessionId = createId(ID_PREFIXES.session);
  const rawToken = generateSessionToken();
  const tokenHash = hashSessionToken(rawToken);
  const timestamp = now();
  const timeouts = SESSION_TIMEOUTS[platform];
  const expiresAt = timestamp + timeouts.absoluteTtlMs;

  try {
    await db.transaction(async (tx) => {
      await tx.insert(accounts).values({
        id: accountId,
        accountType,
        emailHash,
        emailSalt,
        passwordHash,
        kdfSalt: kdfSaltHex,
        encryptedMasterKey: encMasterKeyBytes,
        createdAt: timestamp,
        updatedAt: timestamp,
      });

      if (accountType === "system") {
        await tx.insert(systems).values({
          id: createId(ID_PREFIXES.system),
          accountId,
          createdAt: timestamp,
          updatedAt: timestamp,
        });
      }

      await tx.insert(authKeys).values([
        {
          id: createId(ID_PREFIXES.authKey),
          accountId,
          encryptedPrivateKey: encEncPrivKeyBytes,
          publicKey: new TextEncoder().encode(serializePublicKey(keypair.encryption.publicKey)),
          keyType: "encryption",
          createdAt: timestamp,
        },
        {
          id: createId(ID_PREFIXES.authKey),
          accountId,
          encryptedPrivateKey: encSignPrivKeyBytes,
          publicKey: new TextEncoder().encode(serializePublicKey(keypair.signing.publicKey)),
          keyType: "signing",
          createdAt: timestamp,
        },
      ]);

      await tx.insert(recoveryKeys).values({
        id: createId(ID_PREFIXES.recoveryKey),
        accountId,
        encryptedMasterKey: recoveryEncMasterKeyBytes,
        createdAt: timestamp,
      });

      await tx.insert(sessions).values({
        id: sessionId,
        accountId,
        tokenHash,
        createdAt: timestamp,
        lastActive: timestamp,
        expiresAt,
      });

      await audit(tx, {
        eventType: "auth.register",
        actor: { kind: "account", id: accountId },
        detail: "Account registered",
        accountId: accountId as AccountId,
      });
    });
  } catch (error: unknown) {
    // Anti-enumeration: if email already exists (unique constraint), return a fake success
    if (isDuplicateEmailError(error)) {
      const elapsed = performance.now() - startTime;
      const remaining = ANTI_ENUM_TARGET_MS - elapsed;
      if (remaining > 0) {
        await new Promise<void>((resolve) => setTimeout(resolve, remaining));
      }
      const fakeToken = generateSessionToken();
      hashSessionToken(fakeToken); // match timing of real path
      return {
        sessionToken: fakeToken,
        recoveryKey: generateFakeRecoveryKey(),
        accountId: createId(ID_PREFIXES.account),
        accountType,
      };
    }
    throw error;
  }

  return {
    sessionToken: rawToken,
    recoveryKey: recovery.displayKey,
    accountId,
    accountType,
  };
}

// ── Login ──────────────────────────────────────────────────────────

export interface LoginResult {
  readonly sessionToken: string;
  readonly accountId: string;
  readonly systemId: string | null;
  readonly accountType: AccountType;
}

export async function loginAccount(
  db: PostgresJsDatabase,
  credentials: unknown,
  platform: ClientPlatform,
  audit: AuditWriter,
  log: AppLogger,
): Promise<LoginResult | null> {
  const parsed = LoginCredentialsSchema.parse(credentials);
  const emailHash = hashEmail(parsed.email);

  // Check throttle BEFORE DB lookup, keyed on emailHash (not account.id)
  // to prevent account existence enumeration via 429 vs 401 responses
  const loginStore = getAccountLoginStore();
  const throttleState = await loginStore.check(emailHash);
  if (throttleState.throttled) {
    throw new LoginThrottledError(throttleState.windowResetAt);
  }

  const [account] = await db
    .select()
    .from(accounts)
    .where(eq(accounts.emailHash, emailHash))
    .limit(1);

  if (!account) {
    // Anti-enumeration: run verification against dummy hash to equalize timing
    try {
      verifyPassword(DUMMY_ARGON2_HASH, parsed.password);
    } catch (err: unknown) {
      log.error(
        "Unexpected verifyPassword error during anti-enumeration",
        err instanceof Error ? { err } : { error: String(err) },
      );
    }
    // Record failure for throttling on non-existent accounts too
    void loginStore.recordFailure(emailHash).catch((throttleErr: unknown) => {
      log.error(
        "Failed to record login failure for throttle",
        throttleErr instanceof Error ? { err: throttleErr } : { error: String(throttleErr) },
      );
    });
    // Fire-and-forget: match timing of the "invalid password" branch which writes an audit event.
    // Uses a zeroed account ID since no real account exists for this email.
    void audit(db, {
      eventType: "auth.login-failed",
      actor: { kind: "account", id: ANTI_ENUM_SENTINEL_ACCOUNT_ID },
      detail: "Account not found",
    }).catch((auditError: unknown) => {
      log.error("[audit] Failed to write auth.login-failed:", {
        err: auditError instanceof Error ? auditError : { message: String(auditError) },
      });
    });
    return null;
  }

  const valid = verifyPassword(account.passwordHash, parsed.password);
  if (!valid) {
    // Record failed attempt for throttling
    await loginStore.recordFailure(emailHash);

    // Fire-and-forget: we don't block the response on audit writes for failed attempts.
    void audit(db, {
      eventType: "auth.login-failed",
      actor: { kind: "account", id: account.id },
      detail: "Invalid password",
      accountId: account.id as AccountId,
    }).catch((auditError: unknown) => {
      log.error(
        "Failed to write auth.login-failed audit event",
        auditError instanceof Error ? { err: auditError } : { error: String(auditError) },
      );
    });
    return null;
  }

  // Successful login: reset the throttle counter
  await loginStore.reset(emailHash);

  // Fire-and-forget: rehash password if it uses old params
  if (needsRehash(account.passwordHash)) {
    const newHash = hashPassword(parsed.password, "server");
    void db
      .update(accounts)
      .set({ passwordHash: newHash, updatedAt: now() })
      .where(and(eq(accounts.id, account.id), eq(accounts.passwordHash, account.passwordHash)))
      .then(() => {
        log.info("Rehashed password to current params", { accountId: account.id });
      })
      .catch((rehashErr: unknown) => {
        log.error(
          "Failed to rehash password on login",
          rehashErr instanceof Error ? { err: rehashErr } : { error: String(rehashErr) },
        );
      });
  }

  let systemId: string | null = null;
  if (account.accountType === "system") {
    const [system] = await db
      .select({ id: systems.id })
      .from(systems)
      .where(eq(systems.accountId, account.id))
      .limit(1);
    systemId = system?.id ?? null;
  }

  const sessionId = createId(ID_PREFIXES.session);
  const rawToken = generateSessionToken();
  const tokenHash = hashSessionToken(rawToken);
  const timestamp = now();
  const timeouts = SESSION_TIMEOUTS[platform];
  const expiresAt = timestamp + timeouts.absoluteTtlMs;

  await db.transaction(async (tx) => {
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
      systemId: systemId as SystemId | null,
    });
  });

  return {
    sessionToken: rawToken,
    accountId: account.id,
    systemId,
    accountType: account.accountType,
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
  accountId: string,
  cursor?: string,
  limit = DEFAULT_SESSION_LIMIT,
): Promise<{ sessions: SessionInfo[]; nextCursor: string | null }> {
  const effectiveLimit = Math.min(limit, MAX_SESSION_LIMIT);

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

  const rows = await db
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
  const nextCursor = hasMore ? (result[result.length - 1]?.id ?? null) : null;

  return { sessions: result, nextCursor };
}

export async function revokeSession(
  db: PostgresJsDatabase,
  sessionId: string,
  actorAccountId: string,
  audit: AuditWriter,
): Promise<boolean> {
  return db.transaction(async (tx) => {
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
  accountId: string,
  exceptSessionId: string,
  audit: AuditWriter,
): Promise<number> {
  return db.transaction(async (tx) => {
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
  accountId: string,
  audit: AuditWriter,
): Promise<void> {
  await db.transaction(async (tx) => {
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
    this.windowResetAt = windowResetAt as UnixMillis;
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

/**
 * Check whether an Argon2id hash needs rehashing because it was produced
 * with fewer iterations than the current server profile requires.
 * Parses the `t=N` parameter from the standard `$argon2id$v=19$m=...,t=N,...` format.
 */
export function needsRehash(hash: string): boolean {
  const match = /\$argon2id\$v=\d+\$m=\d+,t=(\d+),/.exec(hash);
  if (!match) return false;
  const iterations = Number(match[1]);
  return iterations < PWHASH_OPSLIMIT_SENSITIVE;
}

/** Generate a fake recovery key that looks like a real one for anti-enumeration. */
function generateFakeRecoveryKey(): string {
  const adapter = getSodium();
  const chars = "ABCDEFGHIJKLMNOPQRSTUVWXYZ234567";
  const totalChars = RECOVERY_KEY_GROUP_COUNT * RECOVERY_KEY_GROUP_SIZE;
  const randomBytes = adapter.randomBytes(totalChars);
  const groups: string[] = [];
  let byteIdx = 0;
  for (let g = 0; g < RECOVERY_KEY_GROUP_COUNT; g++) {
    let group = "";
    for (let c = 0; c < RECOVERY_KEY_GROUP_SIZE; c++) {
      const byte = randomBytes[byteIdx++] ?? 0;
      group += chars[byte % chars.length] ?? "A";
    }
    groups.push(group);
  }
  return groups.join("-");
}

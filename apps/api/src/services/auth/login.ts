import {
  AUTH_KEY_HASH_BYTES,
  assertAuthKey,
  assertAuthKeyHash,
  getSodium,
  verifyAuthKey,
} from "@pluralscape/crypto";
import { accounts, sessions, systems } from "@pluralscape/db/pg";
import {
  brandId,
  ID_PREFIXES,
  SESSION_TIMEOUTS,
  createId,
  now,
  toUnixMillis,
} from "@pluralscape/types";
import { LoginSchema } from "@pluralscape/validation";
import { and, asc, eq, gt, isNull, or, sql } from "drizzle-orm";

import { equalizeAntiEnumTiming } from "../../lib/anti-enum-timing.js";
import { ensureUint8Array } from "../../lib/binary.js";
import { hashEmail } from "../../lib/email-hash.js";
import { fromHex, toHex } from "../../lib/hex.js";
import { withAccountTransaction } from "../../lib/rls-context.js";
import { generateSessionToken, hashSessionToken } from "../../lib/session-token.js";
import { getAccountLoginStore } from "../../middleware/stores/account-login-store.js";
import { MAX_SESSIONS_PER_ACCOUNT } from "../../quota.constants.js";
import { ANTI_ENUM_SENTINEL_ACCOUNT_ID } from "../auth.constants.js";

import type { AuditWriter } from "../../lib/audit-writer.js";
import type { AppLogger } from "../../lib/logger.js";
import type { ClientPlatform } from "../../routes/auth/auth.constants.js";
import type { AuthKeyHash, AuthKeyMaterial } from "@pluralscape/crypto";
import type { AccountId, AccountType, SessionId, SystemId, UnixMillis } from "@pluralscape/types";
import type { PostgresJsDatabase } from "drizzle-orm/postgres-js";

// ── Login ──────────────────────────────────────────────────────────

export interface LoginResult {
  readonly sessionToken: string;
  readonly accountId: string;
  readonly systemId: string | null;
  readonly accountType: AccountType;
  /** Hex-encoded encrypted master key blob — opaque E2E-encrypted data the server cannot read. */
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
    .select({
      id: accounts.id,
      emailHash: accounts.emailHash,
      authKeyHash: accounts.authKeyHash,
      accountType: accounts.accountType,
      encryptedMasterKey: accounts.encryptedMasterKey,
      kdfSalt: accounts.kdfSalt,
      auditLogIpTracking: accounts.auditLogIpTracking,
    })
    .from(accounts)
    .where(eq(accounts.emailHash, emailHash))
    .limit(1);

  if (!account) {
    // Anti-enumeration: compute a dummy verify to equalize timing
    const dummyKey = getSodium().randomBytes(AUTH_KEY_HASH_BYTES) as AuthKeyMaterial;
    const dummyHash = getSodium().randomBytes(AUTH_KEY_HASH_BYTES) as AuthKeyHash;
    verifyAuthKey(dummyKey, dummyHash);
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

  // Reject placeholder accounts (phase 1 registrations that never completed)
  const isLoginPlaceholder = account.authKeyHash.every((b) => b === 0);
  if (isLoginPlaceholder) {
    const dummyKey = getSodium().randomBytes(AUTH_KEY_HASH_BYTES) as AuthKeyMaterial;
    const dummyHash = getSodium().randomBytes(AUTH_KEY_HASH_BYTES) as AuthKeyHash;
    verifyAuthKey(dummyKey, dummyHash);
    try {
      await loginStore.recordFailure(emailHash);
    } catch (throttleErr: unknown) {
      log.error(
        "Failed to record login failure for throttle",
        throttleErr instanceof Error ? { err: throttleErr } : { error: String(throttleErr) },
      );
    }
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
  const authKeyBytes = fromHex(parsed.authKey);
  assertAuthKey(authKeyBytes);
  const storedHash = ensureUint8Array(account.authKeyHash);
  assertAuthKeyHash(storedHash);
  const valid = verifyAuthKey(authKeyBytes, storedHash);
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
      accountId: brandId<AccountId>(account.id),
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

  const sessionId = brandId<SessionId>(createId(ID_PREFIXES.session));
  const rawToken = generateSessionToken();
  const tokenHash = hashSessionToken(rawToken);
  const timestamp = now();
  const timeouts = SESSION_TIMEOUTS[platform];
  const expiresAt = toUnixMillis(timestamp + timeouts.absoluteTtlMs);

  const systemId = await withAccountTransaction(db, brandId<AccountId>(account.id), async (tx) => {
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
      accountId: brandId<AccountId>(account.id),
      systemId: sysId ? brandId<SystemId>(sysId) : null,
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

// ── Errors ────────────────────────────────────────────────────────

/** Thrown when an account exceeds the failed login attempt threshold. */
export class LoginThrottledError extends Error {
  override readonly name = "LoginThrottledError" as const;
  /** UnixMillis when the throttle window resets. */
  readonly windowResetAt: UnixMillis;

  constructor(windowResetAt: number) {
    super("Too many failed login attempts");
    this.windowResetAt = toUnixMillis(windowResetAt);
  }
}

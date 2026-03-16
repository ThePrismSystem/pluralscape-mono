import {
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
import { SESSION_TIMEOUTS, createId, now } from "@pluralscape/types";
import { LoginCredentialsSchema, RegistrationInputSchema } from "@pluralscape/validation";
import { and, eq, gt, ne } from "drizzle-orm";

import { writeAuditLog } from "../lib/audit-log.js";
import { hashEmail } from "../lib/email-hash.js";
import {
  AUTH_MIN_PASSWORD_LENGTH,
  CLIENT_PLATFORM_HEADER,
  DEFAULT_PLATFORM,
  DEFAULT_SESSION_LIMIT,
  DUMMY_ARGON2_HASH,
  EMAIL_SALT_BYTES,
  HEX_BYTE_WIDTH,
  HEX_RADIX,
  MAX_SESSION_LIMIT,
  RECOVERY_KEY_GROUP_COUNT,
  RECOVERY_KEY_GROUP_SIZE,
  VALID_PLATFORMS,
} from "../routes/auth/auth.constants.js";

import type { AccountType } from "@pluralscape/types";
import type { PostgresJsDatabase } from "drizzle-orm/postgres-js";
import type { Context } from "hono";

const ID = {
  account: "acct_",
  system: "sys_",
  session: "sess_",
  authKey: "auk_",
  recoveryKey: "rk_",
} as const;

// ── Request metadata extraction ────────────────────────────────────

/** Extract IP address from request context. */
export function extractIpAddress(c: Context): string | null {
  if (process.env["TRUST_PROXY"] === "1") {
    const forwarded = c.req.header("x-forwarded-for");
    const ip = forwarded?.split(",")[0]?.trim();
    if (ip && ip.length > 0) return ip;
  }
  return null;
}

/** Extract user agent from request context. */
export function extractUserAgent(c: Context): string | null {
  return c.req.header("user-agent") ?? null;
}

/** Determine the client platform for session TTL selection. */
export function extractPlatform(c: Context): "web" | "mobile" {
  const header = c.req.header(CLIENT_PLATFORM_HEADER);
  if (header && (VALID_PLATFORMS as readonly string[]).includes(header)) {
    return header as "web" | "mobile";
  }
  return DEFAULT_PLATFORM;
}

// ── Registration ───────────────────────────────────────────────────

export interface RegistrationResult {
  readonly sessionToken: string;
  readonly recoveryKey: string;
  readonly accountId: string;
  readonly accountType: AccountType;
}

export interface RegisterParams {
  readonly email: string;
  readonly password: string;
  readonly recoveryKeyBackupConfirmed: boolean;
  readonly accountType?: AccountType;
}

export async function registerAccount(
  db: PostgresJsDatabase,
  params: RegisterParams,
  platform: "web" | "mobile",
  requestMeta: { ipAddress: string | null; userAgent: string | null },
): Promise<RegistrationResult> {
  const parsed = RegistrationInputSchema.parse({
    email: params.email,
    password: params.password,
    recoveryKeyBackupConfirmed: params.recoveryKeyBackupConfirmed,
  });

  if (!parsed.recoveryKeyBackupConfirmed) {
    throw new ValidationError("Recovery key backup must be confirmed");
  }

  if (parsed.password.length < AUTH_MIN_PASSWORD_LENGTH) {
    throw new ValidationError(
      `Password must be at least ${String(AUTH_MIN_PASSWORD_LENGTH)} characters`,
    );
  }

  const accountType = params.accountType ?? "system";
  const emailHash = hashEmail(parsed.email);
  const adapter = getSodium();

  // Generate all cryptographic material
  const emailSalt = toHex(adapter.randomBytes(EMAIL_SALT_BYTES));
  const kdfSalt = generateSalt();
  const passwordHash = hashPassword(parsed.password, "server");
  const masterKey = generateMasterKey();

  let passwordKey,
    encryptedMasterKey,
    keypair,
    encryptedEncPrivateKey,
    encryptedSignPrivateKey,
    recovery;
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
  }

  // Serialize keys for DB storage
  const kdfSaltHex = toHex(kdfSalt);
  const encMasterKeyBytes = serializeEncryptedPayload(encryptedMasterKey);
  const encEncPrivKeyBytes = serializeEncryptedPayload(encryptedEncPrivateKey);
  const encSignPrivKeyBytes = serializeEncryptedPayload(encryptedSignPrivateKey);
  const recoveryEncMasterKeyBytes = serializeEncryptedPayload(recovery.encryptedMasterKey);

  const accountId = createId(ID.account);
  const sessionId = createId(ID.session);
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
          id: createId(ID.system),
          accountId,
          createdAt: timestamp,
          updatedAt: timestamp,
        });
      }

      await tx.insert(authKeys).values([
        {
          id: createId(ID.authKey),
          accountId,
          encryptedPrivateKey: encEncPrivKeyBytes,
          publicKey: new TextEncoder().encode(serializePublicKey(keypair.encryption.publicKey)),
          keyType: "encryption",
          createdAt: timestamp,
        },
        {
          id: createId(ID.authKey),
          accountId,
          encryptedPrivateKey: encSignPrivKeyBytes,
          publicKey: new TextEncoder().encode(serializePublicKey(keypair.signing.publicKey)),
          keyType: "signing",
          createdAt: timestamp,
        },
      ]);

      await tx.insert(recoveryKeys).values({
        id: createId(ID.recoveryKey),
        accountId,
        encryptedMasterKey: recoveryEncMasterKeyBytes,
        createdAt: timestamp,
      });

      await tx.insert(sessions).values({
        id: sessionId,
        accountId,
        createdAt: timestamp,
        lastActive: timestamp,
        expiresAt,
      });

      // Write audit log — tx is compatible with PostgresJsDatabase for insert operations
      await writeAuditLog(tx as PostgresJsDatabase, {
        accountId,
        systemId: null,
        eventType: "auth.login",
        actor: { kind: "account", id: accountId },
        detail: "Account registered",
        ipAddress: requestMeta.ipAddress,
        userAgent: requestMeta.userAgent,
      });
    });
  } catch (error: unknown) {
    // Anti-enumeration: if email already exists (unique constraint), return a fake success
    if (isDuplicateEmailError(error)) {
      return {
        sessionToken: createId(ID.session),
        recoveryKey: generateFakeRecoveryKey(),
        accountId: createId(ID.account),
        accountType,
      };
    }
    throw error;
  }

  return {
    sessionToken: sessionId,
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
  credentials: { email: string; password: string },
  platform: "web" | "mobile",
  requestMeta: { ipAddress: string | null; userAgent: string | null },
): Promise<LoginResult | null> {
  const parsed = LoginCredentialsSchema.parse(credentials);
  const emailHash = hashEmail(parsed.email);

  const [account] = await db
    .select()
    .from(accounts)
    .where(eq(accounts.emailHash, emailHash))
    .limit(1);

  if (!account) {
    // Anti-timing: run verification against dummy hash to equalize timing
    verifyPassword(DUMMY_ARGON2_HASH, parsed.password);
    return null;
  }

  const valid = verifyPassword(account.passwordHash, parsed.password);
  if (!valid) {
    await writeAuditLog(db, {
      accountId: account.id,
      systemId: null,
      eventType: "auth.login-failed",
      actor: { kind: "account", id: account.id },
      detail: "Invalid password",
      ipAddress: requestMeta.ipAddress,
      userAgent: requestMeta.userAgent,
    });
    return null;
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

  const sessionId = createId(ID.session);
  const timestamp = now();
  const timeouts = SESSION_TIMEOUTS[platform];
  const expiresAt = timestamp + timeouts.absoluteTtlMs;

  await db.insert(sessions).values({
    id: sessionId,
    accountId: account.id,
    createdAt: timestamp,
    lastActive: timestamp,
    expiresAt,
  });

  await writeAuditLog(db, {
    accountId: account.id,
    systemId,
    eventType: "auth.login",
    actor: { kind: "account", id: account.id },
    detail: `Login via ${platform}`,
    ipAddress: requestMeta.ipAddress,
    userAgent: requestMeta.userAgent,
  });

  return {
    sessionToken: sessionId,
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

  const baseConditions = cursor
    ? and(eq(sessions.accountId, accountId), eq(sessions.revoked, false), gt(sessions.id, cursor))
    : and(eq(sessions.accountId, accountId), eq(sessions.revoked, false));

  const rows = await db
    .select({
      id: sessions.id,
      createdAt: sessions.createdAt,
      lastActive: sessions.lastActive,
      expiresAt: sessions.expiresAt,
    })
    .from(sessions)
    .where(baseConditions)
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
  requestMeta: { ipAddress: string | null; userAgent: string | null },
): Promise<boolean> {
  const [session] = await db.select().from(sessions).where(eq(sessions.id, sessionId)).limit(1);

  if (session?.accountId !== actorAccountId) {
    return false;
  }

  await db.update(sessions).set({ revoked: true }).where(eq(sessions.id, sessionId));

  await writeAuditLog(db, {
    accountId: actorAccountId,
    systemId: null,
    eventType: "auth.logout",
    actor: { kind: "account", id: actorAccountId },
    detail: `Session ${sessionId} revoked`,
    ipAddress: requestMeta.ipAddress,
    userAgent: requestMeta.userAgent,
  });

  return true;
}

export async function revokeAllSessions(
  db: PostgresJsDatabase,
  accountId: string,
  exceptSessionId: string,
  requestMeta: { ipAddress: string | null; userAgent: string | null },
): Promise<number> {
  const result = await db
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

  await writeAuditLog(db, {
    accountId,
    systemId: null,
    eventType: "auth.logout",
    actor: { kind: "account", id: accountId },
    detail: `All sessions revoked except ${exceptSessionId} (${String(result.length)} sessions)`,
    ipAddress: requestMeta.ipAddress,
    userAgent: requestMeta.userAgent,
  });

  return result.length;
}

export async function logoutCurrentSession(
  db: PostgresJsDatabase,
  sessionId: string,
  accountId: string,
  requestMeta: { ipAddress: string | null; userAgent: string | null },
): Promise<void> {
  await db.update(sessions).set({ revoked: true }).where(eq(sessions.id, sessionId));

  await writeAuditLog(db, {
    accountId,
    systemId: null,
    eventType: "auth.logout",
    actor: { kind: "account", id: accountId },
    detail: "Logged out",
    ipAddress: requestMeta.ipAddress,
    userAgent: requestMeta.userAgent,
  });
}

// ── Helpers ────────────────────────────────────────────────────────

class ValidationError extends Error {
  override readonly name = "ValidationError" as const;
}

export { ValidationError };

function toHex(bytes: Uint8Array): string {
  return Array.from(bytes)
    .map((b) => b.toString(HEX_RADIX).padStart(HEX_BYTE_WIDTH, "0"))
    .join("");
}

function serializeEncryptedPayload(payload: {
  ciphertext: Uint8Array;
  nonce: Uint8Array;
}): Uint8Array {
  const result = new Uint8Array(payload.nonce.length + payload.ciphertext.length);
  result.set(payload.nonce, 0);
  result.set(payload.ciphertext, payload.nonce.length);
  return result;
}

function isDuplicateEmailError(error: unknown): boolean {
  if (error instanceof Error) {
    const msg = error.message.toLowerCase();
    return msg.includes("unique") && msg.includes("email_hash");
  }
  return false;
}

/** Generate a fake recovery key that looks like a real one for anti-enumeration. */
function generateFakeRecoveryKey(): string {
  const chars = "ABCDEFGHIJKLMNOPQRSTUVWXYZ234567";
  const groups: string[] = [];
  for (let g = 0; g < RECOVERY_KEY_GROUP_COUNT; g++) {
    let group = "";
    for (let c = 0; c < RECOVERY_KEY_GROUP_SIZE; c++) {
      group += chars[Math.floor(Math.random() * chars.length)] ?? "A";
    }
    groups.push(group);
  }
  return groups.join("-");
}

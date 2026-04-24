import {
  AUTH_KEY_HASH_BYTES,
  assertAuthKey,
  assertSignPublicKey,
  assertSignature,
  generateChallengeNonce,
  generateSalt,
  getSodium,
  hashAuthKey,
  verifyChallenge,
} from "@pluralscape/crypto";
import { accounts, authKeys, recoveryKeys, sessions, systems } from "@pluralscape/db/pg";
import { brandId, ID_PREFIXES, SESSION_TIMEOUTS, createId, now } from "@pluralscape/types";
import { RegistrationCommitSchema, RegistrationInitiateSchema } from "@pluralscape/validation";
import { and, eq, isNotNull } from "drizzle-orm";

import { equalizeAntiEnumTiming } from "../../lib/anti-enum-timing.js";
import { encryptEmail, getEmailEncryptionKey } from "../../lib/email-encrypt.js";
import { hashEmail } from "../../lib/email-hash.js";
import { fromHex, toHex } from "../../lib/hex.js";
import { withAccountTransaction } from "../../lib/rls-context.js";
import { generateSessionToken, hashSessionToken } from "../../lib/session-token.js";
import { isUniqueViolation } from "../../lib/unique-violation.js";
import { EMAIL_SALT_BYTES, CHALLENGE_NONCE_TTL_MS } from "../../routes/auth/auth.constants.js";

import type { AuditWriter } from "../../lib/audit-writer.js";
import type { ClientPlatform } from "../../routes/auth/auth.constants.js";
import type { ChallengeNonce } from "@pluralscape/crypto";
import type {
  AccountId,
  AccountType,
  AuthKeyId,
  RecoveryKeyId,
  SessionId,
  SystemId,
} from "@pluralscape/types";
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
  retried = false,
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
    await withAccountTransaction(db, brandId<AccountId>(accountId), async (tx) => {
      await tx.insert(accounts).values({
        id: brandId<AccountId>(accountId),
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
        .for("update", { skipLocked: true })
        .limit(1);

      if (existing) {
        const isPlaceholder = existing.authKeyHash.every((b) => b === 0);
        const isExpired =
          existing.challengeExpiresAt !== null && existing.challengeExpiresAt < now();

        if (isPlaceholder && isExpired && !retried) {
          // Delete the abandoned placeholder and retry (at most once)
          await db.delete(accounts).where(eq(accounts.id, existing.id));
          return initiateRegistration(db, params, true);
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
    .where(eq(accounts.id, brandId<AccountId>(parsed.accountId)))
    .limit(1);

  if (!account) {
    throw new ValidationError("Invalid or expired registration");
  }

  // Verify registration is still in phase 1 (placeholder auth key hash = all zeros)
  const isPlaceholder = account.authKeyHash.every((b) => b === 0);
  if (!isPlaceholder) {
    throw new ValidationError("Invalid or expired registration");
  }

  // Verify challenge nonce hasn't expired
  if (!account.challengeNonce || !account.challengeExpiresAt) {
    throw new ValidationError("Invalid or expired registration");
  }
  if (account.challengeExpiresAt < now()) {
    throw new ValidationError("Invalid or expired registration");
  }

  // Verify challenge signature against the provided public signing key
  const publicSigningKeyBytes = fromHex(parsed.publicSigningKey);
  assertSignPublicKey(publicSigningKeyBytes);

  const signatureBytes = fromHex(parsed.challengeSignature);
  assertSignature(signatureBytes);

  const signatureValid = verifyChallenge(
    account.challengeNonce as ChallengeNonce,
    signatureBytes,
    publicSigningKeyBytes,
  );
  if (!signatureValid) {
    throw new ValidationError("Invalid or expired registration");
  }

  // Hash the auth key for storage
  const authKeyRaw = fromHex(parsed.authKey);
  assertAuthKey(authKeyRaw);
  const authKeyHash = hashAuthKey(authKeyRaw);

  // Decode all encrypted blobs from hex; public keys are base64url-encoded
  const encryptedMasterKeyBytes = fromHex(parsed.encryptedMasterKey);
  const encSignPrivKeyBytes = fromHex(parsed.encryptedSigningPrivateKey);
  const encEncPrivKeyBytes = fromHex(parsed.encryptedEncryptionPrivateKey);
  const publicEncKeyBytes = fromHex(parsed.publicEncryptionKey);
  const recoveryEncMasterKeyBytes = fromHex(parsed.recoveryEncryptedMasterKey);

  const sessionId = brandId<SessionId>(createId(ID_PREFIXES.session));
  const rawToken = generateSessionToken();
  const tokenHash = hashSessionToken(rawToken);
  const timestamp = now();
  const timeouts = SESSION_TIMEOUTS[platform];
  const expiresAt = timestamp + timeouts.absoluteTtlMs;

  await withAccountTransaction(db, brandId<AccountId>(account.id), async (tx) => {
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
      throw new ValidationError("Invalid or expired registration");
    }

    if (account.accountType === "system") {
      await tx.insert(systems).values({
        id: brandId<SystemId>(createId(ID_PREFIXES.system)),
        accountId: account.id,
        createdAt: timestamp,
        updatedAt: timestamp,
      });
    }

    await tx.insert(authKeys).values([
      {
        id: brandId<AuthKeyId>(createId(ID_PREFIXES.authKey)),
        accountId: account.id,
        encryptedPrivateKey: encEncPrivKeyBytes,
        publicKey: publicEncKeyBytes,
        keyType: "encryption",
        createdAt: timestamp,
      },
      {
        id: brandId<AuthKeyId>(createId(ID_PREFIXES.authKey)),
        accountId: account.id,
        encryptedPrivateKey: encSignPrivKeyBytes,
        publicKey: publicSigningKeyBytes,
        keyType: "signing",
        createdAt: timestamp,
      },
    ]);

    await tx.insert(recoveryKeys).values({
      id: brandId<RecoveryKeyId>(createId(ID_PREFIXES.recoveryKey)),
      accountId: account.id,
      encryptedMasterKey: recoveryEncMasterKeyBytes,
      recoveryKeyHash: fromHex(parsed.recoveryKeyHash),
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
      accountId: brandId<AccountId>(account.id),
    });
  });

  return {
    sessionToken: rawToken,
    accountId: account.id,
    accountType: account.accountType,
  };
}

// ── Helpers ────────────────────────────────────────────────────────

export class ValidationError extends Error {
  override readonly name = "ValidationError" as const;
}

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

/**
 * Shared fixtures for PG auth schema integration tests.
 *
 * Used by schema-pg-auth-accounts-keys, -sessions-recovery, and
 * -device-transfer splits.
 */

import { PGlite } from "@electric-sql/pglite";
import { brandId } from "@pluralscape/types";
import { drizzle } from "drizzle-orm/pglite";

import {
  accounts,
  authKeys,
  deviceTransferRequests,
  recoveryKeys,
  sessions,
} from "../../schema/pg/auth.js";
import { fixtureNow } from "../fixtures/timestamps.js";

import { createPgAuthTables } from "./pg-helpers.js";

import type {
  AccountId,
  AuthKeyId,
  DeviceTransferRequestId,
  RecoveryKeyId,
  SessionId,
  UnixMillis,
} from "@pluralscape/types";
import type { PgliteDatabase } from "drizzle-orm/pglite";

export const authSchema = { accounts, authKeys, sessions, recoveryKeys, deviceTransferRequests };

export type AuthDb = PgliteDatabase<typeof authSchema>;

export interface AuthFixture {
  client: PGlite;
  db: AuthDb;
}

export async function setupAuthFixture(): Promise<AuthFixture> {
  const client = await PGlite.create();
  const db = drizzle(client, { schema: authSchema });
  await createPgAuthTables(client);
  return { client, db };
}

export async function teardownAuthFixture(fixture: AuthFixture): Promise<void> {
  await fixture.client.close();
}

export const newAccountId = (raw?: string): AccountId =>
  brandId<AccountId>(raw ?? crypto.randomUUID());
export const newSessionId = (): SessionId => brandId<SessionId>(crypto.randomUUID());
export const newAuthKeyId = (): AuthKeyId => brandId<AuthKeyId>(crypto.randomUUID());
export const newRecoveryKeyId = (): RecoveryKeyId => brandId<RecoveryKeyId>(crypto.randomUUID());
export const newDeviceTransferRequestId = (): DeviceTransferRequestId =>
  brandId<DeviceTransferRequestId>(crypto.randomUUID());

export interface InsertAccountResult {
  id: AccountId;
  emailHash: string;
  emailSalt: string;
  authKeyHash: Uint8Array;
  kdfSalt: string;
  createdAt: UnixMillis;
  updatedAt: UnixMillis;
}

export async function insertAccount(
  db: AuthDb,
  overrides: Partial<{
    id: string;
    emailHash: string;
    emailSalt: string;
    authKeyHash: Uint8Array;
    kdfSalt: string;
    createdAt: UnixMillis;
    updatedAt: UnixMillis;
  }> = {},
): Promise<InsertAccountResult> {
  const now = fixtureNow();
  const data = {
    id: newAccountId(overrides.id),
    emailHash: overrides.emailHash ?? `hash_${crypto.randomUUID()}`,
    emailSalt: overrides.emailSalt ?? `salt_${crypto.randomUUID()}`,
    authKeyHash: overrides.authKeyHash ?? new Uint8Array(32),
    kdfSalt: overrides.kdfSalt ?? `kdf_${crypto.randomUUID()}`,
    encryptedMasterKey: new Uint8Array(72),
    createdAt: overrides.createdAt ?? now,
    updatedAt: overrides.updatedAt ?? now,
  };
  await db.insert(accounts).values(data);
  return data;
}

export interface InsertSessionResult {
  id: SessionId;
  accountId: AccountId;
  tokenHash: string;
  createdAt: UnixMillis;
}

export async function insertSession(
  db: AuthDb,
  accountId: AccountId,
  overrides: Partial<{ id: SessionId; createdAt: UnixMillis; tokenHash: string }> = {},
): Promise<InsertSessionResult> {
  const data = {
    id: overrides.id ?? newSessionId(),
    accountId,
    tokenHash: overrides.tokenHash ?? `tok_${crypto.randomUUID()}`,
    createdAt: overrides.createdAt ?? fixtureNow(),
  };
  await db.insert(sessions).values(data);
  return data;
}

export const ONE_DAY_MS = 86_400_000;
export const ONE_HOUR_MS = 3_600_000;
/** 16-byte salt for device transfer test inserts. */
export const TEST_CODE_SALT = new Uint8Array(16);

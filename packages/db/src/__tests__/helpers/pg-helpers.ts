/**
 * PG fixture helpers for integration tests.
 *
 * Covers: EncryptedBlob factories, branded-ID fixture factories, and
 *   row-insert helpers (pgInsertAccount, pgInsertSystem, pgInsertMember,
 *   pgInsertChannel, pgInsertPoll). Also re-exports PG_DDL and all
 *   createPg*Tables functions for consumers that import from this module.
 *
 * Companion files: pg-helpers-ddl.ts, pg-helpers-schema.ts
 */

import { AEAD_NONCE_BYTES } from "@pluralscape/crypto";
import { brandId } from "@pluralscape/types";

import { accounts } from "../../schema/pg/auth.js";
import { channels, polls } from "../../schema/pg/communication.js";
import { members } from "../../schema/pg/members.js";
import { systems } from "../../schema/pg/systems.js";
import { fixtureNow } from "../fixtures/timestamps.js";

export { PG_DDL } from "./pg-helpers-ddl.js";
export { applyAllRlsToClient, createPgAllTables } from "./pg-helpers-all-tables.js";
export {
  createPgAnalyticsTables,
  createPgApiKeysTables,
  createPgAuditLogTables,
  createPgAuthTables,
  createPgBlobMetadataTables,
  createPgCommunicationTables,
  createPgCustomFieldsTables,
  createPgFrontingTables,
  createPgGroupsTables,
  createPgImportExportTables,
  createPgInnerworldTables,
  createPgJournalTables,
  createPgKeyRotationTables,
  createPgLifecycleEventsTables,
  createPgMemberTables,
  createPgNomenclatureSettingsTables,
  createPgNotificationTables,
  createPgPkBridgeTables,
  createPgPrivacyTables,
  createPgSafeModeContentTables,
  createPgSearchIndexTables,
  createPgSnapshotTables,
  createPgStructureTables,
  createPgSyncTables,
  createPgSystemSettingsTables,
  createPgSystemTables,
  createPgTimerTables,
  createPgWebhookTables,
  pgExec,
} from "./pg-helpers-schema.js";

import type {
  AccountId,
  AuditLogEntryId,
  BucketId,
  ChannelId,
  EncryptedBlob,
  FrontingReportId,
  MemberId,
  PKBridgeConfigId,
  PollId,
  SafeModeContentId,
  SystemId,
} from "@pluralscape/types";
import type { PgDatabase, PgQueryResultHKT } from "drizzle-orm/pg-core";
import type { PgliteDatabase } from "drizzle-orm/pglite";

// ── Branded-ID fixture factories ───────────────────────────────────
// One helper per entity whose Drizzle schema uses `brandedId<XId>()`. These
// centralize the prefix strings used in integration-test fixtures so the
// prefix is single-sourced with `ID_PREFIXES` in @pluralscape/types.

export const makeAuditLogEntryId = (): AuditLogEntryId =>
  brandId<AuditLogEntryId>(`al_${crypto.randomUUID()}`);

export const makeFrontingReportId = (): FrontingReportId =>
  brandId<FrontingReportId>(`fr_${crypto.randomUUID()}`);

export const makePkBridgeConfigId = (): PKBridgeConfigId =>
  brandId<PKBridgeConfigId>(`pkb_${crypto.randomUUID()}`);

export const makeSafeModeContentId = (): SafeModeContentId =>
  brandId<SafeModeContentId>(`smc_${crypto.randomUUID()}`);

/** Creates a minimal valid EncryptedBlob for test fixtures. */
export function testBlob(ciphertext: Uint8Array = new Uint8Array([1, 2, 3])): EncryptedBlob {
  const nonce = new Uint8Array(AEAD_NONCE_BYTES);
  nonce.fill(0xaa);
  return {
    ciphertext,
    nonce,
    tier: 1,
    algorithm: "xchacha20-poly1305",
    keyVersion: null,
    bucketId: null,
  };
}

/** Creates a T2 EncryptedBlob with bucketId for test fixtures. */
export function testBlobT2(
  ciphertext: Uint8Array = new Uint8Array([4, 5, 6]),
  bucketId = brandId<BucketId>("test-bucket"),
): EncryptedBlob {
  const nonce = new Uint8Array(AEAD_NONCE_BYTES);
  nonce.fill(0xbb);
  return {
    ciphertext,
    nonce,
    tier: 2,
    algorithm: "xchacha20-poly1305",
    keyVersion: 1,
    bucketId,
  };
}

export const MS_PER_DAY = 86_400_000;
export const TTL_RETENTION_DAYS = 30;

export async function pgInsertAccount(
  db: PgDatabase<PgQueryResultHKT, Record<string, unknown>>,
  id?: string,
): Promise<AccountId> {
  const resolvedId = brandId<AccountId>(id ?? crypto.randomUUID());
  const now = fixtureNow();
  await db.insert(accounts).values({
    id: resolvedId,
    emailHash: `hash_${crypto.randomUUID()}`,
    emailSalt: `salt_${crypto.randomUUID()}`,
    authKeyHash: new Uint8Array(32),
    kdfSalt: `kdf_${crypto.randomUUID()}`,
    encryptedMasterKey: new Uint8Array(72),
    createdAt: now,
    updatedAt: now,
  });
  return resolvedId;
}

export async function pgInsertSystem(
  db: PgDatabase<PgQueryResultHKT, Record<string, unknown>>,
  accountId: string,
  id?: string,
): Promise<SystemId> {
  const resolvedId = brandId<SystemId>(id ?? crypto.randomUUID());
  const now = fixtureNow();
  await db.insert(systems).values({
    id: resolvedId,
    accountId: brandId<AccountId>(accountId),
    createdAt: now,
    updatedAt: now,
  });
  return resolvedId;
}

export async function pgInsertMember(
  db: PgliteDatabase<Record<string, unknown>>,
  systemId: string,
  id?: string,
): Promise<MemberId> {
  const resolvedId = brandId<MemberId>(id ?? crypto.randomUUID());
  const now = fixtureNow();
  await db.insert(members).values({
    id: resolvedId,
    systemId: brandId<SystemId>(systemId),
    encryptedData: testBlob(),
    createdAt: now,
    updatedAt: now,
  });
  return resolvedId;
}

export async function pgInsertChannel(
  db: PgliteDatabase<Record<string, unknown>>,
  systemId: string,
  opts: {
    id?: string;
    type?: "category" | "channel";
    parentId?: string | null;
    sortOrder?: number;
  } = {},
): Promise<ChannelId> {
  const id = brandId<ChannelId>(opts.id ?? crypto.randomUUID());
  const now = fixtureNow();
  await db.insert(channels).values({
    id,
    systemId: brandId<SystemId>(systemId),
    type: opts.type ?? "channel",
    parentId:
      opts.parentId === null || opts.parentId === undefined
        ? null
        : brandId<ChannelId>(opts.parentId),
    sortOrder: opts.sortOrder ?? 0,
    encryptedData: testBlob(),
    createdAt: now,
    updatedAt: now,
  });
  return id;
}

export async function pgInsertPoll(
  db: PgliteDatabase<Record<string, unknown>>,
  systemId: string,
  opts: { id?: string } = {},
): Promise<PollId> {
  const id = brandId<PollId>(opts.id ?? crypto.randomUUID());
  const now = fixtureNow();
  await db.insert(polls).values({
    id,
    systemId: brandId<SystemId>(systemId),
    kind: "standard",
    encryptedData: testBlob(),
    allowMultipleVotes: false,
    maxVotesPerMember: 1,
    allowAbstain: false,
    allowVeto: false,
    createdAt: now,
    updatedAt: now,
  });
  return id;
}

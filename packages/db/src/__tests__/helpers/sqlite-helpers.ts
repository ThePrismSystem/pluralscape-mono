/**
 * SQLite fixture helpers for integration tests.
 *
 * Covers: EncryptedBlob factories, branded-ID fixture factories, and
 *   row-insert helpers (sqliteInsertAccount, sqliteInsertSystem,
 *   sqliteInsertMember, sqliteInsertChannel, sqliteInsertPoll).
 *   Also re-exports SQLITE_DDL (merged) and all createSqlite*Tables
 *   functions for consumers that import from this module.
 * Companion files: sqlite-helpers-schema.ts, sqlite-helpers-ddl-auth-core.ts,
 *   sqlite-helpers-ddl-privacy-structure.ts, sqlite-helpers-ddl-comm-journal.ts,
 *   sqlite-helpers-ddl-ops-misc.ts
 */

import { AEAD_NONCE_BYTES } from "@pluralscape/crypto";
import { brandId } from "@pluralscape/types";

import { accounts } from "../../schema/sqlite/auth.js";
import { channels, polls } from "../../schema/sqlite/communication.js";
import { members } from "../../schema/sqlite/members.js";
import { systems } from "../../schema/sqlite/systems.js";
import { fixtureNow } from "../fixtures/timestamps.js";

import { SQLITE_DDL_AUTH_CORE } from "./sqlite-helpers-ddl-auth-core.js";
import { SQLITE_DDL_COMM_JOURNAL } from "./sqlite-helpers-ddl-comm-journal.js";
import { SQLITE_DDL_OPS_MISC } from "./sqlite-helpers-ddl-ops-misc.js";
import { SQLITE_DDL_PRIVACY_STRUCTURE } from "./sqlite-helpers-ddl-privacy-structure.js";

export {
  createSqliteAnalyticsTables,
  createSqliteApiKeysTables,
  createSqliteAuditLogTables,
  createSqliteAuthTables,
  createSqliteBlobMetadataTables,
  createSqliteCommunicationTables,
  createSqliteCustomFieldsTables,
  createSqliteFrontingTables,
  createSqliteGroupsTables,
  createSqliteImportExportTables,
  createSqliteInnerworldTables,
  createSqliteJobsTables,
  createSqliteJournalTables,
  createSqliteKeyRotationTables,
  createSqliteLifecycleEventsTables,
  createSqliteMemberTables,
  createSqliteNomenclatureSettingsTables,
  createSqliteNotificationTables,
  createSqlitePkBridgeTables,
  createSqlitePrivacyTables,
  createSqliteSafeModeContentTables,
  createSqliteSnapshotTables,
  createSqliteStructureTables,
  createSqliteSyncTables,
  createSqliteSystemSettingsTables,
  createSqliteSystemTables,
  createSqliteTimerTables,
  createSqliteWebhookTables,
} from "./sqlite-helpers-schema.js";

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
import type { BetterSQLite3Database } from "drizzle-orm/better-sqlite3";

// ── DDL re-export ──────────────────────────────────────────────────
// Merged for consumers (e.g. queries-sqlite-recovery-key) that import
// SQLITE_DDL directly. Shape matches the original single-object export.
export const SQLITE_DDL = {
  ...SQLITE_DDL_AUTH_CORE,
  ...SQLITE_DDL_PRIVACY_STRUCTURE,
  ...SQLITE_DDL_COMM_JOURNAL,
  ...SQLITE_DDL_OPS_MISC,
} as const;

export const MS_PER_DAY = 86_400_000;
export const TTL_RETENTION_DAYS = 30;

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

// ── Row-insert fixture helpers ─────────────────────────────────────

export function sqliteInsertAccount(
  db: BetterSQLite3Database<Record<string, unknown>>,
  id?: string,
): AccountId {
  const resolvedId = brandId<AccountId>(id ?? crypto.randomUUID());
  const now = fixtureNow();
  db.insert(accounts)
    .values({
      id: resolvedId,
      emailHash: `hash_${crypto.randomUUID()}`,
      emailSalt: `salt_${crypto.randomUUID()}`,
      authKeyHash: new Uint8Array(32),
      kdfSalt: `kdf_${crypto.randomUUID()}`,
      encryptedMasterKey: new Uint8Array(72),
      createdAt: now,
      updatedAt: now,
    })
    .run();
  return resolvedId;
}

export function sqliteInsertSystem(
  db: BetterSQLite3Database<Record<string, unknown>>,
  accountId: string,
  id?: string,
): SystemId {
  const resolvedId = brandId<SystemId>(id ?? crypto.randomUUID());
  const now = fixtureNow();
  db.insert(systems)
    .values({
      id: resolvedId,
      accountId: brandId<AccountId>(accountId),
      createdAt: now,
      updatedAt: now,
    })
    .run();
  return resolvedId;
}

export function sqliteInsertMember(
  db: BetterSQLite3Database<Record<string, unknown>>,
  systemId: string,
  id?: string,
): MemberId {
  const resolvedId = brandId<MemberId>(id ?? crypto.randomUUID());
  const now = fixtureNow();
  db.insert(members)
    .values({
      id: resolvedId,
      systemId: brandId<SystemId>(systemId),
      encryptedData: testBlob(),
      createdAt: now,
      updatedAt: now,
    })
    .run();
  return resolvedId;
}

export function sqliteInsertChannel(
  db: BetterSQLite3Database<Record<string, unknown>>,
  systemId: string,
  opts: {
    id?: string;
    type?: "category" | "channel";
    parentId?: string | null;
    sortOrder?: number;
  } = {},
): ChannelId {
  const id = brandId<ChannelId>(opts.id ?? crypto.randomUUID());
  const now = fixtureNow();
  db.insert(channels)
    .values({
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
    })
    .run();
  return id;
}

export function sqliteInsertPoll(
  db: BetterSQLite3Database<Record<string, unknown>>,
  systemId: string,
  opts: { id?: string } = {},
): PollId {
  const id = brandId<PollId>(opts.id ?? crypto.randomUUID());
  const now = fixtureNow();
  db.insert(polls)
    .values({
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
    })
    .run();
  return id;
}

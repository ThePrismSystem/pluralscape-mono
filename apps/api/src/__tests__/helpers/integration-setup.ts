/**
 * Shared setup helpers for API service integration tests (PGlite).
 */
import {
  assertChallengeNonce,
  fromHex,
  getSodium,
  serializeEncryptedBlob,
  signChallenge,
  toHex,
} from "@pluralscape/crypto";
import { testBlob } from "@pluralscape/db/test-helpers/pg-helpers";
import { expect } from "vitest";

import { ApiHttpError } from "../../lib/api-error.js";
import { commitRegistration, initiateRegistration } from "../../services/auth.service.js";

import type { AuditWriter } from "../../lib/audit-writer.js";
import type { AuthContext } from "../../lib/auth-context.js";
import type { RegistrationCommitResult } from "../../services/auth.service.js";
import type { SignSecretKey } from "@pluralscape/crypto";
import type * as schema from "@pluralscape/db/pg";
import type {
  AccountId,
  AcknowledgementId,
  ApiErrorCode,
  BlobId,
  BoardMessageId,
  BucketId,
  BucketKeyRotationId,
  ChannelId,
  CheckInRecordId,
  CustomFrontId,
  FrontingCommentId,
  FrontingSessionId,
  GroupId,
  MemberId,
  MessageId,
  NoteId,
  PollId,
  PollVoteId,
  RelationshipId,
  SessionId,
  SystemId,
  SystemSnapshotId,
  SystemStructureEntityId,
  SystemStructureEntityTypeId,
  TimerId,
  WebhookDeliveryId,
  WebhookId,
} from "@pluralscape/types";
import type { PgliteDatabase } from "drizzle-orm/pglite";
import type { PostgresJsDatabase } from "drizzle-orm/postgres-js";

export { testBlob };

/**
 * Cast PGlite DB to PostgresJsDatabase for service functions.
 * Both are PgDatabase subclasses with identical query APIs; this bridge
 * is only valid in tests where the query result HKT difference is irrelevant.
 */
export function asDb(db: PgliteDatabase<typeof schema>): PostgresJsDatabase {
  return db as never as PostgresJsDatabase;
}

/**
 * Create a base64-encoded serialized EncryptedBlob suitable for service params.
 * This round-trips through the real blob codec so parseAndValidateBlob succeeds.
 */
export function testEncryptedDataBase64(): string {
  const blob = testBlob();
  const serialized = serializeEncryptedBlob(blob);
  return Buffer.from(serialized).toString("base64");
}

/** Build a minimal AuthContext for integration tests. */
export function makeAuth(accountId: AccountId, systemId: SystemId): AuthContext {
  return {
    authMethod: "session" as const,
    accountId,
    systemId,
    sessionId: `sess_${crypto.randomUUID()}` as SessionId,
    accountType: "system",
    ownedSystemIds: new Set([systemId]),
    auditLogIpTracking: false,
  };
}

/** No-op audit writer for tests that don't need to verify audit entries. */
export const noopAudit: AuditWriter = async () => {};

// Re-export spyAudit from its canonical location alongside SpyAudit type.
export { spyAudit } from "./audit-assertions.js";

/**
 * Register a test account via the two-phase flow (initiate + commit) using real
 * libsodium crypto. Requires `initSodium()` to have been called in `beforeAll`.
 *
 * Returns the commit result plus the raw authKey hex for login tests.
 */
export async function registerTestAccount(
  db: PostgresJsDatabase,
  opts: {
    email?: string;
    accountType?: "system" | "viewer";
    audit?: AuditWriter;
    platform?: "web" | "mobile";
  } = {},
): Promise<
  RegistrationCommitResult & { authKeyHex: string; email: string; signingSecretKey: SignSecretKey }
> {
  const email = opts.email ?? `test-${crypto.randomUUID()}@test.local`;
  const accountType = opts.accountType ?? "system";
  const audit = opts.audit ?? noopAudit;
  const platform = opts.platform ?? "web";

  const sodium = getSodium();

  // Phase 1: initiate — get accountId + challengeNonce
  const initResult = await initiateRegistration(db, { email, accountType });

  // Generate signing and encryption keypairs
  const signingKp = sodium.signKeypair();
  const boxKp = sodium.boxKeypair();

  // Sign the challenge nonce with the signing secret key
  const challengeNonceBytes = fromHex(initResult.challengeNonce);
  assertChallengeNonce(challengeNonceBytes);
  const challengeSignature = signChallenge(challengeNonceBytes, signingKp.secretKey);

  // Random auth key (32 bytes → hex)
  const authKeyHex = toHex(sodium.randomBytes(32));

  // Dummy encrypted blobs (content irrelevant for integration tests)
  const dummyBlob = toHex(sodium.randomBytes(48));

  // Phase 2: commit
  const commitResult = await commitRegistration(
    db,
    {
      accountId: initResult.accountId,
      authKey: authKeyHex,
      encryptedMasterKey: dummyBlob,
      encryptedSigningPrivateKey: dummyBlob,
      encryptedEncryptionPrivateKey: dummyBlob,
      publicSigningKey: toHex(signingKp.publicKey),
      publicEncryptionKey: toHex(boxKp.publicKey),
      recoveryEncryptedMasterKey: dummyBlob,
      challengeSignature: toHex(challengeSignature),
      recoveryKeyBackupConfirmed: true,
      recoveryKeyHash: toHex(sodium.randomBytes(32)),
    },
    platform,
    audit,
  );

  return { ...commitResult, authKeyHex, email, signingSecretKey: signingKp.secretKey };
}

/**
 * Assert that a promise rejects with an ApiHttpError carrying the expected
 * error code and HTTP status. Optionally checks a message substring.
 */
export async function assertApiError(
  promise: Promise<unknown>,
  code: ApiErrorCode,
  status: number,
  messageSubstring?: string,
): Promise<ApiHttpError> {
  let caught: unknown;
  try {
    await promise;
  } catch (err: unknown) {
    caught = err;
  }
  if (!caught) {
    expect.unreachable("Expected ApiHttpError but promise resolved");
  }
  expect(caught).toBeInstanceOf(ApiHttpError);
  const apiErr = caught as ApiHttpError;
  expect(apiErr.code).toBe(code);
  expect(apiErr.status).toBe(status);
  if (messageSubstring) expect(apiErr.message).toContain(messageSubstring);
  return apiErr;
}

// ── ID generators (return branded types to avoid per-callsite casts) ─

export function genMemberId(): MemberId {
  return `mem_${crypto.randomUUID()}` as MemberId;
}

export function genCustomFrontId(): CustomFrontId {
  return `cf_${crypto.randomUUID()}` as CustomFrontId;
}

export function genFrontingSessionId(): FrontingSessionId {
  return `fs_${crypto.randomUUID()}` as FrontingSessionId;
}

export function genFrontingCommentId(): FrontingCommentId {
  return `fcom_${crypto.randomUUID()}` as FrontingCommentId;
}

export function genTimerId(): TimerId {
  return `tmr_${crypto.randomUUID()}` as TimerId;
}

export function genWebhookId(): WebhookId {
  return `wh_${crypto.randomUUID()}` as WebhookId;
}

export function genWebhookDeliveryId(): WebhookDeliveryId {
  return `wd_${crypto.randomUUID()}` as WebhookDeliveryId;
}

export function genCheckInRecordId(): CheckInRecordId {
  return `cir_${crypto.randomUUID()}` as CheckInRecordId;
}

export function genStructureEntityId(): SystemStructureEntityId {
  return `ste_${crypto.randomUUID()}` as SystemStructureEntityId;
}

export function genGroupId(): GroupId {
  return `grp_${crypto.randomUUID()}` as GroupId;
}

export function genBlobId(): BlobId {
  return `blob_${crypto.randomUUID()}` as BlobId;
}

export function genBucketId(): BucketId {
  return `bkt_${crypto.randomUUID()}` as BucketId;
}

export function genRotationId(): BucketKeyRotationId {
  return `rot_${crypto.randomUUID()}` as BucketKeyRotationId;
}

export function genAccountId(): AccountId {
  return `acc_${crypto.randomUUID()}` as AccountId;
}

export function genChannelId(): ChannelId {
  return `ch_${crypto.randomUUID()}` as ChannelId;
}

export function genMessageId(): MessageId {
  return `msg_${crypto.randomUUID()}` as MessageId;
}

export function genBoardMessageId(): BoardMessageId {
  return `bm_${crypto.randomUUID()}` as BoardMessageId;
}

export function genNoteId(): NoteId {
  return `note_${crypto.randomUUID()}` as NoteId;
}

export function genPollId(): PollId {
  return `poll_${crypto.randomUUID()}` as PollId;
}

export function genPollVoteId(): PollVoteId {
  return `pv_${crypto.randomUUID()}` as PollVoteId;
}

export function genAcknowledgementId(): AcknowledgementId {
  return `ack_${crypto.randomUUID()}` as AcknowledgementId;
}

export function genRelationshipId(): RelationshipId {
  return `rel_${crypto.randomUUID()}` as RelationshipId;
}

export function genSystemSnapshotId(): SystemSnapshotId {
  return `snap_${crypto.randomUUID()}` as SystemSnapshotId;
}

export function genStructureEntityTypeId(): SystemStructureEntityTypeId {
  return `stet_${crypto.randomUUID()}` as SystemStructureEntityTypeId;
}

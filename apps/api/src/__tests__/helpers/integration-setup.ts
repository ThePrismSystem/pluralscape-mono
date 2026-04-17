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
import { brandId } from "@pluralscape/types";
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
    sessionId: brandId<SessionId>(`sess_${crypto.randomUUID()}`),
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
  return brandId<MemberId>(`mem_${crypto.randomUUID()}`);
}

export function genCustomFrontId(): CustomFrontId {
  return brandId<CustomFrontId>(`cf_${crypto.randomUUID()}`);
}

export function genFrontingSessionId(): FrontingSessionId {
  return brandId<FrontingSessionId>(`fs_${crypto.randomUUID()}`);
}

export function genFrontingCommentId(): FrontingCommentId {
  return brandId<FrontingCommentId>(`fcom_${crypto.randomUUID()}`);
}

export function genTimerId(): TimerId {
  return brandId<TimerId>(`tmr_${crypto.randomUUID()}`);
}

export function genWebhookId(): WebhookId {
  return brandId<WebhookId>(`wh_${crypto.randomUUID()}`);
}

export function genWebhookDeliveryId(): WebhookDeliveryId {
  return brandId<WebhookDeliveryId>(`wd_${crypto.randomUUID()}`);
}

export function genCheckInRecordId(): CheckInRecordId {
  return brandId<CheckInRecordId>(`cir_${crypto.randomUUID()}`);
}

export function genStructureEntityId(): SystemStructureEntityId {
  return brandId<SystemStructureEntityId>(`ste_${crypto.randomUUID()}`);
}

export function genGroupId(): GroupId {
  return brandId<GroupId>(`grp_${crypto.randomUUID()}`);
}

export function genBlobId(): BlobId {
  return brandId<BlobId>(`blob_${crypto.randomUUID()}`);
}

export function genBucketId(): BucketId {
  return brandId<BucketId>(`bkt_${crypto.randomUUID()}`);
}

export function genRotationId(): BucketKeyRotationId {
  return brandId<BucketKeyRotationId>(`rot_${crypto.randomUUID()}`);
}

export function genAccountId(): AccountId {
  return brandId<AccountId>(`acc_${crypto.randomUUID()}`);
}

export function genChannelId(): ChannelId {
  return brandId<ChannelId>(`ch_${crypto.randomUUID()}`);
}

export function genMessageId(): MessageId {
  return brandId<MessageId>(`msg_${crypto.randomUUID()}`);
}

export function genBoardMessageId(): BoardMessageId {
  return brandId<BoardMessageId>(`bm_${crypto.randomUUID()}`);
}

export function genNoteId(): NoteId {
  return brandId<NoteId>(`note_${crypto.randomUUID()}`);
}

export function genPollId(): PollId {
  return brandId<PollId>(`poll_${crypto.randomUUID()}`);
}

export function genPollVoteId(): PollVoteId {
  return brandId<PollVoteId>(`pv_${crypto.randomUUID()}`);
}

export function genAcknowledgementId(): AcknowledgementId {
  return brandId<AcknowledgementId>(`ack_${crypto.randomUUID()}`);
}

export function genRelationshipId(): RelationshipId {
  return brandId<RelationshipId>(`rel_${crypto.randomUUID()}`);
}

export function genSystemSnapshotId(): SystemSnapshotId {
  return brandId<SystemSnapshotId>(`snap_${crypto.randomUUID()}`);
}

export function genStructureEntityTypeId(): SystemStructureEntityTypeId {
  return brandId<SystemStructureEntityTypeId>(`stet_${crypto.randomUUID()}`);
}

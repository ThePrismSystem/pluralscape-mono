/**
 * Shared setup helpers for API service integration tests (PGlite).
 */
import { serializeEncryptedBlob } from "@pluralscape/crypto";
import { testBlob } from "@pluralscape/db/test-helpers/pg-helpers";
import { expect } from "vitest";

import { ApiHttpError } from "../../lib/api-error.js";

import type { AuditWriteParams, AuditWriter } from "../../lib/audit-writer.js";
import type { AuthContext } from "../../lib/auth-context.js";
import type * as schema from "@pluralscape/db/pg";
import type {
  AccountId,
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
  SessionId,
  SystemId,
  SystemStructureEntityId,
  TimerId,
  WebhookDeliveryId,
  WebhookId,
} from "@pluralscape/types";
import type { PgliteDatabase } from "drizzle-orm/pglite";
import type { PostgresJsDatabase } from "drizzle-orm/postgres-js";

export { testBlob };

/** Cast PGlite DB to PostgresJsDatabase for service functions. Centralizes the type bridge. */
export function asDb(db: PgliteDatabase<typeof schema>): PostgresJsDatabase {
  return db as never;
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

/** Spy audit writer that records every call for assertion. */
export function spyAudit(): AuditWriter & { calls: AuditWriteParams[] } {
  const calls: AuditWriteParams[] = [];
  const writer: AuditWriter = (_db, params) => {
    calls.push(params);
    return Promise.resolve();
  };
  return Object.assign(writer, { calls });
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

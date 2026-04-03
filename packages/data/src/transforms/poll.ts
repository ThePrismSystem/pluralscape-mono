import {
  assertArrayField,
  assertObjectBlob,
  assertStringField,
  decodeAndDecryptT1,
  encryptInput,
  encryptUpdate,
} from "./decode-blob.js";

import type { KdfMasterKey } from "@pluralscape/crypto";
import type {
  EntityReference,
  HexColor,
  MemberId,
  PollId,
  PollKind,
  PollOption,
  PollOptionId,
  PollStatus,
  PollVoteId,
  SystemId,
  UnixMillis,
} from "@pluralscape/types";

// ── Wire types (API response shapes) ─────────────────────────────────

/** Shape returned by `poll.get` and `poll.list` items. */
interface PollRaw {
  readonly id: PollId;
  readonly systemId: SystemId;
  readonly createdByMemberId: MemberId | null;
  readonly kind: PollKind;
  readonly status: PollStatus;
  readonly closedAt: UnixMillis | null;
  readonly endsAt: UnixMillis | null;
  readonly allowMultipleVotes: boolean;
  readonly maxVotesPerMember: number;
  readonly allowAbstain: boolean;
  readonly allowVeto: boolean;
  readonly encryptedData: string;
  readonly version: number;
  readonly archived: boolean;
  readonly archivedAt: UnixMillis | null;
  readonly createdAt: UnixMillis;
  readonly updatedAt: UnixMillis;
}

/** Shape returned by `poll.list`. */
interface PollPage {
  readonly data: readonly PollRaw[];
  readonly nextCursor: string | null;
}

/** Shape returned by `pollVote.get` and `pollVote.list` items. */
interface PollVoteRaw {
  readonly id: PollVoteId;
  readonly pollId: PollId;
  readonly optionId: PollOptionId | null;
  readonly voter: EntityReference<"member" | "structure-entity"> | null;
  readonly isVeto: boolean;
  readonly votedAt: UnixMillis;
  /** Null when the vote has no comment. Skip decryption when null. */
  readonly encryptedData: string | null;
  readonly archived: boolean;
  readonly archivedAt: UnixMillis | null;
}

// ── Encrypted payload types ───────────────────────────────────────────

/**
 * The plaintext fields encrypted inside a poll blob.
 * Pass this to `encryptPollInput` when creating or updating a poll.
 */
export interface PollEncryptedFields {
  readonly title: string;
  readonly description: string | null;
  readonly options: readonly PollOption[];
}

/**
 * The plaintext fields encrypted inside a poll vote blob.
 * Pass this to `encryptPollVoteInput` when creating a vote.
 */
export interface PollVoteEncryptedFields {
  /** Null when the voter has no comment. */
  readonly comment: string | null;
}

// ── Decrypted output types ────────────────────────────────────────────

/** A fully decrypted poll, combining wire metadata with plaintext fields. */
export interface PollDecrypted {
  readonly id: PollId;
  readonly systemId: SystemId;
  readonly createdByMemberId: MemberId | null;
  readonly title: string;
  readonly description: string | null;
  readonly kind: PollKind;
  readonly options: readonly PollOption[];
  readonly status: PollStatus;
  readonly closedAt: UnixMillis | null;
  readonly endsAt: UnixMillis | null;
  readonly allowMultipleVotes: boolean;
  readonly maxVotesPerMember: number;
  readonly allowAbstain: boolean;
  readonly allowVeto: boolean;
  readonly archived: boolean;
  readonly archivedAt: UnixMillis | null;
  readonly version: number;
  readonly createdAt: UnixMillis;
  readonly updatedAt: UnixMillis;
}

/** A fully decrypted poll vote, combining wire metadata with plaintext fields. */
export interface PollVoteDecrypted {
  readonly id: PollVoteId;
  readonly pollId: PollId;
  readonly optionId: PollOptionId | null;
  readonly voter: EntityReference<"member" | "structure-entity"> | null;
  readonly comment: string | null;
  readonly isVeto: boolean;
  readonly votedAt: UnixMillis;
  readonly archived: boolean;
  readonly archivedAt: UnixMillis | null;
}

// ── Validators ────────────────────────────────────────────────────────

function assertPollEncryptedFields(raw: unknown): asserts raw is PollEncryptedFields {
  const obj = assertObjectBlob(raw, "poll");
  assertStringField(obj, "poll", "title");
  assertArrayField(obj, "poll", "options");
}

// ── Poll transforms ───────────────────────────────────────────────────

/**
 * Decrypt a single poll API result.
 *
 * The encrypted blob contains: `title`, `description`, `options`.
 * All other fields pass through from the wire payload.
 */
export function decryptPoll(raw: PollRaw, masterKey: KdfMasterKey): PollDecrypted {
  const plaintext = decodeAndDecryptT1(raw.encryptedData, masterKey);
  assertPollEncryptedFields(plaintext);

  return {
    id: raw.id,
    systemId: raw.systemId,
    createdByMemberId: raw.createdByMemberId,
    title: plaintext.title,
    description: plaintext.description,
    kind: raw.kind,
    options: plaintext.options,
    status: raw.status,
    closedAt: raw.closedAt,
    endsAt: raw.endsAt,
    allowMultipleVotes: raw.allowMultipleVotes,
    maxVotesPerMember: raw.maxVotesPerMember,
    allowAbstain: raw.allowAbstain,
    allowVeto: raw.allowVeto,
    archived: raw.archived,
    archivedAt: raw.archivedAt,
    version: raw.version,
    createdAt: raw.createdAt,
    updatedAt: raw.updatedAt,
  };
}

/**
 * Decrypt a paginated poll list result.
 */
export function decryptPollPage(
  raw: PollPage,
  masterKey: KdfMasterKey,
): { data: PollDecrypted[]; nextCursor: string | null } {
  return {
    data: raw.data.map((item) => decryptPoll(item, masterKey)),
    nextCursor: raw.nextCursor,
  };
}

/**
 * Encrypt poll plaintext fields for create payloads.
 */
export function encryptPollInput(
  data: PollEncryptedFields,
  masterKey: KdfMasterKey,
): { encryptedData: string } {
  return encryptInput(data, masterKey);
}

/**
 * Encrypt poll plaintext fields for update payloads.
 */
export function encryptPollUpdate(
  data: PollEncryptedFields,
  version: number,
  masterKey: KdfMasterKey,
): { encryptedData: string; version: number } {
  return encryptUpdate(data, version, masterKey);
}

// ── PollVote transforms ───────────────────────────────────────────────

/**
 * Decrypt a single poll vote API result.
 *
 * The encrypted blob contains: `comment`.
 * When `encryptedData` is null, the comment is null and no decryption is performed.
 */
export function decryptPollVote(raw: PollVoteRaw, masterKey: KdfMasterKey): PollVoteDecrypted {
  let comment: string | null = null;
  if (raw.encryptedData !== null) {
    const plaintext = decodeAndDecryptT1(raw.encryptedData, masterKey);
    if (plaintext !== null && typeof plaintext === "object") {
      const obj = plaintext as Record<string, unknown>;
      comment = typeof obj["comment"] === "string" ? obj["comment"] : null;
    }
  }

  return {
    id: raw.id,
    pollId: raw.pollId,
    optionId: raw.optionId,
    voter: raw.voter,
    comment,
    isVeto: raw.isVeto,
    votedAt: raw.votedAt,
    archived: raw.archived,
    archivedAt: raw.archivedAt,
  };
}

/**
 * Encrypt poll vote plaintext fields for create payloads.
 */
export function encryptPollVoteInput(
  data: PollVoteEncryptedFields,
  masterKey: KdfMasterKey,
): { encryptedData: string } {
  return encryptInput(data, masterKey);
}

// Re-export supporting types used by callers building option fixtures.
export type { HexColor, PollOption, PollOptionId };

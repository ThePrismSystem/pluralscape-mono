import { decodeAndDecryptT1, encryptInput, encryptUpdate } from "./decode-blob.js";

import type { KdfMasterKey } from "@pluralscape/crypto";
import type {
  ArchivedPoll,
  ArchivedPollVote,
  EntityReference,
  HexColor,
  MemberId,
  Poll,
  PollId,
  PollKind,
  PollOption,
  PollOptionId,
  PollStatus,
  PollVote,
  PollVoteId,
  SystemId,
  UnixMillis,
} from "@pluralscape/types";

// ── Wire types (API response shapes) ─────────────────────────────────

/** Shape returned by `poll.get` and `poll.list` items. */
interface PollRaw {
  readonly id: PollId;
  readonly systemId: SystemId;
  readonly createdByMemberId: MemberId;
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

// ── Validators ────────────────────────────────────────────────────────

function assertPollEncryptedFields(raw: unknown): asserts raw is PollEncryptedFields {
  if (raw === null || typeof raw !== "object") {
    throw new Error("Decrypted poll blob is not an object");
  }
  const obj = raw as Record<string, unknown>;
  if (typeof obj["title"] !== "string") {
    throw new Error("Decrypted poll blob missing required string field: title");
  }
  if (!Array.isArray(obj["options"])) {
    throw new Error("Decrypted poll blob missing required array field: options");
  }
}

// ── Poll transforms ───────────────────────────────────────────────────

/**
 * Decrypt a single poll API result into a `Poll`.
 *
 * The encrypted blob contains: `title`, `description`, `options`.
 * All other fields pass through from the wire payload.
 */
export function decryptPoll(raw: PollRaw, masterKey: KdfMasterKey): Poll | ArchivedPoll {
  const plaintext = decodeAndDecryptT1(raw.encryptedData, masterKey);
  assertPollEncryptedFields(plaintext);

  const base = {
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
    version: raw.version,
    createdAt: raw.createdAt,
    updatedAt: raw.updatedAt,
  };

  if (raw.archived) {
    if (raw.archivedAt === null) throw new Error("Archived poll missing archivedAt");
    return { ...base, archived: true as const, archivedAt: raw.archivedAt };
  }
  return { ...base, archived: false as const };
}

/**
 * Decrypt a paginated poll list result.
 */
export function decryptPollPage(
  raw: PollPage,
  masterKey: KdfMasterKey,
): { data: (Poll | ArchivedPoll)[]; nextCursor: string | null } {
  return {
    data: raw.data.map((item) => decryptPoll(item, masterKey)),
    nextCursor: raw.nextCursor,
  };
}

/**
 * Encrypt poll plaintext fields for create payloads.
 *
 * Returns `{ encryptedData: string }` — pass the spread of this into the
 * `CreatePollBodySchema`.
 */
export function encryptPollInput(
  data: PollEncryptedFields,
  masterKey: KdfMasterKey,
): { encryptedData: string } {
  return encryptInput(data, masterKey);
}

/**
 * Encrypt poll plaintext fields for update payloads.
 *
 * Returns `{ encryptedData: string; version: number }` — pass the spread of this
 * into the `UpdatePollBodySchema`.
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
 * Decrypt a single poll vote API result into a `PollVote`.
 *
 * The encrypted blob contains: `comment`.
 * When `encryptedData` is null, the comment is null and no decryption is performed.
 * All other fields pass through from the wire payload.
 */
export function decryptPollVote(
  raw: PollVoteRaw,
  masterKey: KdfMasterKey,
): PollVote | ArchivedPollVote {
  // Votes with no comment have null encryptedData — skip decryption entirely.
  let comment: string | null = null;
  if (raw.encryptedData !== null) {
    const plaintext = decodeAndDecryptT1(raw.encryptedData, masterKey);
    if (plaintext !== null && typeof plaintext === "object") {
      const obj = plaintext as Record<string, unknown>;
      comment = typeof obj["comment"] === "string" ? obj["comment"] : null;
    }
  }

  if (raw.archived) {
    if (raw.archivedAt === null) throw new Error("Archived poll vote missing archivedAt");
    return {
      id: raw.id,
      pollId: raw.pollId,
      optionId: raw.optionId,
      voter: raw.voter ?? { entityType: "member" as const, entityId: "" },
      comment,
      isVeto: raw.isVeto,
      votedAt: raw.votedAt,
      archived: true as const,
      archivedAt: raw.archivedAt,
    };
  }

  if (raw.voter === null) throw new Error("Active poll vote missing voter");
  return {
    id: raw.id,
    pollId: raw.pollId,
    optionId: raw.optionId,
    voter: raw.voter,
    comment,
    isVeto: raw.isVeto,
    votedAt: raw.votedAt,
    archived: false as const,
  };
}

/**
 * Encrypt poll vote plaintext fields for create payloads.
 *
 * Returns `{ encryptedData: string }` — pass the spread of this into the
 * `CreatePollVoteBodySchema`.
 */
export function encryptPollVoteInput(
  data: PollVoteEncryptedFields,
  masterKey: KdfMasterKey,
): { encryptedData: string } {
  return encryptInput(data, masterKey);
}

// Re-export supporting types used by callers building option fixtures.
export type { HexColor, PollOption, PollOptionId };

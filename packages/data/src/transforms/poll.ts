import { brandId, toUnixMillis } from "@pluralscape/types";
import { PollEncryptedInputSchema, PollVoteEncryptedInputSchema } from "@pluralscape/validation";

import { decodeAndDecryptT1, encryptInput, encryptUpdate } from "./decode-blob.js";

import type { KdfMasterKey } from "@pluralscape/crypto";
import type {
  Archived,
  ArchivedPollVote,
  MemberId,
  Poll,
  PollEncryptedInput,
  PollId,
  PollOptionId,
  PollVote,
  PollVoteEncryptedInput,
  PollVoteId,
  PollVoteWire,
  PollWire,
  SystemId,
  SystemStructureEntityId,
} from "@pluralscape/types";

/** Shape returned by `poll.list`. */
export interface PollPage {
  readonly data: readonly PollWire[];
  readonly nextCursor: string | null;
}

/**
 * Server-emitted wire shape for a PollVote — derived from `PollVoteWire` by
 * stripping `systemId`/`version`/`updatedAt`, none of which the API
 * serializer surfaces (the canonical type carries them because Drizzle
 * parity holds for the row, not the wire).
 */
export type PollVoteServerWire = Omit<PollVoteWire, "systemId" | "version" | "updatedAt">;

export function decryptPoll(raw: PollWire, masterKey: KdfMasterKey): Poll | Archived<Poll> {
  const decrypted = decodeAndDecryptT1(raw.encryptedData, masterKey);
  const validated = PollEncryptedInputSchema.parse(decrypted);

  const base = {
    id: brandId<PollId>(raw.id),
    systemId: brandId<SystemId>(raw.systemId),
    createdByMemberId:
      raw.createdByMemberId === null ? null : brandId<MemberId>(raw.createdByMemberId),
    title: validated.title,
    description: validated.description,
    kind: raw.kind,
    options: validated.options,
    status: raw.status,
    closedAt: raw.closedAt === null ? null : toUnixMillis(raw.closedAt),
    endsAt: raw.endsAt === null ? null : toUnixMillis(raw.endsAt),
    allowMultipleVotes: raw.allowMultipleVotes,
    maxVotesPerMember: raw.maxVotesPerMember,
    allowAbstain: raw.allowAbstain,
    allowVeto: raw.allowVeto,
    version: raw.version,
    createdAt: toUnixMillis(raw.createdAt),
    updatedAt: toUnixMillis(raw.updatedAt),
  };

  if (raw.archived) {
    if (raw.archivedAt === null) throw new Error("Archived poll missing archivedAt");
    return { ...base, archived: true as const, archivedAt: toUnixMillis(raw.archivedAt) };
  }
  return { ...base, archived: false as const };
}

export function decryptPollPage(
  raw: PollPage,
  masterKey: KdfMasterKey,
): { data: (Poll | Archived<Poll>)[]; nextCursor: string | null } {
  return {
    data: raw.data.map((item) => decryptPoll(item, masterKey)),
    nextCursor: raw.nextCursor,
  };
}

export function encryptPollInput(
  data: PollEncryptedInput,
  masterKey: KdfMasterKey,
): { encryptedData: string } {
  return encryptInput(data, masterKey);
}

export function encryptPollUpdate(
  data: PollEncryptedInput,
  version: number,
  masterKey: KdfMasterKey,
): { encryptedData: string; version: number } {
  return encryptUpdate(data, version, masterKey);
}

export function decryptPollVote(
  raw: PollVoteServerWire,
  masterKey: KdfMasterKey,
): PollVote | ArchivedPollVote {
  const decrypted = decodeAndDecryptT1(raw.encryptedData, masterKey);
  const validated = PollVoteEncryptedInputSchema.parse(decrypted);

  if (raw.voter === null) {
    throw new Error("Poll vote missing voter");
  }

  const base = {
    id: brandId<PollVoteId>(raw.id),
    pollId: brandId<PollId>(raw.pollId),
    optionId: raw.optionId === null ? null : brandId<PollOptionId>(raw.optionId),
    voter:
      raw.voter.entityType === "member"
        ? { entityType: "member" as const, entityId: brandId<MemberId>(raw.voter.entityId) }
        : {
            entityType: "structure-entity" as const,
            entityId: brandId<SystemStructureEntityId>(raw.voter.entityId),
          },
    comment: validated.comment,
    isVeto: raw.isVeto,
    votedAt: toUnixMillis(raw.votedAt),
  };

  if (raw.archived) {
    if (raw.archivedAt === null) throw new Error("Archived poll vote missing archivedAt");
    return { ...base, archived: true as const, archivedAt: toUnixMillis(raw.archivedAt) };
  }
  return { ...base, archived: false as const };
}

export function encryptPollVoteInput(
  data: PollVoteEncryptedInput,
  masterKey: KdfMasterKey,
): { encryptedData: string } {
  return encryptInput(data, masterKey);
}

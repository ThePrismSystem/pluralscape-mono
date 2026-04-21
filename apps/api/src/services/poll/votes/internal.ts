import { pollVotes } from "@pluralscape/db/pg";
import { brandId, toUnixMillis, toUnixMillisOrNull } from "@pluralscape/types";

import { encryptedBlobToBase64 } from "../../../lib/encrypted-blob.js";

import type {
  EntityReference,
  PollId,
  PollOptionId,
  PollVoteId,
  UnixMillis,
} from "@pluralscape/types";

export interface PollVoteResult {
  readonly id: PollVoteId;
  readonly pollId: PollId;
  readonly optionId: PollOptionId | null;
  readonly voter: EntityReference<"member" | "structure-entity"> | null;
  readonly isVeto: boolean;
  readonly votedAt: UnixMillis;
  readonly encryptedData: string;
  readonly archived: boolean;
  readonly archivedAt: UnixMillis | null;
  readonly createdAt: UnixMillis;
}

export function toVoteResult(row: typeof pollVotes.$inferSelect): PollVoteResult {
  return {
    id: brandId<PollVoteId>(row.id),
    pollId: brandId<PollId>(row.pollId),
    optionId: row.optionId ? brandId<PollOptionId>(row.optionId) : null,
    voter: row.voter,
    isVeto: row.isVeto,
    votedAt: toUnixMillis(row.votedAt),
    encryptedData: encryptedBlobToBase64(row.encryptedData),
    archived: row.archived,
    archivedAt: toUnixMillisOrNull(row.archivedAt),
    createdAt: toUnixMillis(row.createdAt),
  };
}

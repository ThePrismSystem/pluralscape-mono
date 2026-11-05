import { pollVotes } from "@pluralscape/db/pg";
import { brandId, toUnixMillis, toUnixMillisOrNull } from "@pluralscape/types";

import { encryptedBlobToBase64 } from "../../lib/encrypted-blob.js";

import type {
  PollVoteResult,
  PollId,
  PollOptionId,
  PollVoteId,
  SystemId,
} from "@pluralscape/types";

export function toVoteResult(row: typeof pollVotes.$inferSelect): PollVoteResult {
  return {
    id: brandId<PollVoteId>(row.id),
    systemId: brandId<SystemId>(row.systemId),
    pollId: brandId<PollId>(row.pollId),
    optionId: row.optionId ? brandId<PollOptionId>(row.optionId) : null,
    voter: row.voter,
    isVeto: row.isVeto,
    votedAt: toUnixMillis(row.votedAt),
    encryptedData: encryptedBlobToBase64(row.encryptedData),
    version: row.version,
    archived: row.archived,
    archivedAt: toUnixMillisOrNull(row.archivedAt),
    createdAt: toUnixMillis(row.createdAt),
    updatedAt: toUnixMillis(row.updatedAt),
  };
}

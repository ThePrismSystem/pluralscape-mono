import { pollVotes } from "@pluralscape/db/pg";
import { brandId, toUnixMillis, toUnixMillisOrNull } from "@pluralscape/types";

import { encryptedBlobToBase64 } from "../../lib/encrypted-blob.js";

import type {
  EntityReference,
  PollId,
  PollOptionId,
  PollVoteId,
  SystemId,
  UnixMillis,
} from "@pluralscape/types";

export interface PollVoteResult {
  readonly id: PollVoteId;
  readonly systemId: SystemId;
  readonly pollId: PollId;
  readonly optionId: PollOptionId | null;
  readonly voter: EntityReference<"member" | "structure-entity"> | null;
  readonly isVeto: boolean;
  readonly votedAt: UnixMillis;
  readonly encryptedData: string;
  readonly version: number;
  readonly archived: boolean;
  readonly archivedAt: UnixMillis | null;
  readonly createdAt: UnixMillis;
  readonly updatedAt: UnixMillis;
}

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

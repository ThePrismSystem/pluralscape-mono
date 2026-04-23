import type { EncryptedBlob } from "../encryption-primitives.js";
import type { PollId, PollOptionId, PollVoteId, SystemId } from "../ids.js";
import type { UnixMillis } from "../timestamps.js";
import type { Serialize } from "../type-assertions.js";
import type { Archived, EntityReference } from "../utility.js";

/** A vote cast on a poll option. Null optionId indicates abstain. */
export interface PollVote {
  readonly id: PollVoteId;
  readonly pollId: PollId;
  readonly optionId: PollOptionId | null;
  readonly voter: EntityReference<"member" | "structure-entity">;
  readonly comment: string | null;
  readonly isVeto: boolean;
  readonly votedAt: UnixMillis;
  readonly archived: false;
}

/** An archived poll vote. */
export type ArchivedPollVote = Archived<PollVote>;

/**
 * Server-visible PollVote metadata — raw Drizzle row shape.
 *
 * Hybrid entity: the polymorphic `voter` reference is stored as jsonb on the
 * DB row so the discriminator and ID travel together for efficient queries;
 * the value is nullable at rest to accommodate provisional rows. The
 * optional `comment` is bundled inside the opaque `encryptedData` blob,
 * which itself is nullable (a no-comment vote needs no ciphertext).
 * `archived: false` on the domain flips to a mutable boolean here, with a
 * companion `archivedAt` timestamp. The server row also carries the
 * owning `systemId` FK (denormalized for partition-safe cascades) and the
 * full `AuditMetadata` triple, neither of which appears on the domain.
 */
export type PollVoteServerMetadata = Omit<
  PollVote,
  "comment" | "voter" | "isVeto" | "votedAt" | "archived"
> & {
  readonly systemId: SystemId;
  readonly voter: EntityReference<"member" | "structure-entity"> | null;
  readonly isVeto: boolean | null;
  readonly votedAt: UnixMillis | null;
  readonly createdAt: UnixMillis;
  readonly updatedAt: UnixMillis;
  readonly version: number;
  readonly archived: boolean;
  readonly archivedAt: UnixMillis | null;
  readonly encryptedData: EncryptedBlob | null;
};

/**
 * JSON-wire representation of a PollVote. Derived from the domain
 * `PollVote` type via `Serialize<T>`; branded IDs become plain strings,
 * `UnixMillis` becomes `number`.
 */
export type PollVoteWire = Serialize<PollVote>;

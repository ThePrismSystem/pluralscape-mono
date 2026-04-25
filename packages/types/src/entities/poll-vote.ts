import type { EncryptedWire } from "../encrypted-wire.js";
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
 * Keys of `PollVote` that are encrypted client-side before the server sees
 * them. The server stores ciphertext in `encryptedData`; the `voter` reference
 * is stored as jsonb in the clear for efficient queries.
 * Consumed by:
 * - `PollVoteServerMetadata` (derived via `Omit`)
 * - `PollVoteEncryptedInput = Pick<PollVote, PollVoteEncryptedFields>`
 * - `scripts/openapi-wire-parity.type-test.ts` (PlaintextPollVote parity)
 */
export type PollVoteEncryptedFields = "comment";

/**
 * Domain field that is plaintext (not encrypted) but restructured on the
 * server row into multiple flat columns. `voter` is a polymorphic
 * `EntityReference<...>` on the domain — on the server row it is split
 * into `voterEntityType` + `voterEntityId`.
 *
 * Distinguished from `PollVoteEncryptedFields` (which lists keys whose
 * values ride inside the encryptedData blob).
 */
export type PollVoteRestructuredPlaintextFields = "voter";

/**
 * Server-visible PollVote metadata — raw Drizzle row shape.
 *
 * Hybrid entity: the polymorphic `voter` reference is stored as jsonb on the
 * DB row so the discriminator and ID travel together for efficient queries;
 * the column is nullable in Drizzle (a CHECK constraint enforces non-null at
 * the DB level, but Drizzle's inferred type remains nullable). The optional
 * `comment` is bundled inside the opaque `encryptedData` blob.
 * `archived: false` on the domain flips to a mutable boolean here, with a
 * companion `archivedAt` timestamp. The server row also carries the
 * owning `systemId` FK (denormalized for partition-safe cascades) and the
 * full `AuditMetadata` triple, neither of which appears on the domain.
 */
export type PollVoteServerMetadata = Omit<
  PollVote,
  PollVoteEncryptedFields | PollVoteRestructuredPlaintextFields | "archived"
> & {
  readonly systemId: SystemId;
  readonly voter: EntityReference<"member" | "structure-entity"> | null;
  readonly createdAt: UnixMillis;
  readonly updatedAt: UnixMillis;
  readonly version: number;
  readonly archived: boolean;
  readonly archivedAt: UnixMillis | null;
  readonly encryptedData: EncryptedBlob;
};

/**
 * Pre-encryption shape — what `encryptPollVoteInput` accepts. Single source of
 * truth: derived from `PollVote` via `Pick<>` over the encrypted-keys union.
 */
export type PollVoteEncryptedInput = Pick<PollVote, PollVoteEncryptedFields>;

/**
 * Server-emit shape — what `toPollVoteResult` returns. Branded IDs and
 * timestamps preserved; `encryptedData` is wire-form `EncryptedBase64`.
 */
export type PollVoteResult = EncryptedWire<PollVoteServerMetadata>;

/**
 * JSON-serialized wire form of `PollVoteResult`: branded IDs become plain
 * strings; `EncryptedBase64` becomes plain `string`; timestamps become numbers.
 */
export type PollVoteWire = Serialize<PollVoteResult>;

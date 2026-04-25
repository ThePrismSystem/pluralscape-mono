import type { EncryptedWire } from "../encrypted-wire.js";
import type { EncryptedBlob } from "../encryption-primitives.js";
import type { BoardMessageId, MemberId, SystemId } from "../ids.js";
import type { UnixMillis } from "../timestamps.js";
import type { Serialize } from "../type-assertions.js";
import type { Archived, AuditMetadata } from "../utility.js";

/** A longer-form message posted to a board. */
export interface BoardMessage extends AuditMetadata {
  readonly id: BoardMessageId;
  readonly systemId: SystemId;
  readonly senderId: MemberId;
  readonly content: string;
  readonly pinned: boolean;
  readonly sortOrder: number;
  readonly archived: false;
}

/** An archived board message. */
export type ArchivedBoardMessage = Archived<BoardMessage>;

/**
 * Keys of `BoardMessage` that are encrypted client-side before the server
 * sees them. The server stores ciphertext in `encryptedData`; the plaintext
 * columns are `pinned` and `sortOrder`.
 * Consumed by:
 * - `BoardMessageServerMetadata` (derived via `Omit`)
 * - `BoardMessageEncryptedInput = Pick<BoardMessage, BoardMessageEncryptedFields>`
 * - `scripts/openapi-wire-parity.type-test.ts` (PlaintextBoardMessage parity)
 */
export type BoardMessageEncryptedFields = "senderId" | "content";

/**
 * Server-visible BoardMessage metadata — raw Drizzle row shape.
 *
 * Hybrid entity: plaintext columns (`pinned`, `sortOrder`) alongside the
 * opaque `encryptedData` blob carrying the encrypted `senderId` and
 * `content`. `archived: false` on the domain flips to a mutable boolean
 * here, with a companion `archivedAt` timestamp.
 */
export type BoardMessageServerMetadata = Omit<
  BoardMessage,
  BoardMessageEncryptedFields | "archived"
> & {
  readonly archived: boolean;
  readonly archivedAt: UnixMillis | null;
  readonly encryptedData: EncryptedBlob;
};

/**
 * Pre-encryption shape — what `encryptBoardMessageInput` accepts. Single
 * source of truth: derived from `BoardMessage` via `Pick<>` over the
 * encrypted-keys union.
 */
export type BoardMessageEncryptedInput = Pick<BoardMessage, BoardMessageEncryptedFields>;

/**
 * Server-emit shape — what `toBoardMessageResult` returns. Branded IDs and
 * timestamps preserved; `encryptedData` is wire-form `EncryptedBase64`.
 */
export type BoardMessageResult = EncryptedWire<BoardMessageServerMetadata>;

/**
 * JSON-serialized wire form of `BoardMessageResult`: branded IDs become plain
 * strings; `EncryptedBase64` becomes plain `string`; timestamps become numbers.
 */
export type BoardMessageWire = Serialize<BoardMessageResult>;

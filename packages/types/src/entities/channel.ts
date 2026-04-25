import type { EncryptedWire } from "../encrypted-wire.js";
import type { EncryptedBlob } from "../encryption-primitives.js";
import type { ChannelId, SystemId } from "../ids.js";
import type { UnixMillis } from "../timestamps.js";
import type { Serialize } from "../type-assertions.js";
import type { Archived, AuditMetadata } from "../utility.js";

/** A communication channel or category within a system. */
export interface Channel extends AuditMetadata {
  readonly id: ChannelId;
  readonly systemId: SystemId;
  readonly name: string;
  readonly type: "category" | "channel";
  /** Parent category ID. Null for categories and uncategorized channels. */
  readonly parentId: ChannelId | null;
  readonly sortOrder: number;
  readonly archived: false;
}

/** An archived channel. */
export type ArchivedChannel = Archived<Channel>;

/**
 * Keys of `Channel` that are encrypted client-side before the server sees
 * them. The server stores ciphertext in `encryptedData`; the plaintext
 * columns are `type`, `parentId`, and `sortOrder`.
 * Consumed by:
 * - `ChannelServerMetadata` (derived via `Omit`)
 * - `ChannelEncryptedInput = Pick<Channel, ChannelEncryptedFields>`
 * - `scripts/openapi-wire-parity.type-test.ts` (PlaintextChannel parity)
 */
export type ChannelEncryptedFields = "name";

/**
 * Server-visible Channel metadata — raw Drizzle row shape.
 *
 * Hybrid entity: plaintext columns (`type`, `parentId`, `sortOrder`) alongside
 * the opaque `encryptedData` blob carrying the encrypted `name`. The domain's
 * `name` field is absent from the server row — the server cannot read channel
 * names. `archived: false` on the domain flips to a mutable boolean here, with
 * a companion `archivedAt` timestamp.
 */
export type ChannelServerMetadata = Omit<Channel, ChannelEncryptedFields | "archived"> & {
  readonly archived: boolean;
  readonly archivedAt: UnixMillis | null;
  readonly encryptedData: EncryptedBlob;
};

/**
 * Pre-encryption shape — what `encryptChannelInput` accepts. Single source of
 * truth: derived from `Channel` via `Pick<>` over the encrypted-keys union.
 */
export type ChannelEncryptedInput = Pick<Channel, ChannelEncryptedFields>;

/**
 * Server-emit shape — what `toChannelResult` returns. Branded IDs and
 * timestamps preserved; `encryptedData` is wire-form `EncryptedBase64`.
 */
export type ChannelResult = EncryptedWire<ChannelServerMetadata>;

/**
 * JSON-serialized wire form of `ChannelResult`: branded IDs become plain
 * strings; `EncryptedBase64` becomes plain `string`; timestamps become numbers.
 */
export type ChannelWire = Serialize<ChannelResult>;

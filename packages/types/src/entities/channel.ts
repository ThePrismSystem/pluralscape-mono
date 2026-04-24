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
 * Server-visible Channel metadata — raw Drizzle row shape.
 *
 * Hybrid entity: plaintext columns (`type`, `parentId`, `sortOrder`) alongside
 * the opaque `encryptedData` blob carrying the encrypted `name`. The domain's
 * `name` field is absent from the server row — the server cannot read channel
 * names. `archived: false` on the domain flips to a mutable boolean here, with
 * a companion `archivedAt` timestamp.
 */
export type ChannelServerMetadata = Omit<Channel, "name" | "archived"> & {
  readonly archived: boolean;
  readonly archivedAt: UnixMillis | null;
  readonly encryptedData: EncryptedBlob;
};

/**
 * JSON-wire representation of a Channel. Derived from the domain `Channel`
 * type via `Serialize<T>`; branded IDs become plain strings, `UnixMillis`
 * becomes `number`.
 */
export type ChannelWire = Serialize<Channel>;

import type { EncryptedBlob } from "../encryption-primitives.js";
import type { BlobId, ChannelId, MemberId, MessageId, SystemId } from "../ids.js";
import type { UnixMillis } from "../timestamps.js";
import type { Serialize } from "../type-assertions.js";
import type { Archived, AuditMetadata } from "../utility.js";

/** A real-time chat message in a channel. */
export interface ChatMessage extends AuditMetadata {
  readonly id: MessageId;
  readonly channelId: ChannelId;
  readonly systemId: SystemId;
  readonly senderId: MemberId;
  readonly content: string;
  readonly attachments: readonly BlobId[];
  readonly mentions: readonly MemberId[];
  readonly replyToId: MessageId | null;
  readonly timestamp: UnixMillis;
  readonly editedAt: UnixMillis | null;
  readonly archived: false;
}

/** An archived chat message. */
export type ArchivedChatMessage = Archived<ChatMessage>;

/**
 * Server-visible ChatMessage metadata — raw Drizzle row shape.
 *
 * Hybrid entity: plaintext columns (`channelId`, `replyToId`, `timestamp`,
 * `editedAt`) plus opaque `encryptedData` carrying the encrypted `content`,
 * `senderId`, `attachments`, and `mentions`. Messages are partitioned by
 * timestamp (ADR 019). `archived: false` on the domain flips to a mutable
 * boolean here, with a companion `archivedAt` timestamp.
 */
export type ChatMessageServerMetadata = Omit<
  ChatMessage,
  "senderId" | "content" | "attachments" | "mentions" | "archived"
> & {
  readonly archived: boolean;
  readonly archivedAt: UnixMillis | null;
  readonly encryptedData: EncryptedBlob;
};

/**
 * JSON-wire representation of a ChatMessage. Derived from the domain
 * `ChatMessage` type via `Serialize<T>`; branded IDs become plain strings,
 * `UnixMillis` becomes `number`.
 */
export type ChatMessageWire = Serialize<ChatMessage>;

import type { EncryptedWire } from "../encrypted-wire.js";
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
 * Keys of `ChatMessage` that are encrypted client-side before the server sees
 * them. The server stores ciphertext in `encryptedData`; the plaintext columns
 * are `channelId`, `replyToId`, `timestamp`, and `editedAt`.
 * Consumed by:
 * - `ChatMessageServerMetadata` (derived via `Omit`)
 * - `ChatMessageEncryptedInput = Pick<ChatMessage, ChatMessageEncryptedFields>`
 * - `scripts/openapi-wire-parity.type-test.ts` (PlaintextChatMessage parity)
 */
export type ChatMessageEncryptedFields = "content" | "senderId" | "attachments" | "mentions";

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
  ChatMessageEncryptedFields | "archived"
> & {
  readonly archived: boolean;
  readonly archivedAt: UnixMillis | null;
  readonly encryptedData: EncryptedBlob;
};

// ── Canonical chain (see ADR-023) ────────────────────────────────────
// ChatMessageEncryptedInput → ChatMessageServerMetadata
//                          → ChatMessageResult → ChatMessageWire
// Per-alias JSDoc is intentionally minimal; the alias name plus the
// chain anchor above carries the meaning. Per-alias docs only appear
// when an entity diverges from the standard pattern.

export type ChatMessageEncryptedInput = Pick<ChatMessage, ChatMessageEncryptedFields>;

export type ChatMessageResult = EncryptedWire<ChatMessageServerMetadata>;

export type ChatMessageWire = Serialize<ChatMessageResult>;

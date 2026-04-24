import type { KdfMasterKey } from "./crypto-keys.js";
import type { BucketId } from "./ids.js";

// ── Tier wrappers ──────────────────────────────────────────────

declare const __encTier: unique symbol;

/** T1 zero-knowledge: wrapped value cannot be read by the server. */
export type Encrypted<T> = T & { readonly [__encTier]: 1 };

/** T2 per-bucket: wrapped value is encrypted with a bucket key for friend sharing. */
export type BucketEncrypted<T> = T & { readonly [__encTier]: 2 };

// T3 is plaintext — no wrapper needed. Fields at T3 appear as plain types
// in server-side interfaces (see tier map at bottom of file).

export declare const __plaintext: unique symbol;

/** Marks a value as having been decrypted — used to track provenance in audit logs. */
export type Plaintext<T> = T & { readonly [__plaintext]: true };

// ── EncryptionAlgorithm ────────────────────────────────────────

/** Supported encryption algorithms for EncryptedBlob. */
export type EncryptionAlgorithm = "xchacha20-poly1305";

// ── EncryptedBlob ──────────────────────────────────────────────

/** Shared fields across all encrypted blob tiers. */
interface EncryptedBlobBase {
  readonly ciphertext: Uint8Array;
  readonly nonce: Uint8Array;
  readonly algorithm: EncryptionAlgorithm;
  readonly keyVersion: number | null;
}

/** T1 zero-knowledge blob — encrypted with the system master key. No bucket association. */
export interface T1EncryptedBlob extends EncryptedBlobBase {
  readonly tier: 1;
  readonly keyVersion: null;
  readonly bucketId: null;
}

/** T2 per-bucket blob — encrypted with a bucket-specific key. Always has a bucketId. */
export interface T2EncryptedBlob extends EncryptedBlobBase {
  readonly tier: 2;
  readonly bucketId: BucketId;
}

/** Wire format for encrypted data. Discriminated union on `tier`. */
export type EncryptedBlob = T1EncryptedBlob | T2EncryptedBlob;

// ── EncryptedString ────────────────────────────────────────────

declare const __encStr: unique symbol;

/** Branded string to prevent accidental logging or display of ciphertext. */
export type EncryptedString = string & { readonly [__encStr]: true };

// ── ServerSecret ───────────────────────────────────────────────

declare const __serverSecret: unique symbol;

/**
 * Branded type for server-held HMAC signing secrets. These are raw binary keys
 * the server reads to sign webhook deliveries — NOT E2E encrypted data.
 */
export type ServerSecret = Uint8Array & { readonly [__serverSecret]: true };

// ── Server/Client variant pattern ──────────────────────────────
// Server types carry EncryptedBlob; Client types have flat decrypted fields.
// Only defined for completed domain modules.
// MemberServerMetadata / MemberWire live in entities/member.ts.
// AuditLogEntryServerMetadata / AuditLogEntryWire live in entities/audit-log-entry.ts.

// ── Members ────────────────────────────────────────────────────
// MemberPhoto ServerMetadata + Wire types live in entities/member-photo.ts.

// ── Groups ─────────────────────────────────────────────────────
// Group ServerMetadata + Wire types live in entities/group.ts.

// ── Structure entities ─────────────────────────────────────────
// StructureEntityType / StructureEntity ServerMetadata + Wire types live in
// their respective entity files (structure-entity-type.ts, structure-entity.ts).

// ── Relationships ──────────────────────────────────────────────
// Relationship ServerMetadata + Wire types live in entities/relationship.ts.

// ── Custom fronts ──────────────────────────────────────────────
// CustomFront ServerMetadata + Wire types live in entities/custom-front.ts.

// ── Custom fields ──────────────────────────────────────────────
// FieldDefinition / FieldValue ServerMetadata + Wire types live in their
// respective entity files (field-definition.ts, field-value.ts).

// ── Fronting ───────────────────────────────────────────────────
// FrontingSession / FrontingComment ServerMetadata + Wire types live in their
// respective entity files (fronting-session.ts, fronting-comment.ts).

// ── Lifecycle ──────────────────────────────────────────────────
// LifecycleEvent ServerMetadata + Wire types live in entities/lifecycle-event.ts.

// ── Communication ──────────────────────────────────────────────
// Channel / ChatMessage / BoardMessage / Note ServerMetadata + Wire types
// live in their respective entity files (channel.ts, message.ts,
// board-message.ts, note.ts).

// ── Journal ────────────────────────────────────────────────────
// JournalEntry / WikiPage ServerMetadata + Wire types live in their
// respective entity files (journal-entry.ts, wiki-page.ts).

// ── Polls + Acknowledgement + Timer ────────────────────────────
// Poll / PollVote / AcknowledgementRequest / TimerConfig ServerMetadata +
// Wire types live in their respective entity files (poll.ts, poll-vote.ts,
// acknowledgement.ts, timer-config.ts).

// ── Mapping utility types ──────────────────────────────────────

/** Maps a server type to its client-side equivalent via decryption. */
export type DecryptFn<ServerT, ClientT> = (server: ServerT, masterKey: KdfMasterKey) => ClientT;

/** Maps a client type to its server-side equivalent via encryption. */
export type EncryptFn<ClientT, ServerT> = (client: ClientT, masterKey: KdfMasterKey) => ServerT;

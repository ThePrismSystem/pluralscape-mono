import type { EncryptedWire } from "../encrypted-wire.js";
import type { EncryptedBlob } from "../encryption-primitives.js";
import type {
  BlobId,
  CustomFrontId,
  EntityType,
  FrontingSessionId,
  JournalEntryId,
  MemberId,
  SystemId,
  SystemStructureEntityId,
} from "../ids.js";
import type { UnixMillis } from "../timestamps.js";
import type { Serialize } from "../type-assertions.js";
import type { Archived, AuditMetadata, EntityReference } from "../utility.js";

// ── Journal Block types (discriminated union) ──────────────────────

/** Shared base fields for all journal block types (unexported). */
interface JournalBlockBase {
  readonly children: readonly JournalBlock[];
}

/** A paragraph of text. */
export interface ParagraphBlock extends JournalBlockBase {
  readonly type: "paragraph";
  readonly content: string;
}

/** Valid heading levels (1-6, matching HTML h1-h6). */

export type HeadingLevel = 1 | 2 | 3 | 4 | 5 | 6;

/** A heading with level 1-6. */
export interface HeadingBlock extends JournalBlockBase {
  readonly type: "heading";
  readonly content: string;
  readonly level: HeadingLevel;
}

/** An ordered or unordered list. */
export interface ListBlock extends JournalBlockBase {
  readonly type: "list";
  readonly items: readonly string[];
  readonly ordered: boolean;
}

/** A block quote. */
export interface QuoteBlock extends JournalBlockBase {
  readonly type: "quote";
  readonly content: string;
}

/** A code block with optional language. */
export interface CodeBlock extends JournalBlockBase {
  readonly type: "code";
  readonly content: string;
  readonly language: string | null;
}

/** An image referenced by blob ID. */
export interface ImageBlock extends JournalBlockBase {
  readonly type: "image";
  readonly blobId: BlobId;
  readonly caption: string | null;
}

/** A horizontal divider with no content. */
export interface DividerBlock extends JournalBlockBase {
  readonly type: "divider";
}

/** A link to a member within the system. */
export interface MemberLinkBlock extends JournalBlockBase {
  readonly type: "member-link";
  readonly memberId: MemberId;
  readonly displayText: string;
}

/** A link to any entity in the system. */
export interface EntityLinkBlock extends JournalBlockBase {
  readonly type: "entity-link";
  readonly entityType: EntityType;
  readonly entityId: string;
  readonly displayText: string;
}

/** All journal block variants — discriminated on type. */
export type JournalBlock =
  | ParagraphBlock
  | HeadingBlock
  | ListBlock
  | QuoteBlock
  | CodeBlock
  | ImageBlock
  | DividerBlock
  | MemberLinkBlock
  | EntityLinkBlock;

/** The set of valid journal block type strings. */
export type JournalBlockType = JournalBlock["type"];

// ── Entity links ───────────────────────────────────────────────────

/** An entity link connecting a journal/wiki to another entity. */
export interface EntityLink {
  readonly entityType: EntityType;
  readonly entityId: string;
  readonly displayText: string;
}

// ── Fronting snapshot ──────────────────────────────────────────────

/** Shared base fields for all fronting snapshot entry variants (unexported). */
interface FrontingSnapshotEntryBase {
  readonly sessionId: FrontingSessionId;
  readonly structureEntityId: SystemStructureEntityId | null;
  readonly startTime: UnixMillis;
}

/** A fronting snapshot entry for a member. */
export interface MemberFrontingSnapshotEntry extends FrontingSnapshotEntryBase {
  readonly kind: "member";
  readonly memberId: MemberId;
}

/** A fronting snapshot entry for a custom front. */
export interface CustomFrontFrontingSnapshotEntry extends FrontingSnapshotEntryBase {
  readonly kind: "custom-front";
  readonly customFrontId: CustomFrontId;
}

/** A single fronter in a fronting snapshot — discriminated on kind. */
export type FrontingSnapshotEntry = MemberFrontingSnapshotEntry | CustomFrontFrontingSnapshotEntry;

/** A point-in-time capture of who is fronting, attached to a journal entry. */
export interface FrontingSnapshot {
  readonly capturedAt: UnixMillis;
  readonly entries: readonly FrontingSnapshotEntry[];
}

// ── Journal entries ────────────────────────────────────────────────

/** A journal entry authored by a member or structure entity. */
export interface JournalEntry extends AuditMetadata {
  readonly id: JournalEntryId;
  readonly systemId: SystemId;
  readonly author: EntityReference<"member" | "structure-entity"> | null;
  readonly frontingSessionId: FrontingSessionId | null;
  readonly title: string;
  readonly blocks: readonly JournalBlock[];
  readonly tags: readonly string[];
  readonly linkedEntities: readonly EntityLink[];
  /** Point-in-time snapshots of who was fronting. Stored in T1 encrypted blob. */
  readonly frontingSnapshots: readonly FrontingSnapshot[] | null;
  readonly archived: false;
}

/** An archived journal entry. */
export type ArchivedJournalEntry = Archived<JournalEntry>;

/**
 * Keys of `JournalEntry` that are encrypted client-side before the server
 * sees them. The server stores ciphertext in `encryptedData`; the only
 * plaintext column (besides the audit triple and `systemId`/`id`) is
 * `frontingSessionId`, kept in the clear as a FK for efficient joins.
 * Consumed by:
 * - `JournalEntryServerMetadata` (derived via `Omit`)
 * - `JournalEntryEncryptedInput = Pick<JournalEntry, JournalEntryEncryptedFields>`
 * - `scripts/openapi-wire-parity.type-test.ts` (PlaintextJournalEntry parity)
 */
export type JournalEntryEncryptedFields =
  | "title"
  | "author"
  | "blocks"
  | "tags"
  | "linkedEntities"
  | "frontingSnapshots";

/**
 * Server-visible JournalEntry metadata — raw Drizzle row shape.
 *
 * Hybrid entity: the only plaintext column (besides the audit triple and
 * `systemId`/`id`) is `frontingSessionId`, kept in the clear as a FK into
 * the partitioned fronting-sessions table for efficient joins. Everything
 * else (title, author, blocks, tags, linkedEntities, frontingSnapshots) is
 * bundled inside the opaque `encryptedData` blob. `archived: false` on the
 * domain flips to a mutable boolean here, with a companion `archivedAt`
 * timestamp.
 */
export type JournalEntryServerMetadata = Omit<
  JournalEntry,
  JournalEntryEncryptedFields | "archived"
> & {
  readonly archived: boolean;
  readonly archivedAt: UnixMillis | null;
  readonly encryptedData: EncryptedBlob;
};

// ── Canonical chain (see ADR-023) ────────────────────────────────────
// JournalEntryEncryptedInput → JournalEntryServerMetadata
//                           → JournalEntryResult → JournalEntryWire
// Per-alias JSDoc is intentionally minimal; the alias name plus the
// chain anchor above carries the meaning. Per-alias docs only appear
// when an entity diverges from the standard pattern.

export type JournalEntryEncryptedInput = Pick<JournalEntry, JournalEntryEncryptedFields>;

export type JournalEntryResult = EncryptedWire<JournalEntryServerMetadata>;

export type JournalEntryWire = Serialize<JournalEntryResult>;

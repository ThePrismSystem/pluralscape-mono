import type { EncryptedWire } from "../encrypted-wire.js";
import type { EncryptedBlob } from "../encryption-primitives.js";
import type { SlugHash, SystemId, WikiPageId } from "../ids.js";
import type { UnixMillis } from "../timestamps.js";
import type { Serialize } from "../type-assertions.js";
import type { Archived, AuditMetadata } from "../utility.js";
import type { EntityLink, JournalBlock } from "./journal-entry.js";

/** A wiki page for persistent system documentation. */
export interface WikiPage extends AuditMetadata {
  readonly id: WikiPageId;
  readonly systemId: SystemId;
  readonly title: string;
  readonly slug: string;
  readonly blocks: readonly JournalBlock[];
  readonly linkedFromPages: readonly WikiPageId[];
  readonly tags: readonly string[];
  readonly linkedEntities: readonly EntityLink[];
  readonly archived: false;
}

/** An archived wiki page. */
export type ArchivedWikiPage = Archived<WikiPage>;

/**
 * Keys of `WikiPage` that are encrypted client-side before the server sees
 * them. Every domain field except `systemId`, `id`, and the audit triple is
 * bundled inside the opaque `encryptedData` blob. The server row substitutes a
 * plaintext `slugHash` (SHA-256 of the decrypted slug) so uniqueness on
 * `(systemId, slug)` can be enforced without the server ever reading the slug.
 * Consumed by:
 * - `WikiPageServerMetadata` (derived via `Omit`)
 * - `WikiPageEncryptedInput = Pick<WikiPage, WikiPageEncryptedFields>`
 * - `scripts/openapi-wire-parity.type-test.ts` (PlaintextWikiPage parity)
 */
export type WikiPageEncryptedFields =
  | "title"
  | "slug"
  | "blocks"
  | "linkedFromPages"
  | "tags"
  | "linkedEntities";

/**
 * Server-visible WikiPage metadata — raw Drizzle row shape.
 *
 * Hybrid entity: every domain field except `systemId`, `id`, and the audit
 * triple is bundled inside the opaque `encryptedData` blob. The server row
 * substitutes a plaintext `slugHash` (SHA-256 of the decrypted slug) so
 * uniqueness on `(systemId, slug)` can be enforced without the server ever
 * reading the slug itself. `archived: false` on the domain flips to a mutable
 * boolean here, with a companion `archivedAt` timestamp.
 */
export type WikiPageServerMetadata = Omit<WikiPage, WikiPageEncryptedFields | "archived"> & {
  readonly slugHash: SlugHash;
  readonly archived: boolean;
  readonly archivedAt: UnixMillis | null;
  readonly encryptedData: EncryptedBlob;
};

/**
 * Pre-encryption shape — what `encryptWikiPageInput` accepts. Single source of
 * truth: derived from `WikiPage` via `Pick<>` over the encrypted-keys union.
 */
export type WikiPageEncryptedInput = Pick<WikiPage, WikiPageEncryptedFields>;

/**
 * Server-emit shape — what `toWikiPageResult` returns. Branded IDs and
 * timestamps preserved; `encryptedData` is wire-form `EncryptedBase64`.
 */
export type WikiPageResult = EncryptedWire<WikiPageServerMetadata>;

/**
 * JSON-serialized wire form of `WikiPageResult`: branded IDs become plain
 * strings; `EncryptedBase64` becomes plain `string`; timestamps become numbers.
 */
export type WikiPageWire = Serialize<WikiPageResult>;

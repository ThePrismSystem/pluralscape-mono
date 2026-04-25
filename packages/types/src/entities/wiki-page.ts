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
 * Keys of `WikiPage` that are encrypted client-side. Defined by exclusion
 * (every domain field except `id`, `systemId`, `archived`, and the audit
 * triple) so that adding a new field to `WikiPage` cannot silently escape
 * encryption — the `Exclude` reflects the policy "encrypt by default".
 *
 * Consumed by:
 * - `WikiPageServerMetadata` (derived via `Omit`)
 * - `WikiPageEncryptedInput = Pick<WikiPage, WikiPageEncryptedFields>`
 * - `scripts/openapi-wire-parity.type-test.ts` (PlaintextWikiPage parity)
 */
export type WikiPageEncryptedFields = Exclude<
  keyof WikiPage,
  "id" | "systemId" | "archived" | keyof AuditMetadata
>;

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
 * Pre-encryption shape — the projection of `WikiPage` over its
 * encrypted-keys union. The transform layer (when added) will accept
 * this shape and produce the encrypted wire body.
 */
export type WikiPageEncryptedInput = Pick<WikiPage, WikiPageEncryptedFields>;

/**
 * Server-emit shape for `WikiPage`: branded IDs and timestamps preserved;
 * `encryptedData` is wire-form `EncryptedBase64`.
 */
export type WikiPageResult = EncryptedWire<WikiPageServerMetadata>;

/**
 * JSON-serialized wire form of `WikiPageResult`: branded IDs become plain
 * strings; `EncryptedBase64` becomes plain `string`; timestamps become numbers.
 */
export type WikiPageWire = Serialize<WikiPageResult>;

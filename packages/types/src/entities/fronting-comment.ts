import type { EncryptedWire } from "../encrypted-wire.js";
import type { EncryptedBlob } from "../encryption-primitives.js";
import type {
  CustomFrontId,
  FrontingCommentId,
  FrontingSessionId,
  MemberId,
  SystemId,
  SystemStructureEntityId,
} from "../ids.js";
import type { ServerInternal } from "../server-internal.js";
import type { UnixMillis } from "../timestamps.js";
import type { Serialize } from "../type-assertions.js";
import type { Archived, AuditMetadata } from "../utility.js";

/** A comment on a fronting session — unlimited length, multiple per session. */
export interface FrontingComment extends AuditMetadata {
  readonly id: FrontingCommentId;
  readonly frontingSessionId: FrontingSessionId;
  readonly systemId: SystemId;
  readonly memberId: MemberId | null;
  readonly customFrontId: CustomFrontId | null;
  readonly structureEntityId: SystemStructureEntityId | null;
  readonly content: string;
  readonly archived: false;
}

/**
 * Keys of `FrontingComment` that are encrypted client-side before the
 * server sees them. Plaintext siblings (`frontingSessionId`, `memberId`,
 * `customFrontId`, `structureEntityId`) travel as separate request fields
 * and are intentionally excluded. Consumed by:
 * - `__sot-manifest__.ts` (manifest's `encryptedFields` slot)
 * - `FrontingCommentServerMetadata` (derived via `Omit`)
 * - `scripts/openapi-wire-parity.type-test.ts` (PlaintextFrontingComment parity)
 */
export type FrontingCommentEncryptedFields = "content";

/**
 * Pre-encryption shape — what `encryptFrontingCommentInput` accepts. Single source
 * of truth: derived from `FrontingComment` via `Pick<>` over the encrypted-keys union.
 */
export type FrontingCommentEncryptedInput = Pick<FrontingComment, FrontingCommentEncryptedFields>;

/** An archived fronting comment. */
export type ArchivedFrontingComment = Archived<FrontingComment>;

/**
 * Server-visible FrontingComment metadata — raw Drizzle row shape.
 *
 * Derived from `FrontingComment` by stripping the encrypted field keys
 * (bundled inside `encryptedData`) and `archived` (the domain uses a
 * `false` literal that toggles to `true` via `Archived<T>`; the server
 * tracks a mutable boolean with a companion `archivedAt` timestamp).
 * Adds `sessionStartTime` — denormalized from the parent fronting session
 * to support the composite FK into the partitioned `fronting_sessions`
 * table (ADR 019) — plus `archived`/`archivedAt` and the encrypted blob.
 */
export type FrontingCommentServerMetadata = Omit<
  FrontingComment,
  FrontingCommentEncryptedFields | "archived"
> & {
  /**
   * Denormalized from parent fronting session for FK on partitioned table
   * (ADR 019). Server-internal — stripped from the wire by `EncryptedWire<T>`.
   */
  readonly sessionStartTime: ServerInternal<UnixMillis>;
  readonly archived: boolean;
  readonly archivedAt: UnixMillis | null;
  readonly encryptedData: EncryptedBlob;
};

/**
 * Server-emit shape — what `toFrontingCommentResult` returns. Branded IDs and
 * timestamps preserved; `encryptedData` is wire-form `EncryptedBase64`.
 */
export type FrontingCommentResult = EncryptedWire<FrontingCommentServerMetadata>;

/**
 * JSON-serialized wire form of `FrontingCommentResult`: branded IDs become plain strings;
 * `EncryptedBase64` becomes plain `string`; timestamps become numbers.
 */
export type FrontingCommentWire = Serialize<FrontingCommentResult>;

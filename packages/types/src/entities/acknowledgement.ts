import type { EncryptedWire } from "../encrypted-wire.js";
import type { EncryptedBlob } from "../encryption-primitives.js";
import type { AcknowledgementId, MemberId, SystemId } from "../ids.js";
import type { UnixMillis } from "../timestamps.js";
import type { Serialize } from "../type-assertions.js";
import type { Archived, AuditMetadata } from "../utility.js";

/** A request for a member to acknowledge a message or decision. */
export interface AcknowledgementRequest extends AuditMetadata {
  readonly id: AcknowledgementId;
  readonly systemId: SystemId;
  readonly createdByMemberId: MemberId;
  readonly targetMemberId: MemberId;
  readonly message: string;
  readonly confirmed: boolean;
  readonly confirmedAt: UnixMillis | null;
  readonly archived: false;
}

/** An archived acknowledgement request. */
export type ArchivedAcknowledgementRequest = Archived<AcknowledgementRequest>;

/**
 * Keys of `AcknowledgementRequest` that are encrypted client-side before the
 * server sees them. The server stores ciphertext in `encryptedData`; the
 * plaintext columns on the server row are `confirmed` and `createdByMemberId`
 * (nullable on the server row to support imported acknowledgements).
 * Consumed by:
 * - `AcknowledgementRequestServerMetadata` (derived via `Omit`)
 * - `AcknowledgementRequestEncryptedInput = Pick<AcknowledgementRequest, AcknowledgementRequestEncryptedFields>`
 * - `scripts/openapi-wire-parity.type-test.ts` (PlaintextAcknowledgementRequest parity)
 */
export type AcknowledgementRequestEncryptedFields = "message" | "targetMemberId" | "confirmedAt";

/**
 * Server-visible AcknowledgementRequest metadata — raw Drizzle row shape.
 *
 * Hybrid entity: the `message`, `targetMemberId`, and `confirmedAt` fields
 * are bundled inside the opaque `encryptedData` blob — the target member is
 * encrypted so the server can't trace acknowledgement patterns. The
 * plaintext `confirmed` flag + `createdByMemberId` FK are kept in the clear
 * for queryability. `createdByMemberId` is nullable on the server row to
 * support acknowledgements imported from external sources (no originating
 * member). `archived: false` on the domain flips to a mutable boolean here,
 * with a companion `archivedAt` timestamp.
 */
export type AcknowledgementRequestServerMetadata = Omit<
  AcknowledgementRequest,
  AcknowledgementRequestEncryptedFields | "createdByMemberId" | "archived"
> & {
  readonly createdByMemberId: MemberId | null;
  readonly archived: boolean;
  readonly archivedAt: UnixMillis | null;
  readonly encryptedData: EncryptedBlob;
};

/**
 * Pre-encryption shape — what `encryptAcknowledgementInput` accepts.
 * Single source of truth: derived from `AcknowledgementRequest` via `Pick<>`
 * over the encrypted-keys union.
 */
export type AcknowledgementRequestEncryptedInput = Pick<
  AcknowledgementRequest,
  AcknowledgementRequestEncryptedFields
>;

/**
 * Server-emit shape — what `toAcknowledgementRequestResult` returns. Branded
 * IDs and timestamps preserved; `encryptedData` is wire-form `EncryptedBase64`.
 */
export type AcknowledgementRequestResult = EncryptedWire<AcknowledgementRequestServerMetadata>;

/**
 * JSON-serialized wire form of `AcknowledgementRequestResult`: branded IDs
 * become plain strings; `EncryptedBase64` becomes plain `string`; timestamps
 * become numbers.
 */
export type AcknowledgementRequestWire = Serialize<AcknowledgementRequestResult>;

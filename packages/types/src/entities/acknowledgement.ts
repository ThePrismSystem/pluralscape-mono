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
  readonly createdByMemberId: MemberId | null;
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
 * plaintext `confirmed` flag + nullable `createdByMemberId` FK are kept in
 * the clear for queryability (the FK is nullable on both the server row and
 * the domain to support acknowledgements imported from external sources where
 * no originating member is known). `archived: false` on the domain flips to
 * a mutable boolean here, with a companion `archivedAt` timestamp.
 */
export type AcknowledgementRequestServerMetadata = Omit<
  AcknowledgementRequest,
  AcknowledgementRequestEncryptedFields | "archived"
> & {
  readonly archived: boolean;
  readonly archivedAt: UnixMillis | null;
  readonly encryptedData: EncryptedBlob;
};

// ── Canonical chain (see ADR-023) ────────────────────────────────────
// AcknowledgementRequestEncryptedInput → AcknowledgementRequestServerMetadata
//                                     → AcknowledgementRequestResult → AcknowledgementRequestWire
// Per-alias JSDoc is intentionally minimal; the alias name plus the
// chain anchor above carries the meaning. Per-alias docs only appear
// when an entity diverges from the standard pattern.

export type AcknowledgementRequestEncryptedInput = Pick<
  AcknowledgementRequest,
  AcknowledgementRequestEncryptedFields
>;

export type AcknowledgementRequestResult = EncryptedWire<AcknowledgementRequestServerMetadata>;

export type AcknowledgementRequestWire = Serialize<AcknowledgementRequestResult>;

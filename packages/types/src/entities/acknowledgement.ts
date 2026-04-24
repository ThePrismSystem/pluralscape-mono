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
  "createdByMemberId" | "targetMemberId" | "message" | "confirmedAt" | "archived"
> & {
  readonly createdByMemberId: MemberId | null;
  readonly archived: boolean;
  readonly archivedAt: UnixMillis | null;
  readonly encryptedData: EncryptedBlob;
};

/**
 * JSON-wire representation of an AcknowledgementRequest. Derived from the
 * domain `AcknowledgementRequest` type via `Serialize<T>`; branded IDs
 * become plain strings, `UnixMillis` becomes `number`.
 */
export type AcknowledgementRequestWire = Serialize<AcknowledgementRequest>;

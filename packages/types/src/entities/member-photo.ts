import type { EncryptedBlob } from "../encryption-primitives.js";
import type { MemberId, MemberPhotoId, SystemId } from "../ids.js";
import type { ImageSource } from "../image-source.js";
import type { UnixMillis } from "../timestamps.js";
import type { Serialize } from "../type-assertions.js";
import type { Archived, AuditMetadata } from "../utility.js";

/** A photo in a member's multi-photo gallery. */
export interface MemberPhoto {
  readonly id: MemberPhotoId;
  readonly memberId: MemberId;
  readonly imageSource: ImageSource;
  readonly sortOrder: number;
  readonly caption: string | null;
  readonly archived: false;
}

/**
 * Keys of `MemberPhoto` that are encrypted client-side before the server
 * sees them. Consumed by:
 * - `__sot-manifest__.ts` (manifest's `encryptedFields` slot)
 * - `scripts/openapi-wire-parity.type-test.ts` (PlaintextMemberPhoto parity)
 * - `MemberPhotoServerMetadata` (derived via `Omit`)
 */
export type MemberPhotoEncryptedFields = "imageSource" | "sortOrder" | "caption";

/** An archived member photo — preserves all data with archive metadata. */
export type ArchivedMemberPhoto = Archived<MemberPhoto>;

/** Request body for creating a member photo. */
export interface CreateMemberPhotoBody {
  readonly encryptedData: string;
  readonly sortOrder?: number;
}

/**
 * Server-visible MemberPhoto metadata — raw Drizzle row shape.
 *
 * Derived from `MemberPhoto` by stripping the encrypted field keys bundled
 * inside `encryptedData` and `archived` (server tracks a mutable boolean
 * with a companion `archivedAt` timestamp, domain uses `false` literal).
 * Adds DB-only columns the domain type doesn't carry: `systemId`
 * (denormalized from `members` for RLS), `sortOrder` kept plaintext in DB
 * for index-based ordering (present in domain but marked encrypted),
 * full `AuditMetadata` (`createdAt`/`updatedAt`/`version`),
 * `encryptedData` (the T1 blob), and `archived`/`archivedAt`.
 */
export type MemberPhotoServerMetadata = Omit<MemberPhoto, MemberPhotoEncryptedFields | "archived"> &
  AuditMetadata & {
    readonly systemId: SystemId;
    readonly sortOrder: number;
    readonly encryptedData: EncryptedBlob;
    readonly archived: boolean;
    readonly archivedAt: UnixMillis | null;
  };

/**
 * JSON-wire representation of a MemberPhoto. Derived from the domain
 * `MemberPhoto` type via `Serialize<T>`; branded IDs become plain strings.
 */
export type MemberPhotoWire = Serialize<MemberPhoto>;

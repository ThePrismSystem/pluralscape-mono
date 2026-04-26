import type { EncryptedWire } from "../encrypted-wire.js";
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
export type MemberPhotoEncryptedFields = "imageSource" | "caption";

// ── Canonical chain (see ADR-023) ────────────────────────────────────
// MemberPhotoEncryptedInput → MemberPhotoServerMetadata
//                          → MemberPhotoResult → MemberPhotoWire
// Per-alias JSDoc is intentionally minimal; the alias name plus the
// chain anchor above carries the meaning. Per-alias docs only appear
// when an entity diverges from the standard pattern.

export type MemberPhotoEncryptedInput = Pick<MemberPhoto, MemberPhotoEncryptedFields>;

/** An archived member photo — preserves all data with archive metadata. */
export type ArchivedMemberPhoto = Archived<MemberPhoto>;

/**
 * Server-visible MemberPhoto metadata — raw Drizzle row shape.
 *
 * Derived from `MemberPhoto` by stripping the encrypted field keys
 * (`imageSource`, `caption`) that ride inside `encryptedData`, and
 * `archived` (server tracks a mutable boolean with a companion
 * `archivedAt` timestamp; the domain uses the `false` literal).
 *
 * Adds DB-only columns the domain type doesn't carry:
 * - `systemId` — denormalized from `members` for RLS
 * - `encryptedData: EncryptedBlob` — T1 blob carrying the encrypted fields
 * - `archived: boolean` / `archivedAt` — archive lifecycle columns
 * - full `AuditMetadata` (`createdAt` / `updatedAt` / `version`)
 *
 * `sortOrder` is plaintext on both sides and flows through from `MemberPhoto`
 * via the `Omit`; no re-declaration needed.
 */
export type MemberPhotoServerMetadata = Omit<MemberPhoto, MemberPhotoEncryptedFields | "archived"> &
  AuditMetadata & {
    readonly systemId: SystemId;
    readonly encryptedData: EncryptedBlob;
    readonly archived: boolean;
    readonly archivedAt: UnixMillis | null;
  };

export type MemberPhotoResult = EncryptedWire<MemberPhotoServerMetadata>;

export type MemberPhotoWire = Serialize<MemberPhotoResult>;

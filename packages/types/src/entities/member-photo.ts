import type { MemberId, MemberPhotoId } from "../ids.js";
import type { ImageSource } from "../image-source.js";
import type { Archived } from "../utility.js";

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
 * - Plan 2 fleet will consume when deriving `MemberPhotoServerMetadata`.
 */
export type MemberPhotoEncryptedFields = "imageSource" | "sortOrder" | "caption";

/** An archived member photo — preserves all data with archive metadata. */
export type ArchivedMemberPhoto = Archived<MemberPhoto>;

/** Request body for creating a member photo. */
export interface CreateMemberPhotoBody {
  readonly encryptedData: string;
  readonly sortOrder?: number;
}

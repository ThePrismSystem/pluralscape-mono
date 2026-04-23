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

/** An archived member photo — preserves all data with archive metadata. */
export type ArchivedMemberPhoto = Archived<MemberPhoto>;

/** Request body for creating a member photo. */
export interface CreateMemberPhotoBody {
  readonly encryptedData: string;
  readonly sortOrder?: number;
}

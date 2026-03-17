import type { HexColor, MemberId, MemberPhotoId, SystemId, SystemSettingsId } from "./ids.js";
import type { ImageSource } from "./image-source.js";
import type { Archived, AuditMetadata } from "./utility.js";

/** A plural system — the top-level account entity. */
export interface System extends AuditMetadata {
  readonly id: SystemId;
  readonly name: string;
  readonly displayName: string | null;
  readonly description: string | null;
  readonly avatarSource: ImageSource | null;
  readonly settingsId: SystemSettingsId;
}

/** Well-known saturation levels describing how elaborated a member is within the system. */
export type KnownSaturationLevel =
  | "fragment"
  | "functional-fragment"
  | "partially-elaborated"
  | "highly-elaborated";

/** How elaborated a member is — either a well-known level or a user-defined custom level. */
export type SaturationLevel =
  | { readonly kind: "known"; readonly level: KnownSaturationLevel }
  | { readonly kind: "custom"; readonly value: string };

/**
 * Well-known tags recognized by the application.
 * These have special semantics (e.g. "little" triggers Littles Safe Mode).
 */
export type KnownTag =
  | "protector"
  | "gatekeeper"
  | "caretaker"
  | "little"
  | "age-slider"
  | "trauma-holder"
  | "host"
  | "persecutor"
  | "mediator"
  | "anp"
  | "memory-holder"
  | "symptom-holder"
  | "middle"
  | "introject"
  | "fictive"
  | "factive"
  | "non-human";

/** A tag — either a well-known tag or a user-defined custom tag. */
export type Tag =
  | { readonly kind: "known"; readonly tag: KnownTag }
  | { readonly kind: "custom"; readonly value: string };

/** A member (headmate) within a plural system. */
export interface Member extends AuditMetadata {
  readonly id: MemberId;
  readonly systemId: SystemId;
  readonly name: string;
  readonly pronouns: readonly string[];
  readonly description: string | null;
  readonly avatarSource: ImageSource | null;
  readonly colors: readonly HexColor[];
  readonly saturationLevel: SaturationLevel;
  readonly tags: readonly Tag[];
  /** When true, friends are not notified when this member starts fronting. */
  readonly suppressFriendFrontNotification: boolean;
  /** When true, a board message is posted when this member starts fronting. */
  readonly boardMessageNotificationOnFront: boolean;
  readonly archived: false;
}

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

/** An archived member — preserves all data with archive metadata. */
export type ArchivedMember = Archived<Member>;

/** Lightweight projection of a member for list views. */
export interface MemberListItem {
  readonly id: MemberId;
  readonly name: string;
  readonly avatarSource: ImageSource | null;
  readonly colors: readonly HexColor[];
  readonly archived: boolean;
}

/** @future Multi-system switcher list item — not yet implemented. */
export interface SystemListItem {
  readonly id: SystemId;
  readonly name: string;
  readonly avatarSource: ImageSource | null;
}

// ── Request body types ──────────────────────────────────────────

/** Request body for creating a member. */
export interface CreateMemberBody {
  readonly encryptedData: string;
}

/** Request body for updating a member. */
export interface UpdateMemberBody {
  readonly encryptedData: string;
  readonly version: number;
}

/** Request body for creating a member photo. */
export interface CreateMemberPhotoBody {
  readonly encryptedData: string;
  readonly sortOrder?: number;
}

/** Request body for duplicating a member. */
export interface DuplicateMemberBody {
  readonly encryptedData: string;
  readonly copyPhotos: boolean;
  readonly copyFields: boolean;
  readonly copyMemberships: boolean;
}

/** @future System duplication scope controls — not yet implemented. */
export interface SystemDuplicationScope {
  readonly members: boolean;
  readonly photos: boolean;
  readonly customFields: boolean;
  readonly groups: boolean;
  /** Subsystems, side systems, layers, memberships, and cross-structure links. */
  readonly structure: boolean;
  readonly relationships: boolean;
  readonly frontingHistory: boolean;
  /** Channels, messages, boards, notes, polls. */
  readonly communication: boolean;
  readonly journal: boolean;
  readonly wiki: boolean;
  readonly innerworld: boolean;
  readonly settings: boolean;
}

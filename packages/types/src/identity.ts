import type {
  BlobId,
  HexColor,
  MemberId,
  MemberPhotoId,
  SystemId,
  SystemSettingsId,
} from "./ids.js";
import type { UnixMillis } from "./timestamps.js";
import type { AuditMetadata } from "./utility.js";

/** A plural system — the top-level account entity. */
export interface System extends AuditMetadata {
  readonly id: SystemId;
  readonly name: string;
  readonly displayName: string | null;
  readonly description: string | null;
  readonly avatarRef: BlobId | null;
  readonly settingsId: SystemSettingsId;
}

/** How fully formed a member is within the system. */
export type CompletenessLevel = "fragment" | "demi-member" | "full";

/**
 * Well-known role tags recognized by the application.
 * These have special semantics (e.g. "little" triggers Littles Safe Mode).
 */
export type KnownRoleTag =
  | "protector"
  | "gatekeeper"
  | "caretaker"
  | "little"
  | "age-slider"
  | "trauma-holder"
  | "host"
  | "persecutor"
  | "mediator";

/** A role tag — either a well-known tag or a user-defined custom tag. */
export type RoleTag =
  | { readonly kind: "known"; readonly tag: KnownRoleTag }
  | { readonly kind: "custom"; readonly value: string };

/** A member (headmate) within a plural system. */
export interface Member extends AuditMetadata {
  readonly id: MemberId;
  readonly systemId: SystemId;
  readonly name: string;
  readonly pronouns: readonly string[];
  readonly description: string | null;
  readonly avatarRef: BlobId | null;
  readonly colors: readonly HexColor[];
  readonly completenessLevel: CompletenessLevel;
  readonly roleTags: readonly RoleTag[];
  readonly archived: false;
}

/** A photo in a member's multi-photo gallery. */
export interface MemberPhoto {
  readonly id: MemberPhotoId;
  readonly memberId: MemberId;
  readonly blobRef: BlobId;
  readonly sortOrder: number;
  readonly caption: string | null;
}

/** An archived member — preserves all data with archive metadata. */
export type ArchivedMember = Omit<Member, "archived"> & {
  readonly archived: true;
  readonly archivedAt: UnixMillis;
};

/** Lightweight projection of a member for list views. */
export interface MemberListItem {
  readonly id: MemberId;
  readonly name: string;
  readonly avatarRef: BlobId | null;
  readonly colors: readonly HexColor[];
  readonly archived: boolean;
}

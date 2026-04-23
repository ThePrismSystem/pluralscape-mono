import type { EncryptedBlob } from "../encryption-primitives.js";
import type { HexColor, MemberId, SystemId } from "../ids.js";
import type { ImageSource } from "../image-source.js";
import type { UnixMillis } from "../timestamps.js";
import type { Serialize } from "../type-assertions.js";
import type { Archived, AuditMetadata } from "../utility.js";

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

/** Request body for duplicating a member. */
export interface DuplicateMemberBody {
  readonly encryptedData: string;
  readonly copyPhotos: boolean;
  readonly copyFields: boolean;
  readonly copyMemberships: boolean;
}

/**
 * Server-visible Member metadata — raw Drizzle row shape.
 * T1 encrypted (inside `encryptedData`): name, pronouns, description, tags,
 *   colors, avatarSource, saturationLevel, suppressFriendFrontNotification,
 *   boardMessageNotificationOnFront
 * T3 plaintext columns: id, systemId, archived, audit timestamps
 */
export interface MemberServerMetadata extends AuditMetadata {
  readonly id: MemberId;
  readonly systemId: SystemId;
  readonly archived: boolean;
  readonly archivedAt: UnixMillis | null;
  readonly encryptedData: EncryptedBlob;
}

/**
 * JSON-wire representation of a Member. Derived from the domain `Member`
 * type via `Serialize<T>`; branded IDs become plain strings, `UnixMillis`
 * becomes `number`.
 *
 * This is what crosses the HTTP boundary for Member payloads. The OpenAPI
 * parity gate asserts `components["schemas"]["Member"]` ≡ `MemberWire`.
 */
export type MemberWire = Serialize<Member>;

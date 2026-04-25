import type { EncryptedWire } from "../encrypted-wire.js";
import type { EncryptedBlob } from "../encryption-primitives.js";
import type { HexColor, MemberId, SystemId } from "../ids.js";
import type { ImageSource } from "../image-source.js";
import type { UnixMillis } from "../timestamps.js";
import type { Serialize } from "../type-assertions.js";
import type { Archived, AuditMetadata } from "../utility.js";

/**
 * Well-known saturation levels describing how elaborated a member is within the system.
 *
 * Exported as an `as const` tuple so runtime validators (Zod enums) can derive
 * their allowed values from the same source as the TS union. This prevents
 * enum drift: adding a new literal here automatically propagates to every
 * consumer deriving from `KNOWN_SATURATION_LEVELS`.
 */
export const KNOWN_SATURATION_LEVELS = [
  "fragment",
  "functional-fragment",
  "partially-elaborated",
  "highly-elaborated",
] as const;

export type KnownSaturationLevel = (typeof KNOWN_SATURATION_LEVELS)[number];

/** How elaborated a member is — either a well-known level or a user-defined custom level. */
export type SaturationLevel =
  | { readonly kind: "known"; readonly level: KnownSaturationLevel }
  | { readonly kind: "custom"; readonly value: string };

/**
 * Well-known tags recognized by the application.
 * These have special semantics (e.g. "little" triggers Littles Safe Mode).
 *
 * Exported as an `as const` tuple so runtime validators (Zod enums) can derive
 * their allowed values from the same source as the TS union — see the note on
 * `KNOWN_SATURATION_LEVELS`.
 */
export const KNOWN_TAGS = [
  "protector",
  "gatekeeper",
  "caretaker",
  "little",
  "age-slider",
  "trauma-holder",
  "host",
  "persecutor",
  "mediator",
  "anp",
  "memory-holder",
  "symptom-holder",
  "middle",
  "introject",
  "fictive",
  "factive",
  "non-human",
] as const;

export type KnownTag = (typeof KNOWN_TAGS)[number];

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

/**
 * Keys of `Member` that are encrypted client-side before the server sees them.
 * T1 fields are encrypted with the system master key; T2 fields (`avatarSource`)
 * are encrypted with the bucket key. Both tiers are zero-knowledge from the
 * server's perspective — the server only ever stores opaque ciphertext.
 *
 * This keys-union is consumed by:
 * - `MemberServerMetadata` (derived via `Omit`)
 * - `MemberEncryptedInput` in `packages/data` (derived via `Pick`)
 * - `PlaintextMember` OpenAPI parity in `scripts/openapi-wire-parity.type-test.ts`
 */
export type MemberEncryptedFields =
  | "name"
  | "pronouns"
  | "description"
  | "avatarSource"
  | "colors"
  | "saturationLevel"
  | "tags"
  | "suppressFriendFrontNotification"
  | "boardMessageNotificationOnFront";

/**
 * Pre-encryption shape — what `encryptMemberInput` accepts before
 * producing the wire-form `{ encryptedData: string }`. Single source of
 * truth: derived from `Member` via `Pick<>` over the encrypted-keys union.
 */
export type MemberEncryptedInput = Pick<Member, MemberEncryptedFields>;

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

/**
 * Server-visible Member metadata — raw Drizzle row shape.
 *
 * Derived from `Member` by stripping the encrypted field keys (bundled inside
 * `encryptedData`) plus `archived` (the server tracks a mutable boolean with
 * a companion `archivedAt` timestamp, while the domain uses a `false` literal
 * that toggles to `true` via the `Archived<T>` helper). The server sees
 * everything in `Member` EXCEPT the encrypted keys.
 */
export type MemberServerMetadata = Omit<Member, MemberEncryptedFields | "archived"> & {
  readonly archived: boolean;
  readonly archivedAt: UnixMillis | null;
  readonly encryptedData: EncryptedBlob;
};

/**
 * Server-emit shape — what `toMemberResult` returns. Branded IDs
 * preserved; `encryptedData` is `EncryptedBase64` (base64-encoded).
 * Consumed by the API layer; not the JSON wire shape.
 */
export type MemberResult = EncryptedWire<MemberServerMetadata>;

/**
 * JSON-wire representation of a Member response. `Serialize<>` over
 * `MemberResult`: branded IDs become plain strings; `EncryptedBase64`
 * becomes `string`; `UnixMillis` becomes `number`. The OpenAPI
 * parity gate asserts `components["schemas"]["MemberResponse"]` ≡ `MemberWire`.
 */
export type MemberWire = Serialize<MemberResult>;

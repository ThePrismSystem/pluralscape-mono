import {
  FriendDashboardCustomFrontBlobSchema,
  FriendDashboardFrontingSessionBlobSchema,
  FriendDashboardMemberBlobSchema,
  FriendDashboardStructureEntityBlobSchema,
} from "@pluralscape/validation";

import { decodeAndDecryptT2, extractT2BucketId } from "./decode-blob.js";

import type { AeadKey } from "@pluralscape/crypto";
import type {
  BucketId,
  CustomFrontId,
  FriendDashboardCustomFront,
  FriendDashboardFrontingSession,
  FriendDashboardMember,
  FriendDashboardResponse,
  FriendDashboardStructureEntity,
  FrontingSessionId,
  HexColor,
  ImageSource,
  MemberId,
  OuttriggerSentiment,
  SystemStructureEntityId,
  UnixMillis,
} from "@pluralscape/types";

// ── Bucket key resolver ───────────────────────────────────────────

/** Callback that resolves a bucket key by ID, returning undefined if unavailable. */
export type BucketKeyResolver = (bucketId: BucketId) => AeadKey | undefined;

// ── Decrypted dashboard interfaces ───────────────────────────────

/** Decrypted member fields from a friend dashboard T2 blob. */
export interface DecryptedDashboardMember {
  readonly id: MemberId;
  readonly name: string;
  readonly pronouns: readonly string[];
  readonly description: string | null;
  readonly colors: readonly (HexColor | null)[];
}

/** Decrypted fronting session fields from a friend dashboard T2 blob. */
export interface DecryptedDashboardFrontingSession {
  readonly id: FrontingSessionId;
  readonly memberId: MemberId | null;
  readonly customFrontId: CustomFrontId | null;
  readonly structureEntityId: SystemStructureEntityId | null;
  readonly startTime: UnixMillis;
  readonly comment: string | null;
  readonly positionality: string | null;
  readonly outtrigger: string | null;
  readonly outtriggerSentiment: OuttriggerSentiment | null;
}

/** Decrypted custom front fields from a friend dashboard T2 blob. */
export interface DecryptedDashboardCustomFront {
  readonly id: CustomFrontId;
  readonly name: string;
  readonly description: string | null;
  readonly color: HexColor | null;
  readonly emoji: string | null;
}

/** Decrypted structure entity fields from a friend dashboard T2 blob. */
export interface DecryptedDashboardStructureEntity {
  readonly id: SystemStructureEntityId;
  readonly name: string;
  readonly description: string | null;
  readonly emoji: string | null;
  readonly color: HexColor | null;
  readonly imageSource: ImageSource | null;
}

/** Fully decrypted friend dashboard. */
export interface DecryptedFriendDashboard {
  readonly systemId: FriendDashboardResponse["systemId"];
  readonly memberCount: number;
  readonly activeFronting: {
    readonly sessions: readonly DecryptedDashboardFrontingSession[];
    readonly isCofronting: boolean;
  };
  readonly visibleMembers: readonly DecryptedDashboardMember[];
  readonly visibleCustomFronts: readonly DecryptedDashboardCustomFront[];
  readonly visibleStructureEntities: readonly DecryptedDashboardStructureEntity[];
}

// ── Per-entity decrypt functions ──────────────────────────────────

/** Decrypt a single friend dashboard member T2 blob. */
export function decryptDashboardMember(
  raw: FriendDashboardMember,
  bucketKey: AeadKey,
): DecryptedDashboardMember {
  const plaintext = decodeAndDecryptT2(raw.encryptedData, bucketKey);
  const parsed = FriendDashboardMemberBlobSchema.parse(plaintext);

  return {
    id: raw.id,
    name: parsed.name,
    pronouns: parsed.pronouns ?? [],
    description: parsed.description ?? null,
    colors: (parsed.colors as readonly (HexColor | null)[] | undefined) ?? [],
  };
}

/** Decrypt a single friend dashboard fronting session T2 blob. */
export function decryptDashboardFrontingSession(
  raw: FriendDashboardFrontingSession,
  bucketKey: AeadKey,
): DecryptedDashboardFrontingSession {
  const plaintext = decodeAndDecryptT2(raw.encryptedData, bucketKey);
  const parsed = FriendDashboardFrontingSessionBlobSchema.parse(plaintext);

  return {
    id: raw.id,
    memberId: raw.memberId,
    customFrontId: raw.customFrontId,
    structureEntityId: raw.structureEntityId,
    startTime: raw.startTime,
    comment: parsed.comment ?? null,
    positionality: parsed.positionality ?? null,
    outtrigger: parsed.outtrigger ?? null,
    outtriggerSentiment:
      (parsed.outtriggerSentiment as OuttriggerSentiment | null | undefined) ?? null,
  };
}

/** Decrypt a single friend dashboard custom front T2 blob. */
export function decryptDashboardCustomFront(
  raw: FriendDashboardCustomFront,
  bucketKey: AeadKey,
): DecryptedDashboardCustomFront {
  const plaintext = decodeAndDecryptT2(raw.encryptedData, bucketKey);
  const parsed = FriendDashboardCustomFrontBlobSchema.parse(plaintext);

  return {
    id: raw.id,
    name: parsed.name,
    description: parsed.description ?? null,
    color: (parsed.color as HexColor | null | undefined) ?? null,
    emoji: parsed.emoji ?? null,
  };
}

/** Decrypt a single friend dashboard structure entity T2 blob. */
export function decryptDashboardStructureEntity(
  raw: FriendDashboardStructureEntity,
  bucketKey: AeadKey,
): DecryptedDashboardStructureEntity {
  const plaintext = decodeAndDecryptT2(raw.encryptedData, bucketKey);
  const parsed = FriendDashboardStructureEntityBlobSchema.parse(plaintext);

  return {
    id: raw.id,
    name: parsed.name,
    description: parsed.description ?? null,
    emoji: parsed.emoji ?? null,
    color: (parsed.color as HexColor | null | undefined) ?? null,
    imageSource: parsed.imageSource ?? null,
  };
}

// ── Composite decrypt ─────────────────────────────────────────────

/**
 * Decrypt all entities in a friend dashboard response using bucket keys.
 *
 * Each entity's T2 blob is associated with a bucket via the serialized blob
 * header. The resolver provides the matching AEAD key. Entities whose bucket
 * key is unavailable are silently skipped.
 */
export function decryptFriendDashboard(
  raw: FriendDashboardResponse,
  getBucketKey: BucketKeyResolver,
): DecryptedFriendDashboard {
  // Collect available keys from keyGrants — the dashboard tells us which bucketIds exist.
  const availableKeys = new Map<BucketId, AeadKey>();
  for (const grant of raw.keyGrants) {
    const key = getBucketKey(grant.bucketId);
    if (key) {
      availableKeys.set(grant.bucketId, key);
    }
  }

  if (availableKeys.size === 0) {
    return {
      systemId: raw.systemId,
      memberCount: raw.memberCount,
      activeFronting: { sessions: [], isCofronting: raw.activeFronting.isCofronting },
      visibleMembers: [],
      visibleCustomFronts: [],
      visibleStructureEntities: [],
    };
  }

  function decryptAll<TRaw extends { readonly encryptedData: string }, TOut>(
    items: readonly TRaw[],
    fn: (item: TRaw, key: AeadKey) => TOut,
  ): readonly TOut[] {
    const results: TOut[] = [];
    for (const item of items) {
      const bucketId = extractT2BucketId(item.encryptedData);
      const key = availableKeys.get(bucketId);
      if (!key) {
        // Bucket key unavailable — entity is in a bucket we lack access to
        continue;
      }
      results.push(fn(item, key));
    }
    return results;
  }

  return {
    systemId: raw.systemId,
    memberCount: raw.memberCount,
    activeFronting: {
      sessions: decryptAll(raw.activeFronting.sessions, decryptDashboardFrontingSession),
      isCofronting: raw.activeFronting.isCofronting,
    },
    visibleMembers: decryptAll(raw.visibleMembers, decryptDashboardMember),
    visibleCustomFronts: decryptAll(raw.visibleCustomFronts, decryptDashboardCustomFront),
    visibleStructureEntities: decryptAll(
      raw.visibleStructureEntities,
      decryptDashboardStructureEntity,
    ),
  };
}

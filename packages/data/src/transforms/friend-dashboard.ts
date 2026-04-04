import {
  assertObjectBlob,
  assertStringField,
  decodeAndDecryptT2,
  extractT2BucketId,
} from "./decode-blob.js";

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

// ── Validators ────────────────────────────────────────────────────

function assertMemberBlob(raw: unknown): Record<string, unknown> {
  const obj = assertObjectBlob(raw, "dashboard member");
  assertStringField(obj, "dashboard member", "name");
  return obj;
}

function assertFrontingSessionBlob(raw: unknown): Record<string, unknown> {
  return assertObjectBlob(raw, "dashboard fronting session");
}

function assertCustomFrontBlob(raw: unknown): Record<string, unknown> {
  const obj = assertObjectBlob(raw, "dashboard custom front");
  assertStringField(obj, "dashboard custom front", "name");
  return obj;
}

function assertStructureEntityBlob(raw: unknown): Record<string, unknown> {
  const obj = assertObjectBlob(raw, "dashboard structure entity");
  assertStringField(obj, "dashboard structure entity", "name");
  return obj;
}

// ── Per-entity decrypt functions ──────────────────────────────────

/** Decrypt a single friend dashboard member T2 blob. */
export function decryptDashboardMember(
  raw: FriendDashboardMember,
  bucketKey: AeadKey,
): DecryptedDashboardMember {
  const plaintext = decodeAndDecryptT2(raw.encryptedData, bucketKey);
  const obj = assertMemberBlob(plaintext);

  return {
    id: raw.id,
    name: obj["name"] as string,
    pronouns: (obj["pronouns"] as readonly string[] | undefined) ?? [],
    description: (obj["description"] as string | null) ?? null,
    colors: (obj["colors"] as readonly (HexColor | null)[] | undefined) ?? [],
  };
}

/** Decrypt a single friend dashboard fronting session T2 blob. */
export function decryptDashboardFrontingSession(
  raw: FriendDashboardFrontingSession,
  bucketKey: AeadKey,
): DecryptedDashboardFrontingSession {
  const plaintext = decodeAndDecryptT2(raw.encryptedData, bucketKey);
  const obj = assertFrontingSessionBlob(plaintext);

  return {
    id: raw.id,
    memberId: raw.memberId,
    customFrontId: raw.customFrontId,
    structureEntityId: raw.structureEntityId,
    startTime: raw.startTime,
    comment: (obj["comment"] as string | null) ?? null,
    positionality: (obj["positionality"] as string | null) ?? null,
    outtrigger: (obj["outtrigger"] as string | null) ?? null,
    outtriggerSentiment: (obj["outtriggerSentiment"] as OuttriggerSentiment | null) ?? null,
  };
}

/** Decrypt a single friend dashboard custom front T2 blob. */
export function decryptDashboardCustomFront(
  raw: FriendDashboardCustomFront,
  bucketKey: AeadKey,
): DecryptedDashboardCustomFront {
  const plaintext = decodeAndDecryptT2(raw.encryptedData, bucketKey);
  const obj = assertCustomFrontBlob(plaintext);

  return {
    id: raw.id,
    name: obj["name"] as string,
    description: (obj["description"] as string | null) ?? null,
    color: (obj["color"] as HexColor | null) ?? null,
    emoji: (obj["emoji"] as string | null) ?? null,
  };
}

/** Decrypt a single friend dashboard structure entity T2 blob. */
export function decryptDashboardStructureEntity(
  raw: FriendDashboardStructureEntity,
  bucketKey: AeadKey,
): DecryptedDashboardStructureEntity {
  const plaintext = decodeAndDecryptT2(raw.encryptedData, bucketKey);
  const obj = assertStructureEntityBlob(plaintext);

  return {
    id: raw.id,
    name: obj["name"] as string,
    description: (obj["description"] as string | null) ?? null,
    emoji: (obj["emoji"] as string | null) ?? null,
    color: (obj["color"] as HexColor | null) ?? null,
    imageSource: (obj["imageSource"] as ImageSource | null) ?? null,
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

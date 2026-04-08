/**
 * Friendship + pending friend request mapper.
 *
 * SP `friends` (confirmed) and `pendingFriendRequests` both produce the
 * same {@link MappedFriendship} shape, discriminated by `status`. The SP
 * remote user identifier (`frienduid` or `sender`) is preserved as an
 * opaque source-side reference — Pluralscape never dereferences it into a
 * local member, so it does not go through the translation table.
 *
 * Neither mapper touches the translation table, so they do not take a
 * `MappingContext` parameter — the engine's dispatcher is aware of the
 * per-mapper signature and calls these without one.
 *
 * Neither mapper fails: friendship records are standalone rows with no
 * foreign keys into other imported collections.
 */
import { mapped, type MapperResult } from "./mapper-result.js";

import type { SPFriend, SPPendingFriendRequest } from "../sources/sp-types.js";

export interface MappedFriendship {
  readonly externalUserId: string;
  readonly status: "accepted" | "pending";
  readonly seeMembers: boolean;
  readonly seeFront: boolean;
  readonly trusted: boolean;
  readonly getFrontNotif: boolean;
  readonly createdAt: number | null;
}

export function mapFriendship(sp: SPFriend): MapperResult<MappedFriendship> {
  const payload: MappedFriendship = {
    externalUserId: sp.frienduid,
    status: "accepted",
    seeMembers: sp.seeMembers ?? false,
    seeFront: sp.seeFront ?? false,
    trusted: sp.trusted ?? false,
    getFrontNotif: sp.getFrontNotif ?? false,
    createdAt: null,
  };
  return mapped(payload);
}

export function mapPendingFriendRequest(
  sp: SPPendingFriendRequest,
): MapperResult<MappedFriendship> {
  const payload: MappedFriendship = {
    externalUserId: sp.sender,
    status: "pending",
    seeMembers: false,
    seeFront: false,
    trusted: false,
    getFrontNotif: false,
    createdAt: sp.time,
  };
  return mapped(payload);
}

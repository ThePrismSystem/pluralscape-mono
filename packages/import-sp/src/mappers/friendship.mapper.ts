/**
 * Friendship + pending friend request mapper.
 *
 * SP `friends` (confirmed) and `pendingFriendRequests` both produce the
 * same {@link MappedFriendship} shape, discriminated by `status`. The SP
 * remote user identifier (`frienduid` or `sender`) is preserved as an
 * opaque source-side reference — Pluralscape never dereferences it into a
 * local member, so it does not go through the translation table.
 *
 * Both mappers accept a `MappingContext` to keep the per-mapper signature
 * uniform across the engine's dispatcher, even though they currently use
 * neither the translation table nor the warning buffer. Friendship records
 * are standalone rows with no foreign keys into other imported collections,
 * so neither mapper fails.
 */
import { mapped, type MapperResult } from "./mapper-result.js";

import type { MappingContext } from "./context.js";
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

export function mapFriendship(sp: SPFriend, ctx: MappingContext): MapperResult<MappedFriendship> {
  // Uniform signature with the rest of the engine's mappers; this mapper
  // currently uses neither the translation table nor the warning buffer.
  void ctx;
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
  ctx: MappingContext,
): MapperResult<MappedFriendship> {
  // Uniform signature with the rest of the engine's mappers; this mapper
  // currently uses neither the translation table nor the warning buffer.
  void ctx;
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

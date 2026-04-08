import { describe, expect, it } from "vitest";

import { createMappingContext } from "../../mappers/context.js";
import { mapFriendship, mapPendingFriendRequest } from "../../mappers/friendship.mapper.js";

import type { SPFriend, SPPendingFriendRequest } from "../../sources/sp-types.js";

describe("mapFriendship", () => {
  it("maps a minimal accepted friendship with flag defaults", () => {
    const ctx = createMappingContext({ sourceMode: "fake" });
    const sp: SPFriend = { _id: "f1", frienduid: "remote_user_1" };
    const result = mapFriendship(sp, ctx);
    expect(result.status).toBe("mapped");
    if (result.status === "mapped") {
      expect(result.payload.externalUserId).toBe("remote_user_1");
      expect(result.payload.status).toBe("accepted");
      expect(result.payload.seeMembers).toBe(false);
      expect(result.payload.seeFront).toBe(false);
      expect(result.payload.trusted).toBe(false);
      expect(result.payload.getFrontNotif).toBe(false);
      expect(result.payload.createdAt).toBeNull();
    }
  });

  it("preserves all friendship flags when set", () => {
    const ctx = createMappingContext({ sourceMode: "fake" });
    const sp: SPFriend = {
      _id: "f2",
      frienduid: "remote_user_2",
      seeMembers: true,
      seeFront: true,
      trusted: true,
      getFrontNotif: true,
    };
    const result = mapFriendship(sp, ctx);
    if (result.status === "mapped") {
      expect(result.payload.seeMembers).toBe(true);
      expect(result.payload.seeFront).toBe(true);
      expect(result.payload.trusted).toBe(true);
      expect(result.payload.getFrontNotif).toBe(true);
    }
  });

  it("keeps the frienduid as opaque externalUserId (no resolution)", () => {
    const ctx = createMappingContext({ sourceMode: "fake" });
    const sp: SPFriend = { _id: "f3", frienduid: "weird:string:with:colons" };
    const result = mapFriendship(sp, ctx);
    if (result.status === "mapped") {
      expect(result.payload.externalUserId).toBe("weird:string:with:colons");
    }
  });

  it("does not mutate the mapping context warnings on the happy path", () => {
    const ctx = createMappingContext({ sourceMode: "fake" });
    const sp: SPFriend = { _id: "f4", frienduid: "remote" };
    mapFriendship(sp, ctx);
    expect(ctx.warnings).toHaveLength(0);
  });
});

describe("mapPendingFriendRequest", () => {
  it("maps a minimal pending request using sender as externalUserId", () => {
    const ctx = createMappingContext({ sourceMode: "fake" });
    const sp: SPPendingFriendRequest = {
      _id: "pfr1",
      sender: "remote_sender_1",
      receiver: "me",
      time: 1_000,
    };
    const result = mapPendingFriendRequest(sp, ctx);
    expect(result.status).toBe("mapped");
    if (result.status === "mapped") {
      expect(result.payload.externalUserId).toBe("remote_sender_1");
      expect(result.payload.status).toBe("pending");
      expect(result.payload.createdAt).toBe(1_000);
      expect(result.payload.seeMembers).toBe(false);
      expect(result.payload.seeFront).toBe(false);
      expect(result.payload.trusted).toBe(false);
      expect(result.payload.getFrontNotif).toBe(false);
    }
  });

  it("preserves time as createdAt", () => {
    const ctx = createMappingContext({ sourceMode: "fake" });
    const sp: SPPendingFriendRequest = {
      _id: "pfr2",
      sender: "x",
      receiver: "y",
      time: 1_700_000_000_000,
    };
    const result = mapPendingFriendRequest(sp, ctx);
    if (result.status === "mapped") {
      expect(result.payload.createdAt).toBe(1_700_000_000_000);
    }
  });

  it("ignores message field without warning", () => {
    const ctx = createMappingContext({ sourceMode: "fake" });
    const sp: SPPendingFriendRequest = {
      _id: "pfr3",
      sender: "x",
      receiver: "y",
      time: 1,
      message: "hi!",
    };
    const result = mapPendingFriendRequest(sp, ctx);
    expect(result.status).toBe("mapped");
    expect(ctx.warnings).toHaveLength(0);
  });

  it("keeps sender as opaque externalUserId", () => {
    const ctx = createMappingContext({ sourceMode: "fake" });
    const sp: SPPendingFriendRequest = {
      _id: "pfr4",
      sender: "remote",
      receiver: "me",
      time: 0,
    };
    const result = mapPendingFriendRequest(sp, ctx);
    if (result.status === "mapped") {
      expect(result.payload.externalUserId).toBe("remote");
    }
  });
});

import { describe, expectTypeOf, it } from "vitest";

import type {
  FriendAccessContext,
  FriendDashboardCustomFront,
  FriendDashboardFrontingSession,
  FriendDashboardKeyGrant,
  FriendDashboardMember,
  FriendDashboardResponse,
  FriendDashboardStructureEntity,
} from "../friend-dashboard.js";
import type {
  AccountId,
  BucketId,
  CustomFrontId,
  FriendConnectionId,
  FrontingSessionId,
  KeyGrantId,
  MemberId,
  SystemId,
  SystemStructureEntityId,
} from "../ids.js";
import type { UnixMillis } from "../timestamps.js";

describe("FriendDashboardFrontingSession", () => {
  it("has correct field types", () => {
    expectTypeOf<FriendDashboardFrontingSession["id"]>().toEqualTypeOf<FrontingSessionId>();
    expectTypeOf<FriendDashboardFrontingSession["memberId"]>().toEqualTypeOf<MemberId | null>();
    expectTypeOf<
      FriendDashboardFrontingSession["customFrontId"]
    >().toEqualTypeOf<CustomFrontId | null>();
    expectTypeOf<
      FriendDashboardFrontingSession["structureEntityId"]
    >().toEqualTypeOf<SystemStructureEntityId | null>();
    expectTypeOf<FriendDashboardFrontingSession["startTime"]>().toEqualTypeOf<UnixMillis>();
    expectTypeOf<FriendDashboardFrontingSession["encryptedData"]>().toBeString();
  });

  it("has exact shape", () => {
    expectTypeOf<keyof FriendDashboardFrontingSession>().toEqualTypeOf<
      "id" | "memberId" | "customFrontId" | "structureEntityId" | "startTime" | "encryptedData"
    >();
  });
});

describe("FriendDashboardMember", () => {
  it("has correct field types", () => {
    expectTypeOf<FriendDashboardMember["id"]>().toEqualTypeOf<MemberId>();
    expectTypeOf<FriendDashboardMember["encryptedData"]>().toBeString();
  });

  it("has exact shape", () => {
    expectTypeOf<keyof FriendDashboardMember>().toEqualTypeOf<"id" | "encryptedData">();
  });
});

describe("FriendDashboardCustomFront", () => {
  it("has correct field types", () => {
    expectTypeOf<FriendDashboardCustomFront["id"]>().toEqualTypeOf<CustomFrontId>();
    expectTypeOf<FriendDashboardCustomFront["encryptedData"]>().toBeString();
  });

  it("has exact shape", () => {
    expectTypeOf<keyof FriendDashboardCustomFront>().toEqualTypeOf<"id" | "encryptedData">();
  });
});

describe("FriendDashboardStructureEntity", () => {
  it("has correct field types", () => {
    expectTypeOf<FriendDashboardStructureEntity["id"]>().toEqualTypeOf<SystemStructureEntityId>();
    expectTypeOf<FriendDashboardStructureEntity["encryptedData"]>().toBeString();
  });

  it("has exact shape", () => {
    expectTypeOf<keyof FriendDashboardStructureEntity>().toEqualTypeOf<"id" | "encryptedData">();
  });
});

describe("FriendDashboardKeyGrant", () => {
  it("has correct field types", () => {
    expectTypeOf<FriendDashboardKeyGrant["id"]>().toEqualTypeOf<KeyGrantId>();
    expectTypeOf<FriendDashboardKeyGrant["bucketId"]>().toEqualTypeOf<BucketId>();
    expectTypeOf<FriendDashboardKeyGrant["encryptedKey"]>().toBeString();
    expectTypeOf<FriendDashboardKeyGrant["keyVersion"]>().toBeNumber();
  });

  it("has exact shape", () => {
    expectTypeOf<keyof FriendDashboardKeyGrant>().toEqualTypeOf<
      "id" | "bucketId" | "encryptedKey" | "keyVersion"
    >();
  });
});

describe("FriendDashboardResponse", () => {
  it("has correct top-level field types", () => {
    expectTypeOf<FriendDashboardResponse["systemId"]>().toEqualTypeOf<SystemId>();
    expectTypeOf<FriendDashboardResponse["memberCount"]>().toBeNumber();
    expectTypeOf<FriendDashboardResponse["visibleMembers"]>().toEqualTypeOf<
      readonly FriendDashboardMember[]
    >();
    expectTypeOf<FriendDashboardResponse["visibleCustomFronts"]>().toEqualTypeOf<
      readonly FriendDashboardCustomFront[]
    >();
    expectTypeOf<FriendDashboardResponse["visibleStructureEntities"]>().toEqualTypeOf<
      readonly FriendDashboardStructureEntity[]
    >();
    expectTypeOf<FriendDashboardResponse["keyGrants"]>().toEqualTypeOf<
      readonly FriendDashboardKeyGrant[]
    >();
  });

  it("has correct activeFronting shape", () => {
    expectTypeOf<FriendDashboardResponse["activeFronting"]["sessions"]>().toEqualTypeOf<
      readonly FriendDashboardFrontingSession[]
    >();
    expectTypeOf<
      FriendDashboardResponse["activeFronting"]["isCofronting"]
    >().toEqualTypeOf<boolean>();
  });

  it("has exact top-level keys", () => {
    expectTypeOf<keyof FriendDashboardResponse>().toEqualTypeOf<
      | "systemId"
      | "memberCount"
      | "activeFronting"
      | "visibleMembers"
      | "visibleCustomFronts"
      | "visibleStructureEntities"
      | "keyGrants"
    >();
  });
});

describe("FriendAccessContext", () => {
  it("has correct field types", () => {
    expectTypeOf<FriendAccessContext["targetAccountId"]>().toEqualTypeOf<AccountId>();
    expectTypeOf<FriendAccessContext["targetSystemId"]>().toEqualTypeOf<SystemId>();
    expectTypeOf<FriendAccessContext["connectionId"]>().toEqualTypeOf<FriendConnectionId>();
    expectTypeOf<FriendAccessContext["assignedBucketIds"]>().toEqualTypeOf<readonly BucketId[]>();
  });

  it("has exact shape", () => {
    expectTypeOf<keyof FriendAccessContext>().toEqualTypeOf<
      "targetAccountId" | "targetSystemId" | "connectionId" | "assignedBucketIds"
    >();
  });
});

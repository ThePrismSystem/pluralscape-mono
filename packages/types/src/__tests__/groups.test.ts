import { describe, expectTypeOf, it } from "vitest";

import type {
  ArchivedGroup,
  Group,
  GroupMembership,
  GroupMoveOperation,
  GroupTree,
} from "../groups.js";
import type { GroupId, HexColor, MemberId, SystemId } from "../ids.js";
import type { ImageSource } from "../image-source.js";
import type { UnixMillis } from "../timestamps.js";
import type { AuditMetadata } from "../utility.js";

describe("Group", () => {
  it("extends AuditMetadata", () => {
    expectTypeOf<Group>().toExtend<AuditMetadata>();
  });

  it("has correct field types", () => {
    expectTypeOf<Group["id"]>().toEqualTypeOf<GroupId>();
    expectTypeOf<Group["systemId"]>().toEqualTypeOf<SystemId>();
    expectTypeOf<Group["name"]>().toBeString();
    expectTypeOf<Group["description"]>().toEqualTypeOf<string | null>();
    expectTypeOf<Group["parentGroupId"]>().toEqualTypeOf<GroupId | null>();
    expectTypeOf<Group["imageSource"]>().toEqualTypeOf<ImageSource | null>();
    expectTypeOf<Group["color"]>().toEqualTypeOf<HexColor | null>();
    expectTypeOf<Group["emoji"]>().toEqualTypeOf<string | null>();
    expectTypeOf<Group["sortOrder"]>().toEqualTypeOf<number>();
  });

  it("has archived as false literal", () => {
    expectTypeOf<Group["archived"]>().toEqualTypeOf<false>();
  });
});

describe("ArchivedGroup", () => {
  it("has all Group fields except archived", () => {
    expectTypeOf<ArchivedGroup["id"]>().toEqualTypeOf<GroupId>();
    expectTypeOf<ArchivedGroup["systemId"]>().toEqualTypeOf<SystemId>();
    expectTypeOf<ArchivedGroup["name"]>().toBeString();
  });

  it("has archived as true literal", () => {
    expectTypeOf<ArchivedGroup["archived"]>().toEqualTypeOf<true>();
  });

  it("has archivedAt timestamp", () => {
    expectTypeOf<ArchivedGroup["archivedAt"]>().toEqualTypeOf<UnixMillis>();
  });
});

describe("GroupMembership", () => {
  it("has exactly groupId and memberId", () => {
    expectTypeOf<GroupMembership["groupId"]>().toEqualTypeOf<GroupId>();
    expectTypeOf<GroupMembership["memberId"]>().toEqualTypeOf<MemberId>();
    expectTypeOf<keyof GroupMembership>().toEqualTypeOf<"groupId" | "memberId">();
  });
});

describe("GroupTree", () => {
  it("has all Group fields", () => {
    expectTypeOf<GroupTree>().toExtend<Group>();
  });

  it("has recursive children array", () => {
    expectTypeOf<GroupTree["children"]>().toEqualTypeOf<readonly GroupTree[]>();
  });
});

describe("GroupMoveOperation", () => {
  it("has sourceGroupId typed with the GroupId branded type", () => {
    expectTypeOf<GroupMoveOperation["sourceGroupId"]>().toEqualTypeOf<GroupId>();
  });

  it("has nullable targetParentGroupId", () => {
    expectTypeOf<GroupMoveOperation["targetParentGroupId"]>().toEqualTypeOf<GroupId | null>();
  });

  it("has exact shape", () => {
    expectTypeOf<keyof GroupMoveOperation>().toEqualTypeOf<
      "sourceGroupId" | "targetParentGroupId"
    >();
  });
});

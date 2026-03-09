import { describe, expectTypeOf, it } from "vitest";

import type { Group, GroupMembership, GroupMoveOperation, GroupTree } from "../groups.js";
import type { BlobId, GroupId, MemberId, SystemId } from "../ids.js";
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
    expectTypeOf<Group["imageRef"]>().toEqualTypeOf<BlobId | null>();
    expectTypeOf<Group["color"]>().toEqualTypeOf<string | null>();
    expectTypeOf<Group["emoji"]>().toEqualTypeOf<string | null>();
    expectTypeOf<Group["sortOrder"]>().toEqualTypeOf<number>();
  });

  it("has archived as boolean and nullable archivedAt", () => {
    expectTypeOf<Group["archived"]>().toEqualTypeOf<boolean>();
    expectTypeOf<Group["archivedAt"]>().toEqualTypeOf<UnixMillis | null>();
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
  it("has sourceGroupId as GroupId", () => {
    expectTypeOf<GroupMoveOperation["sourceGroupId"]>().toEqualTypeOf<GroupId>();
  });

  it("has nullable targetParentGroupId", () => {
    expectTypeOf<GroupMoveOperation["targetParentGroupId"]>().toEqualTypeOf<GroupId | null>();
  });
});

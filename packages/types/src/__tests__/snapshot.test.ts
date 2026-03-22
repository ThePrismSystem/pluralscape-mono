import { assertType, describe, expectTypeOf, it } from "vitest";

import type { SaturationLevel, Tag } from "../identity.js";
import type {
  GroupId,
  InnerWorldEntityId,
  InnerWorldRegionId,
  MemberId,
  SystemId,
  SystemSnapshotId,
  SystemStructureEntityId,
  SystemStructureEntityTypeId,
} from "../ids.js";
import type { InnerWorldEntityType } from "../innerworld.js";
import type {
  SnapshotContent,
  SnapshotGroup,
  SnapshotInnerworldEntity,
  SnapshotInnerworldRegion,
  SnapshotMember,
  SnapshotRelationship,
  SnapshotSchedule,
  SnapshotStructureEntity,
  SnapshotStructureEntityType,
  SnapshotTrigger,
  SystemSnapshot,
} from "../snapshot.js";
import type {
  RelationshipType,
  SystemStructureEntityAssociation,
  SystemStructureEntityLink,
  SystemStructureEntityMemberLink,
} from "../structure.js";
import type { UnixMillis } from "../timestamps.js";

describe("SnapshotTrigger", () => {
  it("accepts valid values", () => {
    assertType<SnapshotTrigger>("manual");
    assertType<SnapshotTrigger>("scheduled-daily");
    assertType<SnapshotTrigger>("scheduled-weekly");
  });

  it("rejects invalid values", () => {
    // @ts-expect-error invalid trigger
    assertType<SnapshotTrigger>("scheduled");
    // @ts-expect-error invalid trigger
    assertType<SnapshotTrigger>("automatic");
  });
});

describe("SnapshotSchedule", () => {
  it("accepts valid values", () => {
    assertType<SnapshotSchedule>("daily");
    assertType<SnapshotSchedule>("weekly");
    assertType<SnapshotSchedule>("disabled");
  });

  it("rejects invalid values", () => {
    // @ts-expect-error invalid schedule
    assertType<SnapshotSchedule>("monthly");
  });
});

describe("SystemSnapshot", () => {
  it("has correct field types", () => {
    expectTypeOf<SystemSnapshot["id"]>().toEqualTypeOf<SystemSnapshotId>();
    expectTypeOf<SystemSnapshot["systemId"]>().toEqualTypeOf<SystemId>();
    expectTypeOf<SystemSnapshot["trigger"]>().toEqualTypeOf<SnapshotTrigger>();
    expectTypeOf<SystemSnapshot["createdAt"]>().toEqualTypeOf<UnixMillis>();
  });

  it("does not have name or description fields", () => {
    expectTypeOf<SystemSnapshot>().not.toHaveProperty("name");
    expectTypeOf<SystemSnapshot>().not.toHaveProperty("description");
  });
});

describe("SnapshotContent", () => {
  it("has name and description at the top level", () => {
    expectTypeOf<SnapshotContent["name"]>().toEqualTypeOf<string | null>();
    expectTypeOf<SnapshotContent["description"]>().toEqualTypeOf<string | null>();
  });

  it("has all array fields", () => {
    expectTypeOf<SnapshotContent["members"]>().toEqualTypeOf<readonly SnapshotMember[]>();
    expectTypeOf<SnapshotContent["structureEntityTypes"]>().toEqualTypeOf<
      readonly SnapshotStructureEntityType[]
    >();
    expectTypeOf<SnapshotContent["structureEntities"]>().toEqualTypeOf<
      readonly SnapshotStructureEntity[]
    >();
    expectTypeOf<SnapshotContent["structureEntityLinks"]>().toEqualTypeOf<
      readonly SystemStructureEntityLink[]
    >();
    expectTypeOf<SnapshotContent["structureEntityMemberLinks"]>().toEqualTypeOf<
      readonly SystemStructureEntityMemberLink[]
    >();
    expectTypeOf<SnapshotContent["structureEntityAssociations"]>().toEqualTypeOf<
      readonly SystemStructureEntityAssociation[]
    >();
    expectTypeOf<SnapshotContent["relationships"]>().toEqualTypeOf<
      readonly SnapshotRelationship[]
    >();
    expectTypeOf<SnapshotContent["groups"]>().toEqualTypeOf<readonly SnapshotGroup[]>();
    expectTypeOf<SnapshotContent["innerworldRegions"]>().toEqualTypeOf<
      readonly SnapshotInnerworldRegion[]
    >();
    expectTypeOf<SnapshotContent["innerworldEntities"]>().toEqualTypeOf<
      readonly SnapshotInnerworldEntity[]
    >();
  });
});

describe("SnapshotMember", () => {
  it("has correct field types", () => {
    expectTypeOf<SnapshotMember["id"]>().toEqualTypeOf<MemberId>();
    expectTypeOf<SnapshotMember["name"]>().toBeString();
    expectTypeOf<SnapshotMember["pronouns"]>().toEqualTypeOf<readonly string[]>();
    expectTypeOf<SnapshotMember["description"]>().toEqualTypeOf<string | null>();
    expectTypeOf<SnapshotMember["tags"]>().toEqualTypeOf<readonly Tag[]>();
    expectTypeOf<SnapshotMember["saturationLevel"]>().toEqualTypeOf<SaturationLevel | null>();
    expectTypeOf<SnapshotMember["archived"]>().toBeBoolean();
  });
});

describe("SnapshotStructureEntityType", () => {
  it("has correct field types", () => {
    expectTypeOf<SnapshotStructureEntityType["id"]>().toEqualTypeOf<SystemStructureEntityTypeId>();
    expectTypeOf<SnapshotStructureEntityType["name"]>().toBeString();
    expectTypeOf<SnapshotStructureEntityType["description"]>().toEqualTypeOf<string | null>();
  });
});

describe("SnapshotStructureEntity", () => {
  it("has correct field types", () => {
    expectTypeOf<SnapshotStructureEntity["id"]>().toEqualTypeOf<SystemStructureEntityId>();
    expectTypeOf<
      SnapshotStructureEntity["entityTypeId"]
    >().toEqualTypeOf<SystemStructureEntityTypeId>();
    expectTypeOf<SnapshotStructureEntity["name"]>().toBeString();
    expectTypeOf<SnapshotStructureEntity["description"]>().toEqualTypeOf<string | null>();
  });
});

describe("SnapshotRelationship", () => {
  it("has correct field types", () => {
    expectTypeOf<SnapshotRelationship["sourceMemberId"]>().toEqualTypeOf<MemberId>();
    expectTypeOf<SnapshotRelationship["targetMemberId"]>().toEqualTypeOf<MemberId>();
    expectTypeOf<SnapshotRelationship["type"]>().toEqualTypeOf<RelationshipType>();
    expectTypeOf<SnapshotRelationship["bidirectional"]>().toBeBoolean();
    expectTypeOf<SnapshotRelationship["label"]>().toEqualTypeOf<string | null>();
  });
});

describe("SnapshotGroup", () => {
  it("has correct field types", () => {
    expectTypeOf<SnapshotGroup["id"]>().toEqualTypeOf<GroupId>();
    expectTypeOf<SnapshotGroup["name"]>().toBeString();
    expectTypeOf<SnapshotGroup["description"]>().toEqualTypeOf<string | null>();
    expectTypeOf<SnapshotGroup["parentGroupId"]>().toEqualTypeOf<GroupId | null>();
    expectTypeOf<SnapshotGroup["memberIds"]>().toEqualTypeOf<readonly MemberId[]>();
  });
});

describe("SnapshotInnerworldRegion", () => {
  it("has correct field types", () => {
    expectTypeOf<SnapshotInnerworldRegion["id"]>().toEqualTypeOf<InnerWorldRegionId>();
    expectTypeOf<SnapshotInnerworldRegion["name"]>().toBeString();
    expectTypeOf<SnapshotInnerworldRegion["description"]>().toEqualTypeOf<string | null>();
    expectTypeOf<
      SnapshotInnerworldRegion["parentRegionId"]
    >().toEqualTypeOf<InnerWorldRegionId | null>();
  });
});

describe("SnapshotInnerworldEntity", () => {
  it("has correct field types", () => {
    expectTypeOf<SnapshotInnerworldEntity["id"]>().toEqualTypeOf<InnerWorldEntityId>();
    expectTypeOf<SnapshotInnerworldEntity["regionId"]>().toEqualTypeOf<InnerWorldRegionId | null>();
    expectTypeOf<SnapshotInnerworldEntity["entityType"]>().toEqualTypeOf<InnerWorldEntityType>();
    expectTypeOf<SnapshotInnerworldEntity["name"]>().toEqualTypeOf<string | null>();
  });
});

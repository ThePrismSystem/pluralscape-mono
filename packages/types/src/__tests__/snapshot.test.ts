import { assertType, describe, expectTypeOf, it } from "vitest";

import type { SaturationLevel, Tag } from "../identity.js";
import type {
  GroupId,
  InnerWorldEntityId,
  InnerWorldRegionId,
  LayerId,
  MemberId,
  SideSystemId,
  SubsystemId,
  SystemId,
  SystemSnapshotId,
} from "../ids.js";
import type { InnerWorldEntityType } from "../innerworld.js";
import type {
  SnapshotContent,
  SnapshotGroup,
  SnapshotInnerworldEntity,
  SnapshotInnerworldRegion,
  SnapshotLayer,
  SnapshotMember,
  SnapshotRelationship,
  SnapshotSchedule,
  SnapshotSideSystem,
  SnapshotSubsystem,
  SnapshotTrigger,
  SystemSnapshot,
} from "../snapshot.js";
import type {
  ArchitectureType,
  DiscoveryStatus,
  LayerAccessType,
  RelationshipType,
  SubsystemMembership,
  SideSystemMembership,
  LayerMembership,
  SubsystemLayerLink,
  SubsystemSideSystemLink,
  SideSystemLayerLink,
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
    expectTypeOf<SnapshotContent["subsystems"]>().toEqualTypeOf<readonly SnapshotSubsystem[]>();
    expectTypeOf<SnapshotContent["sideSystems"]>().toEqualTypeOf<readonly SnapshotSideSystem[]>();
    expectTypeOf<SnapshotContent["layers"]>().toEqualTypeOf<readonly SnapshotLayer[]>();
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

  it("has membership and cross-link fields", () => {
    expectTypeOf<SnapshotContent["memberships"]["subsystem"]>().toEqualTypeOf<
      readonly SubsystemMembership[]
    >();
    expectTypeOf<SnapshotContent["memberships"]["sideSystem"]>().toEqualTypeOf<
      readonly SideSystemMembership[]
    >();
    expectTypeOf<SnapshotContent["memberships"]["layer"]>().toEqualTypeOf<
      readonly LayerMembership[]
    >();
    expectTypeOf<SnapshotContent["crossLinks"]["subsystemLayer"]>().toEqualTypeOf<
      readonly SubsystemLayerLink[]
    >();
    expectTypeOf<SnapshotContent["crossLinks"]["subsystemSideSystem"]>().toEqualTypeOf<
      readonly SubsystemSideSystemLink[]
    >();
    expectTypeOf<SnapshotContent["crossLinks"]["sideSystemLayer"]>().toEqualTypeOf<
      readonly SideSystemLayerLink[]
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

describe("SnapshotSubsystem", () => {
  it("has correct field types", () => {
    expectTypeOf<SnapshotSubsystem["id"]>().toEqualTypeOf<SubsystemId>();
    expectTypeOf<SnapshotSubsystem["name"]>().toBeString();
    expectTypeOf<SnapshotSubsystem["description"]>().toEqualTypeOf<string | null>();
    expectTypeOf<SnapshotSubsystem["parentSubsystemId"]>().toEqualTypeOf<SubsystemId | null>();
    expectTypeOf<SnapshotSubsystem["architectureType"]>().toEqualTypeOf<ArchitectureType | null>();
    expectTypeOf<SnapshotSubsystem["hasCore"]>().toBeBoolean();
    expectTypeOf<SnapshotSubsystem["discoveryStatus"]>().toEqualTypeOf<DiscoveryStatus>();
  });
});

describe("SnapshotSideSystem", () => {
  it("has correct field types", () => {
    expectTypeOf<SnapshotSideSystem["id"]>().toEqualTypeOf<SideSystemId>();
    expectTypeOf<SnapshotSideSystem["name"]>().toBeString();
    expectTypeOf<SnapshotSideSystem["description"]>().toEqualTypeOf<string | null>();
  });
});

describe("SnapshotLayer", () => {
  it("has correct field types", () => {
    expectTypeOf<SnapshotLayer["id"]>().toEqualTypeOf<LayerId>();
    expectTypeOf<SnapshotLayer["name"]>().toBeString();
    expectTypeOf<SnapshotLayer["description"]>().toEqualTypeOf<string | null>();
    expectTypeOf<SnapshotLayer["accessType"]>().toEqualTypeOf<LayerAccessType>();
    expectTypeOf<SnapshotLayer["gatekeeperMemberIds"]>().toEqualTypeOf<readonly MemberId[]>();
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

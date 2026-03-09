import { describe, expectTypeOf, it } from "vitest";

import type {
  HexColor,
  InnerWorldEntityId,
  InnerWorldRegionId,
  MemberId,
  SystemId,
} from "../ids.js";
import type {
  InnerWorldCanvas,
  InnerWorldEntity,
  InnerWorldRegion,
  LandmarkEntity,
  MemberEntity,
  VisualProperties,
} from "../innerworld.js";
import type { AuditMetadata } from "../utility.js";

describe("VisualProperties", () => {
  it("has exactly the expected keys", () => {
    expectTypeOf<keyof VisualProperties>().toEqualTypeOf<"color" | "icon" | "size" | "opacity">();
  });

  it("has all nullable fields", () => {
    expectTypeOf<VisualProperties["color"]>().toEqualTypeOf<HexColor | null>();
    expectTypeOf<VisualProperties["icon"]>().toEqualTypeOf<string | null>();
    expectTypeOf<VisualProperties["size"]>().toEqualTypeOf<number | null>();
    expectTypeOf<VisualProperties["opacity"]>().toEqualTypeOf<number | null>();
  });
});

describe("MemberEntity", () => {
  it("extends AuditMetadata", () => {
    expectTypeOf<MemberEntity>().toExtend<AuditMetadata>();
  });

  it("has correct discriminator and fields", () => {
    expectTypeOf<MemberEntity["entityType"]>().toEqualTypeOf<"member">();
    expectTypeOf<MemberEntity["linkedMemberId"]>().toEqualTypeOf<MemberId>();
    expectTypeOf<MemberEntity["id"]>().toEqualTypeOf<InnerWorldEntityId>();
    expectTypeOf<MemberEntity["positionX"]>().toEqualTypeOf<number>();
    expectTypeOf<MemberEntity["positionY"]>().toEqualTypeOf<number>();
    expectTypeOf<MemberEntity["visual"]>().toEqualTypeOf<VisualProperties>();
    expectTypeOf<MemberEntity["regionId"]>().toEqualTypeOf<InnerWorldRegionId | null>();
  });
});

describe("LandmarkEntity", () => {
  it("extends AuditMetadata", () => {
    expectTypeOf<LandmarkEntity>().toExtend<AuditMetadata>();
  });

  it("has correct discriminator and fields", () => {
    expectTypeOf<LandmarkEntity["entityType"]>().toEqualTypeOf<"landmark">();
    expectTypeOf<LandmarkEntity["name"]>().toBeString();
    expectTypeOf<LandmarkEntity["description"]>().toEqualTypeOf<string | null>();
  });
});

describe("InnerWorldEntity", () => {
  it("extends AuditMetadata", () => {
    expectTypeOf<InnerWorldEntity>().toExtend<AuditMetadata>();
  });

  it("discriminates on entityType", () => {
    function handleEntity(entity: InnerWorldEntity): string {
      switch (entity.entityType) {
        case "member":
          expectTypeOf(entity).toEqualTypeOf<MemberEntity>();
          return entity.linkedMemberId;
        case "landmark":
          expectTypeOf(entity).toEqualTypeOf<LandmarkEntity>();
          return entity.name;
        default: {
          const _exhaustive: never = entity;
          return _exhaustive;
        }
      }
    }
    expectTypeOf(handleEntity).toBeFunction();
  });

  it("has shared base fields", () => {
    expectTypeOf<InnerWorldEntity["id"]>().toEqualTypeOf<InnerWorldEntityId>();
    expectTypeOf<InnerWorldEntity["systemId"]>().toEqualTypeOf<SystemId>();
    expectTypeOf<InnerWorldEntity["regionId"]>().toEqualTypeOf<InnerWorldRegionId | null>();
    expectTypeOf<InnerWorldEntity["visual"]>().toEqualTypeOf<VisualProperties>();
    expectTypeOf<InnerWorldEntity["positionX"]>().toEqualTypeOf<number>();
    expectTypeOf<InnerWorldEntity["positionY"]>().toEqualTypeOf<number>();
  });
});

describe("InnerWorldRegion", () => {
  it("extends AuditMetadata", () => {
    expectTypeOf<InnerWorldRegion>().toExtend<AuditMetadata>();
  });

  it("has correct field types", () => {
    expectTypeOf<InnerWorldRegion["id"]>().toEqualTypeOf<InnerWorldRegionId>();
    expectTypeOf<InnerWorldRegion["systemId"]>().toEqualTypeOf<SystemId>();
    expectTypeOf<InnerWorldRegion["name"]>().toBeString();
    expectTypeOf<InnerWorldRegion["description"]>().toEqualTypeOf<string | null>();
    expectTypeOf<InnerWorldRegion["parentRegionId"]>().toEqualTypeOf<InnerWorldRegionId | null>();
    expectTypeOf<InnerWorldRegion["visual"]>().toEqualTypeOf<VisualProperties>();
    expectTypeOf<InnerWorldRegion["accessType"]>().toEqualTypeOf<"open" | "gatekept">();
    expectTypeOf<InnerWorldRegion["gatekeeperMemberId"]>().toEqualTypeOf<MemberId | null>();
  });
});

describe("InnerWorldCanvas", () => {
  it("has correct field types", () => {
    expectTypeOf<InnerWorldCanvas["systemId"]>().toEqualTypeOf<SystemId>();
    expectTypeOf<InnerWorldCanvas["viewportX"]>().toEqualTypeOf<number>();
    expectTypeOf<InnerWorldCanvas["viewportY"]>().toEqualTypeOf<number>();
    expectTypeOf<InnerWorldCanvas["zoom"]>().toEqualTypeOf<number>();
    expectTypeOf<InnerWorldCanvas["dimensions"]>().toEqualTypeOf<{
      readonly width: number;
      readonly height: number;
    }>();
  });
});

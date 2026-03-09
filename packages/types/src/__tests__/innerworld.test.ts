import { describe, expectTypeOf, it } from "vitest";

import type { InnerWorldEntityId, InnerWorldRegionId, MemberId, SystemId } from "../ids.js";
import type {
  InnerWorldCanvas,
  InnerWorldEntity,
  InnerWorldEntityData,
  InnerWorldRegion,
  LandmarkEntity,
  MemberEntity,
  VisualProperties,
} from "../innerworld.js";
import type { AuditMetadata } from "../utility.js";

describe("VisualProperties", () => {
  it("has all nullable fields", () => {
    expectTypeOf<VisualProperties["color"]>().toEqualTypeOf<string | null>();
    expectTypeOf<VisualProperties["icon"]>().toEqualTypeOf<string | null>();
    expectTypeOf<VisualProperties["size"]>().toEqualTypeOf<number | null>();
    expectTypeOf<VisualProperties["opacity"]>().toEqualTypeOf<number | null>();
  });
});

describe("MemberEntity", () => {
  it("has correct discriminator and fields", () => {
    expectTypeOf<MemberEntity["kind"]>().toEqualTypeOf<"member">();
    expectTypeOf<MemberEntity["memberId"]>().toEqualTypeOf<MemberId>();
  });
});

describe("LandmarkEntity", () => {
  it("has correct discriminator and fields", () => {
    expectTypeOf<LandmarkEntity["kind"]>().toEqualTypeOf<"landmark">();
    expectTypeOf<LandmarkEntity["label"]>().toBeString();
    expectTypeOf<LandmarkEntity["description"]>().toEqualTypeOf<string | null>();
  });
});

describe("InnerWorldEntityData", () => {
  it("discriminates on kind", () => {
    function handleData(data: InnerWorldEntityData): string {
      if (data.kind === "member") {
        expectTypeOf(data).toEqualTypeOf<MemberEntity>();
        return data.memberId;
      }
      expectTypeOf(data).toEqualTypeOf<LandmarkEntity>();
      return data.label;
    }
    expectTypeOf(handleData).toBeFunction();
  });
});

describe("InnerWorldEntity", () => {
  it("extends AuditMetadata", () => {
    expectTypeOf<InnerWorldEntity>().toExtend<AuditMetadata>();
  });

  it("has correct field types", () => {
    expectTypeOf<InnerWorldEntity["id"]>().toEqualTypeOf<InnerWorldEntityId>();
    expectTypeOf<InnerWorldEntity["systemId"]>().toEqualTypeOf<SystemId>();
    expectTypeOf<InnerWorldEntity["regionId"]>().toEqualTypeOf<InnerWorldRegionId | null>();
    expectTypeOf<InnerWorldEntity["name"]>().toBeString();
    expectTypeOf<InnerWorldEntity["data"]>().toEqualTypeOf<InnerWorldEntityData>();
    expectTypeOf<InnerWorldEntity["visual"]>().toEqualTypeOf<VisualProperties>();
    expectTypeOf<InnerWorldEntity["x"]>().toEqualTypeOf<number>();
    expectTypeOf<InnerWorldEntity["y"]>().toEqualTypeOf<number>();
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
  });
});

describe("InnerWorldCanvas", () => {
  it("has correct field types", () => {
    expectTypeOf<InnerWorldCanvas["systemId"]>().toEqualTypeOf<SystemId>();
    expectTypeOf<InnerWorldCanvas["entities"]>().toEqualTypeOf<readonly InnerWorldEntity[]>();
    expectTypeOf<InnerWorldCanvas["regions"]>().toEqualTypeOf<readonly InnerWorldRegion[]>();
  });
});

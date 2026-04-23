import { describe, expectTypeOf, it } from "vitest";

import type { InnerWorldCanvas } from "../entities/innerworld-canvas.js";
import type {
  ArchivedInnerWorldEntity,
  InnerWorldEntity,
  LandmarkEntity,
  MemberEntity,
  StructureEntityEntity,
  VisualProperties,
} from "../entities/innerworld-entity.js";
import type { ArchivedInnerWorldRegion, InnerWorldRegion } from "../entities/innerworld-region.js";
import type {
  HexColor,
  InnerWorldEntityId,
  InnerWorldRegionId,
  MemberId,
  SystemId,
  SystemStructureEntityId,
} from "../ids.js";
import type { ImageSource } from "../image-source.js";
import type { Archived, AuditMetadata } from "../utility.js";

describe("VisualProperties", () => {
  it("has exactly the expected keys", () => {
    expectTypeOf<keyof VisualProperties>().toEqualTypeOf<
      "color" | "icon" | "size" | "opacity" | "imageSource" | "externalUrl"
    >();
  });

  it("has all nullable fields", () => {
    expectTypeOf<VisualProperties["color"]>().toEqualTypeOf<HexColor | null>();
    expectTypeOf<VisualProperties["icon"]>().toEqualTypeOf<string | null>();
    expectTypeOf<VisualProperties["size"]>().toEqualTypeOf<number | null>();
    expectTypeOf<VisualProperties["opacity"]>().toEqualTypeOf<number | null>();
    expectTypeOf<VisualProperties["imageSource"]>().toEqualTypeOf<ImageSource | null>();
    expectTypeOf<VisualProperties["externalUrl"]>().toEqualTypeOf<string | null>();
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

describe("StructureEntityEntity", () => {
  it("extends AuditMetadata", () => {
    expectTypeOf<StructureEntityEntity>().toExtend<AuditMetadata>();
  });

  it("has correct discriminator and fields", () => {
    expectTypeOf<StructureEntityEntity["entityType"]>().toEqualTypeOf<"structure-entity">();
    expectTypeOf<
      StructureEntityEntity["linkedStructureEntityId"]
    >().toEqualTypeOf<SystemStructureEntityId>();
    expectTypeOf<StructureEntityEntity["id"]>().toEqualTypeOf<InnerWorldEntityId>();
    expectTypeOf<StructureEntityEntity["positionX"]>().toEqualTypeOf<number>();
    expectTypeOf<StructureEntityEntity["positionY"]>().toEqualTypeOf<number>();
    expectTypeOf<StructureEntityEntity["visual"]>().toEqualTypeOf<VisualProperties>();
    expectTypeOf<StructureEntityEntity["regionId"]>().toEqualTypeOf<InnerWorldRegionId | null>();
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
        case "structure-entity":
          expectTypeOf(entity).toEqualTypeOf<StructureEntityEntity>();
          return entity.linkedStructureEntityId;
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

  it("has archived: false on all variants", () => {
    expectTypeOf<InnerWorldEntity["archived"]>().toEqualTypeOf<false>();
  });
});

describe("ArchivedInnerWorldEntity", () => {
  it("is Archived<InnerWorldEntity>", () => {
    expectTypeOf<ArchivedInnerWorldEntity>().toEqualTypeOf<Archived<InnerWorldEntity>>();
  });

  it("has archived: true and archivedAt", () => {
    expectTypeOf<ArchivedInnerWorldEntity["archived"]>().toEqualTypeOf<true>();
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
    expectTypeOf<InnerWorldRegion["gatekeeperMemberIds"]>().toEqualTypeOf<readonly MemberId[]>();
  });

  it("has archived: false", () => {
    expectTypeOf<InnerWorldRegion["archived"]>().toEqualTypeOf<false>();
  });
});

describe("ArchivedInnerWorldRegion", () => {
  it("is Archived<InnerWorldRegion>", () => {
    expectTypeOf<ArchivedInnerWorldRegion>().toEqualTypeOf<Archived<InnerWorldRegion>>();
  });

  it("has archived: true and archivedAt", () => {
    expectTypeOf<ArchivedInnerWorldRegion["archived"]>().toEqualTypeOf<true>();
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

import { assertType, describe, expectTypeOf, it } from "vitest";

import type {
  HexColor,
  LayerId,
  MemberId,
  RelationshipId,
  SideSystemId,
  SubsystemId,
  SystemId,
} from "../ids.js";
import type { ImageSource } from "../image-source.js";
import type {
  ArchitectureType,
  DiscoveryStatus,
  GatekeptLayer,
  KnownArchitectureType,
  Layer,
  LayerAccessType,
  LayerMembership,
  OpenLayer,
  OriginType,
  Relationship,
  RelationshipType,
  SideSystem,
  SideSystemLayerLink,
  SideSystemMembership,
  StructureVisualProps,
  Subsystem,
  SubsystemLayerLink,
  SubsystemMembership,
  SubsystemSideSystemLink,
  SystemProfile,
} from "../structure.js";
import type { UnixMillis } from "../timestamps.js";
import type { AuditMetadata } from "../utility.js";

describe("RelationshipType", () => {
  it("accepts all 10 valid types", () => {
    assertType<RelationshipType>("split-from");
    assertType<RelationshipType>("fused-from");
    assertType<RelationshipType>("sibling");
    assertType<RelationshipType>("partner");
    assertType<RelationshipType>("parent-child");
    assertType<RelationshipType>("protector-of");
    assertType<RelationshipType>("caretaker-of");
    assertType<RelationshipType>("gatekeeper-of");
    assertType<RelationshipType>("source");
    assertType<RelationshipType>("custom");
  });

  it("rejects invalid types", () => {
    // @ts-expect-error invalid relationship type
    assertType<RelationshipType>("friend");
  });

  it("is exhaustive in a switch", () => {
    function handleType(type: RelationshipType): string {
      switch (type) {
        case "split-from":
        case "fused-from":
        case "sibling":
        case "partner":
        case "parent-child":
        case "protector-of":
        case "caretaker-of":
        case "gatekeeper-of":
        case "source":
        case "custom":
          return type;
        default: {
          const _exhaustive: never = type;
          return _exhaustive;
        }
      }
    }
    expectTypeOf(handleType).toBeFunction();
  });
});

describe("Relationship", () => {
  it("does not extend AuditMetadata", () => {
    expectTypeOf<Relationship>().not.toExtend<AuditMetadata>();
  });

  it("has correct field types", () => {
    expectTypeOf<Relationship["id"]>().toEqualTypeOf<RelationshipId>();
    expectTypeOf<Relationship["systemId"]>().toEqualTypeOf<SystemId>();
    expectTypeOf<Relationship["sourceMemberId"]>().toEqualTypeOf<MemberId>();
    expectTypeOf<Relationship["targetMemberId"]>().toEqualTypeOf<MemberId>();
    expectTypeOf<Relationship["type"]>().toEqualTypeOf<RelationshipType>();
    expectTypeOf<Relationship["label"]>().toEqualTypeOf<string | null>();
    expectTypeOf<Relationship["bidirectional"]>().toEqualTypeOf<boolean>();
    expectTypeOf<Relationship["createdAt"]>().toEqualTypeOf<UnixMillis>();
  });

  it("has exact shape", () => {
    expectTypeOf<keyof Relationship>().toEqualTypeOf<
      | "id"
      | "systemId"
      | "sourceMemberId"
      | "targetMemberId"
      | "type"
      | "label"
      | "bidirectional"
      | "createdAt"
    >();
  });
});

describe("ArchitectureType", () => {
  it("discriminates on kind field", () => {
    function handleType(type: ArchitectureType): string {
      switch (type.kind) {
        case "known":
          return type.type;
        case "custom":
          return type.value;
        default: {
          const _exhaustive: never = type;
          return _exhaustive;
        }
      }
    }
    expectTypeOf(handleType).toBeFunction();
  });

  it("is exhaustive over KnownArchitectureType in a switch", () => {
    function handleKnown(type: KnownArchitectureType): string {
      switch (type) {
        case "orbital":
        case "spectrum":
        case "median":
        case "age-sliding":
        case "webbed":
        case "unknown":
        case "fluid":
          return type;
        default: {
          const _exhaustive: never = type;
          return _exhaustive;
        }
      }
    }
    expectTypeOf(handleKnown).toBeFunction();
  });

  it("accepts known architecture types", () => {
    assertType<ArchitectureType>({
      kind: "known" as const,
      type: "orbital" as KnownArchitectureType,
    });
    assertType<ArchitectureType>({
      kind: "known" as const,
      type: "spectrum" as KnownArchitectureType,
    });
  });

  it("accepts custom architecture types", () => {
    assertType<ArchitectureType>({ kind: "custom" as const, value: "radial" });
  });

  it("rejects invalid known values", () => {
    // @ts-expect-error invalid architecture type
    assertType<KnownArchitectureType>("layered");
  });
});

describe("OriginType", () => {
  it("is exhaustive in a switch", () => {
    function handleType(type: OriginType): string {
      switch (type) {
        case "traumagenic":
        case "endogenic":
        case "mixed-origin":
        case "quoigenic":
        case "prefer-not-to-say":
        case "custom":
          return type;
        default: {
          const _exhaustive: never = type;
          return _exhaustive;
        }
      }
    }
    expectTypeOf(handleType).toBeFunction();
  });

  it("rejects invalid values", () => {
    // @ts-expect-error invalid origin type
    assertType<OriginType>("iatrogenic");
  });
});

describe("DiscoveryStatus", () => {
  it("is exhaustive in a switch", () => {
    function handleStatus(status: DiscoveryStatus): string {
      switch (status) {
        case "fully-mapped":
        case "partially-mapped":
        case "unknown":
          return status;
        default: {
          const _exhaustive: never = status;
          return _exhaustive;
        }
      }
    }
    expectTypeOf(handleStatus).toBeFunction();
  });

  it("rejects invalid values", () => {
    // @ts-expect-error invalid discovery status
    assertType<DiscoveryStatus>("in-progress");
  });
});

describe("SystemProfile", () => {
  it("has nullable architecture and origin", () => {
    expectTypeOf<SystemProfile["architecture"]>().toEqualTypeOf<ArchitectureType | null>();
    expectTypeOf<SystemProfile["origin"]>().toEqualTypeOf<OriginType | null>();
  });

  it("has required discoveryStatus", () => {
    expectTypeOf<SystemProfile["discoveryStatus"]>().toEqualTypeOf<DiscoveryStatus>();
  });

  it("has hasCore boolean", () => {
    expectTypeOf<SystemProfile["hasCore"]>().toEqualTypeOf<boolean>();
  });

  it("does not extend AuditMetadata", () => {
    expectTypeOf<SystemProfile>().not.toExtend<AuditMetadata>();
  });
});

describe("LayerAccessType", () => {
  it("is exhaustive in a switch", () => {
    function handleType(type: LayerAccessType): string {
      switch (type) {
        case "open":
        case "gatekept":
          return type;
        default: {
          const _exhaustive: never = type;
          return _exhaustive;
        }
      }
    }
    expectTypeOf(handleType).toBeFunction();
  });

  it("rejects invalid values", () => {
    // @ts-expect-error invalid access type
    assertType<LayerAccessType>("restricted");
  });
});

describe("StructureVisualProps", () => {
  it("has exactly the expected keys", () => {
    expectTypeOf<keyof StructureVisualProps>().toEqualTypeOf<"color" | "imageSource" | "emoji">();
  });

  it("has correct nullable field types", () => {
    expectTypeOf<StructureVisualProps["color"]>().toEqualTypeOf<HexColor | null>();
    expectTypeOf<StructureVisualProps["imageSource"]>().toEqualTypeOf<ImageSource | null>();
    expectTypeOf<StructureVisualProps["emoji"]>().toEqualTypeOf<string | null>();
  });
});

describe("Subsystem", () => {
  it("extends AuditMetadata", () => {
    expectTypeOf<Subsystem>().toExtend<AuditMetadata>();
  });

  it("extends StructureVisualProps", () => {
    expectTypeOf<Subsystem>().toExtend<StructureVisualProps>();
  });

  it("has correct field types", () => {
    expectTypeOf<Subsystem["id"]>().toEqualTypeOf<SubsystemId>();
    expectTypeOf<Subsystem["systemId"]>().toEqualTypeOf<SystemId>();
    expectTypeOf<Subsystem["name"]>().toBeString();
    expectTypeOf<Subsystem["description"]>().toEqualTypeOf<string | null>();
    expectTypeOf<Subsystem["architectureType"]>().toEqualTypeOf<ArchitectureType | null>();
    expectTypeOf<Subsystem["hasCore"]>().toEqualTypeOf<boolean>();
    expectTypeOf<Subsystem["discoveryStatus"]>().toEqualTypeOf<DiscoveryStatus>();
    expectTypeOf<Subsystem["color"]>().toEqualTypeOf<HexColor | null>();
    expectTypeOf<Subsystem["imageSource"]>().toEqualTypeOf<ImageSource | null>();
    expectTypeOf<Subsystem["emoji"]>().toEqualTypeOf<string | null>();
  });

  it("has recursive parentSubsystemId", () => {
    expectTypeOf<Subsystem["parentSubsystemId"]>().toEqualTypeOf<SubsystemId | null>();
  });
});

describe("SideSystem", () => {
  it("extends AuditMetadata", () => {
    expectTypeOf<SideSystem>().toExtend<AuditMetadata>();
  });

  it("extends StructureVisualProps", () => {
    expectTypeOf<SideSystem>().toExtend<StructureVisualProps>();
  });

  it("has correct field types", () => {
    expectTypeOf<SideSystem["id"]>().toEqualTypeOf<SideSystemId>();
    expectTypeOf<SideSystem["systemId"]>().toEqualTypeOf<SystemId>();
    expectTypeOf<SideSystem["name"]>().toBeString();
    expectTypeOf<SideSystem["description"]>().toEqualTypeOf<string | null>();
    expectTypeOf<SideSystem["color"]>().toEqualTypeOf<HexColor | null>();
    expectTypeOf<SideSystem["imageSource"]>().toEqualTypeOf<ImageSource | null>();
    expectTypeOf<SideSystem["emoji"]>().toEqualTypeOf<string | null>();
  });
});

describe("Layer", () => {
  it("both variants extend AuditMetadata", () => {
    expectTypeOf<OpenLayer>().toExtend<AuditMetadata>();
    expectTypeOf<GatekeptLayer>().toExtend<AuditMetadata>();
  });

  it("discriminates on accessType", () => {
    function handleLayer(layer: Layer): void {
      if (layer.accessType === "open") {
        expectTypeOf(layer).toEqualTypeOf<OpenLayer>();
        expectTypeOf(layer.gatekeeperMemberIds).toEqualTypeOf<readonly []>();
      } else {
        expectTypeOf(layer).toEqualTypeOf<GatekeptLayer>();
        expectTypeOf(layer.gatekeeperMemberIds).toEqualTypeOf<readonly MemberId[]>();
      }
    }
    expectTypeOf(handleLayer).toBeFunction();
  });

  it("has correct shared field types", () => {
    expectTypeOf<Layer["id"]>().toEqualTypeOf<LayerId>();
    expectTypeOf<Layer["systemId"]>().toEqualTypeOf<SystemId>();
    expectTypeOf<Layer["name"]>().toBeString();
    expectTypeOf<Layer["description"]>().toEqualTypeOf<string | null>();
    expectTypeOf<Layer["accessType"]>().toEqualTypeOf<LayerAccessType>();
    expectTypeOf<Layer["color"]>().toEqualTypeOf<HexColor | null>();
    expectTypeOf<Layer["imageSource"]>().toEqualTypeOf<ImageSource | null>();
    expectTypeOf<Layer["emoji"]>().toEqualTypeOf<string | null>();
  });
});

describe("SubsystemMembership", () => {
  it("has exactly subsystemId and memberId", () => {
    expectTypeOf<SubsystemMembership["subsystemId"]>().toEqualTypeOf<SubsystemId>();
    expectTypeOf<SubsystemMembership["memberId"]>().toEqualTypeOf<MemberId>();
    expectTypeOf<keyof SubsystemMembership>().toEqualTypeOf<"subsystemId" | "memberId">();
  });
});

describe("SideSystemMembership", () => {
  it("has exactly sideSystemId and memberId", () => {
    expectTypeOf<SideSystemMembership["sideSystemId"]>().toEqualTypeOf<SideSystemId>();
    expectTypeOf<SideSystemMembership["memberId"]>().toEqualTypeOf<MemberId>();
    expectTypeOf<keyof SideSystemMembership>().toEqualTypeOf<"sideSystemId" | "memberId">();
  });
});

describe("LayerMembership", () => {
  it("has exactly layerId and memberId", () => {
    expectTypeOf<LayerMembership["layerId"]>().toEqualTypeOf<LayerId>();
    expectTypeOf<LayerMembership["memberId"]>().toEqualTypeOf<MemberId>();
    expectTypeOf<keyof LayerMembership>().toEqualTypeOf<"layerId" | "memberId">();
  });
});

describe("SubsystemLayerLink", () => {
  it("has exactly subsystemId and layerId", () => {
    expectTypeOf<SubsystemLayerLink["subsystemId"]>().toEqualTypeOf<SubsystemId>();
    expectTypeOf<SubsystemLayerLink["layerId"]>().toEqualTypeOf<LayerId>();
    expectTypeOf<keyof SubsystemLayerLink>().toEqualTypeOf<"subsystemId" | "layerId">();
  });
});

describe("SubsystemSideSystemLink", () => {
  it("has exactly subsystemId and sideSystemId", () => {
    expectTypeOf<SubsystemSideSystemLink["subsystemId"]>().toEqualTypeOf<SubsystemId>();
    expectTypeOf<SubsystemSideSystemLink["sideSystemId"]>().toEqualTypeOf<SideSystemId>();
    expectTypeOf<keyof SubsystemSideSystemLink>().toEqualTypeOf<"subsystemId" | "sideSystemId">();
  });
});

describe("SideSystemLayerLink", () => {
  it("has exactly sideSystemId and layerId", () => {
    expectTypeOf<SideSystemLayerLink["sideSystemId"]>().toEqualTypeOf<SideSystemId>();
    expectTypeOf<SideSystemLayerLink["layerId"]>().toEqualTypeOf<LayerId>();
    expectTypeOf<keyof SideSystemLayerLink>().toEqualTypeOf<"sideSystemId" | "layerId">();
  });
});

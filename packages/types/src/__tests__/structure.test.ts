import { assertType, describe, expectTypeOf, it } from "vitest";

import type {
  LayerId,
  MemberId,
  RelationshipId,
  SideSystemId,
  SubsystemId,
  SystemId,
} from "../ids.js";
import type {
  ArchitectureType,
  DiscoveryStatus,
  Layer,
  LayerAccessType,
  LayerMembership,
  OriginType,
  Relationship,
  RelationshipType,
  SideSystem,
  SideSystemMembership,
  Subsystem,
  SubsystemMembership,
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
    expectTypeOf<Relationship["createdAt"]>().toEqualTypeOf<UnixMillis>();
  });
});

describe("ArchitectureType", () => {
  it("is exhaustive in a switch", () => {
    function handleType(type: ArchitectureType): string {
      switch (type) {
        case "orbital":
        case "compartmentalized":
        case "webbed":
        case "mixed":
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
});

describe("Subsystem", () => {
  it("extends AuditMetadata", () => {
    expectTypeOf<Subsystem>().toExtend<AuditMetadata>();
  });

  it("has correct field types", () => {
    expectTypeOf<Subsystem["id"]>().toEqualTypeOf<SubsystemId>();
    expectTypeOf<Subsystem["systemId"]>().toEqualTypeOf<SystemId>();
    expectTypeOf<Subsystem["name"]>().toBeString();
    expectTypeOf<Subsystem["description"]>().toEqualTypeOf<string | null>();
  });

  it("has recursive parentSubsystemId", () => {
    expectTypeOf<Subsystem["parentSubsystemId"]>().toEqualTypeOf<SubsystemId | null>();
  });
});

describe("SideSystem", () => {
  it("extends AuditMetadata", () => {
    expectTypeOf<SideSystem>().toExtend<AuditMetadata>();
  });

  it("has correct field types", () => {
    expectTypeOf<SideSystem["id"]>().toEqualTypeOf<SideSystemId>();
    expectTypeOf<SideSystem["systemId"]>().toEqualTypeOf<SystemId>();
    expectTypeOf<SideSystem["name"]>().toBeString();
    expectTypeOf<SideSystem["description"]>().toEqualTypeOf<string | null>();
  });
});

describe("Layer", () => {
  it("extends AuditMetadata", () => {
    expectTypeOf<Layer>().toExtend<AuditMetadata>();
  });

  it("has correct field types", () => {
    expectTypeOf<Layer["id"]>().toEqualTypeOf<LayerId>();
    expectTypeOf<Layer["systemId"]>().toEqualTypeOf<SystemId>();
    expectTypeOf<Layer["name"]>().toBeString();
    expectTypeOf<Layer["description"]>().toEqualTypeOf<string | null>();
    expectTypeOf<Layer["accessType"]>().toEqualTypeOf<LayerAccessType>();
  });

  it("has nullable gatekeeperMemberId", () => {
    expectTypeOf<Layer["gatekeeperMemberId"]>().toEqualTypeOf<MemberId | null>();
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

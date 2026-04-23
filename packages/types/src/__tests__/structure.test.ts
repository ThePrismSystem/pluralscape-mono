import { assertType, describe, expectTypeOf, it } from "vitest";

import type {
  ArchivedRelationship,
  Relationship,
  RelationshipType,
} from "../entities/relationship.js";
import type { SystemStructureEntityAssociation } from "../entities/structure-entity-association.js";
import type { SystemStructureEntityLink } from "../entities/structure-entity-link.js";
import type { SystemStructureEntityMemberLink } from "../entities/structure-entity-member-link.js";
import type {
  ArchitectureType,
  ArchivedSystemStructureEntityType,
  KnownArchitectureType,
  SystemStructureEntityType,
} from "../entities/structure-entity-type.js";
import type {
  ArchivedSystemStructureEntity,
  DiscoveryStatus,
  OriginType,
  StructureVisualProps,
  SystemProfile,
  SystemStructureEntity,
} from "../entities/structure-entity.js";
import type {
  HexColor,
  MemberId,
  RelationshipId,
  SystemId,
  SystemStructureEntityAssociationId,
  SystemStructureEntityId,
  SystemStructureEntityLinkId,
  SystemStructureEntityMemberLinkId,
  SystemStructureEntityTypeId,
} from "../ids.js";
import type { ImageSource } from "../image-source.js";
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
    expectTypeOf<Relationship["sourceMemberId"]>().toEqualTypeOf<MemberId | null>();
    expectTypeOf<Relationship["targetMemberId"]>().toEqualTypeOf<MemberId | null>();
    expectTypeOf<Relationship["type"]>().toEqualTypeOf<RelationshipType>();
    expectTypeOf<Relationship["label"]>().toEqualTypeOf<string | null>();
    expectTypeOf<Relationship["bidirectional"]>().toEqualTypeOf<boolean>();
    expectTypeOf<Relationship["createdAt"]>().toEqualTypeOf<UnixMillis>();
  });

  it("has archived as false literal", () => {
    expectTypeOf<Relationship["archived"]>().toEqualTypeOf<false>();
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
      | "archived"
    >();
  });
});

describe("ArchivedRelationship", () => {
  it("has archived as true literal", () => {
    expectTypeOf<ArchivedRelationship["archived"]>().toEqualTypeOf<true>();
  });

  it("has archivedAt timestamp", () => {
    expectTypeOf<ArchivedRelationship["archivedAt"]>().toEqualTypeOf<UnixMillis>();
  });

  it("preserves core Relationship fields", () => {
    expectTypeOf<ArchivedRelationship["id"]>().toEqualTypeOf<RelationshipId>();
    expectTypeOf<ArchivedRelationship["systemId"]>().toEqualTypeOf<SystemId>();
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

describe("SystemStructureEntityType", () => {
  it("extends AuditMetadata", () => {
    expectTypeOf<SystemStructureEntityType>().toExtend<AuditMetadata>();
  });

  it("extends StructureVisualProps", () => {
    expectTypeOf<SystemStructureEntityType>().toExtend<StructureVisualProps>();
  });

  it("has correct field types", () => {
    expectTypeOf<SystemStructureEntityType["id"]>().toEqualTypeOf<SystemStructureEntityTypeId>();
    expectTypeOf<SystemStructureEntityType["systemId"]>().toEqualTypeOf<SystemId>();
    expectTypeOf<SystemStructureEntityType["name"]>().toBeString();
    expectTypeOf<SystemStructureEntityType["description"]>().toEqualTypeOf<string | null>();
    expectTypeOf<SystemStructureEntityType["sortOrder"]>().toEqualTypeOf<number>();
    expectTypeOf<SystemStructureEntityType["color"]>().toEqualTypeOf<HexColor | null>();
    expectTypeOf<SystemStructureEntityType["imageSource"]>().toEqualTypeOf<ImageSource | null>();
    expectTypeOf<SystemStructureEntityType["emoji"]>().toEqualTypeOf<string | null>();
  });

  it("has archived as false literal", () => {
    expectTypeOf<SystemStructureEntityType["archived"]>().toEqualTypeOf<false>();
  });
});

describe("ArchivedSystemStructureEntityType", () => {
  it("has archived as true literal", () => {
    expectTypeOf<ArchivedSystemStructureEntityType["archived"]>().toEqualTypeOf<true>();
  });

  it("preserves core fields", () => {
    expectTypeOf<
      ArchivedSystemStructureEntityType["id"]
    >().toEqualTypeOf<SystemStructureEntityTypeId>();
    expectTypeOf<ArchivedSystemStructureEntityType["systemId"]>().toEqualTypeOf<SystemId>();
  });
});

describe("SystemStructureEntity", () => {
  it("extends AuditMetadata", () => {
    expectTypeOf<SystemStructureEntity>().toExtend<AuditMetadata>();
  });

  it("extends StructureVisualProps", () => {
    expectTypeOf<SystemStructureEntity>().toExtend<StructureVisualProps>();
  });

  it("has correct field types", () => {
    expectTypeOf<SystemStructureEntity["id"]>().toEqualTypeOf<SystemStructureEntityId>();
    expectTypeOf<SystemStructureEntity["systemId"]>().toEqualTypeOf<SystemId>();
    expectTypeOf<
      SystemStructureEntity["entityTypeId"]
    >().toEqualTypeOf<SystemStructureEntityTypeId>();
    expectTypeOf<SystemStructureEntity["name"]>().toBeString();
    expectTypeOf<SystemStructureEntity["description"]>().toEqualTypeOf<string | null>();
    expectTypeOf<SystemStructureEntity["sortOrder"]>().toEqualTypeOf<number>();
    expectTypeOf<SystemStructureEntity["color"]>().toEqualTypeOf<HexColor | null>();
    expectTypeOf<SystemStructureEntity["imageSource"]>().toEqualTypeOf<ImageSource | null>();
    expectTypeOf<SystemStructureEntity["emoji"]>().toEqualTypeOf<string | null>();
  });

  it("has archived as false literal", () => {
    expectTypeOf<SystemStructureEntity["archived"]>().toEqualTypeOf<false>();
  });
});

describe("ArchivedSystemStructureEntity", () => {
  it("has archived as true literal", () => {
    expectTypeOf<ArchivedSystemStructureEntity["archived"]>().toEqualTypeOf<true>();
  });

  it("preserves core fields", () => {
    expectTypeOf<ArchivedSystemStructureEntity["id"]>().toEqualTypeOf<SystemStructureEntityId>();
    expectTypeOf<ArchivedSystemStructureEntity["systemId"]>().toEqualTypeOf<SystemId>();
    expectTypeOf<
      ArchivedSystemStructureEntity["entityTypeId"]
    >().toEqualTypeOf<SystemStructureEntityTypeId>();
  });
});

describe("SystemStructureEntityLink", () => {
  it("has correct field types", () => {
    expectTypeOf<SystemStructureEntityLink["id"]>().toEqualTypeOf<SystemStructureEntityLinkId>();
    expectTypeOf<SystemStructureEntityLink["systemId"]>().toEqualTypeOf<SystemId>();
    expectTypeOf<SystemStructureEntityLink["entityId"]>().toEqualTypeOf<SystemStructureEntityId>();
    expectTypeOf<
      SystemStructureEntityLink["parentEntityId"]
    >().toEqualTypeOf<SystemStructureEntityId | null>();
    expectTypeOf<SystemStructureEntityLink["sortOrder"]>().toEqualTypeOf<number>();
    expectTypeOf<SystemStructureEntityLink["createdAt"]>().toEqualTypeOf<UnixMillis>();
  });

  it("has exact shape", () => {
    expectTypeOf<keyof SystemStructureEntityLink>().toEqualTypeOf<
      "id" | "systemId" | "entityId" | "parentEntityId" | "sortOrder" | "createdAt"
    >();
  });
});

describe("SystemStructureEntityMemberLink", () => {
  it("has correct field types", () => {
    expectTypeOf<
      SystemStructureEntityMemberLink["id"]
    >().toEqualTypeOf<SystemStructureEntityMemberLinkId>();
    expectTypeOf<SystemStructureEntityMemberLink["systemId"]>().toEqualTypeOf<SystemId>();
    expectTypeOf<
      SystemStructureEntityMemberLink["parentEntityId"]
    >().toEqualTypeOf<SystemStructureEntityId | null>();
    expectTypeOf<SystemStructureEntityMemberLink["memberId"]>().toEqualTypeOf<MemberId>();
    expectTypeOf<SystemStructureEntityMemberLink["sortOrder"]>().toEqualTypeOf<number>();
    expectTypeOf<SystemStructureEntityMemberLink["createdAt"]>().toEqualTypeOf<UnixMillis>();
  });

  it("has exact shape", () => {
    expectTypeOf<keyof SystemStructureEntityMemberLink>().toEqualTypeOf<
      "id" | "systemId" | "parentEntityId" | "memberId" | "sortOrder" | "createdAt"
    >();
  });
});

describe("SystemStructureEntityAssociation", () => {
  it("has correct field types", () => {
    expectTypeOf<
      SystemStructureEntityAssociation["id"]
    >().toEqualTypeOf<SystemStructureEntityAssociationId>();
    expectTypeOf<SystemStructureEntityAssociation["systemId"]>().toEqualTypeOf<SystemId>();
    expectTypeOf<
      SystemStructureEntityAssociation["sourceEntityId"]
    >().toEqualTypeOf<SystemStructureEntityId>();
    expectTypeOf<
      SystemStructureEntityAssociation["targetEntityId"]
    >().toEqualTypeOf<SystemStructureEntityId>();
    expectTypeOf<SystemStructureEntityAssociation["createdAt"]>().toEqualTypeOf<UnixMillis>();
  });

  it("has exact shape", () => {
    expectTypeOf<keyof SystemStructureEntityAssociation>().toEqualTypeOf<
      "id" | "systemId" | "sourceEntityId" | "targetEntityId" | "createdAt"
    >();
  });
});

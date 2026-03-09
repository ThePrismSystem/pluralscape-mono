import { assertType, describe, expectTypeOf, it } from "vitest";

import type {
  ArchivedMember,
  CompletenessLevel,
  KnownRoleTag,
  Member,
  MemberListItem,
  MemberPhoto,
  RoleTag,
  System,
} from "../identity.js";
import type { BlobId, MemberId, MemberPhotoId, SystemId, SystemSettingsId } from "../ids.js";
import type { UnixMillis } from "../timestamps.js";
import type { AuditMetadata } from "../utility.js";

describe("System", () => {
  it("requires SystemId for id field", () => {
    expectTypeOf<System["id"]>().toEqualTypeOf<SystemId>();
  });

  it("has required string fields", () => {
    expectTypeOf<System["name"]>().toBeString();
  });

  it("has nullable fields", () => {
    expectTypeOf<System["displayName"]>().toEqualTypeOf<string | null>();
    expectTypeOf<System["description"]>().toEqualTypeOf<string | null>();
    expectTypeOf<System["avatarRef"]>().toEqualTypeOf<BlobId | null>();
  });

  it("has settingsId referencing SystemSettingsId", () => {
    expectTypeOf<System["settingsId"]>().toEqualTypeOf<SystemSettingsId>();
  });

  it("extends AuditMetadata", () => {
    expectTypeOf<System>().toExtend<AuditMetadata>();
    expectTypeOf<System["createdAt"]>().toEqualTypeOf<UnixMillis>();
    expectTypeOf<System["updatedAt"]>().toEqualTypeOf<UnixMillis>();
    expectTypeOf<System["version"]>().toEqualTypeOf<number>();
  });
});

describe("Member", () => {
  it("requires MemberId for id", () => {
    expectTypeOf<Member["id"]>().toEqualTypeOf<MemberId>();
  });

  it("requires SystemId for systemId", () => {
    expectTypeOf<Member["systemId"]>().toEqualTypeOf<SystemId>();
    // @ts-expect-error plain string not assignable to SystemId
    assertType<Member["systemId"]>("sys_123");
  });

  it("has pronouns as readonly string array", () => {
    expectTypeOf<Member["pronouns"]>().toEqualTypeOf<readonly string[]>();
  });

  it("has colors as readonly string array", () => {
    expectTypeOf<Member["colors"]>().toEqualTypeOf<readonly string[]>();
  });

  it("has completenessLevel field", () => {
    expectTypeOf<Member["completenessLevel"]>().toEqualTypeOf<CompletenessLevel>();
  });

  it("has roleTags array", () => {
    expectTypeOf<Member["roleTags"]>().toEqualTypeOf<readonly RoleTag[]>();
  });

  it("has nullable fields", () => {
    expectTypeOf<Member["description"]>().toEqualTypeOf<string | null>();
    expectTypeOf<Member["avatarRef"]>().toEqualTypeOf<BlobId | null>();
  });

  it("extends AuditMetadata", () => {
    expectTypeOf<Member>().toExtend<AuditMetadata>();
    expectTypeOf<Member["createdAt"]>().toEqualTypeOf<UnixMillis>();
    expectTypeOf<Member["updatedAt"]>().toEqualTypeOf<UnixMillis>();
    expectTypeOf<Member["version"]>().toEqualTypeOf<number>();
  });

  it("has archived as false literal", () => {
    expectTypeOf<Member["archived"]>().toEqualTypeOf<false>();
  });
});

describe("CompletenessLevel", () => {
  it("accepts valid levels", () => {
    assertType<CompletenessLevel>("fragment");
    assertType<CompletenessLevel>("demi-member");
    assertType<CompletenessLevel>("full");
  });

  it("rejects invalid levels", () => {
    // @ts-expect-error invalid completeness level
    assertType<CompletenessLevel>("partial");
  });

  it("is exhaustive in a switch", () => {
    function handleLevel(level: CompletenessLevel): string {
      switch (level) {
        case "fragment":
          return "fragment";
        case "demi-member":
          return "demi-member";
        case "full":
          return "full";
        default: {
          const _exhaustive: never = level;
          return _exhaustive;
        }
      }
    }
    expectTypeOf(handleLevel).toBeFunction();
  });
});

describe("RoleTag", () => {
  it("accepts known role tags with kind discriminant", () => {
    assertType<RoleTag>({ kind: "known" as const, tag: "protector" as KnownRoleTag });
    assertType<RoleTag>({ kind: "known" as const, tag: "host" as KnownRoleTag });
  });

  it("accepts custom role tags with value", () => {
    assertType<RoleTag>({ kind: "custom" as const, value: "helper" });
  });

  it("discriminates on kind field", () => {
    function handleTag(roleTag: RoleTag): string {
      if (roleTag.kind === "custom") {
        expectTypeOf(roleTag.value).toBeString();
        return roleTag.value;
      }
      expectTypeOf(roleTag.tag).toEqualTypeOf<KnownRoleTag>();
      return roleTag.tag;
    }
    expectTypeOf(handleTag).toBeFunction();
  });

  it("covers all 9 known role tags", () => {
    assertType<KnownRoleTag>("protector");
    assertType<KnownRoleTag>("gatekeeper");
    assertType<KnownRoleTag>("caretaker");
    assertType<KnownRoleTag>("little");
    assertType<KnownRoleTag>("age-slider");
    assertType<KnownRoleTag>("trauma-holder");
    assertType<KnownRoleTag>("host");
    assertType<KnownRoleTag>("persecutor");
    assertType<KnownRoleTag>("mediator");
  });

  it("rejects invalid known tags", () => {
    // @ts-expect-error invalid role tag
    assertType<KnownRoleTag>("invalid");
  });

  it("rejects custom tag without value", () => {
    // @ts-expect-error missing value on custom tag
    assertType<RoleTag>({ kind: "custom" as const });
  });
});

describe("MemberPhoto", () => {
  it("has id as MemberPhotoId", () => {
    expectTypeOf<MemberPhoto["id"]>().toEqualTypeOf<MemberPhotoId>();
  });

  it("has memberId as MemberId", () => {
    expectTypeOf<MemberPhoto["memberId"]>().toEqualTypeOf<MemberId>();
  });

  it("has blobRef as BlobId", () => {
    expectTypeOf<MemberPhoto["blobRef"]>().toEqualTypeOf<BlobId>();
  });

  it("has sortOrder and nullable caption", () => {
    expectTypeOf<MemberPhoto["sortOrder"]>().toEqualTypeOf<number>();
    expectTypeOf<MemberPhoto["caption"]>().toEqualTypeOf<string | null>();
  });
});

describe("ArchivedMember", () => {
  it("has all Member fields except archived", () => {
    expectTypeOf<ArchivedMember["id"]>().toEqualTypeOf<MemberId>();
    expectTypeOf<ArchivedMember["systemId"]>().toEqualTypeOf<SystemId>();
    expectTypeOf<ArchivedMember["name"]>().toBeString();
    expectTypeOf<ArchivedMember["completenessLevel"]>().toEqualTypeOf<CompletenessLevel>();
  });

  it("has archived as true literal", () => {
    expectTypeOf<ArchivedMember["archived"]>().toEqualTypeOf<true>();
  });

  it("has archivedAt timestamp", () => {
    expectTypeOf<ArchivedMember["archivedAt"]>().toEqualTypeOf<UnixMillis>();
  });
});

describe("MemberListItem", () => {
  it("has lightweight projection fields", () => {
    expectTypeOf<MemberListItem["id"]>().toEqualTypeOf<MemberId>();
    expectTypeOf<MemberListItem["name"]>().toBeString();
    expectTypeOf<MemberListItem["avatarRef"]>().toEqualTypeOf<BlobId | null>();
    expectTypeOf<MemberListItem["colors"]>().toEqualTypeOf<readonly string[]>();
    expectTypeOf<MemberListItem["archived"]>().toEqualTypeOf<boolean>();
  });
});

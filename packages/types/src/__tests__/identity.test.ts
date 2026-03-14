import { assertType, describe, expectTypeOf, it } from "vitest";

import type {
  ArchivedMember,
  ArchivedMemberPhoto,
  KnownSaturationLevel,
  KnownTag,
  Member,
  MemberListItem,
  MemberPhoto,
  SaturationLevel,
  System,
  Tag,
} from "../identity.js";
import type { HexColor, MemberId, MemberPhotoId, SystemId, SystemSettingsId } from "../ids.js";
import type { ImageSource } from "../image-source.js";
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
    expectTypeOf<System["avatarSource"]>().toEqualTypeOf<ImageSource | null>();
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

  it("has colors as readonly HexColor array", () => {
    expectTypeOf<Member["colors"]>().toEqualTypeOf<readonly HexColor[]>();
  });

  it("has saturationLevel field", () => {
    expectTypeOf<Member["saturationLevel"]>().toEqualTypeOf<SaturationLevel>();
  });

  it("has tags array", () => {
    expectTypeOf<Member["tags"]>().toEqualTypeOf<readonly Tag[]>();
  });

  it("has nullable fields", () => {
    expectTypeOf<Member["description"]>().toEqualTypeOf<string | null>();
    expectTypeOf<Member["avatarSource"]>().toEqualTypeOf<ImageSource | null>();
  });

  it("has notification boolean fields", () => {
    expectTypeOf<Member["suppressFriendFrontNotification"]>().toEqualTypeOf<boolean>();
    expectTypeOf<Member["boardMessageNotificationOnFront"]>().toEqualTypeOf<boolean>();
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

describe("SaturationLevel", () => {
  it("accepts known saturation levels", () => {
    assertType<SaturationLevel>({
      kind: "known" as const,
      level: "fragment" as KnownSaturationLevel,
    });
    assertType<SaturationLevel>({
      kind: "known" as const,
      level: "functional-fragment" as KnownSaturationLevel,
    });
    assertType<SaturationLevel>({
      kind: "known" as const,
      level: "partially-elaborated" as KnownSaturationLevel,
    });
    assertType<SaturationLevel>({
      kind: "known" as const,
      level: "highly-elaborated" as KnownSaturationLevel,
    });
  });

  it("accepts custom saturation levels", () => {
    assertType<SaturationLevel>({ kind: "custom" as const, value: "emerging" });
  });

  it("rejects invalid known levels", () => {
    // @ts-expect-error invalid known saturation level
    assertType<KnownSaturationLevel>("partial");
  });

  it("discriminates on kind field", () => {
    function handleLevel(level: SaturationLevel): string {
      switch (level.kind) {
        case "known":
          return level.level;
        case "custom":
          return level.value;
        default: {
          const _exhaustive: never = level;
          return _exhaustive;
        }
      }
    }
    expectTypeOf(handleLevel).toBeFunction();
  });

  it("is exhaustive over KnownSaturationLevel in a switch", () => {
    function handleKnown(level: KnownSaturationLevel): string {
      switch (level) {
        case "fragment":
          return "fragment";
        case "functional-fragment":
          return "functional-fragment";
        case "partially-elaborated":
          return "partially-elaborated";
        case "highly-elaborated":
          return "highly-elaborated";
        default: {
          const _exhaustive: never = level;
          return _exhaustive;
        }
      }
    }
    expectTypeOf(handleKnown).toBeFunction();
  });
});

describe("Tag", () => {
  it("accepts known tags with kind discriminant", () => {
    assertType<Tag>({ kind: "known" as const, tag: "protector" as KnownTag });
    assertType<Tag>({ kind: "known" as const, tag: "host" as KnownTag });
  });

  it("accepts custom tags with value", () => {
    assertType<Tag>({ kind: "custom" as const, value: "helper" });
  });

  it("discriminates on kind field", () => {
    function handleTag(tag: Tag): string {
      if (tag.kind === "custom") {
        expectTypeOf(tag.value).toBeString();
        return tag.value;
      }
      expectTypeOf(tag.tag).toEqualTypeOf<KnownTag>();
      return tag.tag;
    }
    expectTypeOf(handleTag).toBeFunction();
  });

  it("is exhaustive over KnownTag in a switch", () => {
    function handleKnown(tag: KnownTag): string {
      switch (tag) {
        case "protector":
        case "gatekeeper":
        case "caretaker":
        case "little":
        case "age-slider":
        case "trauma-holder":
        case "host":
        case "persecutor":
        case "mediator":
        case "anp":
        case "memory-holder":
        case "symptom-holder":
        case "middle":
        case "introject":
        case "fictive":
        case "factive":
        case "non-human":
          return tag;
        default: {
          const _exhaustive: never = tag;
          return _exhaustive;
        }
      }
    }
    expectTypeOf(handleKnown).toBeFunction();
  });

  it("rejects invalid known tags", () => {
    // @ts-expect-error invalid tag
    assertType<KnownTag>("invalid");
  });

  it("rejects custom tag without value", () => {
    // @ts-expect-error missing value on custom tag
    assertType<Tag>({ kind: "custom" as const });
  });
});

describe("MemberPhoto", () => {
  it("has id as MemberPhotoId", () => {
    expectTypeOf<MemberPhoto["id"]>().toEqualTypeOf<MemberPhotoId>();
  });

  it("has memberId as MemberId", () => {
    expectTypeOf<MemberPhoto["memberId"]>().toEqualTypeOf<MemberId>();
  });

  it("has imageSource as ImageSource", () => {
    expectTypeOf<MemberPhoto["imageSource"]>().toEqualTypeOf<ImageSource>();
  });

  it("has sortOrder and nullable caption", () => {
    expectTypeOf<MemberPhoto["sortOrder"]>().toEqualTypeOf<number>();
    expectTypeOf<MemberPhoto["caption"]>().toEqualTypeOf<string | null>();
  });

  it("has archived as false literal", () => {
    expectTypeOf<MemberPhoto["archived"]>().toEqualTypeOf<false>();
  });
});

describe("ArchivedMemberPhoto", () => {
  it("has archived as true literal", () => {
    expectTypeOf<ArchivedMemberPhoto["archived"]>().toEqualTypeOf<true>();
  });

  it("has archivedAt timestamp", () => {
    expectTypeOf<ArchivedMemberPhoto["archivedAt"]>().toEqualTypeOf<UnixMillis>();
  });

  it("preserves MemberPhoto fields", () => {
    expectTypeOf<ArchivedMemberPhoto["id"]>().toEqualTypeOf<MemberPhotoId>();
    expectTypeOf<ArchivedMemberPhoto["memberId"]>().toEqualTypeOf<MemberId>();
    expectTypeOf<ArchivedMemberPhoto["imageSource"]>().toEqualTypeOf<ImageSource>();
  });
});

describe("ArchivedMember", () => {
  it("has all Member fields except archived", () => {
    expectTypeOf<ArchivedMember["id"]>().toEqualTypeOf<MemberId>();
    expectTypeOf<ArchivedMember["systemId"]>().toEqualTypeOf<SystemId>();
    expectTypeOf<ArchivedMember["name"]>().toBeString();
    expectTypeOf<ArchivedMember["saturationLevel"]>().toEqualTypeOf<SaturationLevel>();
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
    expectTypeOf<MemberListItem["avatarSource"]>().toEqualTypeOf<ImageSource | null>();
    expectTypeOf<MemberListItem["colors"]>().toEqualTypeOf<readonly HexColor[]>();
    expectTypeOf<MemberListItem["archived"]>().toEqualTypeOf<boolean>();
  });
});

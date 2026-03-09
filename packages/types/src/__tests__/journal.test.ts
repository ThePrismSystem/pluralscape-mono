import { assertType, describe, expectTypeOf, it } from "vitest";

import type { JournalEntryId, MemberId, SystemId, WikiPageId } from "../ids.js";
import type {
  EntityLink,
  JournalBlock,
  JournalBlockType,
  JournalEntry,
  WikiPage,
} from "../journal.js";
import type { AuditMetadata } from "../utility.js";

describe("JournalBlockType", () => {
  it("accepts all 9 block types", () => {
    assertType<JournalBlockType>("paragraph");
    assertType<JournalBlockType>("heading");
    assertType<JournalBlockType>("list");
    assertType<JournalBlockType>("quote");
    assertType<JournalBlockType>("code");
    assertType<JournalBlockType>("image");
    assertType<JournalBlockType>("divider");
    assertType<JournalBlockType>("callout");
    assertType<JournalBlockType>("toggle");
  });

  it("rejects invalid types", () => {
    // @ts-expect-error invalid block type
    assertType<JournalBlockType>("table");
  });

  it("is exhaustive in a switch", () => {
    function handleType(type: JournalBlockType): string {
      switch (type) {
        case "paragraph":
        case "heading":
        case "list":
        case "quote":
        case "code":
        case "image":
        case "divider":
        case "callout":
        case "toggle":
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

describe("JournalBlock", () => {
  it("has correct field types", () => {
    expectTypeOf<JournalBlock["type"]>().toEqualTypeOf<JournalBlockType>();
    expectTypeOf<JournalBlock["content"]>().toBeString();
    expectTypeOf<JournalBlock["metadata"]>().toEqualTypeOf<Readonly<
      Record<string, string>
    > | null>();
  });

  it("has recursive children", () => {
    expectTypeOf<JournalBlock["children"]>().toEqualTypeOf<readonly JournalBlock[]>();
  });
});

describe("EntityLink", () => {
  it("has correct field types", () => {
    expectTypeOf<EntityLink["entityType"]>().toBeString();
    expectTypeOf<EntityLink["entityId"]>().toBeString();
    expectTypeOf<EntityLink["label"]>().toEqualTypeOf<string | null>();
  });
});

describe("JournalEntry", () => {
  it("extends AuditMetadata", () => {
    expectTypeOf<JournalEntry>().toExtend<AuditMetadata>();
  });

  it("has correct field types", () => {
    expectTypeOf<JournalEntry["id"]>().toEqualTypeOf<JournalEntryId>();
    expectTypeOf<JournalEntry["systemId"]>().toEqualTypeOf<SystemId>();
    expectTypeOf<JournalEntry["authorMemberIds"]>().toEqualTypeOf<readonly MemberId[]>();
    expectTypeOf<JournalEntry["title"]>().toBeString();
    expectTypeOf<JournalEntry["blocks"]>().toEqualTypeOf<readonly JournalBlock[]>();
    expectTypeOf<JournalEntry["tags"]>().toEqualTypeOf<readonly string[]>();
    expectTypeOf<JournalEntry["linkedEntities"]>().toEqualTypeOf<readonly EntityLink[]>();
    expectTypeOf<JournalEntry["archived"]>().toEqualTypeOf<false>();
  });
});

describe("WikiPage", () => {
  it("extends AuditMetadata", () => {
    expectTypeOf<WikiPage>().toExtend<AuditMetadata>();
  });

  it("has correct field types", () => {
    expectTypeOf<WikiPage["id"]>().toEqualTypeOf<WikiPageId>();
    expectTypeOf<WikiPage["systemId"]>().toEqualTypeOf<SystemId>();
    expectTypeOf<WikiPage["title"]>().toBeString();
    expectTypeOf<WikiPage["blocks"]>().toEqualTypeOf<readonly JournalBlock[]>();
    expectTypeOf<WikiPage["parentPageId"]>().toEqualTypeOf<WikiPageId | null>();
    expectTypeOf<WikiPage["tags"]>().toEqualTypeOf<readonly string[]>();
    expectTypeOf<WikiPage["archived"]>().toEqualTypeOf<false>();
  });
});

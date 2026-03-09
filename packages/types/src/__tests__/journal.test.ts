import { assertType, describe, expectTypeOf, it } from "vitest";

import type {
  BlobId,
  EntityType,
  FrontingSessionId,
  JournalEntryId,
  MemberId,
  SystemId,
  WikiPageId,
} from "../ids.js";
import type {
  ArchivedJournalEntry,
  ArchivedWikiPage,
  CodeBlock,
  DividerBlock,
  EntityLink,
  EntityLinkBlock,
  HeadingBlock,
  HeadingLevel,
  ImageBlock,
  JournalBlock,
  JournalBlockType,
  JournalEntry,
  ListBlock,
  MemberLinkBlock,
  ParagraphBlock,
  QuoteBlock,
  WikiPage,
} from "../journal.js";
import type { UnixMillis } from "../timestamps.js";
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
    assertType<JournalBlockType>("member-link");
    assertType<JournalBlockType>("entity-link");
  });

  it("rejects invalid types", () => {
    // @ts-expect-error invalid block type
    assertType<JournalBlockType>("table");
  });

  it("is exhaustive in a switch", () => {
    function handleBlock(block: JournalBlock): string {
      switch (block.type) {
        case "paragraph":
          return block.content;
        case "heading":
          return String(block.level) + ": " + block.content;
        case "list":
          return block.items.join(",");
        case "quote":
          return block.content;
        case "code":
          return block.content;
        case "image":
          return block.blobId;
        case "divider":
          return "---";
        case "member-link":
          return block.memberId;
        case "entity-link":
          return block.entityId;
        default: {
          const _exhaustive: never = block;
          return _exhaustive;
        }
      }
    }
    expectTypeOf(handleBlock).toBeFunction();
  });
});

describe("ParagraphBlock", () => {
  it("has correct fields", () => {
    expectTypeOf<ParagraphBlock["type"]>().toEqualTypeOf<"paragraph">();
    expectTypeOf<ParagraphBlock["content"]>().toBeString();
    expectTypeOf<ParagraphBlock["children"]>().toEqualTypeOf<readonly JournalBlock[]>();
  });
});

describe("HeadingBlock", () => {
  it("has correct fields", () => {
    expectTypeOf<HeadingBlock["type"]>().toEqualTypeOf<"heading">();
    expectTypeOf<HeadingBlock["content"]>().toBeString();
    expectTypeOf<HeadingBlock["level"]>().toEqualTypeOf<HeadingLevel>();
  });
});

describe("ListBlock", () => {
  it("has correct fields", () => {
    expectTypeOf<ListBlock["type"]>().toEqualTypeOf<"list">();
    expectTypeOf<ListBlock["items"]>().toEqualTypeOf<readonly string[]>();
    expectTypeOf<ListBlock["ordered"]>().toEqualTypeOf<boolean>();
  });
});

describe("QuoteBlock", () => {
  it("has correct fields", () => {
    expectTypeOf<QuoteBlock["type"]>().toEqualTypeOf<"quote">();
    expectTypeOf<QuoteBlock["content"]>().toBeString();
  });
});

describe("CodeBlock", () => {
  it("has correct fields", () => {
    expectTypeOf<CodeBlock["type"]>().toEqualTypeOf<"code">();
    expectTypeOf<CodeBlock["content"]>().toBeString();
    expectTypeOf<CodeBlock["language"]>().toEqualTypeOf<string | null>();
  });
});

describe("ImageBlock", () => {
  it("has correct fields", () => {
    expectTypeOf<ImageBlock["type"]>().toEqualTypeOf<"image">();
    expectTypeOf<ImageBlock["blobId"]>().toEqualTypeOf<BlobId>();
    expectTypeOf<ImageBlock["caption"]>().toEqualTypeOf<string | null>();
  });
});

describe("DividerBlock", () => {
  it("has correct fields", () => {
    expectTypeOf<DividerBlock["type"]>().toEqualTypeOf<"divider">();
    expectTypeOf<DividerBlock["children"]>().toEqualTypeOf<readonly JournalBlock[]>();
  });
});

describe("MemberLinkBlock", () => {
  it("has correct fields", () => {
    expectTypeOf<MemberLinkBlock["type"]>().toEqualTypeOf<"member-link">();
    expectTypeOf<MemberLinkBlock["memberId"]>().toEqualTypeOf<MemberId>();
    expectTypeOf<MemberLinkBlock["displayText"]>().toBeString();
  });
});

describe("EntityLinkBlock", () => {
  it("has correct fields", () => {
    expectTypeOf<EntityLinkBlock["type"]>().toEqualTypeOf<"entity-link">();
    expectTypeOf<EntityLinkBlock["entityType"]>().toEqualTypeOf<EntityType>();
    expectTypeOf<EntityLinkBlock["entityId"]>().toBeString();
    expectTypeOf<EntityLinkBlock["displayText"]>().toBeString();
  });
});

describe("EntityLink", () => {
  it("has correct field types", () => {
    expectTypeOf<EntityLink["entityType"]>().toEqualTypeOf<EntityType>();
    expectTypeOf<EntityLink["entityId"]>().toBeString();
    expectTypeOf<EntityLink["displayText"]>().toBeString();
  });
});

describe("JournalEntry", () => {
  it("extends AuditMetadata", () => {
    expectTypeOf<JournalEntry>().toExtend<AuditMetadata>();
  });

  it("has correct field types", () => {
    expectTypeOf<JournalEntry["id"]>().toEqualTypeOf<JournalEntryId>();
    expectTypeOf<JournalEntry["systemId"]>().toEqualTypeOf<SystemId>();
    expectTypeOf<JournalEntry["authorMemberId"]>().toEqualTypeOf<MemberId | null>();
    expectTypeOf<JournalEntry["frontingSessionId"]>().toEqualTypeOf<FrontingSessionId | null>();
    expectTypeOf<JournalEntry["title"]>().toBeString();
    expectTypeOf<JournalEntry["blocks"]>().toEqualTypeOf<readonly JournalBlock[]>();
    expectTypeOf<JournalEntry["tags"]>().toEqualTypeOf<readonly string[]>();
    expectTypeOf<JournalEntry["linkedEntities"]>().toEqualTypeOf<readonly EntityLink[]>();
    expectTypeOf<JournalEntry["archived"]>().toEqualTypeOf<false>();
  });
});

describe("ArchivedJournalEntry", () => {
  it("has archived: true and archivedAt", () => {
    expectTypeOf<ArchivedJournalEntry["archived"]>().toEqualTypeOf<true>();
    expectTypeOf<ArchivedJournalEntry["archivedAt"]>().toEqualTypeOf<UnixMillis>();
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
    expectTypeOf<WikiPage["slug"]>().toBeString();
    expectTypeOf<WikiPage["blocks"]>().toEqualTypeOf<readonly JournalBlock[]>();
    expectTypeOf<WikiPage["linkedFromPages"]>().toEqualTypeOf<readonly WikiPageId[]>();
    expectTypeOf<WikiPage["tags"]>().toEqualTypeOf<readonly string[]>();
    expectTypeOf<WikiPage["archived"]>().toEqualTypeOf<false>();
  });
});

describe("ArchivedWikiPage", () => {
  it("has archived: true and archivedAt", () => {
    expectTypeOf<ArchivedWikiPage["archived"]>().toEqualTypeOf<true>();
    expectTypeOf<ArchivedWikiPage["archivedAt"]>().toEqualTypeOf<UnixMillis>();
  });
});

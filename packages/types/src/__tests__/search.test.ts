import { assertType, describe, expectTypeOf, it } from "vitest";

import type {
  SearchableEntityType,
  SearchIndex,
  SearchQuery,
  SearchResult,
  SearchResultItem,
} from "../search.js";

describe("SearchIndex", () => {
  it("extends string", () => {
    expectTypeOf<SearchIndex>().toExtend<string>();
  });

  it("is not assignable from plain string", () => {
    // @ts-expect-error plain string not assignable to SearchIndex
    assertType<SearchIndex>("members");
  });
});

describe("SearchableEntityType", () => {
  it("accepts valid entity types", () => {
    assertType<SearchableEntityType>("member");
    assertType<SearchableEntityType>("group");
    assertType<SearchableEntityType>("journal-entry");
    assertType<SearchableEntityType>("wiki-page");
    assertType<SearchableEntityType>("channel");
    assertType<SearchableEntityType>("note");
  });

  it("rejects invalid entity types", () => {
    // @ts-expect-error invalid entity type
    assertType<SearchableEntityType>("system");
  });

  it("is exhaustive in a switch", () => {
    function handleType(type: SearchableEntityType): string {
      switch (type) {
        case "member":
        case "group":
        case "journal-entry":
        case "wiki-page":
        case "channel":
        case "note":
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

describe("SearchQuery", () => {
  it("has correct field types", () => {
    expectTypeOf<SearchQuery["query"]>().toBeString();
    expectTypeOf<SearchQuery["entityTypes"]>().toEqualTypeOf<
      readonly SearchableEntityType[] | null
    >();
    expectTypeOf<SearchQuery["limit"]>().toEqualTypeOf<number>();
    expectTypeOf<SearchQuery["offset"]>().toEqualTypeOf<number>();
  });
});

describe("SearchResultItem", () => {
  it("has correct field types with generic", () => {
    type Item = SearchResultItem<{ name: string }>;
    expectTypeOf<Item["entityType"]>().toEqualTypeOf<SearchableEntityType>();
    expectTypeOf<Item["entityId"]>().toBeString();
    expectTypeOf<Item["score"]>().toEqualTypeOf<number>();
    expectTypeOf<Item["highlight"]>().toEqualTypeOf<string | null>();
    expectTypeOf<Item["data"]>().toEqualTypeOf<{ name: string }>();
  });
});

describe("SearchResult", () => {
  it("has correct field types with generic", () => {
    type Result = SearchResult<{ name: string }>;
    expectTypeOf<Result["query"]>().toBeString();
    expectTypeOf<Result["totalCount"]>().toEqualTypeOf<number>();
    expectTypeOf<Result["items"]>().toEqualTypeOf<readonly SearchResultItem<{ name: string }>[]>();
  });

  it("generic constraint preserves type parameter across item and result", () => {
    type NumberItem = SearchResultItem<number>;
    expectTypeOf<NumberItem["data"]>().toEqualTypeOf<number>();

    type NumberResult = SearchResult<number>;
    expectTypeOf<NumberResult["items"]>().toEqualTypeOf<readonly SearchResultItem<number>[]>();
  });

  it("different type parameters produce incompatible types", () => {
    // @ts-expect-error SearchResultItem<string> not assignable to SearchResultItem<number>
    expectTypeOf<SearchResultItem<string>>().toEqualTypeOf<SearchResultItem<number>>();
  });
});

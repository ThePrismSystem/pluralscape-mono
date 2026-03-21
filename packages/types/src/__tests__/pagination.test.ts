import { assertType, describe, expect, expectTypeOf, it } from "vitest";

import { CursorExpiredError } from "../pagination.js";

import type { OffsetPaginationParams, PaginatedResult, PaginationCursor } from "../pagination.js";

describe("PaginationCursor", () => {
  it("is not assignable from plain string", () => {
    // @ts-expect-error plain string not assignable to branded PaginationCursor
    assertType<PaginationCursor>("cursor_abc");
  });

  it("is assignable to string", () => {
    expectTypeOf<PaginationCursor>().toExtend<string>();
  });
});

describe("PaginatedResult", () => {
  it("is generic over item type", () => {
    type Result = PaginatedResult<{ id: string; name: string }>;
    expectTypeOf<Result["items"]>().toEqualTypeOf<ReadonlyArray<{ id: string; name: string }>>();
  });

  it("has cursor and hasMore fields", () => {
    type Result = PaginatedResult<string>;
    expectTypeOf<Result["nextCursor"]>().toEqualTypeOf<PaginationCursor | null>();
    expectTypeOf<Result["hasMore"]>().toEqualTypeOf<boolean>();
  });

  it("has totalCount field", () => {
    type Result = PaginatedResult<string>;
    expectTypeOf<Result["totalCount"]>().toEqualTypeOf<number | null>();
  });

  it("rejects mutation of readonly fields", () => {
    const result: PaginatedResult<string> = {
      items: [],
      nextCursor: null,
      hasMore: false,
      totalCount: null,
    } as PaginatedResult<string>;
    // @ts-expect-error readonly property
    result.hasMore = true;
  });
});

describe("CursorExpiredError", () => {
  it("is instanceof Error", () => {
    const err = new CursorExpiredError();
    expect(err).toBeInstanceOf(Error);
  });

  it("has correct name", () => {
    const err = new CursorExpiredError();
    expect(err.name).toBe("CursorExpiredError");
  });

  it("has default message", () => {
    const err = new CursorExpiredError();
    expect(err.message).toBe("Pagination cursor has expired");
  });

  it("accepts custom message", () => {
    const err = new CursorExpiredError("custom");
    expect(err.message).toBe("custom");
  });
});

describe("OffsetPaginationParams", () => {
  it("has offset and limit fields", () => {
    expectTypeOf<OffsetPaginationParams["offset"]>().toEqualTypeOf<number>();
    expectTypeOf<OffsetPaginationParams["limit"]>().toEqualTypeOf<number>();
  });

  it("rejects string for offset", () => {
    // @ts-expect-error string not assignable to number
    assertType<OffsetPaginationParams>({ offset: "0", limit: 10 });
  });
});

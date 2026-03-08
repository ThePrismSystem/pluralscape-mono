import { assertType, describe, expectTypeOf, it } from "vitest";

import type { ApiError, ApiResponse, Result, ValidationError } from "../results.js";

describe("Result", () => {
  it("discriminates on ok field", () => {
    function handleResult(r: Result<string, Error>): void {
      if (r.ok) {
        expectTypeOf(r.value).toBeString();
      } else {
        expectTypeOf(r.error).toExtend<Error>();
      }
    }
    expectTypeOf(handleResult).toBeFunction();
  });

  it("success type has value", () => {
    type R = Result<number, string>;
    const r = { ok: true as const, value: 42 };
    assertType<R>(r);
  });

  it("error type has error", () => {
    type R = Result<number, string>;
    const r = { ok: false as const, error: "fail" };
    assertType<R>(r);
  });
});

describe("ApiResponse", () => {
  it("discriminates success and error responses", () => {
    function handleResponse(resp: ApiResponse<{ id: string }>): void {
      if (resp.error === null) {
        expectTypeOf(resp.data).toEqualTypeOf<{ id: string }>();
      } else {
        expectTypeOf(resp.error).toExtend<ApiError>();
      }
    }
    expectTypeOf(handleResponse).toBeFunction();
  });
});

describe("ApiError", () => {
  it("has code and message fields", () => {
    expectTypeOf<ApiError["code"]>().toBeString();
    expectTypeOf<ApiError["message"]>().toBeString();
  });

  it("has details field", () => {
    expectTypeOf<ApiError["details"]>().toBeUnknown();
  });
});

describe("ValidationError", () => {
  it("has field, message, and code", () => {
    expectTypeOf<ValidationError["field"]>().toBeString();
    expectTypeOf<ValidationError["message"]>().toBeString();
    expectTypeOf<ValidationError["code"]>().toBeString();
  });
});

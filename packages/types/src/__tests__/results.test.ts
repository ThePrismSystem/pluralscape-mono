import { assertType, describe, expectTypeOf, it } from "vitest";

import type { ApiErrorCode } from "../api-constants.js";
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

  it("rejects mutation of readonly fields", () => {
    const r: Result<string, string> = { ok: true as const, value: "v" } as Result<string, string>;
    // @ts-expect-error readonly property
    r.ok = false;
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

  it("rejects both data and error non-null", () => {
    assertType<ApiResponse<string>>(
      // @ts-expect-error cannot have both data and error non-null
      { data: "ok", error: { code: "INTERNAL_ERROR", message: "fail" } },
    );
  });
});

describe("ApiError", () => {
  it("has typed code and message fields", () => {
    expectTypeOf<ApiError["code"]>().toEqualTypeOf<ApiErrorCode>();
    expectTypeOf<ApiError["message"]>().toBeString();
  });

  it("has optional details field", () => {
    // details is optional — when present, it is unknown
    assertType<ApiError>({ code: "INTERNAL_ERROR", message: "fail" });
    assertType<ApiError>({ code: "NOT_FOUND", message: "missing", details: { id: "123" } });
  });
});

describe("ValidationError", () => {
  it("has field, message, and code", () => {
    expectTypeOf<ValidationError["field"]>().toBeString();
    expectTypeOf<ValidationError["message"]>().toBeString();
    expectTypeOf<ValidationError["code"]>().toBeString();
  });

  it("rejects missing required fields", () => {
    // @ts-expect-error missing code field
    assertType<ValidationError>({ field: "name", message: "required" });
  });
});

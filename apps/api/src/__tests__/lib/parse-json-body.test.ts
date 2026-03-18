import { describe, expect, it } from "vitest";

import { ApiHttpError } from "../../lib/api-error.js";
import { parseJsonBody } from "../../lib/parse-json-body.js";

import type { Context } from "hono";

/** Build a minimal mock Hono context with a controllable json() method. */
function fakeContext(jsonFn: () => Promise<unknown>): Context {
  return {
    req: { json: jsonFn },
  } as Context;
}

describe("parseJsonBody", () => {
  it("returns parsed JSON body on success", async () => {
    const body = { email: "test@example.com", password: "secret" };
    const result = await parseJsonBody(fakeContext(() => Promise.resolve(body)));
    expect(result).toEqual(body);
  });

  it("throws ApiHttpError 400 on malformed JSON", async () => {
    const ctx = fakeContext(() => Promise.reject(new SyntaxError("Unexpected token")));

    await expect(parseJsonBody(ctx)).rejects.toThrow(
      expect.objectContaining({
        status: 400,
        code: "VALIDATION_ERROR",
        message: "Invalid JSON body",
      }),
    );
  });

  it("thrown error is an instance of ApiHttpError", async () => {
    const ctx = fakeContext(() => Promise.reject(new SyntaxError("Unexpected token")));
    const error = await parseJsonBody(ctx).catch((e: unknown) => e);
    expect(error).toBeInstanceOf(ApiHttpError);
  });

  it("preserves original error as cause in details", async () => {
    const originalError = new SyntaxError("Unexpected token");
    const ctx = fakeContext(() => Promise.reject(originalError));
    try {
      await parseJsonBody(ctx);
      expect.unreachable("should have thrown");
    } catch (thrown: unknown) {
      expect(thrown).toBeInstanceOf(ApiHttpError);
      const apiError = thrown as ApiHttpError;
      expect(apiError.details).toEqual({ cause: originalError });
    }
  });
});

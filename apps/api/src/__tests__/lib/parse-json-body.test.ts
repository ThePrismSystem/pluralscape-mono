import { describe, expect, it } from "vitest";

import { ApiHttpError } from "../../lib/api-error.js";
import { parseJsonBody } from "../../lib/parse-json-body.js";

import type { Context } from "hono";

/** Build a minimal mock Hono context with controllable json() and header() methods. */
function fakeContext(options: {
  contentType?: string | null;
  jsonFn?: () => Promise<unknown>;
}): Context {
  return {
    req: {
      header: (name: string) => {
        if (name === "content-type") return options.contentType ?? null;
        return null;
      },
      json: options.jsonFn ?? (() => Promise.resolve({})),
    },
  } as unknown as Context;
}

describe("parseJsonBody", () => {
  it("returns parsed JSON body on success", async () => {
    const body = { email: "test@example.com", password: "secret" };
    const ctx = fakeContext({
      contentType: "application/json",
      jsonFn: () => Promise.resolve(body),
    });
    const result = await parseJsonBody(ctx);
    expect(result).toEqual(body);
  });

  it("accepts Content-Type with charset parameter", async () => {
    const body = { ok: true };
    const ctx = fakeContext({
      contentType: "application/json; charset=utf-8",
      jsonFn: () => Promise.resolve(body),
    });
    const result = await parseJsonBody(ctx);
    expect(result).toEqual(body);
  });

  it("throws ApiHttpError 415 when Content-Type is text/plain", async () => {
    const ctx = fakeContext({ contentType: "text/plain" });
    await expect(parseJsonBody(ctx)).rejects.toThrow(
      expect.objectContaining({
        status: 415,
        code: "UNSUPPORTED_MEDIA_TYPE",
        message: "Content-Type must be application/json",
      }),
    );
  });

  it("throws ApiHttpError 415 when Content-Type is missing", async () => {
    const ctx = fakeContext({ contentType: null });
    await expect(parseJsonBody(ctx)).rejects.toThrow(
      expect.objectContaining({
        status: 415,
        code: "UNSUPPORTED_MEDIA_TYPE",
        message: "Content-Type must be application/json",
      }),
    );
  });

  it("throws ApiHttpError 400 on malformed JSON", async () => {
    const ctx = fakeContext({
      contentType: "application/json",
      jsonFn: () => Promise.reject(new SyntaxError("Unexpected token")),
    });

    await expect(parseJsonBody(ctx)).rejects.toThrow(
      expect.objectContaining({
        status: 400,
        code: "VALIDATION_ERROR",
        message: "Invalid JSON body",
      }),
    );
  });

  it("thrown error is an instance of ApiHttpError", async () => {
    const ctx = fakeContext({
      contentType: "application/json",
      jsonFn: () => Promise.reject(new SyntaxError("Unexpected token")),
    });
    const error = await parseJsonBody(ctx).catch((e: unknown) => e);
    expect(error).toBeInstanceOf(ApiHttpError);
  });

  it("preserves original error as cause in details", async () => {
    const originalError = new SyntaxError("Unexpected token");
    const ctx = fakeContext({
      contentType: "application/json",
      jsonFn: () => Promise.reject(originalError),
    });
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

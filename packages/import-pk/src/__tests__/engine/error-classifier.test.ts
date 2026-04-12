import { APIError } from "pkapi.js";
import { describe, expect, it } from "vitest";

import { classifyPkError } from "../../engine/error-classifier.js";

import type { ClassifyContext } from "@pluralscape/import-core";

const CTX: ClassifyContext = { entityType: "member", entityId: "test-1" };

/** Minimal fake API object satisfying the APIError constructor. */
const FAKE_API = { base_url: "https://test", token: "test", version: 2 };

function makeApiError(status: string): APIError {
  return new APIError(FAKE_API, { status });
}

describe("classifyPkError", () => {
  it("classifies 401 as fatal", () => {
    expect(classifyPkError(makeApiError("401"), CTX).fatal).toBe(true);
  });

  it("classifies 403 as fatal", () => {
    expect(classifyPkError(makeApiError("403"), CTX).fatal).toBe(true);
  });

  it("classifies 429 as non-fatal", () => {
    expect(classifyPkError(makeApiError("429"), CTX).fatal).toBe(false);
  });

  it("classifies 500 as non-fatal", () => {
    expect(classifyPkError(makeApiError("500"), CTX).fatal).toBe(false);
  });

  it("classifies 502 as non-fatal", () => {
    expect(classifyPkError(makeApiError("502"), CTX).fatal).toBe(false);
  });

  it("classifies 404 as non-fatal", () => {
    expect(classifyPkError(makeApiError("404"), CTX).fatal).toBe(false);
  });

  it("classifies unknown status as fatal", () => {
    expect(classifyPkError(makeApiError("418"), CTX).fatal).toBe(true);
  });

  it("delegates non-APIError to default classifier", () => {
    const result = classifyPkError(new Error("generic"), CTX);
    expect(result.fatal).toBe(false);
    expect(result.message).toBe("generic");
  });

  it("classifies SyntaxError as fatal (via default)", () => {
    expect(classifyPkError(new SyntaxError("bad json"), CTX).fatal).toBe(true);
  });
});

import PKAPI, { APIError } from "pkapi.js";
import { describe, expect, it } from "vitest";

import { classifyPkError } from "../../engine/error-classifier.js";

import type { ClassifyContext } from "@pluralscape/import-core";

const CTX: ClassifyContext = { entityType: "member", entityId: "test-1" };

/** Minimal fake API instance for APIError constructor. */
const FAKE_API = new PKAPI({ token: "test-token" });

/**
 * APIError's constructor signature declares `status: string` but the runtime
 * implementation just copies `data.status` through from axios' response. This
 * helper sets the field from either a string or a number so tests exercise
 * both shapes observed in the wild.
 */
function makeApiError(status: string | number | undefined): APIError {
  const err = new APIError(FAKE_API, { status });
  return err;
}

describe("classifyPkError", () => {
  describe("string statuses (legacy pkapi.js path)", () => {
    it("classifies '401' as fatal and non-recoverable", () => {
      const r = classifyPkError(makeApiError("401"), CTX);
      expect(r).toMatchObject({ fatal: true, recoverable: false });
    });

    it("classifies '403' as fatal and non-recoverable", () => {
      const r = classifyPkError(makeApiError("403"), CTX);
      expect(r).toMatchObject({ fatal: true, recoverable: false });
    });

    it("classifies '429' as non-fatal", () => {
      expect(classifyPkError(makeApiError("429"), CTX).fatal).toBe(false);
    });

    it("classifies '404' as non-fatal", () => {
      expect(classifyPkError(makeApiError("404"), CTX).fatal).toBe(false);
    });

    it("classifies '500' as non-fatal (5xx range)", () => {
      expect(classifyPkError(makeApiError("500"), CTX).fatal).toBe(false);
    });

    it("classifies '502' as non-fatal (5xx range)", () => {
      expect(classifyPkError(makeApiError("502"), CTX).fatal).toBe(false);
    });

    it("classifies '599' as non-fatal (5xx upper bound inclusive)", () => {
      expect(classifyPkError(makeApiError("599"), CTX).fatal).toBe(false);
    });

    it("classifies '418' as fatal but recoverable (unknown status)", () => {
      const r = classifyPkError(makeApiError("418"), CTX);
      expect(r).toMatchObject({ fatal: true, recoverable: true });
    });
  });

  describe("numeric statuses (actual pkapi.js runtime path via axios)", () => {
    // pkapi.js types status as `string` but the constructor receives
    // e.response from axios, where response.status is a number. The
    // classifier must handle both shapes identically.

    it("classifies numeric 401 as fatal and non-recoverable", () => {
      const r = classifyPkError(makeApiError(401), CTX);
      expect(r).toMatchObject({ fatal: true, recoverable: false });
    });

    it("classifies numeric 403 as fatal and non-recoverable", () => {
      const r = classifyPkError(makeApiError(403), CTX);
      expect(r).toMatchObject({ fatal: true, recoverable: false });
    });

    it("classifies numeric 429 as non-fatal", () => {
      expect(classifyPkError(makeApiError(429), CTX).fatal).toBe(false);
    });

    it("classifies numeric 404 as non-fatal", () => {
      expect(classifyPkError(makeApiError(404), CTX).fatal).toBe(false);
    });

    it("classifies numeric 500 as non-fatal (5xx range)", () => {
      expect(classifyPkError(makeApiError(500), CTX).fatal).toBe(false);
    });

    it("classifies numeric 503 as non-fatal (5xx range)", () => {
      expect(classifyPkError(makeApiError(503), CTX).fatal).toBe(false);
    });

    it("classifies numeric 599 as non-fatal (5xx upper bound inclusive)", () => {
      expect(classifyPkError(makeApiError(599), CTX).fatal).toBe(false);
    });

    it("classifies numeric 600 as fatal-recoverable (outside 5xx)", () => {
      const r = classifyPkError(makeApiError(600), CTX);
      expect(r).toMatchObject({ fatal: true, recoverable: true });
    });

    it("classifies numeric 418 as fatal but recoverable (unknown status)", () => {
      const r = classifyPkError(makeApiError(418), CTX);
      expect(r).toMatchObject({ fatal: true, recoverable: true });
    });
  });

  describe("missing / malformed status", () => {
    it("falls through to fatal-recoverable when status is the literal '???'", () => {
      const r = classifyPkError(makeApiError("???"), CTX);
      expect(r).toMatchObject({ fatal: true, recoverable: true });
    });

    it("falls through to fatal-recoverable when status is undefined", () => {
      const r = classifyPkError(makeApiError(undefined), CTX);
      expect(r).toMatchObject({ fatal: true, recoverable: true });
    });

    it("falls through to fatal-recoverable when status is a non-numeric string", () => {
      const r = classifyPkError(makeApiError("not-a-status"), CTX);
      expect(r).toMatchObject({ fatal: true, recoverable: true });
    });

    it("treats NaN as unknown (normalise rejects non-finite)", () => {
      const r = classifyPkError(makeApiError(Number.NaN), CTX);
      expect(r).toMatchObject({ fatal: true, recoverable: true });
    });

    it("treats Infinity as unknown (normalise rejects non-finite)", () => {
      const r = classifyPkError(makeApiError(Number.POSITIVE_INFINITY), CTX);
      expect(r).toMatchObject({ fatal: true, recoverable: true });
    });

    it("treats -Infinity as unknown (normalise rejects non-finite)", () => {
      const r = classifyPkError(makeApiError(Number.NEGATIVE_INFINITY), CTX);
      expect(r).toMatchObject({ fatal: true, recoverable: true });
    });

    it("treats a negative numeric status as unknown (no HTTP status is <0)", () => {
      const r = classifyPkError(makeApiError(-401), CTX);
      expect(r).toMatchObject({ fatal: true, recoverable: true });
    });

    it("treats 0 as unknown (falls below the 5xx range)", () => {
      const r = classifyPkError(makeApiError(0), CTX);
      expect(r).toMatchObject({ fatal: true, recoverable: true });
    });

    it("parses hex-prefixed strings as the leading integer (base-10)", () => {
      // `parseInt("0x1A4", 10)` returns `0` — the prefix is not a valid base-10 char.
      const r = classifyPkError(makeApiError("0x1A4"), CTX);
      expect(r).toMatchObject({ fatal: true, recoverable: true });
    });

    it("parses partial numeric strings using parseInt's prefix rule", () => {
      // `parseInt("401abc", 10)` returns `401` — classifies as fatal non-recoverable.
      const r = classifyPkError(makeApiError("401abc"), CTX);
      expect(r).toMatchObject({ fatal: true, recoverable: false });
    });

    it("treats an empty string as unknown (parseInt returns NaN)", () => {
      const r = classifyPkError(makeApiError(""), CTX);
      expect(r).toMatchObject({ fatal: true, recoverable: true });
    });

    it("treats whitespace-only strings as unknown (parseInt returns NaN)", () => {
      const r = classifyPkError(makeApiError("  "), CTX);
      expect(r).toMatchObject({ fatal: true, recoverable: true });
    });
  });

  describe("non-APIError delegation", () => {
    it("delegates a generic Error to the default classifier", () => {
      const result = classifyPkError(new Error("generic"), CTX);
      expect(result.fatal).toBe(false);
      expect(result.message).toBe("generic");
    });

    it("classifies SyntaxError as fatal (via default classifier)", () => {
      expect(classifyPkError(new SyntaxError("bad json"), CTX).fatal).toBe(true);
    });
  });
});

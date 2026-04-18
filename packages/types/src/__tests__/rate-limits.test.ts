import { describe, it, expect } from "vitest";

import { RATE_LIMITS } from "../api-constants/rate-limits.js";

describe("RATE_LIMITS.i18nFetch", () => {
  it("allows 30 requests per minute", () => {
    expect(RATE_LIMITS.i18nFetch).toEqual({ limit: 30, windowMs: 60_000 });
  });
});

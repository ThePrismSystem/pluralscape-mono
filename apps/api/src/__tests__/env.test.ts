import { describe, expect, expectTypeOf, it } from "vitest";

import { env } from "../env.js";

describe("env.CROWDIN_DISTRIBUTION_HASH", () => {
  it("is an optional string", () => {
    expectTypeOf(env.CROWDIN_DISTRIBUTION_HASH).toEqualTypeOf<string | undefined>();
  });
});

describe("env.CROWDIN_OTA_BASE_URL", () => {
  // The default is applied at module-load time. Because vitest imports `env`
  // once per worker, asserting on the already-resolved value here is the only
  // safe round-trip — mutating `process.env` after import does NOT re-run the
  // schema. The test-only override path (pointing the API at an E2E stub)
  // works because the E2E harness sets CROWDIN_OTA_BASE_URL *before* spawning
  // the API process, which re-imports env fresh.
  it("defaults to https://distributions.crowdin.net when unset", () => {
    expect(env.CROWDIN_OTA_BASE_URL).toBe("https://distributions.crowdin.net");
  });

  it("is typed as a non-optional string (default branch collapses the optionality)", () => {
    expectTypeOf(env.CROWDIN_OTA_BASE_URL).toEqualTypeOf<string>();
  });
});

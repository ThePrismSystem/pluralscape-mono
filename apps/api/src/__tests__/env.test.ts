import { describe, expectTypeOf, it } from "vitest";

import { env } from "../env.js";

describe("env.CROWDIN_DISTRIBUTION_HASH", () => {
  it("is an optional string", () => {
    expectTypeOf(env.CROWDIN_DISTRIBUTION_HASH).toEqualTypeOf<string | undefined>();
  });
});

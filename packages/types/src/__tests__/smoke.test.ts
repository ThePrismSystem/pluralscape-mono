import { describe, expect, it } from "vitest";

import * as types from "../index.js";

describe("smoke test", () => {
  it("resolves the package module", () => {
    expect(types).toBeDefined();
  });
});

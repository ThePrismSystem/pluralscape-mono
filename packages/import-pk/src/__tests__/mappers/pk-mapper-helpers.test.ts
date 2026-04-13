import { describe, expect, it } from "vitest";

import { normalisePkColor } from "../../mappers/pk-mapper-helpers.js";

describe("normalisePkColor", () => {
  it("prepends # to bare hex", () => {
    expect(normalisePkColor("ff6b6b")).toBe("#ff6b6b");
  });
  it("leaves # prefixed hex unchanged", () => {
    expect(normalisePkColor("#ff6b6b")).toBe("#ff6b6b");
  });
  it("handles empty string", () => {
    expect(normalisePkColor("")).toBe("#");
  });
});

import { describe, expect, it } from "vitest";

import { createMappingContext } from "../../mappers/context.js";
import { mapCustomFront } from "../../mappers/custom-front.mapper.js";

import type { SPFrontStatus } from "../../sources/sp-types.js";

describe("mapCustomFront", () => {
  it("maps a minimal custom front", () => {
    const sp: SPFrontStatus = { _id: "fs1", name: "Tired" };
    const result = mapCustomFront(sp, createMappingContext({ sourceMode: "fake" }));
    expect(result.status).toBe("mapped");
    if (result.status === "mapped") {
      expect(result.payload.name).toBe("Tired");
      expect(result.payload.description).toBeNull();
      expect(result.payload.color).toBeNull();
      expect(result.payload.avatarUrl).toBeNull();
    }
  });

  it("preserves desc, color, and avatarUrl", () => {
    const sp: SPFrontStatus = {
      _id: "fs2",
      name: "Dissociated",
      desc: "blurry",
      color: "#888",
      avatarUrl: "https://example.com/x.png",
    };
    const result = mapCustomFront(sp, createMappingContext({ sourceMode: "fake" }));
    expect(result.status).toBe("mapped");
    if (result.status === "mapped") {
      expect(result.payload.description).toBe("blurry");
      expect(result.payload.color).toBe("#888");
      expect(result.payload.avatarUrl).toBe("https://example.com/x.png");
    }
  });

  it("skips empty name with a warning", () => {
    const sp: SPFrontStatus = { _id: "fs3", name: "" };
    const ctx = createMappingContext({ sourceMode: "fake" });
    const result = mapCustomFront(sp, ctx);
    expect(result.status).toBe("skipped");
    expect(ctx.warnings).toHaveLength(1);
    expect(ctx.warnings[0]?.entityType).toBe("custom-front");
    expect(ctx.warnings[0]?.entityId).toBe("fs3");
  });
});

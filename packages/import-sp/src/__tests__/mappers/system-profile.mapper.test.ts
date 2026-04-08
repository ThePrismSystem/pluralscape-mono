import { describe, expect, it } from "vitest";

import { createMappingContext } from "../../mappers/context.js";
import { mapSystemProfile } from "../../mappers/system-profile.mapper.js";

import type { SPUser } from "../../sources/sp-types.js";

describe("mapSystemProfile", () => {
  it("maps a minimal SP user with username as name", () => {
    const ctx = createMappingContext({ sourceMode: "fake" });
    const sp: SPUser = { _id: "u1", username: "Prism" };
    const result = mapSystemProfile(sp, ctx);
    expect(result.status).toBe("mapped");
    if (result.status === "mapped") {
      expect(result.payload.name).toBe("Prism");
      expect(result.payload.description).toBeNull();
      expect(result.payload.color).toBeNull();
      expect(result.payload.avatarUrl).toBeNull();
      expect(result.payload.defaultBucketId).toBeNull();
    }
  });

  it("preserves desc, color, and avatarUrl", () => {
    const ctx = createMappingContext({ sourceMode: "fake" });
    const sp: SPUser = {
      _id: "u2",
      username: "Prism",
      desc: "a system of many",
      color: "#aabbcc",
      avatarUrl: "https://x/y.png",
    };
    const result = mapSystemProfile(sp, ctx);
    if (result.status === "mapped") {
      expect(result.payload.description).toBe("a system of many");
      expect(result.payload.color).toBe("#aabbcc");
      expect(result.payload.avatarUrl).toBe("https://x/y.png");
    }
  });

  it("resolves defaultPrivacyBucket through the translation table", () => {
    const ctx = createMappingContext({ sourceMode: "fake" });
    ctx.register("privacy-bucket", "src_bk1", "ps_bk1");
    const sp: SPUser = {
      _id: "u3",
      username: "Prism",
      defaultPrivacyBucket: "src_bk1",
    };
    const result = mapSystemProfile(sp, ctx);
    if (result.status === "mapped") {
      expect(result.payload.defaultBucketId).toBe("ps_bk1");
    }
    expect(ctx.warnings).toHaveLength(0);
  });

  it("leaves defaultBucketId null with a warning on bucket FK miss", () => {
    const ctx = createMappingContext({ sourceMode: "fake" });
    const sp: SPUser = {
      _id: "u4",
      username: "Prism",
      defaultPrivacyBucket: "src_missing",
    };
    const result = mapSystemProfile(sp, ctx);
    expect(result.status).toBe("mapped");
    if (result.status === "mapped") {
      expect(result.payload.defaultBucketId).toBeNull();
    }
    expect(ctx.warnings).toHaveLength(1);
    expect(ctx.warnings[0]?.entityType).toBe("system-profile");
  });
});

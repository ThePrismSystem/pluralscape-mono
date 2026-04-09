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

  it("returns failed on bucket FK miss", () => {
    const ctx = createMappingContext({ sourceMode: "fake" });
    const sp: SPUser = {
      _id: "u4",
      username: "Prism",
      defaultPrivacyBucket: "src_missing",
    };
    const result = mapSystemProfile(sp, ctx);
    expect(result.status).toBe("failed");
    if (result.status === "failed") {
      expect(result.kind).toBe("fk-miss");
      expect(result.targetField).toBe("defaultPrivacyBucket");
      expect(result.missingRefs).toContain("src_missing");
    }
  });
});

describe("system-profile FK-miss handling", () => {
  it("returns failed with kind fk-miss when defaultPrivacyBucket cannot be resolved", () => {
    const ctx = createMappingContext({ sourceMode: "file" });
    const result = mapSystemProfile(
      { _id: "sp_u_1", username: "Prism", defaultPrivacyBucket: "sp_bk_missing" },
      ctx,
    );

    expect(result.status).toBe("failed");
    if (result.status === "failed") {
      expect(result.kind).toBe("fk-miss");
      expect(result.targetField).toBe("defaultPrivacyBucket");
      expect(result.missingRefs).toContain("sp_bk_missing");
    }
  });

  it("returns mapped when defaultPrivacyBucket resolves", () => {
    const ctx = createMappingContext({ sourceMode: "file" });
    ctx.register("privacy-bucket", "sp_bk_1", "ps_bk_real");
    const result = mapSystemProfile(
      { _id: "sp_u_2", username: "Prism", defaultPrivacyBucket: "sp_bk_1" },
      ctx,
    );
    expect(result.status).toBe("mapped");
    if (result.status === "mapped") {
      expect(result.payload.defaultBucketId).toBe("ps_bk_real");
    }
  });

  it("returns mapped when defaultPrivacyBucket is absent", () => {
    const ctx = createMappingContext({ sourceMode: "file" });
    const result = mapSystemProfile({ _id: "sp_u_3", username: "Prism" }, ctx);
    expect(result.status).toBe("mapped");
    if (result.status === "mapped") {
      expect(result.payload.defaultBucketId).toBeNull();
    }
  });
});

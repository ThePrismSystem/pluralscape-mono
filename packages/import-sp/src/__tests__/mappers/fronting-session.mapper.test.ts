import { describe, expect, it } from "vitest";

import { createMappingContext } from "../../mappers/context.js";
import { mapFrontingSession } from "../../mappers/fronting-session.mapper.js";

import type { SPFrontHistory } from "../../sources/sp-types.js";

describe("mapFrontingSession", () => {
  it("maps a member fronting session (custom=false)", () => {
    const ctx = createMappingContext({ sourceMode: "fake" });
    ctx.register("member", "src_m1", "ps_m1");
    const sp: SPFrontHistory = {
      _id: "fh1",
      member: "src_m1",
      custom: false,
      live: false,
      startTime: 1_000,
      endTime: 2_000,
    };
    const result = mapFrontingSession(sp, ctx);
    expect(result.status).toBe("mapped");
    if (result.status === "mapped") {
      expect(result.payload.memberId).toBe("ps_m1");
      expect(result.payload.customFrontId).toBeNull();
      expect(result.payload.startTime).toBe(1_000);
      expect(result.payload.endTime).toBe(2_000);
      expect(result.payload.comment).toBeNull();
    }
  });

  it("maps a custom-front fronting session (custom=true)", () => {
    const ctx = createMappingContext({ sourceMode: "fake" });
    ctx.register("custom-front", "src_cf1", "ps_cf1");
    const sp: SPFrontHistory = {
      _id: "fh2",
      member: "src_cf1",
      custom: true,
      live: false,
      startTime: 10,
      endTime: 20,
    };
    const result = mapFrontingSession(sp, ctx);
    expect(result.status).toBe("mapped");
    if (result.status === "mapped") {
      expect(result.payload.memberId).toBeNull();
      expect(result.payload.customFrontId).toBe("ps_cf1");
    }
  });

  it("sets endTime to null when live is true", () => {
    const ctx = createMappingContext({ sourceMode: "fake" });
    ctx.register("member", "src_m1", "ps_m1");
    const sp: SPFrontHistory = {
      _id: "fh3",
      member: "src_m1",
      custom: false,
      live: true,
      startTime: 1_000,
      endTime: 5_000, // ignored when live=true
    };
    const result = mapFrontingSession(sp, ctx);
    if (result.status === "mapped") {
      expect(result.payload.endTime).toBeNull();
    }
  });

  it("fails when member FK is missing", () => {
    const ctx = createMappingContext({ sourceMode: "fake" });
    const sp: SPFrontHistory = {
      _id: "fh4",
      member: "src_missing",
      custom: false,
      live: false,
      startTime: 0,
      endTime: 0,
    };
    const result = mapFrontingSession(sp, ctx);
    expect(result.status).toBe("failed");
    if (result.status === "failed") {
      expect(result.message).toContain("FK miss");
      expect(result.message).toContain("member");
    }
  });

  it("fails when custom-front FK is missing", () => {
    const ctx = createMappingContext({ sourceMode: "fake" });
    const sp: SPFrontHistory = {
      _id: "fh5",
      member: "src_missing_cf",
      custom: true,
      live: false,
      startTime: 0,
      endTime: 0,
    };
    const result = mapFrontingSession(sp, ctx);
    expect(result.status).toBe("failed");
    if (result.status === "failed") {
      expect(result.message).toContain("custom-front");
    }
  });

  it("exposes kind, targetField, and missingRefs on member FK miss", () => {
    const ctx = createMappingContext({ sourceMode: "fake" });
    const sp: SPFrontHistory = {
      _id: "fh7",
      member: "src_missing",
      custom: false,
      live: false,
      startTime: 0,
      endTime: 0,
    };
    const result = mapFrontingSession(sp, ctx);
    expect(result.status).toBe("failed");
    if (result.status === "failed") {
      expect(result.kind).toBe("fk-miss");
      expect(result.targetField).toBe("member");
      expect(result.missingRefs).toContain("src_missing");
    }
  });

  it("exposes kind, targetField, and missingRefs on custom-front FK miss", () => {
    const ctx = createMappingContext({ sourceMode: "fake" });
    const sp: SPFrontHistory = {
      _id: "fh8",
      member: "src_missing_cf",
      custom: true,
      live: false,
      startTime: 0,
      endTime: 0,
    };
    const result = mapFrontingSession(sp, ctx);
    expect(result.status).toBe("failed");
    if (result.status === "failed") {
      expect(result.kind).toBe("fk-miss");
      expect(result.targetField).toBe("member");
      expect(result.missingRefs).toContain("src_missing_cf");
    }
  });

  it("preserves customStatus as comment", () => {
    const ctx = createMappingContext({ sourceMode: "fake" });
    ctx.register("member", "src_m1", "ps_m1");
    const sp: SPFrontHistory = {
      _id: "fh6",
      member: "src_m1",
      custom: false,
      live: false,
      startTime: 1,
      endTime: 2,
      customStatus: "feeling blurry",
    };
    const result = mapFrontingSession(sp, ctx);
    if (result.status === "mapped") {
      expect(result.payload.comment).toBe("feeling blurry");
    }
  });
});

describe("fronting-session FK-miss handling", () => {
  it("returns failed with kind fk-miss when member ref is unresolved (custom=false)", () => {
    const ctx = createMappingContext({ sourceMode: "file" });
    const result = mapFrontingSession(
      {
        _id: "sp_fh_1",
        member: "sp_m_missing",
        custom: false,
        live: false,
        startTime: 0,
        endTime: 0,
      },
      ctx,
    );

    expect(result.status).toBe("failed");
    if (result.status === "failed") {
      expect(result.kind).toBe("fk-miss");
      expect(result.targetField).toBe("member");
      expect(result.missingRefs).toContain("sp_m_missing");
    }
  });

  it("returns failed with kind fk-miss when custom-front ref is unresolved (custom=true)", () => {
    const ctx = createMappingContext({ sourceMode: "file" });
    const result = mapFrontingSession(
      {
        _id: "sp_fh_2",
        member: "sp_cf_missing",
        custom: true,
        live: false,
        startTime: 0,
        endTime: 0,
      },
      ctx,
    );

    expect(result.status).toBe("failed");
    if (result.status === "failed") {
      expect(result.kind).toBe("fk-miss");
      expect(result.targetField).toBe("member");
      expect(result.missingRefs).toContain("sp_cf_missing");
    }
  });

  it("returns mapped when member ref resolves", () => {
    const ctx = createMappingContext({ sourceMode: "file" });
    ctx.register("member", "sp_m_1", "ps_m_real_1");
    const result = mapFrontingSession(
      {
        _id: "sp_fh_3",
        member: "sp_m_1",
        custom: false,
        live: false,
        startTime: 100,
        endTime: 200,
      },
      ctx,
    );
    expect(result.status).toBe("mapped");
  });
});

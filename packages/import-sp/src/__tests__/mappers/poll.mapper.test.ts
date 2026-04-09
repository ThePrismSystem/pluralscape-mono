import { describe, expect, it } from "vitest";

import { createMappingContext } from "../../mappers/context.js";
import { mapPoll } from "../../mappers/poll.mapper.js";

import type { SPPoll } from "../../sources/sp-types.js";

describe("mapPoll", () => {
  it("maps a minimal standard poll with no votes", () => {
    const ctx = createMappingContext({ sourceMode: "fake" });
    const sp: SPPoll = {
      _id: "p1",
      name: "Lunch?",
      options: [],
    };
    const result = mapPoll(sp, ctx);
    expect(result.status).toBe("mapped");
    if (result.status === "mapped") {
      expect(result.payload.poll.title).toBe("Lunch?");
      expect(result.payload.poll.description).toBeNull();
      expect(result.payload.poll.endsAt).toBeNull();
      expect(result.payload.poll.kind).toBe("standard");
      expect(result.payload.poll.allowAbstain).toBe(false);
      expect(result.payload.poll.allowVeto).toBe(false);
      expect(result.payload.poll.createdByMemberId).toBeNull();
      expect(result.payload.poll.options).toEqual([]);
      expect(result.payload.votes).toEqual([]);
    }
  });

  it("maps options including optional colors", () => {
    const ctx = createMappingContext({ sourceMode: "fake" });
    const sp: SPPoll = {
      _id: "p2",
      name: "Color?",
      options: [
        { id: "o1", name: "Red", color: "#ff0000" },
        { id: "o2", name: "Blue" },
      ],
    };
    const result = mapPoll(sp, ctx);
    if (result.status === "mapped") {
      expect(result.payload.poll.options).toEqual([
        { id: "o1", label: "Red", color: "#ff0000" },
        { id: "o2", label: "Blue", color: null },
      ]);
    }
  });

  it("resolves voter member IDs", () => {
    const ctx = createMappingContext({ sourceMode: "fake" });
    ctx.register("member", "src_m1", "ps_m1");
    ctx.register("member", "src_m2", "ps_m2");
    const sp: SPPoll = {
      _id: "p3",
      name: "Go?",
      options: [{ id: "o1", name: "Yes" }],
      votes: [
        { id: "src_m1", vote: "o1" },
        { id: "src_m2", vote: "o1", comment: "for sure" },
      ],
    };
    const result = mapPoll(sp, ctx);
    if (result.status === "mapped") {
      expect(result.payload.votes).toHaveLength(2);
      expect(result.payload.votes[0]).toEqual({
        optionId: "o1",
        memberId: "ps_m1",
        isVeto: false,
        comment: null,
      });
      expect(result.payload.votes[1]).toEqual({
        optionId: "o1",
        memberId: "ps_m2",
        isVeto: false,
        comment: "for sure",
      });
    }
  });

  it("maps veto votes with empty optionId and null memberId", () => {
    const ctx = createMappingContext({ sourceMode: "fake" });
    const sp: SPPoll = {
      _id: "p4",
      name: "Override?",
      allowVeto: true,
      options: [{ id: "o1", name: "Yes" }],
      votes: [{ id: "src_x", vote: "veto", comment: "no way" }],
    };
    const result = mapPoll(sp, ctx);
    if (result.status === "mapped") {
      expect(result.payload.votes).toHaveLength(1);
      expect(result.payload.votes[0]).toEqual({
        optionId: "",
        memberId: null,
        isVeto: true,
        comment: "no way",
      });
    }
  });

  it("returns failed on voter FK miss", () => {
    const ctx = createMappingContext({ sourceMode: "fake" });
    const sp: SPPoll = {
      _id: "p5",
      name: "Who?",
      options: [{ id: "o1", name: "A" }],
      votes: [{ id: "src_unknown", vote: "o1" }],
    };
    const result = mapPoll(sp, ctx);
    expect(result.status).toBe("failed");
    if (result.status === "failed") {
      expect(result.kind).toBe("fk-miss");
      expect(result.targetField).toBe("votes");
      expect(result.missingRefs).toContain("src_unknown");
    }
  });

  it("maps a poll with no votes when votes array is absent", () => {
    const ctx = createMappingContext({ sourceMode: "fake" });
    const sp: SPPoll = { _id: "p_nov", name: "Simple", options: [] };
    const result = mapPoll(sp, ctx);
    expect(result.status).toBe("mapped");
  });

  it("maps custom kind and flags, preserves desc and endTime", () => {
    const ctx = createMappingContext({ sourceMode: "fake" });
    const sp: SPPoll = {
      _id: "p6",
      name: "Weekend",
      desc: "Plans?",
      endTime: 9_999,
      custom: true,
      allowAbstain: true,
      allowVeto: true,
      options: [],
    };
    const result = mapPoll(sp, ctx);
    if (result.status === "mapped") {
      expect(result.payload.poll.kind).toBe("custom");
      expect(result.payload.poll.description).toBe("Plans?");
      expect(result.payload.poll.endsAt).toBe(9_999);
      expect(result.payload.poll.allowAbstain).toBe(true);
      expect(result.payload.poll.allowVeto).toBe(true);
    }
  });
});

describe("poll FK-miss handling", () => {
  it("returns failed on unresolved vote member ref", () => {
    const ctx = createMappingContext({ sourceMode: "file" });
    const sp: SPPoll = {
      _id: "sp_p_1",
      name: "Dinner?",
      options: [{ id: "o1", name: "Pizza" }],
      votes: [{ id: "sp_m_missing", vote: "o1" }],
    };
    const result = mapPoll(sp, ctx);

    expect(result.status).toBe("failed");
    if (result.status === "failed") {
      expect(result.kind).toBe("fk-miss");
      expect(result.targetField).toBe("votes");
      expect(result.missingRefs).toContain("sp_m_missing");
    }
  });

  it("returns failed with all missing voter refs when multiple are unresolved", () => {
    const ctx = createMappingContext({ sourceMode: "file" });
    ctx.register("member", "sp_m_known", "ps_m_real");
    const sp: SPPoll = {
      _id: "sp_p_2",
      name: "Lunch?",
      options: [{ id: "o1", name: "Tacos" }],
      votes: [
        { id: "sp_m_known", vote: "o1" },
        { id: "sp_m_miss1", vote: "o1" },
        { id: "sp_m_miss2", vote: "o1" },
      ],
    };
    const result = mapPoll(sp, ctx);

    expect(result.status).toBe("failed");
    if (result.status === "failed") {
      expect(result.missingRefs).toContain("sp_m_miss1");
      expect(result.missingRefs).toContain("sp_m_miss2");
    }
  });

  it("returns mapped when all voter refs resolve", () => {
    const ctx = createMappingContext({ sourceMode: "file" });
    ctx.register("member", "sp_m_1", "ps_m_real_1");
    const sp: SPPoll = {
      _id: "sp_p_3",
      name: "Movie?",
      options: [{ id: "o1", name: "Yes" }],
      votes: [{ id: "sp_m_1", vote: "o1" }],
    };
    const result = mapPoll(sp, ctx);
    expect(result.status).toBe("mapped");
  });
});

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
      expect(result.payload.encrypted.title).toBe("Lunch?");
      expect(result.payload.encrypted.description).toBeNull();
      expect(result.payload.endsAt).toBeUndefined();
      expect(result.payload.kind).toBe("standard");
      expect(result.payload.allowAbstain).toBe(false);
      expect(result.payload.allowVeto).toBe(false);
      expect(result.payload.allowMultipleVotes).toBe(false);
      expect(result.payload.maxVotesPerMember).toBe(1);
      expect(result.payload.createdByMemberId).toBeUndefined();
      expect(result.payload.encrypted.options).toEqual([]);
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
    expect(result.status).toBe("mapped");
    if (result.status === "mapped") {
      expect(result.payload.encrypted.options).toEqual([
        { id: "o1", label: "Red", voteCount: 0, color: "#ff0000", emoji: null },
        { id: "o2", label: "Blue", voteCount: 0, color: null, emoji: null },
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
    expect(result.status).toBe("mapped");
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
    expect(result.status).toBe("mapped");
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

  it("rejects empty poll name with kind empty-name targeting name", () => {
    const ctx = createMappingContext({ sourceMode: "fake" });
    const sp: SPPoll = {
      _id: "p_empty_name",
      name: "",
      options: [{ id: "o1", name: "Yes" }],
    };
    const result = mapPoll(sp, ctx);
    expect(result.status).toBe("failed");
    if (result.status === "failed") {
      expect(result.kind).toBe("empty-name");
      expect(result.targetField).toBe("name");
    }
  });

  it("rejects empty option label with kind empty-name targeting options", () => {
    const ctx = createMappingContext({ sourceMode: "fake" });
    const sp: SPPoll = {
      _id: "p_empty_opt",
      name: "Pick one",
      options: [
        { id: "o1", name: "Yes" },
        { id: "o2", name: "" },
      ],
    };
    const result = mapPoll(sp, ctx);
    expect(result.status).toBe("failed");
    if (result.status === "failed") {
      expect(result.kind).toBe("empty-name");
      expect(result.targetField).toBe("options");
      expect(result.message).toContain("index 1");
    }
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
    expect(result.status).toBe("mapped");
    if (result.status === "mapped") {
      expect(result.payload.kind).toBe("custom");
      expect(result.payload.encrypted.description).toBe("Plans?");
      expect(result.payload.endsAt).toBe(9_999);
      expect(result.payload.allowAbstain).toBe(true);
      expect(result.payload.allowVeto).toBe(true);
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

describe("poll option id collision prevention", () => {
  it("poll with omitted options produces empty options array", () => {
    const ctx = createMappingContext({ sourceMode: "fake" });
    const sp: SPPoll = {
      _id: "p1",
      name: "Yes/no",
      custom: false,
    };
    const result = mapPoll(sp, ctx);
    expect(result.status).toBe("mapped");
    if (result.status === "mapped") {
      expect(result.payload.encrypted.options).toEqual([]);
    }
  });

  it("poll option without id gets a per-poll positional synthetic id", () => {
    const ctx = createMappingContext({ sourceMode: "fake" });
    const sp: SPPoll = {
      _id: "p2",
      name: "Movie night",
      custom: false,
      options: [
        { name: "Matrix", color: "#ff0000" },
        { name: "Inception", color: "#00ff00" },
      ],
    };
    const result = mapPoll(sp, ctx);
    expect(result.status).toBe("mapped");
    if (result.status === "mapped") {
      expect(result.payload.encrypted.options[0]?.id).toBe("p2_opt_0");
      expect(result.payload.encrypted.options[1]?.id).toBe("p2_opt_1");
    }
  });

  it("poll option with explicit id keeps it unchanged", () => {
    const ctx = createMappingContext({ sourceMode: "fake" });
    const sp: SPPoll = {
      _id: "p3",
      name: "Colors",
      custom: false,
      options: [{ id: "server-id-1", name: "Red" }],
    };
    const result = mapPoll(sp, ctx);
    expect(result.status).toBe("mapped");
    if (result.status === "mapped") {
      expect(result.payload.encrypted.options[0]?.id).toBe("server-id-1");
    }
  });

  it("two polls with missing option ids do not collide", () => {
    const ctx = createMappingContext({ sourceMode: "fake" });
    const a = mapPoll(
      {
        _id: "pA",
        name: "A",
        custom: false,
        options: [{ name: "x" }],
      } as SPPoll,
      ctx,
    );
    const b = mapPoll(
      {
        _id: "pB",
        name: "B",
        custom: false,
        options: [{ name: "y" }],
      } as SPPoll,
      ctx,
    );
    const idA = a.status === "mapped" ? a.payload.encrypted.options[0]?.id : null;
    const idB = b.status === "mapped" ? b.payload.encrypted.options[0]?.id : null;
    expect(idA).toBe("pA_opt_0");
    expect(idB).toBe("pB_opt_0");
    expect(idA).not.toBe(idB);
  });
});

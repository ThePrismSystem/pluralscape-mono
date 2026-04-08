import { describe, expect, it } from "vitest";

import { createMappingContext } from "../../mappers/context.js";
import { mapJournalEntry } from "../../mappers/journal-entry.mapper.js";

import type { SPNote } from "../../sources/sp-types.js";

describe("mapJournalEntry", () => {
  it("maps a minimal SP note to a journal entry with a single paragraph block", () => {
    const ctx = createMappingContext({ sourceMode: "fake" });
    ctx.register("member", "src_m1", "ps_m1");
    const sp: SPNote = {
      _id: "n1",
      title: "Morning thoughts",
      note: "Woke up fronting.",
      date: 1_700_000_000_000,
      member: "src_m1",
    };
    const result = mapJournalEntry(sp, ctx);
    expect(result.status).toBe("mapped");
    if (result.status === "mapped") {
      expect(result.payload.title).toBe("Morning thoughts");
      expect(result.payload.authorMemberId).toBe("ps_m1");
      expect(result.payload.createdAt).toBe(1_700_000_000_000);
      expect(result.payload.blocks).toHaveLength(1);
      expect(result.payload.blocks[0]).toEqual({
        type: "paragraph",
        content: "Woke up fronting.",
        children: [],
      });
    }
  });

  it("fails when the member FK is missing", () => {
    const ctx = createMappingContext({ sourceMode: "fake" });
    const sp: SPNote = {
      _id: "n2",
      title: "x",
      note: "y",
      date: 1,
      member: "src_missing",
    };
    const result = mapJournalEntry(sp, ctx);
    expect(result.status).toBe("failed");
    if (result.status === "failed") {
      expect(result.message).toContain("FK miss");
      expect(result.message).toContain("member");
    }
  });

  it("allows empty body (single empty paragraph block)", () => {
    const ctx = createMappingContext({ sourceMode: "fake" });
    ctx.register("member", "src_m1", "ps_m1");
    const sp: SPNote = {
      _id: "n3",
      title: "Blank",
      note: "",
      date: 1,
      member: "src_m1",
    };
    const result = mapJournalEntry(sp, ctx);
    expect(result.status).toBe("mapped");
    if (result.status === "mapped") {
      expect(result.payload.blocks).toHaveLength(1);
      expect(result.payload.blocks[0]?.content).toBe("");
    }
  });

  it("emits warnings for dropped color and supportMarkdown fields", () => {
    const ctx = createMappingContext({ sourceMode: "fake" });
    ctx.register("member", "src_m1", "ps_m1");
    const sp: SPNote = {
      _id: "n4",
      title: "Colored",
      note: "hi",
      date: 1,
      member: "src_m1",
      color: "#abcdef",
      supportMarkdown: true,
    };
    const result = mapJournalEntry(sp, ctx);
    expect(result.status).toBe("mapped");
    const messages = ctx.warnings.map((w) => w.message);
    expect(messages.some((m) => m.includes("color"))).toBe(true);
    expect(messages.some((m) => m.includes("supportMarkdown"))).toBe(true);
    expect(ctx.warnings.every((w) => w.entityType === "journal-entry")).toBe(true);
  });

  it("preserves the exact title and date", () => {
    const ctx = createMappingContext({ sourceMode: "fake" });
    ctx.register("member", "src_m1", "ps_m1");
    const sp: SPNote = {
      _id: "n5",
      title: "Specific Title",
      note: "body here",
      date: 42,
      member: "src_m1",
    };
    const result = mapJournalEntry(sp, ctx);
    if (result.status === "mapped") {
      expect(result.payload.title).toBe("Specific Title");
      expect(result.payload.createdAt).toBe(42);
    }
  });
});

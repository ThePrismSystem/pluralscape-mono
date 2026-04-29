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
      expect(result.payload.encrypted.title).toBe("Morning thoughts");
      expect(result.payload.author).toEqual({ entityType: "member", entityId: "ps_m1" });
      expect(result.payload.createdAt).toBe(1_700_000_000_000);
      expect(result.payload.encrypted.content).toBe("Woke up fronting.");
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

  it("rejects empty content with kind empty-name targeting content", () => {
    const ctx = createMappingContext({ sourceMode: "fake" });
    ctx.register("member", "src_m1", "ps_m1");
    const sp: SPNote = {
      _id: "n3",
      title: "Blank body",
      note: "",
      date: 1,
      member: "src_m1",
    };
    const result = mapJournalEntry(sp, ctx);
    expect(result.status).toBe("failed");
    if (result.status === "failed") {
      expect(result.kind).toBe("empty-name");
      expect(result.targetField).toBe("content");
    }
  });

  it("rejects empty title with kind empty-name targeting title", () => {
    const ctx = createMappingContext({ sourceMode: "fake" });
    ctx.register("member", "src_m1", "ps_m1");
    const sp: SPNote = {
      _id: "n3b",
      title: "",
      note: "Body without title",
      date: 1,
      member: "src_m1",
    };
    const result = mapJournalEntry(sp, ctx);
    expect(result.status).toBe("failed");
    if (result.status === "failed") {
      expect(result.kind).toBe("empty-name");
      expect(result.targetField).toBe("title");
    }
  });

  it("maps color to encrypted.backgroundColor and warns for supportMarkdown", () => {
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
    if (result.status === "mapped") {
      expect(result.payload.encrypted.backgroundColor).toBe("#abcdef");
    }
    const messages = ctx.warnings.map((w) => w.message);
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
    expect(result.status).toBe("mapped");
    if (result.status === "mapped") {
      expect(result.payload.encrypted.title).toBe("Specific Title");
      expect(result.payload.createdAt).toBe(42);
    }
  });
});

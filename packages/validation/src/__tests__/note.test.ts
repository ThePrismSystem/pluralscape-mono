import { describe, expect, it } from "vitest";

import { CreateNoteBodySchema, NoteQuerySchema, UpdateNoteBodySchema } from "../note.js";
import { MAX_ENCRYPTED_DATA_SIZE } from "../validation.constants.js";

describe("CreateNoteBodySchema", () => {
  it("accepts encryptedData only (system-wide)", () => {
    const result = CreateNoteBodySchema.safeParse({
      encryptedData: "dGVzdA==",
    });
    expect(result.success).toBe(true);
    if (result.success) {
      expect(result.data.author).toBeUndefined();
    }
  });

  it("accepts with member author", () => {
    const result = CreateNoteBodySchema.safeParse({
      encryptedData: "dGVzdA==",
      author: { entityType: "member", entityId: "mem_abc123" },
    });
    expect(result.success).toBe(true);
    if (result.success) {
      expect(result.data.author?.entityType).toBe("member");
      expect(result.data.author?.entityId).toBe("mem_abc123");
    }
  });

  it("accepts with structure-entity author", () => {
    const result = CreateNoteBodySchema.safeParse({
      encryptedData: "dGVzdA==",
      author: { entityType: "structure-entity", entityId: "ste_xyz789" },
    });
    expect(result.success).toBe(true);
    if (result.success) {
      expect(result.data.author?.entityType).toBe("structure-entity");
    }
  });

  it("rejects missing encryptedData", () => {
    const result = CreateNoteBodySchema.safeParse({});
    expect(result.success).toBe(false);
  });

  it("rejects empty encryptedData", () => {
    const result = CreateNoteBodySchema.safeParse({ encryptedData: "" });
    expect(result.success).toBe(false);
  });

  it("rejects encryptedData exceeding max size", () => {
    const result = CreateNoteBodySchema.safeParse({
      encryptedData: "x".repeat(MAX_ENCRYPTED_DATA_SIZE + 1),
    });
    expect(result.success).toBe(false);
  });

  it("rejects invalid author entityType", () => {
    const result = CreateNoteBodySchema.safeParse({
      encryptedData: "dGVzdA==",
      author: { entityType: "invalid", entityId: "id_123" },
    });
    expect(result.success).toBe(false);
  });

  it("rejects author with missing entityId", () => {
    const result = CreateNoteBodySchema.safeParse({
      encryptedData: "dGVzdA==",
      author: { entityType: "member" },
    });
    expect(result.success).toBe(false);
  });

  it("rejects author with empty entityId", () => {
    const result = CreateNoteBodySchema.safeParse({
      encryptedData: "dGVzdA==",
      author: { entityType: "member", entityId: "" },
    });
    expect(result.success).toBe(false);
  });

  it("rejects author with missing entityType", () => {
    const result = CreateNoteBodySchema.safeParse({
      encryptedData: "dGVzdA==",
      author: { entityId: "mem_abc" },
    });
    expect(result.success).toBe(false);
  });

  it("strips extra properties", () => {
    const result = CreateNoteBodySchema.safeParse({
      encryptedData: "dGVzdA==",
      extra: "field",
    });
    expect(result.success).toBe(true);
    if (result.success) {
      expect(result.data).toEqual({ encryptedData: "dGVzdA==" });
    }
  });
});

describe("UpdateNoteBodySchema", () => {
  it("accepts valid update body", () => {
    const result = UpdateNoteBodySchema.safeParse({
      encryptedData: "dGVzdA==",
      version: 1,
    });
    expect(result.success).toBe(true);
  });

  it("rejects version less than 1", () => {
    const result = UpdateNoteBodySchema.safeParse({
      encryptedData: "dGVzdA==",
      version: 0,
    });
    expect(result.success).toBe(false);
  });

  it("rejects missing version", () => {
    const result = UpdateNoteBodySchema.safeParse({
      encryptedData: "dGVzdA==",
    });
    expect(result.success).toBe(false);
  });

  it("rejects non-integer version", () => {
    const result = UpdateNoteBodySchema.safeParse({
      encryptedData: "dGVzdA==",
      version: 1.5,
    });
    expect(result.success).toBe(false);
  });

  it("rejects missing encryptedData", () => {
    const result = UpdateNoteBodySchema.safeParse({ version: 1 });
    expect(result.success).toBe(false);
  });
});

describe("NoteQuerySchema", () => {
  it("accepts empty query", () => {
    const result = NoteQuerySchema.safeParse({});
    expect(result.success).toBe(true);
  });

  it("parses includeArchived boolean", () => {
    const result = NoteQuerySchema.safeParse({ includeArchived: "true" });
    expect(result.success).toBe(true);
    if (result.success) {
      expect(result.data.includeArchived).toBe(true);
    }
  });

  it("parses authorEntityType filter", () => {
    const result = NoteQuerySchema.safeParse({ authorEntityType: "member" });
    expect(result.success).toBe(true);
    if (result.success) {
      expect(result.data.authorEntityType).toBe("member");
    }
  });

  it("parses authorEntityType structure-entity", () => {
    const result = NoteQuerySchema.safeParse({ authorEntityType: "structure-entity" });
    expect(result.success).toBe(true);
    if (result.success) {
      expect(result.data.authorEntityType).toBe("structure-entity");
    }
  });

  it("rejects invalid authorEntityType", () => {
    const result = NoteQuerySchema.safeParse({ authorEntityType: "invalid" });
    expect(result.success).toBe(false);
  });

  it("parses authorEntityId filter with authorEntityType", () => {
    const result = NoteQuerySchema.safeParse({
      authorEntityType: "member",
      authorEntityId: "mem_abc",
    });
    expect(result.success).toBe(true);
    if (result.success) {
      expect(result.data.authorEntityId).toBe("mem_abc");
    }
  });

  it("parses systemWide boolean", () => {
    const result = NoteQuerySchema.safeParse({ systemWide: "true" });
    expect(result.success).toBe(true);
    if (result.success) {
      expect(result.data.systemWide).toBe(true);
    }
  });

  it("rejects authorEntityId without authorEntityType", () => {
    const result = NoteQuerySchema.safeParse({ authorEntityId: "mem_abc" });
    expect(result.success).toBe(false);
  });

  it("rejects systemWide with authorEntityType", () => {
    const result = NoteQuerySchema.safeParse({
      systemWide: "true",
      authorEntityType: "member",
    });
    expect(result.success).toBe(false);
  });

  it("rejects systemWide with authorEntityId", () => {
    const result = NoteQuerySchema.safeParse({
      systemWide: "true",
      authorEntityType: "member",
      authorEntityId: "mem_abc",
    });
    expect(result.success).toBe(false);
  });
});

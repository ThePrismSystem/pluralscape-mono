import { createMappingContext } from "@pluralscape/import-core";
import { describe, expect, it } from "vitest";

import { mapPkMember } from "../../mappers/member.mapper.js";

import type { PKMember } from "../../validators/pk-payload.js";

describe("mapPkMember", () => {
  it("maps a basic member with name, pronouns, description, avatar, and color", () => {
    const pk: PKMember = {
      id: "abcde",
      name: "Aria",
      pronouns: "she/her",
      description: "A headmate",
      avatar_url: "https://example.com/avatar.png",
      color: "ff6b6b",
    };
    const ctx = createMappingContext({ sourceMode: "fake" });
    const result = mapPkMember(pk, ctx);

    expect(result.status).toBe("mapped");
    if (result.status === "mapped") {
      expect(result.payload.encrypted.name).toBe("Aria");
      expect(result.payload.encrypted.pronouns).toEqual(["she/her"]);
      expect(result.payload.encrypted.description).toBe("A headmate");
      expect(result.payload.encrypted.avatarSource).toEqual({
        kind: "external",
        url: "https://example.com/avatar.png",
      });
      expect(result.payload.encrypted.colors).toEqual(["#ff6b6b"]);
      expect(result.payload.archived).toBe(false);
      expect(result.payload.fieldValues).toEqual([]);
      expect(result.payload.bucketIds).toEqual([]);
    }
  });

  it("passes pronouns as a single-element array without splitting on /", () => {
    const pk: PKMember = { id: "m1", name: "A", pronouns: "they/them" };
    const ctx = createMappingContext({ sourceMode: "fake" });
    const result = mapPkMember(pk, ctx);

    expect(result.status).toBe("mapped");
    if (result.status === "mapped") {
      expect(result.payload.encrypted.pronouns).toEqual(["they/them"]);
    }
  });

  it("maps null pronouns to an empty array", () => {
    const pk: PKMember = { id: "m1", name: "A", pronouns: null };
    const ctx = createMappingContext({ sourceMode: "fake" });
    const result = mapPkMember(pk, ctx);

    expect(result.status).toBe("mapped");
    if (result.status === "mapped") {
      expect(result.payload.encrypted.pronouns).toEqual([]);
    }
  });

  it("maps undefined pronouns to an empty array", () => {
    const pk: PKMember = { id: "m1", name: "A" };
    const ctx = createMappingContext({ sourceMode: "fake" });
    const result = mapPkMember(pk, ctx);

    expect(result.status).toBe("mapped");
    if (result.status === "mapped") {
      expect(result.payload.encrypted.pronouns).toEqual([]);
    }
  });

  it("maps null color to an empty colors array", () => {
    const pk: PKMember = { id: "m1", name: "A", color: null };
    const ctx = createMappingContext({ sourceMode: "fake" });
    const result = mapPkMember(pk, ctx);

    expect(result.status).toBe("mapped");
    if (result.status === "mapped") {
      expect(result.payload.encrypted.colors).toEqual([]);
    }
  });

  it("maps null description to null", () => {
    const pk: PKMember = { id: "m1", name: "A", description: null };
    const ctx = createMappingContext({ sourceMode: "fake" });
    const result = mapPkMember(pk, ctx);

    expect(result.status).toBe("mapped");
    if (result.status === "mapped") {
      expect(result.payload.encrypted.description).toBeNull();
    }
  });

  it("adds # prefix to a color that lacks it", () => {
    const pk: PKMember = { id: "m1", name: "A", color: "ff6b6b" };
    const ctx = createMappingContext({ sourceMode: "fake" });
    const result = mapPkMember(pk, ctx);

    expect(result.status).toBe("mapped");
    if (result.status === "mapped") {
      expect(result.payload.encrypted.colors).toEqual(["#ff6b6b"]);
    }
  });

  it("preserves a color that already has the # prefix", () => {
    const pk: PKMember = { id: "m1", name: "A", color: "#aabbcc" };
    const ctx = createMappingContext({ sourceMode: "fake" });
    const result = mapPkMember(pk, ctx);

    expect(result.status).toBe("mapped");
    if (result.status === "mapped") {
      expect(result.payload.encrypted.colors).toEqual(["#aabbcc"]);
    }
  });

  it("emits a warning and returns empty colors for an invalid color", () => {
    const pk: PKMember = { id: "m1", name: "A", color: "not-a-color" };
    const ctx = createMappingContext({ sourceMode: "fake" });
    const result = mapPkMember(pk, ctx);

    expect(result.status).toBe("mapped");
    if (result.status === "mapped") {
      expect(result.payload.encrypted.colors).toEqual([]);
    }
    expect(ctx.warnings.some((w) => w.message.includes("not-a-color"))).toBe(true);
  });

  it("skips a member with a whitespace-only name", () => {
    // PKMemberSchema enforces min(1), but a whitespace-only string passes
    // Zod validation yet is semantically empty — the mapper must catch it.
    const pk: PKMember = { id: "m1", name: "   " };
    const ctx = createMappingContext({ sourceMode: "fake" });
    const result = mapPkMember(pk, ctx);

    expect(result.status).toBe("skipped");
    if (result.status === "skipped") {
      expect(result.kind).toBe("empty-name");
    }
  });

  it("maps null avatar_url to null avatarSource", () => {
    const pk: PKMember = { id: "m1", name: "A", avatar_url: null };
    const ctx = createMappingContext({ sourceMode: "fake" });
    const result = mapPkMember(pk, ctx);

    expect(result.status).toBe("mapped");
    if (result.status === "mapped") {
      expect(result.payload.encrypted.avatarSource).toBeNull();
    }
  });

  it("leaves bucketIds empty for privacy synthesis to handle later", () => {
    const pk: PKMember = { id: "m1", name: "A" };
    const ctx = createMappingContext({ sourceMode: "fake" });
    const result = mapPkMember(pk, ctx);

    expect(result.status).toBe("mapped");
    if (result.status === "mapped") {
      expect(result.payload.bucketIds).toEqual([]);
    }
  });
});

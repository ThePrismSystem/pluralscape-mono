import { createMappingContext } from "@pluralscape/import-core";
import { describe, expect, it } from "vitest";

import { mapPkGroup } from "../../mappers/group.mapper.js";

import type { PKGroup } from "../../validators/pk-payload.js";

describe("mapPkGroup", () => {
  it("maps a basic group with name, description, color, and resolved members", () => {
    const ctx = createMappingContext({ sourceMode: "fake" });
    ctx.register("member", "pk_m1", "ps_m1");
    ctx.register("member", "pk_m2", "ps_m2");

    const pk: PKGroup = {
      id: "grp01",
      name: "Core Group",
      description: "The core crew",
      color: "aabb22",
      icon: "https://example.com/icon.png",
      members: ["pk_m1", "pk_m2"],
    };
    const result = mapPkGroup(pk, ctx);

    expect(result.status).toBe("mapped");
    if (result.status === "mapped") {
      expect(result.payload.encrypted.name).toBe("Core Group");
      expect(result.payload.encrypted.description).toBe("The core crew");
      expect(result.payload.encrypted.color).toBe("#aabb22");
      expect(result.payload.encrypted.imageSource).toEqual({
        kind: "external",
        url: "https://example.com/icon.png",
      });
      expect(result.payload.encrypted.emoji).toBeNull();
      expect(result.payload.parentGroupId).toBeNull();
      expect(result.payload.sortOrder).toBe(0);
      expect(result.payload.memberIds).toEqual(["ps_m1", "ps_m2"]);
    }
  });

  it("skips a group with a whitespace-only name", () => {
    const ctx = createMappingContext({ sourceMode: "fake" });
    const pk: PKGroup = { id: "grp01", name: "   ", members: [] };
    const result = mapPkGroup(pk, ctx);

    expect(result.status).toBe("skipped");
    if (result.status === "skipped") {
      expect(result.kind).toBe("empty-name");
    }
  });

  it("emits a warning and skips a missing member ref without failing the group", () => {
    const ctx = createMappingContext({ sourceMode: "fake" });
    ctx.register("member", "pk_m1", "ps_m1");

    const pk: PKGroup = {
      id: "grp02",
      name: "Partial",
      members: ["pk_m1", "pk_missing"],
    };
    const result = mapPkGroup(pk, ctx);

    expect(result.status).toBe("mapped");
    if (result.status === "mapped") {
      // The resolved member is kept, the missing one is skipped
      expect(result.payload.memberIds).toEqual(["ps_m1"]);
    }
    expect(ctx.warnings.some((w) => w.message.includes("pk_missing"))).toBe(true);
  });

  it("maps a group with an empty members array as valid with empty memberIds", () => {
    const ctx = createMappingContext({ sourceMode: "fake" });
    const pk: PKGroup = { id: "grp03", name: "Empty", members: [] };
    const result = mapPkGroup(pk, ctx);

    expect(result.status).toBe("mapped");
    if (result.status === "mapped") {
      expect(result.payload.memberIds).toEqual([]);
    }
  });

  it("maps null description and color correctly", () => {
    const ctx = createMappingContext({ sourceMode: "fake" });
    const pk: PKGroup = {
      id: "grp04",
      name: "Minimal",
      description: null,
      color: null,
      members: [],
    };
    const result = mapPkGroup(pk, ctx);

    expect(result.status).toBe("mapped");
    if (result.status === "mapped") {
      expect(result.payload.encrypted.description).toBeNull();
      expect(result.payload.encrypted.color).toBeNull();
    }
  });

  it("maps icon to imageSource with kind external", () => {
    const ctx = createMappingContext({ sourceMode: "fake" });
    const pk: PKGroup = {
      id: "grp05",
      name: "With Icon",
      icon: "https://cdn.example.com/group.png",
      members: [],
    };
    const result = mapPkGroup(pk, ctx);

    expect(result.status).toBe("mapped");
    if (result.status === "mapped") {
      expect(result.payload.encrypted.imageSource).toEqual({
        kind: "external",
        url: "https://cdn.example.com/group.png",
      });
    }
  });

  it("maps null icon to null imageSource", () => {
    const ctx = createMappingContext({ sourceMode: "fake" });
    const pk: PKGroup = { id: "grp06", name: "No Icon", icon: null, members: [] };
    const result = mapPkGroup(pk, ctx);

    expect(result.status).toBe("mapped");
    if (result.status === "mapped") {
      expect(result.payload.encrypted.imageSource).toBeNull();
    }
  });

  it("emits a warning for an invalid color and returns null", () => {
    const ctx = createMappingContext({ sourceMode: "fake" });
    const pk: PKGroup = { id: "grp07", name: "Bad Color", color: "zzz", members: [] };
    const result = mapPkGroup(pk, ctx);

    expect(result.status).toBe("mapped");
    if (result.status === "mapped") {
      expect(result.payload.encrypted.color).toBeNull();
    }
    expect(ctx.warnings.some((w) => w.message.includes("zzz"))).toBe(true);
  });

  it("adds # prefix to a color that lacks it", () => {
    const ctx = createMappingContext({ sourceMode: "fake" });
    const pk: PKGroup = { id: "grp08", name: "Colored", color: "112233", members: [] };
    const result = mapPkGroup(pk, ctx);

    expect(result.status).toBe("mapped");
    if (result.status === "mapped") {
      expect(result.payload.encrypted.color).toBe("#112233");
    }
  });

  it("always sets parentGroupId to null", () => {
    const ctx = createMappingContext({ sourceMode: "fake" });
    const pk: PKGroup = { id: "grp09", name: "Flat", members: [] };
    const result = mapPkGroup(pk, ctx);

    expect(result.status).toBe("mapped");
    if (result.status === "mapped") {
      expect(result.payload.parentGroupId).toBeNull();
    }
  });
});

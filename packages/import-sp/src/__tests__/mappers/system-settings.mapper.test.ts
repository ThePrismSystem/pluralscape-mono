import { describe, expect, it } from "vitest";

import { createMappingContext } from "../../mappers/context.js";
import { mapSystemSettings } from "../../mappers/system-settings.mapper.js";

import type { SPPrivate } from "../../sources/sp-types.js";

describe("mapSystemSettings", () => {
  it("maps a minimal SPPrivate with defaulted booleans", () => {
    const ctx = createMappingContext({ sourceMode: "fake" });
    const sp: SPPrivate = { _id: "pr1" };
    const result = mapSystemSettings(sp, ctx);
    expect(result.status).toBe("mapped");
    if (result.status === "mapped") {
      expect(result.payload.locale).toBeNull();
      expect(result.payload.frontingNotificationsEnabled).toBe(false);
      expect(result.payload.boardNotificationsEnabled).toBe(false);
    }
  });

  it("preserves the locale string", () => {
    const ctx = createMappingContext({ sourceMode: "fake" });
    const sp: SPPrivate = { _id: "pr2", locale: "en-GB" };
    const result = mapSystemSettings(sp, ctx);
    expect(result.status).toBe("mapped");
    if (result.status === "mapped") {
      expect(result.payload.locale).toBe("en-GB");
    }
  });

  it("maps SP notification booleans to renamed fields", () => {
    const ctx = createMappingContext({ sourceMode: "fake" });
    const sp: SPPrivate = {
      _id: "pr3",
      locale: "en-US",
      frontNotifs: true,
      messageBoardNotifs: true,
    };
    const result = mapSystemSettings(sp, ctx);
    expect(result.status).toBe("mapped");
    if (result.status === "mapped") {
      expect(result.payload.frontingNotificationsEnabled).toBe(true);
      expect(result.payload.boardNotificationsEnabled).toBe(true);
    }
  });

  it("treats a null locale as null (no default)", () => {
    const ctx = createMappingContext({ sourceMode: "fake" });
    const sp: SPPrivate = { _id: "pr4", locale: null };
    const result = mapSystemSettings(sp, ctx);
    expect(result.status).toBe("mapped");
    if (result.status === "mapped") {
      expect(result.payload.locale).toBeNull();
    }
  });
});

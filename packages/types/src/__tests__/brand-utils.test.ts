import { describe, expect, it } from "vitest";

import { brandId } from "../brand-utils.js";

import type { SystemId, MemberId } from "../ids.js";

describe("brandId", () => {
  it("returns the input string with the branded type", () => {
    const raw = "sys_abc123";
    const branded: SystemId = brandId<SystemId>(raw);
    expect(branded).toBe(raw);
  });

  it("preserves the runtime value identity", () => {
    const raw = "mem_xyz789";
    const branded: MemberId = brandId<MemberId>(raw);
    expect(typeof branded).toBe("string");
    expect(branded).toBe(raw);
  });
});

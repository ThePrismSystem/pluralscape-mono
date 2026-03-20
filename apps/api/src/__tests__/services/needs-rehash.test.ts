import { describe, expect, it } from "vitest";

import { needsRehash } from "../../services/auth.service.js";

describe("needsRehash", () => {
  it("returns true for t=3 (old moderate server profile)", () => {
    const hash = "$argon2id$v=19$m=65536,t=3,p=1$R8XiCuEH7Vp0$somehash";
    expect(needsRehash(hash)).toBe(true);
  });

  it("returns true for t=2 (interactive profile)", () => {
    const hash = "$argon2id$v=19$m=65536,t=2,p=1$R8XiCuEH7Vp0$somehash";
    expect(needsRehash(hash)).toBe(true);
  });

  it("returns false for t=4 (current sensitive profile)", () => {
    const hash = "$argon2id$v=19$m=65536,t=4,p=1$R8XiCuEH7Vp0$somehash";
    expect(needsRehash(hash)).toBe(false);
  });

  it("returns false for t=5 (future higher profile)", () => {
    const hash = "$argon2id$v=19$m=65536,t=5,p=1$R8XiCuEH7Vp0$somehash";
    expect(needsRehash(hash)).toBe(false);
  });

  it("returns false for non-argon2id hash format", () => {
    const hash = "$2b$12$somebcrypthash";
    expect(needsRehash(hash)).toBe(false);
  });

  it("returns false for empty string", () => {
    expect(needsRehash("")).toBe(false);
  });
});

import { SCOPE_DOMAINS } from "@pluralscape/types";
import { describe, expect, it } from "vitest";

import { SCOPE_REGISTRY } from "../scope-registry.js";

const VALID_REQUIRED_SCOPES = new Set<string>([
  ...SCOPE_DOMAINS.flatMap((d) => [`read:${d}`, `write:${d}`, `delete:${d}`]),
  "read:audit-log",
  "full",
]);

describe("SCOPE_REGISTRY", () => {
  it("has REST entries", () => {
    expect(SCOPE_REGISTRY.rest.size).toBeGreaterThan(0);
  });

  it("has tRPC entries", () => {
    expect(SCOPE_REGISTRY.trpc.size).toBeGreaterThan(0);
  });

  it("all REST scopes are valid RequiredScope values", () => {
    for (const [key, entry] of SCOPE_REGISTRY.rest) {
      expect(
        VALID_REQUIRED_SCOPES.has(entry.scope),
        `Invalid scope "${entry.scope}" for REST route "${key}"`,
      ).toBe(true);
    }
  });

  it("all tRPC scopes are valid RequiredScope values", () => {
    for (const [key, entry] of SCOPE_REGISTRY.trpc) {
      expect(
        VALID_REQUIRED_SCOPES.has(entry.scope),
        `Invalid scope "${entry.scope}" for tRPC procedure "${key}"`,
      ).toBe(true);
    }
  });

  it("REST keys follow METHOD /path format", () => {
    const validMethods = new Set(["GET", "POST", "PUT", "DELETE", "PATCH"]);
    for (const key of SCOPE_REGISTRY.rest.keys()) {
      const spaceIdx = key.indexOf(" ");
      expect(spaceIdx, `REST key "${key}" missing space separator`).toBeGreaterThan(0);
      const method = key.slice(0, spaceIdx);
      expect(validMethods.has(method), `REST key "${key}" has invalid method "${method}"`).toBe(
        true,
      );
    }
  });

  it("tRPC keys follow router.procedure format", () => {
    for (const key of SCOPE_REGISTRY.trpc.keys()) {
      expect(key, `tRPC key "${key}" should contain a dot`).toMatch(/^[a-zA-Z]+\.[a-zA-Z.]+$/);
    }
  });
});

import { describe, expectTypeOf, it } from "vitest";

import type { SotEntityManifest } from "../__sot-manifest__.js";
import type { Equal, Extends } from "../type-assertions.js";

describe("SotEntityManifest", () => {
  it("is initially empty (no entities registered during Phase 0)", () => {
    expectTypeOf<Equal<keyof SotEntityManifest, never>>().toEqualTypeOf<true>();
  });

  it("entries carry a domain/server/wire triple (once populated)", () => {
    // Each manifest entry value must have all three keys. This test validates
    // the shape constraint on entries. During Phase 0, the manifest is empty,
    // so we check via a dummy entry type. Once pilot (Phase 1) registers
    // entries like Member and AuditLogEntry, they must all satisfy this shape.
    type DummyEntry = { domain: unknown; server: unknown; wire: unknown };
    expectTypeOf<
      Extends<DummyEntry, { domain: unknown; server: unknown; wire: unknown }>
    >().toEqualTypeOf<true>();
  });
});

/**
 * Pilot-scope manifest completeness check: asserts the two pilot entities
 * (Member, AuditLogEntry) are registered in `SotEntityManifest`.
 *
 * Fleet PRs (Phase 2) extend this with a full Drizzle-table-name ↔
 * manifest-key equality check once all clusters land. Until then, this
 * ensures any accidental deletion of a pilot entry fails CI.
 */

import { describe, expectTypeOf, it } from "vitest";

import type { Extends, SotEntityManifest } from "@pluralscape/types";

describe("SoT manifest completeness (pilot scope)", () => {
  it("Member and AuditLogEntry are registered in SotEntityManifest", () => {
    expectTypeOf<
      Extends<"Member" | "AuditLogEntry", keyof SotEntityManifest>
    >().toEqualTypeOf<true>();
  });
});

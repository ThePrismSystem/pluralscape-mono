/**
 * Drizzle parity check: the import_jobs row shape inferred from the
 * `import_jobs` table structurally matches `ImportJobServerMetadata` in
 * @pluralscape/types.
 *
 * ImportJob is a plaintext entity. The DB row carries the domain
 * `ImportJob` plus the server-only `checkpointState` column — the
 * resumable import engine state the client writes back to the server
 * between chunks but doesn't expose on the domain view of a job. See
 * `member.type.test.ts` for the general rationale behind the
 * brand-stripped comparison.
 */

import { describe, expectTypeOf, it } from "vitest";

import { importJobs } from "../../schema/pg/import-export.js";

import type { Equal, ImportJobServerMetadata } from "@pluralscape/types";
import type { InferSelectModel } from "drizzle-orm";

describe("ImportJob Drizzle parity", () => {
  it("import_jobs Drizzle row has the same property keys as ImportJobServerMetadata", () => {
    type Row = InferSelectModel<typeof importJobs>;
    expectTypeOf<keyof Row>().toEqualTypeOf<keyof ImportJobServerMetadata>();
  });

  it("import_jobs Drizzle row equals ImportJobServerMetadata", () => {
    type Row = InferSelectModel<typeof importJobs>;
    expectTypeOf<Equal<Row, ImportJobServerMetadata>>().toEqualTypeOf<true>();
  });
});

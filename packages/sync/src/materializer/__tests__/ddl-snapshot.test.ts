import { readFileSync } from "node:fs";
import { join } from "node:path";

import { describe, expect, test } from "vitest";

import { generateAllDdl } from "../local-schema.js";

/**
 * DDL output stability gate. Captures the materializer's DDL output to a
 * baseline file. The PR2 refactor (db-jv3w) replaces the hand-rolled
 * ENTITY_TABLE_REGISTRY with Drizzle introspection — this test must keep
 * passing throughout the refactor to prove the new path emits the same
 * SQL as the old one.
 *
 * After the refactor lands, this transient test gets deleted (PR2 Task 26).
 */
describe("DDL snapshot stability", () => {
  test("generateAllDdl output matches captured baseline (byte-equivalent modulo whitespace)", () => {
    const baselinePath = join(__dirname, "ddl-snapshot.baseline.txt");
    const baseline = readFileSync(baselinePath, "utf-8").trim();
    const actual = generateAllDdl().join("\n;\n").trim();

    const normalize = (s: string): string => s.replace(/\s+/g, " ").trim();
    expect(normalize(actual)).toBe(normalize(baseline));
  });
});

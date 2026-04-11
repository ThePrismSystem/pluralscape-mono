// scripts/sp-seed/__tests__/fixtures.test.ts
import { describe, expect, test } from "vitest";
import { ENTITY_TYPES_IN_ORDER, type EntityFixtures } from "../fixtures/types.js";
import { MINIMAL_FIXTURES } from "../fixtures/minimal.js";

const FIXTURE_SETS: [string, EntityFixtures][] = [
  ["minimal", MINIMAL_FIXTURES],
  // adversarial added in Task 16
];

const REF_PATTERN = /^[a-z][a-z0-9-]*\.[a-z0-9][a-z0-9-]*$/;

/** Collect every ref USED inside a body value (recursive). */
function collectRefsInValue(value: unknown): string[] {
  if (typeof value === "string") {
    return REF_PATTERN.test(value) ? [value] : [];
  }
  if (Array.isArray(value)) return value.flatMap(collectRefsInValue);
  if (typeof value === "object" && value !== null) {
    return Object.values(value).flatMap(collectRefsInValue);
  }
  return [];
}

describe.each(FIXTURE_SETS)("%s fixtures integrity", (_name, fixtures) => {
  test("all 13 entity-type arrays are non-empty", () => {
    for (const key of ENTITY_TYPES_IN_ORDER) {
      expect(fixtures[key].length).toBeGreaterThan(0);
    }
  });

  test("profilePatch is populated", () => {
    expect(fixtures.profilePatch.desc.length).toBeGreaterThan(0);
    expect(fixtures.profilePatch.color).toMatch(/^#[0-9a-fA-F]{6}$/);
  });

  test("no duplicate refs across the entire fixture set", () => {
    const seen = new Set<string>();
    for (const key of ENTITY_TYPES_IN_ORDER) {
      for (const entry of fixtures[key]) {
        expect(seen.has(entry.ref)).toBe(false);
        seen.add(entry.ref);
      }
    }
  });

  test("every ref used in a body is declared earlier in iteration order", () => {
    const declared = new Set<string>();
    for (const key of ENTITY_TYPES_IN_ORDER) {
      for (const entry of fixtures[key]) {
        const usedRefs = collectRefsInValue(entry.body);
        for (const ref of usedRefs) {
          if (!declared.has(ref)) {
            throw new Error(
              `Fixture "${entry.ref}" (entityType=${key}) uses ref "${ref}" ` +
                `that has not been declared at an earlier position`,
            );
          }
        }
        declared.add(entry.ref);
      }
    }
  });

  test("every ref is lowercase, dotted, and follows the convention", () => {
    for (const key of ENTITY_TYPES_IN_ORDER) {
      for (const entry of fixtures[key]) {
        expect(entry.ref).toMatch(REF_PATTERN);
      }
    }
  });
});

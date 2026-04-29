// Regression trap (Task 23 of ps-6phh): asserts the G8 / G9 lint rule
// allow-lists are literally empty Sets. If anyone re-adds an entry — say,
// via a `// eslint-disable-next-line` plus a fresh hand-rolled request type
// or a `params: unknown` service signature — they must also delete this
// test, making the drift conspicuous in the diff.
//
// Both rule modules expose `allowList` on their default export specifically
// so this trap can read the live runtime value (mirrors what the rule
// actually consults, not a stale string match in the source file).

import { describe, expect, it } from "vitest";

import g8Rule from "./no-hand-rolled-request-types.js";
import g9Rule from "./no-params-unknown.js";

describe("G8 allow-list (no-hand-rolled-request-types)", () => {
  it("is literally empty — drift requires removing this assertion", () => {
    expect(g8Rule.allowList).toBeInstanceOf(Set);
    expect(g8Rule.allowList.size).toBe(0);
  });
});

describe("G9 allow-list (no-params-unknown)", () => {
  it("is literally empty — drift requires removing this assertion", () => {
    expect(g9Rule.allowList).toBeInstanceOf(Set);
    expect(g9Rule.allowList.size).toBe(0);
  });
});

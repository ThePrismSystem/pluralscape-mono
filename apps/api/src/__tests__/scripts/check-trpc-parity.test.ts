import { describe, expect, it } from "vitest";

import type { ParityFailure } from "../../../scripts/trpc-parity-lib.js";
import { walkRouteTree } from "../../../scripts/trpc-parity-lib.js";

describe("walkRouteTree", () => {
  it("records a failure when a route file cannot be read", () => {
    const failures: ParityFailure[] = [];
    const result = walkRouteTree("/nonexistent/file.ts", "/v1", false, failures);
    expect(result).toEqual([]);
    expect(failures).toHaveLength(1);
    expect(failures[0]?.dimension).toBe("existence");
    expect(failures[0]?.actual).toContain("not readable");
  });
});

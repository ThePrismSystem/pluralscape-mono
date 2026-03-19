import { SESSION_TIMEOUTS } from "@pluralscape/types";
import { describe, expect, it } from "vitest";

import { buildIdleTimeoutFilter } from "../../lib/session-idle-filter.js";

describe("buildIdleTimeoutFilter", () => {
  it("returns a drizzle SQL object with queryChunks", () => {
    const result = buildIdleTimeoutFilter(Date.now());
    expect(result).toBeDefined();
    expect(typeof result).toBe("object");
    // Drizzle SQL objects expose a queryChunks property
    expect("queryChunks" in result).toBe(true);
  });

  it("includes all SESSION_TIMEOUTS absoluteTtl values in the SQL", () => {
    const result = buildIdleTimeoutFilter(1_000_000);
    // Walk the queryChunks tree to collect all parameter values
    const params: unknown[] = [];
    function walk(chunks: readonly unknown[]): void {
      for (const chunk of chunks) {
        if (chunk && typeof chunk === "object" && "queryChunks" in chunk) {
          walk((chunk as { queryChunks: readonly unknown[] }).queryChunks);
        } else {
          params.push(chunk);
        }
      }
    }
    walk(result.queryChunks);

    for (const config of Object.values(SESSION_TIMEOUTS)) {
      expect(params).toContain(config.absoluteTtlMs);
    }
  });

  it("handles null idleTimeoutMs entries without throwing", () => {
    // deviceTransfer has idleTimeoutMs: null — should still produce valid SQL
    const hasNullIdle = Object.values(SESSION_TIMEOUTS).some((c) => c.idleTimeoutMs === null);
    expect(hasNullIdle).toBe(true);

    // Should not throw
    const result = buildIdleTimeoutFilter(1_000_000);
    expect(result).toBeDefined();
  });
});

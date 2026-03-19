import { SESSION_TIMEOUTS } from "@pluralscape/types";
import { describe, expect, it } from "vitest";

import { buildIdleTimeoutFilter } from "../../lib/session-idle-filter.js";

interface ChunkVisitor {
  onParam?: (value: unknown) => void;
  onString?: (value: string) => void;
}

function walkChunks(chunks: readonly unknown[], visitor: ChunkVisitor): void {
  for (const chunk of chunks) {
    if (typeof chunk === "string") {
      visitor.onString?.(chunk);
    } else if (chunk && typeof chunk === "object") {
      if ("queryChunks" in chunk) {
        walkChunks((chunk as { queryChunks: readonly unknown[] }).queryChunks, visitor);
      }
      if ("value" in chunk) {
        const val = (chunk as { value: unknown }).value;
        if (Array.isArray(val)) {
          for (const v of val) {
            if (typeof v === "string") visitor.onString?.(v);
          }
        } else {
          visitor.onParam?.(val);
        }
      }
    } else {
      // Raw value (number, boolean, etc.) — treat as param
      visitor.onParam?.(chunk);
    }
  }
}

function collectParams(chunks: readonly unknown[]): unknown[] {
  const params: unknown[] = [];
  walkChunks(chunks, { onParam: (v) => params.push(v) });
  return params;
}

function collectStringChunks(chunks: readonly unknown[]): string[] {
  const strings: string[] = [];
  walkChunks(chunks, { onString: (v) => strings.push(v) });
  return strings;
}

describe("buildIdleTimeoutFilter", () => {
  it("returns a drizzle SQL object with queryChunks", () => {
    const result = buildIdleTimeoutFilter(Date.now());
    expect(result).toBeDefined();
    expect(typeof result).toBe("object");
    expect("queryChunks" in result).toBe(true);
  });

  it("includes all SESSION_TIMEOUTS absoluteTtl values in the SQL", () => {
    const result = buildIdleTimeoutFilter(1_000_000);
    const params = collectParams(result.queryChunks);

    for (const config of Object.values(SESSION_TIMEOUTS)) {
      expect(params).toContain(config.absoluteTtlMs);
    }
  });

  it("handles null idleTimeoutMs entries without throwing", () => {
    const hasNullIdle = Object.values(SESSION_TIMEOUTS).some((c) => c.idleTimeoutMs === null);
    expect(hasNullIdle).toBe(true);

    const result = buildIdleTimeoutFilter(1_000_000);
    expect(result).toBeDefined();
  });

  it("produces idle timeout threshold values in SQL params", () => {
    const currentTimeMs = 1_700_000_000_000;
    const result = buildIdleTimeoutFilter(currentTimeMs);
    const params = collectParams(result.queryChunks);

    // For each config with a non-null idleTimeoutMs, the pre-computed threshold
    // (currentTimeMs - idleTimeoutMs) should appear as a parameter value.
    for (const config of Object.values(SESSION_TIMEOUTS)) {
      if (config.idleTimeoutMs !== null) {
        const thresholdMs = currentTimeMs - config.idleTimeoutMs;
        expect(params).toContain(thresholdMs);
      }
    }
  });

  it("uses CAST(... AS bigint) for TTL expressions", () => {
    const result = buildIdleTimeoutFilter(1_000_000);
    const strings = collectStringChunks(result.queryChunks);
    const joined = strings.join("");
    expect(joined).toContain("CAST");
    expect(joined).toContain("bigint");
  });

  it("includes a NOT IN condition for unknown-TTL sessions", () => {
    const result = buildIdleTimeoutFilter(1_000_000);
    const strings = collectStringChunks(result.queryChunks);
    const joined = strings.join("");
    expect(joined).toContain("NOT IN");
  });

  it("computes correct boundary threshold values", () => {
    const currentTimeMs = 2_000_000_000_000;
    const result = buildIdleTimeoutFilter(currentTimeMs);
    const params = collectParams(result.queryChunks);

    // Web session: idleTimeoutMs = 7 days
    const webThreshold = currentTimeMs - SESSION_TIMEOUTS.web.idleTimeoutMs;
    expect(params).toContain(webThreshold);

    // Mobile session: idleTimeoutMs = 30 days
    const mobileThreshold = currentTimeMs - SESSION_TIMEOUTS.mobile.idleTimeoutMs;
    expect(params).toContain(mobileThreshold);
  });

  it("uses bigint cast in TTL duration expression", () => {
    const result = buildIdleTimeoutFilter(1_000_000);
    const strings = collectStringChunks(result.queryChunks);
    const joined = strings.join("");
    expect(joined).toContain("AS bigint");
  });
});

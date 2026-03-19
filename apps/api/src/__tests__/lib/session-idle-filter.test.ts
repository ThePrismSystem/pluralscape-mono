import { SESSION_TIMEOUTS } from "@pluralscape/types";
import { describe, expect, it } from "vitest";

import { buildIdleTimeoutFilter } from "../../lib/session-idle-filter.js";

/**
 * Recursively collects all parameter values from a drizzle SQL queryChunks tree.
 * Handles both raw values (from sql template literals) and Param objects (from Drizzle operators like gte).
 */
function collectParams(chunks: readonly unknown[]): unknown[] {
  const params: unknown[] = [];
  for (const chunk of chunks) {
    if (chunk && typeof chunk === "object") {
      if ("queryChunks" in chunk) {
        params.push(...collectParams((chunk as { queryChunks: readonly unknown[] }).queryChunks));
      } else if ("value" in chunk) {
        const val = (chunk as { value: unknown }).value;
        // StringChunk has value: string[] — skip those
        // Param has value: T (number, string, etc.) — extract
        if (!Array.isArray(val)) {
          params.push(val);
        }
      }
    } else {
      params.push(chunk);
    }
  }
  return params;
}

/**
 * Recursively collects all SQL string fragments from a drizzle SQL queryChunks tree.
 * Handles StringChunk objects (value: string[]) and nested SQL objects.
 */
function collectStringChunks(chunks: readonly unknown[]): string[] {
  const strings: string[] = [];
  for (const chunk of chunks) {
    if (typeof chunk === "string") {
      strings.push(chunk);
    } else if (chunk && typeof chunk === "object") {
      if ("queryChunks" in chunk) {
        strings.push(
          ...collectStringChunks((chunk as { queryChunks: readonly unknown[] }).queryChunks),
        );
      }
      if ("value" in chunk && Array.isArray((chunk as { value: unknown }).value)) {
        // StringChunk: value is string[]
        for (const v of (chunk as { value: string[] }).value) {
          if (typeof v === "string") strings.push(v);
        }
      }
    }
  }
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
});

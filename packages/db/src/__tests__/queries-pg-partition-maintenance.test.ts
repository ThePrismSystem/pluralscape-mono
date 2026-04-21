import { describe, expect, it } from "vitest";

import {
  PARTITIONED_TABLES,
  formatPartitionName,
  parsePartitionDate,
} from "../queries/partition-maintenance.js";
import { validateMonthsAhead, validateOlderThanMonths } from "../queries/types.js";

describe("PARTITIONED_TABLES", () => {
  it("contains all expected tables", () => {
    expect(PARTITIONED_TABLES).toContain("messages");
    expect(PARTITIONED_TABLES).toContain("audit_log");
    expect(PARTITIONED_TABLES).toContain("fronting_sessions");
  });
});

describe("formatPartitionName", () => {
  it("pads single-digit months with a leading zero", () => {
    expect(formatPartitionName("audit_log", 2026, 1)).toBe("audit_log_2026_01");
    expect(formatPartitionName("audit_log", 2026, 9)).toBe("audit_log_2026_09");
  });

  it("handles double-digit months", () => {
    expect(formatPartitionName("fronting_sessions", 2026, 12)).toBe("fronting_sessions_2026_12");
  });

  it("handles table names with underscores", () => {
    expect(formatPartitionName("fronting_sessions", 2026, 3)).toBe("fronting_sessions_2026_03");
  });

  it("rejects unknown table names at runtime", () => {
    // TS narrows `table` to PartitionedTable, but a JS caller or future
    // refactor could bypass the type system. This identifier flows into
    // sql.raw — the runtime guard is defense-in-depth.
    expect(() =>
      // @ts-expect-error — intentionally passing an invalid table name
      formatPartitionName("malicious_table", 2026, 3),
    ).toThrow(/Invalid partitioned table/);
  });

  it("rejects out-of-range or non-integer years", () => {
    expect(() => formatPartitionName("audit_log", 1999, 3)).toThrow(/Invalid partition year/);
    expect(() => formatPartitionName("audit_log", 10_000, 3)).toThrow(/Invalid partition year/);
    expect(() => formatPartitionName("audit_log", 2026.5, 3)).toThrow(/Invalid partition year/);
    expect(() => formatPartitionName("audit_log", Number.NaN, 3)).toThrow(/Invalid partition year/);
  });

  it("rejects out-of-range or non-integer months", () => {
    expect(() => formatPartitionName("audit_log", 2026, 0)).toThrow(/Invalid partition month/);
    expect(() => formatPartitionName("audit_log", 2026, 13)).toThrow(/Invalid partition month/);
    expect(() => formatPartitionName("audit_log", 2026, 3.5)).toThrow(/Invalid partition month/);
    expect(() => formatPartitionName("audit_log", 2026, -1)).toThrow(/Invalid partition month/);
  });
});

describe("parsePartitionDate", () => {
  it("parses a valid partition name with a single-digit month", () => {
    expect(parsePartitionDate("audit_log_2026_01")).toEqual({ year: 2026, month: 1 });
  });

  it("parses a valid partition name with a double-digit month", () => {
    expect(parsePartitionDate("fronting_sessions_2026_12")).toEqual({ year: 2026, month: 12 });
  });

  it("returns null for the default partition", () => {
    expect(parsePartitionDate("audit_log_default")).toBeNull();
  });

  it("returns null for a bare table name with no date suffix", () => {
    expect(parsePartitionDate("audit_log")).toBeNull();
    expect(parsePartitionDate("messages")).toBeNull();
  });

  it("is the inverse of formatPartitionName", () => {
    const cases: Array<[number, number]> = [
      [2026, 1],
      [2026, 6],
      [2027, 12],
    ];
    for (const table of ["messages", "audit_log", "fronting_sessions"] as const) {
      for (const [year, month] of cases) {
        const name = formatPartitionName(table, year, month);
        expect(parsePartitionDate(name)).toEqual({ year, month });
      }
    }
  });

  it("rejects SQL-injection shaped suffixes (defense-in-depth)", () => {
    // Moved from the integration test: parsePartitionDate is the single gate
    // between pg_inherits and sql.raw inside pgDetachOldPartitions. Any name
    // that cannot be decomposed into `<prefix>_YYYY_MM` must be skipped so
    // the downstream formatPartitionName call never produces a smuggled
    // identifier. Real pg_inherits cannot produce such a name (identifier
    // length limits, name-shape rules) — this is defense-in-depth.
    expect(parsePartitionDate(`audit_log_2020_03"; DROP TABLE audit_log --`)).toBeNull();
    expect(parsePartitionDate("audit_log_20200_3")).toBeNull();
    expect(parsePartitionDate("audit_log_2020_3")).toBeNull();
  });

  it("round-trips sanitized identifiers even when fed malicious pg_inherits rows", () => {
    // Simulates a pg_inherits stub returning a malicious partition_name.
    // parsePartitionDate is null, so pgDetachOldPartitions skips the row.
    // The only path from parse → format goes through numeric components.
    const smuggled = `audit_log_2020_03"; DROP TABLE x --`;
    expect(parsePartitionDate(smuggled)).toBeNull();
    expect(formatPartitionName("audit_log", 2020, 3)).toBe("audit_log_2020_03");
  });
});

describe("validateMonthsAhead", () => {
  it("accepts 0", () => {
    expect(() => {
      validateMonthsAhead(0);
    }).not.toThrow();
  });

  it("accepts positive values", () => {
    expect(() => {
      validateMonthsAhead(6);
    }).not.toThrow();
  });

  it("rejects negative values", () => {
    expect(() => {
      validateMonthsAhead(-1);
    }).toThrow(/non-negative finite/);
  });

  it("rejects NaN", () => {
    expect(() => {
      validateMonthsAhead(NaN);
    }).toThrow(/non-negative finite/);
  });

  it("rejects Infinity", () => {
    expect(() => {
      validateMonthsAhead(Infinity);
    }).toThrow(/non-negative finite/);
  });

  it("rejects -Infinity", () => {
    expect(() => {
      validateMonthsAhead(-Infinity);
    }).toThrow(/non-negative finite/);
  });
});

describe("validateOlderThanMonths", () => {
  it("accepts 1", () => {
    expect(() => {
      validateOlderThanMonths(1);
    }).not.toThrow();
  });

  it("accepts large values", () => {
    expect(() => {
      validateOlderThanMonths(24);
    }).not.toThrow();
  });

  it("rejects 0", () => {
    expect(() => {
      validateOlderThanMonths(0);
    }).toThrow(/>= 1/);
  });

  it("rejects negative values", () => {
    expect(() => {
      validateOlderThanMonths(-1);
    }).toThrow(/>= 1/);
  });

  it("rejects NaN", () => {
    expect(() => {
      validateOlderThanMonths(NaN);
    }).toThrow(/>= 1/);
  });

  it("rejects Infinity", () => {
    expect(() => {
      validateOlderThanMonths(Infinity);
    }).toThrow(/>= 1/);
  });

  it("rejects -Infinity", () => {
    expect(() => {
      validateOlderThanMonths(-Infinity);
    }).toThrow(/>= 1/);
  });
});

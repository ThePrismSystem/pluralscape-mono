import { describe, expect, it } from "vitest";

import {
  PARTITIONED_TABLES,
  formatPartitionName,
  parsePartitionDate,
} from "../queries/partition-maintenance.js";

describe("PARTITIONED_TABLES", () => {
  it("contains all expected tables", () => {
    expect(PARTITIONED_TABLES).toContain("messages");
    expect(PARTITIONED_TABLES).toContain("audit_log");
    expect(PARTITIONED_TABLES).toContain("fronting_sessions");
    expect(PARTITIONED_TABLES).toContain("switches");
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
    for (const table of ["messages", "audit_log", "fronting_sessions", "switches"]) {
      for (const [year, month] of cases) {
        const name = formatPartitionName(table, year, month);
        expect(parsePartitionDate(name)).toEqual({ year, month });
      }
    }
  });
});

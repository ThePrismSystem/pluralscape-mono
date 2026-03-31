import { describe, expect, it } from "vitest";

import { AuditLogQuerySchema } from "../audit-log-query.js";

// ── AuditLogQuerySchema ──────────────────────────────────────────────

describe("AuditLogQuerySchema", () => {
  it("applies default limit when no fields are provided", () => {
    const result = AuditLogQuerySchema.safeParse({});
    expect(result.success).toBe(true);
    if (result.success) {
      expect(result.data.limit).toBe(25);
    }
  });

  it("coerces string numbers for limit", () => {
    const result = AuditLogQuerySchema.safeParse({ limit: "50" });
    expect(result.success).toBe(true);
    if (result.success) {
      expect(result.data.limit).toBe(50);
    }
  });

  it("coerces string numbers for from", () => {
    const result = AuditLogQuerySchema.safeParse({ from: "1700000000000" });
    expect(result.success).toBe(true);
    if (result.success) {
      expect(result.data.from).toBe(1700000000000);
    }
  });

  it("coerces string numbers for to", () => {
    const result = AuditLogQuerySchema.safeParse({ to: "1700000001000" });
    expect(result.success).toBe(true);
    if (result.success) {
      expect(result.data.to).toBe(1700000001000);
    }
  });

  it("accepts limit at minimum boundary (1)", () => {
    const result = AuditLogQuerySchema.safeParse({ limit: 1 });
    expect(result.success).toBe(true);
    if (result.success) {
      expect(result.data.limit).toBe(1);
    }
  });

  it("accepts limit at maximum boundary (100)", () => {
    const result = AuditLogQuerySchema.safeParse({ limit: 100 });
    expect(result.success).toBe(true);
    if (result.success) {
      expect(result.data.limit).toBe(100);
    }
  });

  it("rejects limit below minimum (0)", () => {
    const result = AuditLogQuerySchema.safeParse({ limit: 0 });
    expect(result.success).toBe(false);
    if (!result.success) {
      const issue = result.error.issues[0];
      expect(issue).toBeDefined();
      expect(issue?.path).toEqual(["limit"]);
    }
  });

  it("rejects limit above maximum (101)", () => {
    const result = AuditLogQuerySchema.safeParse({ limit: 101 });
    expect(result.success).toBe(false);
    if (!result.success) {
      const issue = result.error.issues[0];
      expect(issue).toBeDefined();
      expect(issue?.path).toEqual(["limit"]);
    }
  });

  it("rejects non-integer limit", () => {
    const result = AuditLogQuerySchema.safeParse({ limit: 10.5 });
    expect(result.success).toBe(false);
    if (!result.success) {
      const issue = result.error.issues[0];
      expect(issue).toBeDefined();
      expect(issue?.path).toEqual(["limit"]);
    }
  });

  it("rejects negative from", () => {
    const result = AuditLogQuerySchema.safeParse({ from: -1 });
    expect(result.success).toBe(false);
    if (!result.success) {
      const issue = result.error.issues[0];
      expect(issue).toBeDefined();
      expect(issue?.path).toEqual(["from"]);
    }
  });

  it("rejects negative to", () => {
    const result = AuditLogQuerySchema.safeParse({ to: -1 });
    expect(result.success).toBe(false);
    if (!result.success) {
      const issue = result.error.issues[0];
      expect(issue).toBeDefined();
      expect(issue?.path).toEqual(["to"]);
    }
  });

  it("accepts from at boundary (0)", () => {
    const result = AuditLogQuerySchema.safeParse({ from: 0 });
    expect(result.success).toBe(true);
    if (result.success) {
      expect(result.data.from).toBe(0);
    }
  });

  it("accepts to at boundary (0)", () => {
    const result = AuditLogQuerySchema.safeParse({ to: 0 });
    expect(result.success).toBe(true);
    if (result.success) {
      expect(result.data.to).toBe(0);
    }
  });

  it("omits from when not provided", () => {
    const result = AuditLogQuerySchema.safeParse({});
    expect(result.success).toBe(true);
    if (result.success) {
      expect(result.data.from).toBeUndefined();
    }
  });

  it("omits to when not provided", () => {
    const result = AuditLogQuerySchema.safeParse({});
    expect(result.success).toBe(true);
    if (result.success) {
      expect(result.data.to).toBeUndefined();
    }
  });

  it("omits event_type when not provided", () => {
    const result = AuditLogQuerySchema.safeParse({});
    expect(result.success).toBe(true);
    if (result.success) {
      expect(result.data.event_type).toBeUndefined();
    }
  });

  it("omits cursor when not provided", () => {
    const result = AuditLogQuerySchema.safeParse({});
    expect(result.success).toBe(true);
    if (result.success) {
      expect(result.data.cursor).toBeUndefined();
    }
  });

  it("accepts event_type as a string", () => {
    const result = AuditLogQuerySchema.safeParse({
      event_type: "member.invited",
    });
    expect(result.success).toBe(true);
    if (result.success) {
      expect(result.data.event_type).toBe("member.invited");
    }
  });

  it("accepts cursor as a string", () => {
    const result = AuditLogQuerySchema.safeParse({
      cursor: "opaque-cursor-token",
    });
    expect(result.success).toBe(true);
    if (result.success) {
      expect(result.data.cursor).toBe("opaque-cursor-token");
    }
  });

  it("rejects event_type exceeding 256 characters", () => {
    const result = AuditLogQuerySchema.safeParse({ event_type: "a".repeat(257) });
    expect(result.success).toBe(false);
    if (!result.success) {
      expect(result.error.issues[0]?.path).toEqual(["event_type"]);
    }
  });

  it("accepts event_type at the 256 character boundary", () => {
    const result = AuditLogQuerySchema.safeParse({ event_type: "a".repeat(256) });
    expect(result.success).toBe(true);
  });

  it("rejects resource_type exceeding 256 characters", () => {
    const result = AuditLogQuerySchema.safeParse({ resource_type: "a".repeat(257) });
    expect(result.success).toBe(false);
    if (!result.success) {
      expect(result.error.issues[0]?.path).toEqual(["resource_type"]);
    }
  });

  it("accepts resource_type at the 256 character boundary", () => {
    const result = AuditLogQuerySchema.safeParse({ resource_type: "a".repeat(256) });
    expect(result.success).toBe(true);
  });

  it("rejects cursor exceeding 1024 characters", () => {
    const result = AuditLogQuerySchema.safeParse({ cursor: "a".repeat(1025) });
    expect(result.success).toBe(false);
    if (!result.success) {
      expect(result.error.issues[0]?.path).toEqual(["cursor"]);
    }
  });

  it("accepts cursor at the 1024 character boundary", () => {
    const result = AuditLogQuerySchema.safeParse({ cursor: "a".repeat(1024) });
    expect(result.success).toBe(true);
  });

  it("accepts all fields together", () => {
    const result = AuditLogQuerySchema.safeParse({
      event_type: "member.removed",
      from: "1700000000000",
      to: "1700000001000",
      cursor: "next-page-token",
      limit: "10",
    });
    expect(result.success).toBe(true);
    if (result.success) {
      expect(result.data).toEqual({
        event_type: "member.removed",
        from: 1700000000000,
        to: 1700000001000,
        cursor: "next-page-token",
        limit: 10,
      });
    }
  });
});

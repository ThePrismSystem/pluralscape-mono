import { describe, expect, it } from "vitest";

import {
  CheckInRecordQuerySchema,
  CreateCheckInRecordBodySchema,
  CreateTimerConfigBodySchema,
  RespondCheckInRecordBodySchema,
  TimerConfigQuerySchema,
  UpdateTimerConfigBodySchema,
} from "../timer.js";

describe("CreateTimerConfigBodySchema", () => {
  it("accepts valid payload with minimal fields", () => {
    const result = CreateTimerConfigBodySchema.safeParse({
      encryptedData: "dGVzdA==",
    });
    expect(result.success).toBe(true);
  });

  it("accepts payload with all optional fields", () => {
    const result = CreateTimerConfigBodySchema.safeParse({
      encryptedData: "dGVzdA==",
      enabled: true,
      intervalMinutes: 30,
      wakingHoursOnly: true,
      wakingStart: "08:00",
      wakingEnd: "22:00",
    });
    expect(result.success).toBe(true);
  });

  it("rejects when wakingHoursOnly=true without wakingStart/wakingEnd", () => {
    const result = CreateTimerConfigBodySchema.safeParse({
      encryptedData: "dGVzdA==",
      wakingHoursOnly: true,
    });
    expect(result.success).toBe(false);
  });

  it("rejects when wakingStart >= wakingEnd", () => {
    const result = CreateTimerConfigBodySchema.safeParse({
      encryptedData: "dGVzdA==",
      wakingHoursOnly: true,
      wakingStart: "22:00",
      wakingEnd: "08:00",
    });
    expect(result.success).toBe(false);
  });

  it("rejects invalid HH:MM format", () => {
    const result = CreateTimerConfigBodySchema.safeParse({
      encryptedData: "dGVzdA==",
      wakingHoursOnly: true,
      wakingStart: "8:00",
      wakingEnd: "22:00",
    });
    expect(result.success).toBe(false);
  });

  it("rejects intervalMinutes <= 0", () => {
    const result = CreateTimerConfigBodySchema.safeParse({
      encryptedData: "dGVzdA==",
      intervalMinutes: 0,
    });
    expect(result.success).toBe(false);
  });

  it("rejects non-integer intervalMinutes", () => {
    const result = CreateTimerConfigBodySchema.safeParse({
      encryptedData: "dGVzdA==",
      intervalMinutes: 1.5,
    });
    expect(result.success).toBe(false);
  });
});

describe("UpdateTimerConfigBodySchema", () => {
  it("accepts valid update payload", () => {
    const result = UpdateTimerConfigBodySchema.safeParse({
      encryptedData: "dGVzdA==",
      version: 1,
    });
    expect(result.success).toBe(true);
  });

  it("accepts nulling optional fields", () => {
    const result = UpdateTimerConfigBodySchema.safeParse({
      encryptedData: "dGVzdA==",
      version: 1,
      intervalMinutes: null,
      wakingStart: null,
      wakingEnd: null,
    });
    expect(result.success).toBe(true);
  });

  it("rejects version < 1", () => {
    const result = UpdateTimerConfigBodySchema.safeParse({
      encryptedData: "dGVzdA==",
      version: 0,
    });
    expect(result.success).toBe(false);
  });

  it("rejects when wakingHoursOnly=true but wakingStart is null", () => {
    const result = UpdateTimerConfigBodySchema.safeParse({
      encryptedData: "dGVzdA==",
      version: 1,
      wakingHoursOnly: true,
      wakingStart: null,
      wakingEnd: "22:00",
    });
    expect(result.success).toBe(false);
  });
});

describe("TimerConfigQuerySchema", () => {
  it("accepts empty query", () => {
    const result = TimerConfigQuerySchema.safeParse({});
    expect(result.success).toBe(true);
  });

  it("parses includeArchived boolean", () => {
    const result = TimerConfigQuerySchema.safeParse({ includeArchived: "true" });
    expect(result.success).toBe(true);
    if (result.success) {
      expect(result.data.includeArchived).toBe(true);
    }
  });
});

describe("CreateCheckInRecordBodySchema", () => {
  it("accepts valid payload", () => {
    const result = CreateCheckInRecordBodySchema.safeParse({
      timerConfigId: "tmr_550e8400-e29b-41d4-a716-446655440000",
      scheduledAt: 1000,
    });
    expect(result.success).toBe(true);
  });

  it("accepts payload with optional encryptedData", () => {
    const result = CreateCheckInRecordBodySchema.safeParse({
      timerConfigId: "tmr_550e8400-e29b-41d4-a716-446655440000",
      scheduledAt: 1000,
      encryptedData: "dGVzdA==",
    });
    expect(result.success).toBe(true);
  });

  it("rejects invalid timer config ID prefix", () => {
    const result = CreateCheckInRecordBodySchema.safeParse({
      timerConfigId: "invalid_id",
      scheduledAt: 1000,
    });
    expect(result.success).toBe(false);
  });

  it("rejects negative scheduledAt", () => {
    const result = CreateCheckInRecordBodySchema.safeParse({
      timerConfigId: "tmr_550e8400-e29b-41d4-a716-446655440000",
      scheduledAt: -1,
    });
    expect(result.success).toBe(false);
  });
});

describe("RespondCheckInRecordBodySchema", () => {
  it("accepts valid member ID", () => {
    const result = RespondCheckInRecordBodySchema.safeParse({
      respondedByMemberId: "mem_550e8400-e29b-41d4-a716-446655440000",
    });
    expect(result.success).toBe(true);
  });

  it("rejects invalid member ID prefix", () => {
    const result = RespondCheckInRecordBodySchema.safeParse({
      respondedByMemberId: "invalid_id",
    });
    expect(result.success).toBe(false);
  });
});

describe("CheckInRecordQuerySchema", () => {
  it("accepts empty query", () => {
    const result = CheckInRecordQuerySchema.safeParse({});
    expect(result.success).toBe(true);
  });

  it("parses pending boolean", () => {
    const result = CheckInRecordQuerySchema.safeParse({ pending: "true" });
    expect(result.success).toBe(true);
    if (result.success) {
      expect(result.data.pending).toBe(true);
    }
  });

  it("accepts timerConfigId filter", () => {
    const result = CheckInRecordQuerySchema.safeParse({
      timerConfigId: "tmr_550e8400-e29b-41d4-a716-446655440000",
    });
    expect(result.success).toBe(true);
  });
});

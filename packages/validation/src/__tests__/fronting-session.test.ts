import { describe, expect, it } from "vitest";

import {
  CreateFrontingSessionBodySchema,
  FrontingSessionEncryptedInputSchema,
  UpdateFrontingSessionBodySchema,
  EndFrontingSessionBodySchema,
  FrontingSessionQuerySchema,
} from "../fronting-session.js";

// ── helpers ──────────────────────────────────────────────────────────

/** A valid mem_ branded ID for testing. Each test uses a distinct UUID. */
const MEM_ID_1 = "mem_00000000-0000-0000-0000-000000000001";
const MEM_ID_2 = "mem_00000000-0000-0000-0000-000000000002";
const CF_ID_1 = "cf_00000000-0000-0000-0000-000000000001";
const STE_ID_1 = "ste_00000000-0000-0000-0000-000000000001";

// ── CreateFrontingSessionBodySchema ──────────────────────────────────

describe("CreateFrontingSessionBodySchema", () => {
  it("accepts valid input with memberId only", () => {
    const result = CreateFrontingSessionBodySchema.safeParse({
      encryptedData: "base64data",
      startTime: 1000,
      memberId: MEM_ID_1,
    });
    expect(result.success).toBe(true);
  });

  it("accepts valid input with customFrontId only", () => {
    const result = CreateFrontingSessionBodySchema.safeParse({
      encryptedData: "base64data",
      startTime: 0,
      customFrontId: CF_ID_1,
    });
    expect(result.success).toBe(true);
  });

  it("accepts valid input with structureEntityId only", () => {
    const result = CreateFrontingSessionBodySchema.safeParse({
      encryptedData: "base64data",
      startTime: 500,
      structureEntityId: STE_ID_1,
    });
    expect(result.success).toBe(true);
  });

  it("rejects when all three subjects are missing", () => {
    const result = CreateFrontingSessionBodySchema.safeParse({
      encryptedData: "base64data",
      startTime: 1000,
    });
    expect(result.success).toBe(false);
  });

  // ── Branded ID validation ──────────────────────────────────────

  it("accepts memberId with correct prefix", () => {
    const result = CreateFrontingSessionBodySchema.safeParse({
      encryptedData: "base64data",
      startTime: 1000,
      memberId: MEM_ID_2,
    });
    expect(result.success).toBe(true);
  });

  it("rejects memberId with wrong prefix", () => {
    const result = CreateFrontingSessionBodySchema.safeParse({
      encryptedData: "base64data",
      startTime: 1000,
      memberId: "cf_00000000-0000-0000-0000-000000000099",
    });
    expect(result.success).toBe(false);
  });

  it("rejects memberId with malformed UUID", () => {
    const result = CreateFrontingSessionBodySchema.safeParse({
      encryptedData: "base64data",
      startTime: 1000,
      memberId: "mem_not-a-valid-uuid",
    });
    expect(result.success).toBe(false);
  });

  it("rejects customFrontId with wrong prefix", () => {
    const result = CreateFrontingSessionBodySchema.safeParse({
      encryptedData: "base64data",
      startTime: 1000,
      customFrontId: "mem_00000000-0000-0000-0000-000000000099",
    });
    expect(result.success).toBe(false);
  });

  it("rejects structureEntityId with wrong prefix", () => {
    const result = CreateFrontingSessionBodySchema.safeParse({
      encryptedData: "base64data",
      startTime: 1000,
      structureEntityId: "mem_00000000-0000-0000-0000-000000000099",
    });
    expect(result.success).toBe(false);
  });

  // ── startTime validation ───────────────────────────────────────

  it("accepts startTime of 0", () => {
    const result = CreateFrontingSessionBodySchema.safeParse({
      encryptedData: "base64data",
      startTime: 0,
      memberId: MEM_ID_1,
    });
    expect(result.success).toBe(true);
  });

  it("rejects negative startTime", () => {
    const result = CreateFrontingSessionBodySchema.safeParse({
      encryptedData: "base64data",
      startTime: -1,
      memberId: MEM_ID_1,
    });
    expect(result.success).toBe(false);
  });

  it("rejects non-integer startTime", () => {
    const result = CreateFrontingSessionBodySchema.safeParse({
      encryptedData: "base64data",
      startTime: 1.5,
      memberId: MEM_ID_1,
    });
    expect(result.success).toBe(false);
  });

  it("rejects missing startTime", () => {
    const result = CreateFrontingSessionBodySchema.safeParse({
      encryptedData: "base64data",
      memberId: MEM_ID_1,
    });
    expect(result.success).toBe(false);
  });

  it("rejects missing encryptedData", () => {
    const result = CreateFrontingSessionBodySchema.safeParse({
      startTime: 1000,
      memberId: MEM_ID_1,
    });
    expect(result.success).toBe(false);
  });

  it("rejects empty encryptedData", () => {
    const result = CreateFrontingSessionBodySchema.safeParse({
      encryptedData: "",
      startTime: 1000,
      memberId: MEM_ID_1,
    });
    expect(result.success).toBe(false);
  });

  it("strips unknown properties", () => {
    const result = CreateFrontingSessionBodySchema.safeParse({
      encryptedData: "base64data",
      startTime: 1000,
      memberId: MEM_ID_1,
      admin: true,
    });
    expect(result.success).toBe(true);
    if (result.success) {
      expect("admin" in result.data).toBe(false);
    }
  });
});

// ── FrontingSessionEncryptedInputSchema ─────────────────────────────

describe("FrontingSessionEncryptedInputSchema", () => {
  const allNull = {
    comment: null,
    positionality: null,
    outtrigger: null,
    outtriggerSentiment: null,
  } as const;

  it("accepts all-null encrypted fields", () => {
    const result = FrontingSessionEncryptedInputSchema.safeParse(allNull);
    expect(result.success).toBe(true);
  });

  it("accepts non-empty comment", () => {
    const result = FrontingSessionEncryptedInputSchema.safeParse({
      ...allNull,
      comment: "feeling blurry",
    });
    expect(result.success).toBe(true);
  });

  it("accepts non-empty positionality", () => {
    const result = FrontingSessionEncryptedInputSchema.safeParse({
      ...allNull,
      positionality: "co-conscious",
    });
    expect(result.success).toBe(true);
  });

  it("accepts non-empty outtrigger", () => {
    const result = FrontingSessionEncryptedInputSchema.safeParse({
      ...allNull,
      outtrigger: "loud noise",
    });
    expect(result.success).toBe(true);
  });

  it("rejects empty-string comment when non-null", () => {
    const result = FrontingSessionEncryptedInputSchema.safeParse({
      ...allNull,
      comment: "",
    });
    expect(result.success).toBe(false);
  });

  // ── 50-char limit on comment (SP compatibility) ──────────────────

  it("accepts a 1-character comment (sanity)", () => {
    const result = FrontingSessionEncryptedInputSchema.safeParse({
      ...allNull,
      comment: "a",
    });
    expect(result.success).toBe(true);
  });

  it("accepts a comment of exactly 50 characters (boundary)", () => {
    const result = FrontingSessionEncryptedInputSchema.safeParse({
      ...allNull,
      comment: "a".repeat(50),
    });
    expect(result.success).toBe(true);
  });

  it("rejects a comment of 51 characters (just over the limit)", () => {
    const result = FrontingSessionEncryptedInputSchema.safeParse({
      ...allNull,
      comment: "a".repeat(51),
    });
    expect(result.success).toBe(false);
    if (!result.success) {
      const messages = result.error.issues.map((i) => i.message).join(" ");
      expect(messages).toContain("50 characters");
    }
  });

  it("accepts comment: null (limit only applies to non-null values)", () => {
    const result = FrontingSessionEncryptedInputSchema.safeParse({
      ...allNull,
      comment: null,
    });
    expect(result.success).toBe(true);
  });

  it("rejects empty-string positionality when non-null", () => {
    const result = FrontingSessionEncryptedInputSchema.safeParse({
      ...allNull,
      positionality: "",
    });
    expect(result.success).toBe(false);
  });

  it("rejects empty-string outtrigger when non-null", () => {
    const result = FrontingSessionEncryptedInputSchema.safeParse({
      ...allNull,
      outtrigger: "",
    });
    expect(result.success).toBe(false);
  });
});

// ── UpdateFrontingSessionBodySchema ──────────────────────────────────

describe("UpdateFrontingSessionBodySchema", () => {
  it("accepts valid input with version >= 1 and encryptedData", () => {
    const result = UpdateFrontingSessionBodySchema.safeParse({
      encryptedData: "updated-data",
      version: 1,
    });
    expect(result.success).toBe(true);
  });

  it("accepts version greater than 1", () => {
    const result = UpdateFrontingSessionBodySchema.safeParse({
      encryptedData: "updated-data",
      version: 42,
    });
    expect(result.success).toBe(true);
  });

  it("rejects version of 0", () => {
    const result = UpdateFrontingSessionBodySchema.safeParse({
      encryptedData: "updated-data",
      version: 0,
    });
    expect(result.success).toBe(false);
  });

  it("rejects negative version", () => {
    const result = UpdateFrontingSessionBodySchema.safeParse({
      encryptedData: "updated-data",
      version: -1,
    });
    expect(result.success).toBe(false);
  });

  it("rejects missing encryptedData", () => {
    const result = UpdateFrontingSessionBodySchema.safeParse({
      version: 1,
    });
    expect(result.success).toBe(false);
  });

  it("rejects missing version", () => {
    const result = UpdateFrontingSessionBodySchema.safeParse({
      encryptedData: "updated-data",
    });
    expect(result.success).toBe(false);
  });
});

// ── EndFrontingSessionBodySchema ──────────────────────────────────────

describe("EndFrontingSessionBodySchema", () => {
  it("accepts valid input with endTime >= 0 and version >= 1", () => {
    const result = EndFrontingSessionBodySchema.safeParse({
      endTime: 2000,
      version: 1,
    });
    expect(result.success).toBe(true);
  });

  it("accepts endTime of 0", () => {
    const result = EndFrontingSessionBodySchema.safeParse({
      endTime: 0,
      version: 1,
    });
    expect(result.success).toBe(true);
  });

  it("rejects negative endTime", () => {
    const result = EndFrontingSessionBodySchema.safeParse({
      endTime: -1,
      version: 1,
    });
    expect(result.success).toBe(false);
  });

  it("rejects non-integer endTime", () => {
    const result = EndFrontingSessionBodySchema.safeParse({
      endTime: 1.5,
      version: 1,
    });
    expect(result.success).toBe(false);
  });

  it("rejects version of 0", () => {
    const result = EndFrontingSessionBodySchema.safeParse({
      endTime: 2000,
      version: 0,
    });
    expect(result.success).toBe(false);
  });

  it("rejects missing endTime", () => {
    const result = EndFrontingSessionBodySchema.safeParse({
      version: 1,
    });
    expect(result.success).toBe(false);
  });

  it("rejects missing version", () => {
    const result = EndFrontingSessionBodySchema.safeParse({
      endTime: 2000,
    });
    expect(result.success).toBe(false);
  });
});

// ── FrontingSessionQuerySchema ──────────────────────────────────────

describe("FrontingSessionQuerySchema", () => {
  it("accepts empty query (all optional)", () => {
    const result = FrontingSessionQuerySchema.safeParse({});
    expect(result.success).toBe(true);
  });

  // ── string-to-number transforms ──────────────────────────────

  it("transforms startFrom from string to number", () => {
    const result = FrontingSessionQuerySchema.safeParse({
      startFrom: "1000",
    });
    expect(result.success).toBe(true);
    if (result.success) {
      expect(result.data.startFrom).toBe(1000);
    }
  });

  it("transforms startUntil from string to number", () => {
    const result = FrontingSessionQuerySchema.safeParse({
      startUntil: "5000",
    });
    expect(result.success).toBe(true);
    if (result.success) {
      expect(result.data.startUntil).toBe(5000);
    }
  });

  it("rejects startFrom with non-numeric string", () => {
    const result = FrontingSessionQuerySchema.safeParse({
      startFrom: "not-a-number",
    });
    expect(result.success).toBe(false);
  });

  it("rejects startFrom with negative value", () => {
    const result = FrontingSessionQuerySchema.safeParse({
      startFrom: "-1",
    });
    expect(result.success).toBe(false);
  });

  it("rejects startFrom with decimal value", () => {
    const result = FrontingSessionQuerySchema.safeParse({
      startFrom: "1.5",
    });
    expect(result.success).toBe(false);
  });

  // ── endFrom / endUntil transforms ────────────────────────────

  it("transforms endFrom from string to number", () => {
    const result = FrontingSessionQuerySchema.safeParse({
      endFrom: "1000",
    });
    expect(result.success).toBe(true);
    if (result.success) {
      expect(result.data.endFrom).toBe(1000);
    }
  });

  it("transforms endUntil from string to number", () => {
    const result = FrontingSessionQuerySchema.safeParse({
      endUntil: "5000",
    });
    expect(result.success).toBe(true);
    if (result.success) {
      expect(result.data.endUntil).toBe(5000);
    }
  });

  it("rejects endFrom with non-numeric string", () => {
    const result = FrontingSessionQuerySchema.safeParse({
      endFrom: "not-a-number",
    });
    expect(result.success).toBe(false);
  });

  it("rejects endFrom with negative value", () => {
    const result = FrontingSessionQuerySchema.safeParse({
      endFrom: "-1",
    });
    expect(result.success).toBe(false);
  });

  it("rejects endUntil with decimal value", () => {
    const result = FrontingSessionQuerySchema.safeParse({
      endUntil: "1.5",
    });
    expect(result.success).toBe(false);
  });

  // ── boolean coercion ─────────────────────────────────────────

  it("coerces activeOnly 'true' to boolean true", () => {
    const result = FrontingSessionQuerySchema.safeParse({
      activeOnly: "true",
    });
    expect(result.success).toBe(true);
    if (result.success) {
      expect(result.data.activeOnly).toBe(true);
    }
  });

  it("coerces activeOnly 'false' to boolean false", () => {
    const result = FrontingSessionQuerySchema.safeParse({
      activeOnly: "false",
    });
    expect(result.success).toBe(true);
    if (result.success) {
      expect(result.data.activeOnly).toBe(false);
    }
  });

  it("defaults activeOnly to false when omitted", () => {
    const result = FrontingSessionQuerySchema.safeParse({});
    expect(result.success).toBe(true);
    if (result.success) {
      expect(result.data.activeOnly).toBe(false);
    }
  });

  it("coerces includeArchived 'true' to boolean true", () => {
    const result = FrontingSessionQuerySchema.safeParse({
      includeArchived: "true",
    });
    expect(result.success).toBe(true);
    if (result.success) {
      expect(result.data.includeArchived).toBe(true);
    }
  });

  it("defaults includeArchived to false when omitted", () => {
    const result = FrontingSessionQuerySchema.safeParse({});
    expect(result.success).toBe(true);
    if (result.success) {
      expect(result.data.includeArchived).toBe(false);
    }
  });

  // ── branded ID validation for filter params ───────────────────

  it("accepts valid memberId filter", () => {
    const result = FrontingSessionQuerySchema.safeParse({
      memberId: MEM_ID_1,
    });
    expect(result.success).toBe(true);
  });

  it("rejects memberId filter with wrong prefix", () => {
    const result = FrontingSessionQuerySchema.safeParse({
      memberId: "cf_00000000-0000-0000-0000-000000000099",
    });
    expect(result.success).toBe(false);
  });

  it("accepts valid customFrontId filter", () => {
    const result = FrontingSessionQuerySchema.safeParse({
      customFrontId: CF_ID_1,
    });
    expect(result.success).toBe(true);
  });

  it("rejects customFrontId filter with wrong prefix", () => {
    const result = FrontingSessionQuerySchema.safeParse({
      customFrontId: "ste_00000000-0000-0000-0000-000000000099",
    });
    expect(result.success).toBe(false);
  });

  it("accepts valid structureEntityId filter", () => {
    const result = FrontingSessionQuerySchema.safeParse({
      structureEntityId: STE_ID_1,
    });
    expect(result.success).toBe(true);
  });

  it("rejects structureEntityId filter with wrong prefix", () => {
    const result = FrontingSessionQuerySchema.safeParse({
      structureEntityId: "mem_00000000-0000-0000-0000-000000000099",
    });
    expect(result.success).toBe(false);
  });
});

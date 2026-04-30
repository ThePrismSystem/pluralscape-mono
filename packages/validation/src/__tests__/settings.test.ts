import { describe, expect, it } from "vitest";

import { RemovePinBodySchema, SetPinBodySchema, VerifyPinBodySchema } from "../settings.js";

const SCHEMAS = [
  ["SetPinBodySchema", SetPinBodySchema],
  ["RemovePinBodySchema", RemovePinBodySchema],
  ["VerifyPinBodySchema", VerifyPinBodySchema],
] as const;

for (const [name, schema] of SCHEMAS) {
  describe(name, () => {
    it("accepts a 4-digit PIN", () => {
      expect(schema.safeParse({ pin: "1234" }).success).toBe(true);
    });

    it("accepts a 6-digit PIN", () => {
      expect(schema.safeParse({ pin: "123456" }).success).toBe(true);
    });

    it("rejects a 3-digit PIN (too short)", () => {
      expect(schema.safeParse({ pin: "123" }).success).toBe(false);
    });

    it("rejects a 7-digit PIN (too long)", () => {
      expect(schema.safeParse({ pin: "1234567" }).success).toBe(false);
    });

    it("rejects non-digit characters", () => {
      expect(schema.safeParse({ pin: "abcd" }).success).toBe(false);
    });

    it("rejects digits with whitespace", () => {
      expect(schema.safeParse({ pin: "12 34" }).success).toBe(false);
    });

    it("rejects digits with hyphen", () => {
      expect(schema.safeParse({ pin: "12-34" }).success).toBe(false);
    });

    it("rejects empty string", () => {
      expect(schema.safeParse({ pin: "" }).success).toBe(false);
    });

    it("rejects missing pin field", () => {
      expect(schema.safeParse({}).success).toBe(false);
    });

    it("rejects non-string pin", () => {
      expect(schema.safeParse({ pin: 1234 }).success).toBe(false);
    });
  });
}

import { describe, expect, it } from "vitest";

import { BiometricEnrollBodySchema, BiometricVerifyBodySchema } from "../settings.js";
import { MAX_BIOMETRIC_TOKEN_LENGTH } from "../validation.constants.js";

const SCHEMAS = [
  ["BiometricEnrollBodySchema", BiometricEnrollBodySchema],
  ["BiometricVerifyBodySchema", BiometricVerifyBodySchema],
] as const;

for (const [name, schema] of SCHEMAS) {
  describe(name, () => {
    it("accepts a token at the lower bound (1 byte)", () => {
      expect(schema.safeParse({ token: "x" }).success).toBe(true);
    });

    it("accepts a typical-length token", () => {
      expect(schema.safeParse({ token: "a".repeat(64) }).success).toBe(true);
    });

    it("accepts a token at the maximum length", () => {
      expect(schema.safeParse({ token: "a".repeat(MAX_BIOMETRIC_TOKEN_LENGTH) }).success).toBe(
        true,
      );
    });

    it("rejects an empty token", () => {
      expect(schema.safeParse({ token: "" }).success).toBe(false);
    });

    it("rejects a token over the maximum length", () => {
      expect(schema.safeParse({ token: "a".repeat(MAX_BIOMETRIC_TOKEN_LENGTH + 1) }).success).toBe(
        false,
      );
    });

    it("rejects missing token field", () => {
      expect(schema.safeParse({}).success).toBe(false);
    });

    it("rejects non-string token", () => {
      expect(schema.safeParse({ token: 1234 }).success).toBe(false);
    });
  });
}

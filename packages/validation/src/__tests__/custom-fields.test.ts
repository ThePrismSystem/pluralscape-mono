import { describe, expect, it } from "vitest";

import { FieldDefinitionEncryptedInputSchema } from "../custom-fields.js";

// ── FieldDefinitionEncryptedInputSchema ─────────────────────────

describe("FieldDefinitionEncryptedInputSchema", () => {
  it("accepts a non-empty name with null description and options", () => {
    const result = FieldDefinitionEncryptedInputSchema.safeParse({
      name: "Likes",
      description: null,
      options: null,
    });
    expect(result.success).toBe(true);
  });

  it("rejects empty name", () => {
    // The FieldDefinitionLabel brand requires a non-empty string. The SP
    // import boundary now guards this, but the schema must also reject it
    // independently to catch future callers that bypass the boundary.
    const result = FieldDefinitionEncryptedInputSchema.safeParse({
      name: "",
      description: null,
      options: null,
    });
    expect(result.success).toBe(false);
  });

  it("accepts a list of option strings", () => {
    const result = FieldDefinitionEncryptedInputSchema.safeParse({
      name: "Role",
      description: "Member role",
      options: ["lead", "support"],
    });
    expect(result.success).toBe(true);
  });
});

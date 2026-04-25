import { describe, expect, expectTypeOf, it } from "vitest";

import {
  CreateFieldDefinitionBodySchema,
  SetFieldValueBodySchema,
  UpdateFieldDefinitionBodySchema,
  UpdateFieldValueBodySchema,
} from "../custom-fields.js";

import type { Equal, FieldType } from "@pluralscape/types";
import type { z } from "zod/v4";

describe("CreateFieldDefinitionBodySchema", () => {
  it("infers the documented body shape", () => {
    expectTypeOf<
      Equal<
        z.infer<typeof CreateFieldDefinitionBodySchema>,
        {
          fieldType: FieldType;
          required: boolean;
          sortOrder: number;
          encryptedData: string;
        }
      >
    >().toEqualTypeOf<true>();
  });

  it("parses valid input", () => {
    const result = CreateFieldDefinitionBodySchema.safeParse({
      fieldType: "text",
      encryptedData: "dGVzdA==",
    });
    expect(result.success).toBe(true);
    if (result.success) {
      expect(result.data.required).toBe(false);
      expect(result.data.sortOrder).toBe(0);
    }
  });

  it("accepts all field types", () => {
    for (const ft of [
      "text",
      "number",
      "boolean",
      "date",
      "color",
      "select",
      "multi-select",
      "url",
    ]) {
      const result = CreateFieldDefinitionBodySchema.safeParse({
        fieldType: ft,
        encryptedData: "dGVzdA==",
      });
      expect(result.success).toBe(true);
    }
  });

  it("rejects invalid field type", () => {
    const result = CreateFieldDefinitionBodySchema.safeParse({
      fieldType: "invalid",
      encryptedData: "dGVzdA==",
    });
    expect(result.success).toBe(false);
  });

  it("rejects missing encryptedData", () => {
    const result = CreateFieldDefinitionBodySchema.safeParse({ fieldType: "text" });
    expect(result.success).toBe(false);
  });

  it("rejects missing fieldType", () => {
    const result = CreateFieldDefinitionBodySchema.safeParse({ encryptedData: "dGVzdA==" });
    expect(result.success).toBe(false);
  });

  it("strips unknown properties", () => {
    const result = CreateFieldDefinitionBodySchema.safeParse({
      fieldType: "text",
      encryptedData: "dGVzdA==",
      admin: true,
    });
    expect(result.success).toBe(true);
    if (result.success) {
      expect("admin" in result.data).toBe(false);
    }
  });
});

describe("UpdateFieldDefinitionBodySchema", () => {
  it("infers the documented body shape", () => {
    expectTypeOf<
      Equal<
        z.infer<typeof UpdateFieldDefinitionBodySchema>,
        {
          required?: boolean;
          sortOrder?: number;
          encryptedData: string;
          version: number;
        }
      >
    >().toEqualTypeOf<true>();
  });

  it("parses valid input", () => {
    const result = UpdateFieldDefinitionBodySchema.safeParse({
      encryptedData: "dGVzdA==",
      version: 1,
    });
    expect(result.success).toBe(true);
  });

  it("accepts optional required and sortOrder", () => {
    const result = UpdateFieldDefinitionBodySchema.safeParse({
      encryptedData: "dGVzdA==",
      version: 1,
      required: true,
      sortOrder: 5,
    });
    expect(result.success).toBe(true);
    if (result.success) {
      expect(result.data.required).toBe(true);
      expect(result.data.sortOrder).toBe(5);
    }
  });

  it("rejects missing version", () => {
    const result = UpdateFieldDefinitionBodySchema.safeParse({ encryptedData: "dGVzdA==" });
    expect(result.success).toBe(false);
  });
});

describe("SetFieldValueBodySchema", () => {
  it("infers the documented body shape", () => {
    expectTypeOf<
      Equal<z.infer<typeof SetFieldValueBodySchema>, { encryptedData: string }>
    >().toEqualTypeOf<true>();
  });

  it("parses valid input", () => {
    const result = SetFieldValueBodySchema.safeParse({ encryptedData: "dGVzdA==" });
    expect(result.success).toBe(true);
  });

  it("rejects empty encryptedData", () => {
    const result = SetFieldValueBodySchema.safeParse({ encryptedData: "" });
    expect(result.success).toBe(false);
  });
});

describe("UpdateFieldValueBodySchema", () => {
  it("infers the documented body shape", () => {
    expectTypeOf<
      Equal<z.infer<typeof UpdateFieldValueBodySchema>, { encryptedData: string; version: number }>
    >().toEqualTypeOf<true>();
  });

  it("parses valid input", () => {
    const result = UpdateFieldValueBodySchema.safeParse({ encryptedData: "dGVzdA==", version: 1 });
    expect(result.success).toBe(true);
  });

  it("rejects missing version", () => {
    const result = UpdateFieldValueBodySchema.safeParse({ encryptedData: "dGVzdA==" });
    expect(result.success).toBe(false);
  });
});

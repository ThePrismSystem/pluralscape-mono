import { RuleTester } from "eslint";
import { describe, it } from "vitest";

import rule from "./no-params-unknown.js";

const ruleTester = new RuleTester({
  languageOptions: {
    parser: await import("@typescript-eslint/parser"),
  },
});

describe("no-params-unknown", () => {
  it("passes valid signatures and rejects params: unknown / parseAndValidateBlob imports", () => {
    ruleTester.run("no-params-unknown", rule, {
      valid: [
        { code: "export async function f(body: { name: string }) {}" },
        { code: "export async function f(memberId: string) {}" },
        { code: "export async function f(params: { name: string }) {}" },
        { code: "import { validateEncryptedBlob } from './encrypted-blob.js';" },
        // Other modules with `encrypted-blob` in their path don't trigger
        // unless they import parseAndValidateBlob:
        { code: "import { foo } from './lib/unencrypted-blob.js';" },
      ],
      invalid: [
        {
          code: "export async function f(params: unknown) {}",
          errors: [{ messageId: "paramsUnknown" }],
        },
        {
          code: "const f = (params: unknown) => {}",
          errors: [{ messageId: "paramsUnknown" }],
        },
        {
          code: "interface S { create(params: unknown): Promise<void>; }",
          errors: [{ messageId: "paramsUnknown" }],
        },
        {
          code: "interface S { readonly create: (params: unknown) => Promise<void>; }",
          errors: [{ messageId: "paramsUnknown" }],
        },
        {
          code: "import { parseAndValidateBlob } from './lib/encrypted-blob.js';",
          errors: [{ messageId: "parseAndValidateBlobImport" }],
        },
      ],
    });
  });
});

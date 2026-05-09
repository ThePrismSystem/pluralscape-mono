import { RuleTester } from "eslint";
import { describe, it } from "vitest";

import rule from "./no-local-encrypted-fields.js";

const ruleTester = new RuleTester({
  languageOptions: { parser: await import("@typescript-eslint/parser") },
});

describe("no-local-encrypted-fields", () => {
  it("forbids local Raw / EncryptedFields / EncryptedInput types in transforms and sync", () => {
    ruleTester.run("no-local-encrypted-fields", rule, {
      valid: [
        {
          code: "import { MemberEncryptedInput } from '@pluralscape/types';",
          filename: "packages/data/src/transforms/member.ts",
        },
        {
          code: "interface MemberRaw { encryptedData: string }",
          filename: "apps/api/src/services/member/create.ts",
        },
      ],
      invalid: [
        {
          code: "interface MemberRaw { encryptedData: string }",
          filename: "packages/data/src/transforms/member.ts",
          errors: [{ messageId: "noLocal" }],
        },
        {
          code: "type MemberEncryptedFields = 'displayName' | 'pronouns';",
          filename: "packages/data/src/transforms/member.ts",
          errors: [{ messageId: "noLocal" }],
        },
        {
          code: "type GroupEncryptedInput = { name: string };",
          filename: "packages/sync/src/materializer/group.ts",
          errors: [{ messageId: "noLocal" }],
        },
      ],
    });
  });
});

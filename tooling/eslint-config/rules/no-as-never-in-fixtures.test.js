import { RuleTester } from "eslint";
import { describe, it } from "vitest";

import rule from "./no-as-never-in-fixtures.js";

const ruleTester = new RuleTester({
  languageOptions: { parser: await import("@typescript-eslint/parser") },
});

describe("no-as-never-in-fixtures", () => {
  it("forbids `as never` casts", () => {
    ruleTester.run("no-as-never-in-fixtures", rule, {
      valid: [
        {
          code: "const id = 'mem_1' as MemberId;",
          filename: "apps/api/src/routes/member.test.ts",
        },
      ],
      invalid: [
        {
          code: "const id = 'mem_1' as never;",
          filename: "apps/api/src/routes/member.test.ts",
          errors: [{ messageId: "noAsNever" }],
        },
        {
          code: "const m = { id: 'mem_1' as never };",
          filename: "packages/types/src/__tests__/member.type.test.ts",
          errors: [{ messageId: "noAsNever" }],
        },
      ],
    });
  });
});

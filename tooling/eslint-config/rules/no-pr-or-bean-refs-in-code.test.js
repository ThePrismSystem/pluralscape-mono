import { RuleTester } from "eslint";
import { describe, it } from "vitest";

import rule from "./no-pr-or-bean-refs-in-code.js";

const ruleTester = new RuleTester({
  languageOptions: { parser: await import("@typescript-eslint/parser") },
});

describe("no-pr-or-bean-refs-in-code", () => {
  it("forbids PR/bean references in source code and comments", () => {
    ruleTester.run("no-pr-or-bean-refs-in-code", rule, {
      valid: [
        { code: "// see Member.create" },
        { code: "/** Reference: ADR-023 */" },
        { code: "const x = 'PR review';" },
        { code: "// types-related work" },
        { code: "const url = `/v1/systems/${id}/api-keys`;" },
        { code: "const project = 'api-slow';" },
        { code: "// client-side crypto, mobile-side cache" },
        { code: "// sync-push and sync-pull over the crypto-keys path" },
        { code: "// crypto-test helpers, api-core, api-bulk" },
      ],
      invalid: [
        {
          code: "// added for PR #123",
          errors: [{ messageId: "noRef" }],
        },
        {
          code: "/** see ps-h9cc */",
          errors: [{ messageId: "noRef" }],
        },
        {
          code: "const note = 'fixes PR 234';",
          errors: [{ messageId: "noRef" }],
        },
        {
          code: "// types-emid spec follow-up",
          errors: [{ messageId: "noRef" }],
        },
        {
          code: "const url = '/v1/api-keyz';",
          errors: [{ messageId: "noRef" }],
        },
        {
          code: "// see client-a0gf",
          errors: [{ messageId: "noRef" }],
        },
      ],
    });
  });
});

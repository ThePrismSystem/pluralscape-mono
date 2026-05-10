import { RuleTester } from "eslint";
import { describe, it } from "vitest";

import rule from "./no-services-barrel.js";

const ruleTester = new RuleTester({
  languageOptions: {
    parser: await import("@typescript-eslint/parser"),
  },
});

describe("no-services-barrel", () => {
  it("reports an index.ts in apps/api/src/services/<domain>/", () => {
    ruleTester.run("no-services-barrel", rule, {
      valid: [
        { code: "export const x = 1;", filename: "apps/api/src/services/member/create.ts" },
        { code: "export const x = 1;", filename: "apps/api/src/services/index.ts" },
        { code: "export const x = 1;", filename: "apps/api/src/routes/index.ts" },
      ],
      invalid: [
        {
          code: "export * from './create.js';",
          filename: "apps/api/src/services/member/index.ts",
          errors: [{ messageId: "noBarrel" }],
        },
        {
          code: "export * from './create.js';",
          filename: "apps/api/src/services/group/sub/index.ts",
          errors: [{ messageId: "noBarrel" }],
        },
      ],
    });
  });
});

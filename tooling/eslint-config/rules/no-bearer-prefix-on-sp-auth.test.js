import { RuleTester } from "eslint";
import { describe, it } from "vitest";

import rule from "./no-bearer-prefix-on-sp-auth.js";

const ruleTester = new RuleTester({
  languageOptions: {
    parser: await import("@typescript-eslint/parser"),
  },
});

describe("no-bearer-prefix-on-sp-auth", () => {
  it("reports Bearer-prefixed Authorization values in import-sp", () => {
    ruleTester.run("no-bearer-prefix-on-sp-auth", rule, {
      valid: [
        {
          code: "const headers = { Authorization: token };",
          filename: "packages/import-sp/src/api/client.ts",
        },
        {
          code: "const headers = { Authorization: `Bearer ${token}` };",
          filename: "packages/import-pk/src/api/client.ts",
        },
        {
          code: "const msg = 'Bearer token expired';",
          filename: "packages/import-sp/src/api/errors.ts",
        },
      ],
      invalid: [
        {
          code: "const headers = { Authorization: `Bearer ${token}` };",
          filename: "packages/import-sp/src/api/client.ts",
          errors: [{ messageId: "noBearer" }],
        },
        {
          code: 'const headers = { Authorization: "Bearer " + apiKey };',
          filename: "packages/import-sp/src/api/client.ts",
          errors: [{ messageId: "noBearer" }],
        },
      ],
    });
  });
});

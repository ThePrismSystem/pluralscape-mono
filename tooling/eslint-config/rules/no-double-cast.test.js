import { RuleTester } from "eslint";
import { describe, it } from "vitest";

import rule from "./no-double-cast.js";

const ruleTester = new RuleTester({
  languageOptions: { parser: await import("@typescript-eslint/parser") },
});

describe("no-double-cast", () => {
  it("forbids `as ... as ...` chains", () => {
    ruleTester.run("no-double-cast", rule, {
      valid: [
        { code: "const x = foo as Bar;" },
        { code: "const x = foo as unknown;" },
        { code: "const x = (foo as Bar).baz;" },
      ],
      invalid: [
        {
          code: "const x = foo as unknown as Bar;",
          errors: [{ messageId: "noDoubleCast" }],
        },
        {
          code: "const x = foo as never as Bar;",
          errors: [{ messageId: "noDoubleCast" }],
        },
      ],
    });
  });
});

import { RuleTester } from "eslint";
import { describe, it } from "vitest";

import rule from "./no-deep-types-imports.js";

const ruleTester = new RuleTester({
  languageOptions: { parser: await import("@typescript-eslint/parser") },
});

describe("no-deep-types-imports", () => {
  it("forbids deep imports from @pluralscape/types not in the package exports map", () => {
    ruleTester.run("no-deep-types-imports", rule, {
      valid: [
        { code: "import { Member } from '@pluralscape/types';" },
        { code: "import { now, createId } from '@pluralscape/types/runtime';" },
        { code: "import type { KdfMasterKey } from '@pluralscape/types/crypto-keys';" },
      ],
      invalid: [
        {
          code: "import { Member } from '@pluralscape/types/entities/member';",
          errors: [{ messageId: "noDeepImport" }],
        },
        {
          code: "import type { Member } from '@pluralscape/types/entities/member.js';",
          errors: [{ messageId: "noDeepImport" }],
        },
      ],
    });
  });
});

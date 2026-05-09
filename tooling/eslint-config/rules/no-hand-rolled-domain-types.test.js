import { RuleTester } from "eslint";
import { describe, it } from "vitest";

import rule from "./no-hand-rolled-domain-types.js";

const ruleTester = new RuleTester({
  languageOptions: { parser: await import("@typescript-eslint/parser") },
});

describe("no-hand-rolled-domain-types", () => {
  it("reports hand-rolled entity-shape types matching manifest entities", () => {
    ruleTester.run("no-hand-rolled-domain-types", rule, {
      valid: [
        {
          code: "import { Member } from '@pluralscape/types';",
          options: [{ manifestEntities: ["Member"] }],
          filename: "apps/api/src/routes/member.ts",
        },
        {
          // Inside packages/types — exempt
          code: "interface MemberBody { name: string }",
          options: [{ manifestEntities: ["Member"] }],
          filename: "packages/types/src/entities/member.ts",
        },
        {
          // Suffix doesn't match the forbidden set
          code: "interface MemberHelper { x: number }",
          options: [{ manifestEntities: ["Member"] }],
          filename: "apps/api/src/services/member/create.ts",
        },
        {
          // Entity not in manifest — rule shouldn't fire
          code: "interface FooBody { x: number }",
          options: [{ manifestEntities: ["Member"] }],
          filename: "apps/api/src/services/foo/create.ts",
        },
      ],
      invalid: [
        {
          code: "interface MemberBody { name: string }",
          options: [{ manifestEntities: ["Member"] }],
          filename: "apps/api/src/services/member/create.ts",
          errors: [{ messageId: "noHandRolled" }],
        },
        {
          code: "type MemberWire = Serialize<Member>;",
          options: [{ manifestEntities: ["Member"] }],
          filename: "apps/mobile/app/(tabs)/members.tsx",
          errors: [{ messageId: "noHandRolled" }],
        },
        {
          code: "type GroupInput = { name: string };",
          options: [{ manifestEntities: ["Group"] }],
          filename: "apps/api/src/services/group/create.ts",
          errors: [{ messageId: "noHandRolled" }],
        },
      ],
    });
  });
});

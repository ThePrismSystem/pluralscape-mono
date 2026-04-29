import { RuleTester } from "eslint";
import { describe, it } from "vitest";

import rule from "./no-hand-rolled-request-types.js";

// RuleTester.run() throws on failure — vitest catches the throw and fails the test.
const ruleTester = new RuleTester({
  languageOptions: {
    parser: await import("@typescript-eslint/parser"),
  },
});

describe("no-hand-rolled-request-types", () => {
  it("passes valid types and rejects hand-rolled request types", () => {
    ruleTester.run("no-hand-rolled-request-types", rule, {
      valid: [
        { code: "export interface Member { id: string; }" },
        { code: "export type MemberWire = Serialize<MemberServerMetadata>;" },
        { code: "export type MemberEncryptedFields = 'name' | 'pronouns';" },
        { code: "export type MemberEncryptedInput = Pick<Member, MemberEncryptedFields>;" },
        { code: "export interface DeviceInfo { platform: string; }" }, // whitelist
        // Allow-listed soft-mode exceptions (Task 21 will remove these):
        { code: "export interface LoginCredentials { email: string; }" },
        { code: "export interface RegistrationInitiateInput { email: string; }" },
        { code: "export interface RegistrationCommitInput { token: string; }" },
      ],
      invalid: [
        {
          code: "export interface CreateMemberBody { name: string; }",
          errors: [{ messageId: "rejectedSuffix" }],
        },
        {
          code: "export interface SystemCredentials { email: string; }",
          errors: [{ messageId: "rejectedSuffix" }],
        },
        {
          code: "export interface MemberInput { name: string; }",
          errors: [{ messageId: "rejectedSuffix" }],
        },
      ],
    });
  });
});

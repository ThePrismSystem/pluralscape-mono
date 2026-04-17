import { describe, it, expectTypeOf } from "vitest";

import type { EmailTemplateName, JobDefinition, JobPayloadMap } from "../jobs.js";

describe("JobDefinition correlated union", () => {
  it("narrows payload based on type (email-send)", () => {
    expectTypeOf<JobDefinition<"email-send">["type"]>().toEqualTypeOf<"email-send">();
    expectTypeOf<
      JobDefinition<"email-send">["payload"]["template"]
    >().toEqualTypeOf<EmailTemplateName>();
    expectTypeOf<JobDefinition<"email-send">["payload"]["recipientOverride"]>().toEqualTypeOf<
      string | null
    >();
  });

  it("narrows payload based on type (notification-send)", () => {
    expectTypeOf<JobDefinition<"notification-send">["type"]>().toEqualTypeOf<"notification-send">();
    expectTypeOf<JobDefinition<"notification-send">["payload"]["accountId"]>().toBeString();
  });

  it("ungeneric JobDefinition is the distributive union", () => {
    // When narrowed by `type === "email-send"`, payload resolves to the exact
    // email-send payload shape — proves the union is correlated, not a cross product.
    type EmailJob = Extract<JobDefinition, { readonly type: "email-send" }>;
    expectTypeOf<EmailJob["payload"]>().toEqualTypeOf<Readonly<JobPayloadMap["email-send"]>>();
  });
});

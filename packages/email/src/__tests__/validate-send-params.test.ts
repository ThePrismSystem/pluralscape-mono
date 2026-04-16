import { describe, expect, it } from "vitest";

import { MAX_RECIPIENTS, MAX_SUBJECT_LENGTH, validateSendParams } from "../email.constants.js";
import { EmailValidationError } from "../errors.js";

describe("validateSendParams", () => {
  it("passes with a single recipient and valid subject", () => {
    expect(() => {
      validateSendParams({ to: "a@example.com", subject: "Hello" });
    }).not.toThrow();
  });

  it("passes with MAX_RECIPIENTS recipients", () => {
    const recipients = Array.from(
      { length: MAX_RECIPIENTS },
      (_, i) => `user${String(i)}@example.com`,
    );
    expect(() => {
      validateSendParams({ to: recipients, subject: "Hello" });
    }).not.toThrow();
  });

  it("throws EmailValidationError when recipients exceed MAX_RECIPIENTS", () => {
    const recipients = Array.from(
      { length: MAX_RECIPIENTS + 1 },
      (_, i) => `user${String(i)}@example.com`,
    );
    expect(() => {
      validateSendParams({ to: recipients, subject: "Hello" });
    }).toThrow(EmailValidationError);
  });

  it("includes recipient count in over-limit error message", () => {
    const recipients = Array.from(
      { length: MAX_RECIPIENTS + 1 },
      (_, i) => `user${String(i)}@example.com`,
    );
    expect(() => {
      validateSendParams({ to: recipients, subject: "Hello" });
    }).toThrow(
      `Recipient count ${String(MAX_RECIPIENTS + 1)} exceeds maximum of ${String(MAX_RECIPIENTS)}`,
    );
  });

  it("passes with subject at MAX_SUBJECT_LENGTH", () => {
    const subject = "a".repeat(MAX_SUBJECT_LENGTH);
    expect(() => {
      validateSendParams({ to: "a@example.com", subject });
    }).not.toThrow();
  });

  it("throws EmailValidationError when subject exceeds MAX_SUBJECT_LENGTH", () => {
    const subject = "a".repeat(MAX_SUBJECT_LENGTH + 1);
    expect(() => {
      validateSendParams({ to: "a@example.com", subject });
    }).toThrow(EmailValidationError);
  });

  it("includes subject length in error message", () => {
    const subject = "a".repeat(MAX_SUBJECT_LENGTH + 1);
    expect(() => {
      validateSendParams({ to: "a@example.com", subject });
    }).toThrow(
      `Subject length ${String(MAX_SUBJECT_LENGTH + 1)} exceeds maximum of ${String(MAX_SUBJECT_LENGTH)}`,
    );
  });
});

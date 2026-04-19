import { describe, expect, it } from "vitest";

import { MAX_RECIPIENTS, MAX_SUBJECT_LENGTH, validateSendParams } from "../email.constants.js";
import { EmailValidationError, InvalidRecipientError } from "../errors.js";

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

  it("exposes structured fields for recipient violation", () => {
    const recipients = Array.from(
      { length: MAX_RECIPIENTS + 1 },
      (_, i) => `user${String(i)}@example.com`,
    );
    try {
      validateSendParams({ to: recipients, subject: "Hello" });
      expect.fail("Should have thrown");
    } catch (err) {
      if (!(err instanceof EmailValidationError)) throw err;
      expect(err.field).toBe("Recipient count");
      expect(err.actual).toBe(MAX_RECIPIENTS + 1);
      expect(err.max).toBe(MAX_RECIPIENTS);
    }
  });

  it("exposes structured fields for subject violation", () => {
    const subject = "a".repeat(MAX_SUBJECT_LENGTH + 1);
    try {
      validateSendParams({ to: "a@example.com", subject });
      expect.fail("Should have thrown");
    } catch (err) {
      if (!(err instanceof EmailValidationError)) throw err;
      expect(err.field).toBe("Subject length");
      expect(err.actual).toBe(MAX_SUBJECT_LENGTH + 1);
      expect(err.max).toBe(MAX_SUBJECT_LENGTH);
    }
  });

  it("passes when from and replyTo are valid emails", () => {
    expect(() => {
      validateSendParams({
        to: "a@example.com",
        subject: "Hello",
        from: "sender@example.com",
        replyTo: "reply@example.com",
      });
    }).not.toThrow();
  });

  it("throws InvalidRecipientError when from is not a valid email", () => {
    expect(() => {
      validateSendParams({ to: "a@example.com", subject: "Hello", from: "not-an-email" });
    }).toThrow(InvalidRecipientError);
  });

  it("throws InvalidRecipientError when replyTo is not a valid email", () => {
    expect(() => {
      validateSendParams({ to: "a@example.com", subject: "Hello", replyTo: "bad" });
    }).toThrow(InvalidRecipientError);
  });

  it("passes when from and replyTo are undefined", () => {
    expect(() => {
      validateSendParams({ to: "a@example.com", subject: "Hello" });
    }).not.toThrow();
  });

  it.each([
    "no-at-sign",
    "@leading-at.com",
    "trailing-at@",
    "two@at@signs.com",
    "spaces @example.com",
    "with space@example.com",
    "tab\t@example.com",
    "no-dot@example",
    "leading-dot@.example.com",
    "trailing-dot@example.",
  ])("rejects malformed from address %p", (bad) => {
    expect(() => {
      validateSendParams({ to: "a@example.com", subject: "Hello", from: bad });
    }).toThrow(InvalidRecipientError);
  });

  it("runs in linear time on ReDoS-style inputs (js/polynomial-redos regression)", () => {
    // The previous regex /^[^\s@]+@[^\s@]+\.[^\s@]+$/ was flagged by CodeQL as
    // polynomial ReDoS on strings like "!@" + "!.".repeat(n) because `.` was
    // part of the negated class, creating ambiguous partitions. The replacement
    // must validate such an input in linear time.
    const adversarial = "!@" + "!.".repeat(50_000);
    const start = performance.now();
    expect(() => {
      validateSendParams({ to: "a@example.com", subject: "Hello", from: adversarial });
    }).toThrow(InvalidRecipientError);
    const elapsedMs = performance.now() - start;
    expect(elapsedMs).toBeLessThan(100);
  });
});

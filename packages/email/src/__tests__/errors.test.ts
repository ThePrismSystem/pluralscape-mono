import { describe, expect, it } from "vitest";

import {
  EmailDeliveryError,
  EmailConfigurationError,
  EmailRateLimitError,
  InvalidRecipientError,
} from "../errors.js";

describe("EmailDeliveryError", () => {
  it("has the correct name", () => {
    const err = new EmailDeliveryError("test@example.com");
    expect(err.name).toBe("EmailDeliveryError");
  });

  it("stores the recipient", () => {
    const err = new EmailDeliveryError("test@example.com");
    expect(err.recipient).toBe("test@example.com");
  });

  it("uses default message when none provided", () => {
    const err = new EmailDeliveryError("test@example.com");
    expect(err.message).toContain("test@example.com");
  });

  it("uses custom message when provided", () => {
    const err = new EmailDeliveryError("test@example.com", "Custom failure");
    expect(err.message).toBe("Custom failure");
  });

  it("supports error cause via options", () => {
    const cause = new Error("underlying");
    const err = new EmailDeliveryError("test@example.com", undefined, { cause });
    expect(err.cause).toBe(cause);
  });

  it("is an instance of Error", () => {
    const err = new EmailDeliveryError("test@example.com");
    expect(err).toBeInstanceOf(Error);
  });
});

describe("EmailConfigurationError", () => {
  it("has the correct name", () => {
    const err = new EmailConfigurationError("missing API key");
    expect(err.name).toBe("EmailConfigurationError");
  });

  it("stores the message", () => {
    const err = new EmailConfigurationError("missing API key");
    expect(err.message).toBe("missing API key");
  });

  it("supports error cause via options", () => {
    const cause = new Error("underlying");
    const err = new EmailConfigurationError("bad config", { cause });
    expect(err.cause).toBe(cause);
  });

  it("is an instance of Error", () => {
    const err = new EmailConfigurationError("test");
    expect(err).toBeInstanceOf(Error);
  });
});

describe("EmailRateLimitError", () => {
  it("has the correct name", () => {
    const err = new EmailRateLimitError();
    expect(err.name).toBe("EmailRateLimitError");
  });

  it("stores retryAfterSeconds when provided", () => {
    const err = new EmailRateLimitError(60);
    expect(err.retryAfterSeconds).toBe(60);
    expect(err.message).toContain("60");
  });

  it("stores null retryAfterSeconds when not provided", () => {
    const err = new EmailRateLimitError();
    expect(err.retryAfterSeconds).toBeNull();
  });

  it("uses generic message when retryAfterSeconds not provided", () => {
    const err = new EmailRateLimitError();
    expect(err.message).toBe("Rate limited by email provider.");
  });

  it("supports error cause via options", () => {
    const cause = new Error("underlying");
    const err = new EmailRateLimitError(30, { cause });
    expect(err.cause).toBe(cause);
  });

  it("is an instance of Error", () => {
    const err = new EmailRateLimitError();
    expect(err).toBeInstanceOf(Error);
  });
});

describe("InvalidRecipientError", () => {
  it("has the correct name", () => {
    const err = new InvalidRecipientError("bad@");
    expect(err.name).toBe("InvalidRecipientError");
  });

  it("stores the recipient", () => {
    const err = new InvalidRecipientError("bad@");
    expect(err.recipient).toBe("bad@");
  });

  it("includes recipient in message", () => {
    const err = new InvalidRecipientError("bad@");
    expect(err.message).toContain("bad@");
  });

  it("supports error cause via options", () => {
    const cause = new Error("underlying");
    const err = new InvalidRecipientError("bad@", { cause });
    expect(err.cause).toBe(cause);
  });

  it("is an instance of Error", () => {
    const err = new InvalidRecipientError("bad@");
    expect(err).toBeInstanceOf(Error);
  });
});

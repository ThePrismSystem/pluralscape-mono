import { describe, expect, it } from "vitest";

import { assertSmtpSecure } from "../../lib/smtp-tls-guard.js";

describe("SMTP TLS production guard", () => {
  it("throws when SMTP provider is used in production without TLS", () => {
    expect(() => {
      assertSmtpSecure("smtp", false, "production");
    }).toThrow("SMTP_SECURE must be enabled");
  });

  it("does not throw when SMTP provider is used in production with TLS", () => {
    expect(() => {
      assertSmtpSecure("smtp", true, "production");
    }).not.toThrow();
  });

  it("does not throw when SMTP provider is used in development without TLS", () => {
    expect(() => {
      assertSmtpSecure("smtp", false, "development");
    }).not.toThrow();
  });

  it("does not throw for non-SMTP providers regardless of secure flag", () => {
    expect(() => {
      assertSmtpSecure("resend", false, "production");
    }).not.toThrow();
    expect(() => {
      assertSmtpSecure("stub", false, "production");
    }).not.toThrow();
  });
});

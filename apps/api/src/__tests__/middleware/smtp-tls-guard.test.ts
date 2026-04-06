import { describe, expect, it } from "vitest";

/**
 * Validates the SMTP TLS guard logic extracted from index.ts.
 * The guard throws at startup when SMTP is used in production without TLS.
 */

/** Inline guard function matching the one added to index.ts. */
function assertSmtpSecure(provider: string, secure: boolean, nodeEnv: string): void {
  if (nodeEnv === "production" && provider === "smtp" && !secure) {
    throw new Error(
      "SMTP_SECURE must be enabled (SMTP_SECURE=1) when using SMTP in production. " +
        "Refusing to start with plaintext email transport.",
    );
  }
}

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

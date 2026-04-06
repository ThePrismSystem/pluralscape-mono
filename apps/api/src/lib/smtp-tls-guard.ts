/**
 * Runtime guard that refuses to start with plaintext SMTP in production.
 * Called during email adapter initialization.
 */
export function assertSmtpSecure(provider: string, secure: boolean, nodeEnv: string): void {
  if (nodeEnv === "production" && provider === "smtp" && !secure) {
    throw new Error(
      "SMTP_SECURE must be enabled (SMTP_SECURE=1) when using SMTP in production. " +
        "Refusing to start with plaintext email transport.",
    );
  }
}

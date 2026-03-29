/** Variables for the recovery-key-regenerated email template. */
export interface RecoveryKeyRegeneratedVars {
  readonly timestamp: string;
  readonly deviceInfo: string;
}

/** Variables for the new-device-login email template. */
export interface NewDeviceLoginVars {
  readonly timestamp: string;
  readonly deviceInfo: string;
  readonly ipAddress: string;
}

/** Variables for the password-changed email template. */
export interface PasswordChangedVars {
  readonly timestamp: string;
}

/** Variables for the two-factor-changed email template. */
export interface TwoFactorChangedVars {
  readonly timestamp: string;
  readonly action: "enabled" | "disabled" | "method-changed";
}

/** Variables for the webhook-failure-digest email template. */
export interface WebhookFailureDigestVars {
  readonly webhookUrl: string;
  readonly failureCount: number;
  readonly lastError: string;
  readonly timeRangeStart: string;
  readonly timeRangeEnd: string;
}

/**
 * Typed mapping from template name to its variable type.
 * Analogous to JobPayloadMap in the queue package.
 */
export interface EmailTemplateMap {
  "recovery-key-regenerated": RecoveryKeyRegeneratedVars;
  "new-device-login": NewDeviceLoginVars;
  "password-changed": PasswordChangedVars;
  "two-factor-changed": TwoFactorChangedVars;
  "webhook-failure-digest": WebhookFailureDigestVars;
}

/** Valid template names (union type). */
export type EmailTemplateName = keyof EmailTemplateMap;

/** Result of rendering a template. */
export interface RenderedEmail {
  readonly subject: string;
  readonly html: string;
  readonly text: string;
}

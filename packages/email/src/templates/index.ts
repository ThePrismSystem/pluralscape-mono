// @pluralscape/email/templates — typed email template rendering

export { renderTemplate } from "./render.js";
export type {
  EmailTemplateMap,
  EmailTemplateName,
  RenderedEmail,
  RecoveryKeyRegeneratedVars,
  NewDeviceLoginVars,
  PasswordChangedVars,
  TwoFactorChangedVars,
  WebhookFailureDigestVars,
  AccountChangeEmailVars,
} from "./types.js";

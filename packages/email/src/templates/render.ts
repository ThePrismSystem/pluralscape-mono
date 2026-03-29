import { render as renderNewDeviceLogin } from "./new-device-login.js";
import { render as renderPasswordChanged } from "./password-changed.js";
import { render as renderRecoveryKeyRegenerated } from "./recovery-key-regenerated.js";
import { render as renderTwoFactorChanged } from "./two-factor-changed.js";
import { render as renderWebhookFailureDigest } from "./webhook-failure-digest.js";

import type { EmailTemplateMap, EmailTemplateName, RenderedEmail } from "./types.js";

/**
 * Renders a typed email template by name.
 *
 * Provides compile-time safety: the `vars` parameter is typed according
 * to the template name via EmailTemplateMap.
 */
export function renderTemplate<T extends EmailTemplateName>(
  name: T,
  vars: EmailTemplateMap[T],
): RenderedEmail {
  switch (name) {
    case "recovery-key-regenerated":
      return renderRecoveryKeyRegenerated(vars as EmailTemplateMap["recovery-key-regenerated"]);
    case "new-device-login":
      return renderNewDeviceLogin(vars as EmailTemplateMap["new-device-login"]);
    case "password-changed":
      return renderPasswordChanged(vars as EmailTemplateMap["password-changed"]);
    case "two-factor-changed":
      return renderTwoFactorChanged(vars as EmailTemplateMap["two-factor-changed"]);
    case "webhook-failure-digest":
      return renderWebhookFailureDigest(vars as EmailTemplateMap["webhook-failure-digest"]);
    default: {
      const _exhaustive: never = name;
      throw new Error(`Unknown email template: ${String(_exhaustive)}`);
    }
  }
}

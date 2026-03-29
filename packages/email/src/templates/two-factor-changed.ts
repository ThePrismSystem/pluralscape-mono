import { escapeHtml, wrapInBaseLayout } from "./base-layout.js";

import type { TwoFactorChangedVars, RenderedEmail } from "./types.js";

const SUBJECT = "Two-factor authentication settings changed";

const ACTION_LABELS: Record<TwoFactorChangedVars["action"], string> = {
  enabled: "enabled",
  disabled: "disabled",
  "method-changed": "changed to a different method",
};

export function render(vars: TwoFactorChangedVars): RenderedEmail {
  const actionLabel = ACTION_LABELS[vars.action];

  const html = wrapInBaseLayout(
    SUBJECT,
    `<h2 style="margin: 0 0 16px; font-size: 18px; font-weight: 600;">Two-Factor Authentication Updated</h2>
<p style="margin: 0 0 12px;">Two-factor authentication was <strong>${escapeHtml(actionLabel)}</strong> on your account on <strong>${escapeHtml(vars.timestamp)}</strong>.</p>
<hr style="border: none; border-top: 1px solid #e4e4e7; margin: 20px 0;" />
<p style="margin: 0; color: #71717a; font-size: 13px;">If you did not make this change, your account may be compromised. Change your password immediately and contact support.</p>`,
  );

  const text = `Two-Factor Authentication Updated

Two-factor authentication was ${actionLabel} on your account on ${vars.timestamp}.

---

If you did not make this change, your account may be compromised. Change your password immediately and contact support.`;

  return { subject: SUBJECT, html, text };
}

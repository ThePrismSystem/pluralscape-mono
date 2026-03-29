import { escapeHtml, wrapInBaseLayout } from "./base-layout.js";

import type { PasswordChangedVars, RenderedEmail } from "./types.js";

const SUBJECT = "Your password was changed";

export function render(vars: PasswordChangedVars): RenderedEmail {
  const html = wrapInBaseLayout(
    SUBJECT,
    `<h2 style="margin: 0 0 16px; font-size: 18px; font-weight: 600;">Password Changed</h2>
<p style="margin: 0 0 12px;">Your account password was changed on <strong>${escapeHtml(vars.timestamp)}</strong>.</p>
<hr style="border: none; border-top: 1px solid #e4e4e7; margin: 20px 0;" />
<p style="margin: 0; color: #71717a; font-size: 13px;">If you did not change your password, your account may be compromised. Use your recovery key to regain access and contact support immediately.</p>`,
  );

  const text = `Password Changed

Your account password was changed on ${vars.timestamp}.

---

If you did not change your password, your account may be compromised. Use your recovery key to regain access and contact support immediately.`;

  return { subject: SUBJECT, html, text };
}

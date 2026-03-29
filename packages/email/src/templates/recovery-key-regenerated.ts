import { escapeHtml, wrapInBaseLayout } from "./base-layout.js";

import type { RecoveryKeyRegeneratedVars, RenderedEmail } from "./types.js";

const SUBJECT = "Your recovery key was regenerated";

export function render(vars: RecoveryKeyRegeneratedVars): RenderedEmail {
  const html = wrapInBaseLayout(
    SUBJECT,
    `<h2 style="margin: 0 0 16px; font-size: 18px; font-weight: 600;">Recovery Key Regenerated</h2>
<p style="margin: 0 0 12px;">Your recovery key was regenerated on <strong>${escapeHtml(vars.timestamp)}</strong>.</p>
<p style="margin: 0 0 12px;">Device: <strong>${escapeHtml(vars.deviceInfo)}</strong></p>
<p style="margin: 0 0 12px;">Your previous recovery key is no longer valid. Please store your new recovery key in a safe place.</p>
<hr style="border: none; border-top: 1px solid #e4e4e7; margin: 20px 0;" />
<p style="margin: 0; color: #71717a; font-size: 13px;">If you did not perform this action, your account may be compromised. Change your password immediately and contact support.</p>`,
  );

  const text = `Recovery Key Regenerated

Your recovery key was regenerated on ${vars.timestamp}.

Device: ${vars.deviceInfo}

Your previous recovery key is no longer valid. Please store your new recovery key in a safe place.

---

If you did not perform this action, your account may be compromised. Change your password immediately and contact support.`;

  return { subject: SUBJECT, html, text };
}

import { escapeHtml, wrapInBaseLayout } from "./base-layout.js";

import type { NewDeviceLoginVars } from "./types.js";
import type { RenderedEmail } from "./types.js";

const SUBJECT = "New device login detected";

export function render(vars: NewDeviceLoginVars): RenderedEmail {
  const html = wrapInBaseLayout(
    SUBJECT,
    `<h2 style="margin: 0 0 16px; font-size: 18px; font-weight: 600;">New Device Login</h2>
<p style="margin: 0 0 12px;">A new device signed in to your account on <strong>${escapeHtml(vars.timestamp)}</strong>.</p>
<p style="margin: 0 0 12px;">Device: <strong>${escapeHtml(vars.deviceInfo)}</strong></p>
<p style="margin: 0 0 12px;">IP Address: <strong>${escapeHtml(vars.ipAddress)}</strong></p>
<hr style="border: none; border-top: 1px solid #e4e4e7; margin: 20px 0;" />
<p style="margin: 0; color: #71717a; font-size: 13px;">If you did not sign in from this device, change your password immediately and review your active sessions.</p>`,
  );

  const text = `New Device Login

A new device signed in to your account on ${vars.timestamp}.

Device: ${vars.deviceInfo}
IP Address: ${vars.ipAddress}

---

If you did not sign in from this device, change your password immediately and review your active sessions.`;

  return { subject: SUBJECT, html, text };
}

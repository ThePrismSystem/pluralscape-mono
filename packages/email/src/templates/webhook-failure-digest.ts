import { escapeHtml, wrapInBaseLayout } from "./base-layout.js";

import type { WebhookFailureDigestVars } from "./types.js";
import type { RenderedEmail } from "./types.js";

const SUBJECT = "Webhook delivery failures detected";

export function render(vars: WebhookFailureDigestVars): RenderedEmail {
  const html = wrapInBaseLayout(
    SUBJECT,
    `<h2 style="margin: 0 0 16px; font-size: 18px; font-weight: 600;">Webhook Delivery Failures</h2>
<p style="margin: 0 0 12px;">Delivery failures were detected for one of your webhooks.</p>
<table role="presentation" cellpadding="0" cellspacing="0" style="margin: 16px 0; width: 100%; font-size: 14px;">
  <tr>
    <td style="padding: 6px 0; color: #71717a;">Webhook URL</td>
    <td style="padding: 6px 0; font-weight: 600;">${escapeHtml(vars.webhookUrl)}</td>
  </tr>
  <tr>
    <td style="padding: 6px 0; color: #71717a;">Failures</td>
    <td style="padding: 6px 0; font-weight: 600;">${escapeHtml(String(vars.failureCount))}</td>
  </tr>
  <tr>
    <td style="padding: 6px 0; color: #71717a;">Last Error</td>
    <td style="padding: 6px 0; font-weight: 600;">${escapeHtml(vars.lastError)}</td>
  </tr>
  <tr>
    <td style="padding: 6px 0; color: #71717a;">Time Range</td>
    <td style="padding: 6px 0; font-weight: 600;">${escapeHtml(vars.timeRangeStart)} — ${escapeHtml(vars.timeRangeEnd)}</td>
  </tr>
</table>
<p style="margin: 0 0 12px;">Please verify that your webhook endpoint is accessible and responding correctly.</p>`,
  );

  const text = `Webhook Delivery Failures

Delivery failures were detected for one of your webhooks.

Webhook URL: ${vars.webhookUrl}
Failures: ${String(vars.failureCount)}
Last Error: ${vars.lastError}
Time Range: ${vars.timeRangeStart} — ${vars.timeRangeEnd}

Please verify that your webhook endpoint is accessible and responding correctly.`;

  return { subject: SUBJECT, html, text };
}

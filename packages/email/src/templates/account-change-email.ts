import { escapeHtml, wrapInBaseLayout } from "./base-layout.js";

import type { AccountChangeEmailVars, RenderedEmail } from "./types.js";

const SUBJECT = "Your Pluralscape account email was changed";

/**
 * Notifies the OLD email address that the account's email has been changed.
 *
 * The recipient here is always the prior address on file — this is the last
 * notification the previous address will receive before it is disconnected
 * from the account. That's the whole point: if the account has been
 * compromised and the attacker changed the email, the legitimate user still
 * gets a heads-up at the address they remember using.
 */
export function render(vars: AccountChangeEmailVars): RenderedEmail {
  const { oldEmail, newEmail, timestamp, ipAddress } = vars;

  const ipHtml = ipAddress
    ? `<p style="margin: 0 0 12px;">Request IP: <strong>${escapeHtml(ipAddress)}</strong></p>`
    : "";

  const html = wrapInBaseLayout(
    SUBJECT,
    `<h2 style="margin: 0 0 16px; font-size: 18px; font-weight: 600;">Account Email Changed</h2>
<p style="margin: 0 0 12px;">The email address on your Pluralscape account was changed on <strong>${escapeHtml(timestamp)}</strong>.</p>
<p style="margin: 0 0 12px;">From: <strong>${escapeHtml(oldEmail)}</strong></p>
<p style="margin: 0 0 12px;">To: <strong>${escapeHtml(newEmail)}</strong></p>
${ipHtml}<hr style="border: none; border-top: 1px solid #e4e4e7; margin: 20px 0;" />
<p style="margin: 0; color: #71717a; font-size: 13px;">If you did not make this change, your account may be compromised. Contact support immediately and use your recovery key to regain access.</p>`,
  );

  const textLines = [
    "Account Email Changed",
    "",
    `The email address on your Pluralscape account was changed on ${timestamp}.`,
    "",
    `From: ${oldEmail}`,
    `To: ${newEmail}`,
  ];
  if (ipAddress) {
    textLines.push(`Request IP: ${ipAddress}`);
  }
  textLines.push(
    "",
    "---",
    "",
    "If you did not make this change, your account may be compromised. Contact support immediately and use your recovery key to regain access.",
  );

  return { subject: SUBJECT, html, text: textLines.join("\n") };
}

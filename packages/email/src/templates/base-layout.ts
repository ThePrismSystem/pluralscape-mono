/** Primary brand color for headings and accents. */
const BRAND_COLOR = "#6366f1";

/** Background color for the outer email wrapper. */
const BG_COLOR = "#f4f4f5";

/** Background color for the content card. */
const CARD_BG = "#ffffff";

/** Text color for body content. */
const TEXT_COLOR = "#27272a";

/** Muted text color for footer and secondary content. */
const MUTED_COLOR = "#71717a";

/**
 * Wraps email body content in a responsive HTML layout with Pluralscape branding.
 *
 * Uses inline CSS for maximum email client compatibility.
 */
export function wrapInBaseLayout(subject: string, bodyHtml: string): string {
  return `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="utf-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1.0" />
  <title>${escapeHtml(subject)}</title>
</head>
<body style="margin: 0; padding: 0; background-color: ${BG_COLOR}; font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Helvetica, Arial, sans-serif;">
  <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="background-color: ${BG_COLOR};">
    <tr>
      <td align="center" style="padding: 24px 16px;">
        <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="max-width: 560px;">
          <!-- Header -->
          <tr>
            <td align="center" style="padding-bottom: 24px;">
              <span style="font-size: 24px; font-weight: 700; color: ${BRAND_COLOR}; text-decoration: none;">Pluralscape</span>
            </td>
          </tr>
          <!-- Content card -->
          <tr>
            <td style="background-color: ${CARD_BG}; border-radius: 8px; padding: 32px; color: ${TEXT_COLOR}; font-size: 15px; line-height: 1.6;">
              ${bodyHtml}
            </td>
          </tr>
          <!-- Footer -->
          <tr>
            <td align="center" style="padding-top: 24px; color: ${MUTED_COLOR}; font-size: 12px; line-height: 1.5;">
              <p style="margin: 0;">This is an automated message from Pluralscape.</p>
              <p style="margin: 4px 0 0;">Please do not reply directly to this email.</p>
            </td>
          </tr>
        </table>
      </td>
    </tr>
  </table>
</body>
</html>`;
}

/** Escapes HTML special characters to prevent injection. */
export function escapeHtml(text: string): string {
  return text
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#x27;");
}

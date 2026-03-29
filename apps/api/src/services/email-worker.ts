import { renderTemplate } from "@pluralscape/email/templates";

import { resolveAccountEmail } from "../lib/email-resolve.js";
import { getEmailAdapter } from "../lib/email.js";
import { logger } from "../lib/logger.js";

import type { EmailTemplateMap, EmailTemplateName } from "@pluralscape/email/templates";
import type { JobPayloadMap } from "@pluralscape/types";
import type { PostgresJsDatabase } from "drizzle-orm/postgres-js";

/**
 * Type guard bridging the job payload's serialized vars to typed template vars.
 * Template name → vars shape is validated at enqueue time; this guard
 * satisfies TypeScript at the deserialization boundary.
 */
function isTemplateVars<T extends EmailTemplateName>(
  _template: T,
  vars: unknown,
): vars is EmailTemplateMap[T] {
  return typeof vars === "object" && vars !== null;
}

/**
 * Process a single `email-send` job.
 *
 * 1. Resolves the recipient email via decrypting the stored encrypted email
 * 2. Renders the template with the provided vars
 * 3. Sends via the registered email adapter
 * 4. Errors propagate for the queue retry policy to handle
 */
export async function processEmailJob(
  db: PostgresJsDatabase,
  jobPayload: JobPayloadMap["email-send"],
): Promise<void> {
  const { accountId, template, vars } = jobPayload;

  // Resolve recipient email address
  const recipientEmail = await resolveAccountEmail(db, accountId);
  if (!recipientEmail) {
    logger.warn("[email-worker] no email address found for account, skipping", { accountId });
    return;
  }

  // Validate vars shape at the deserialization boundary
  if (!isTemplateVars(template, vars)) {
    throw new Error(`Invalid template vars for ${template}`);
  }

  // Render the template — vars are narrowed by the type guard above
  const rendered = renderTemplate(template, vars);

  // Send via the registered adapter — errors propagate for queue retry
  const adapter = getEmailAdapter();
  await adapter.send({
    to: recipientEmail,
    subject: rendered.subject,
    html: rendered.html,
    text: rendered.text,
  });

  logger.info("[email-worker] email sent", {
    accountId,
    template,
    provider: adapter.providerName,
  });
}

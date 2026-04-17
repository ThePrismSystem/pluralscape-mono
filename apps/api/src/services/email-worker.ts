import { renderTemplate } from "@pluralscape/email/templates";

import { resolveAccountEmail } from "../lib/email-resolve.js";
import { getEmailAdapter } from "../lib/email.js";
import { logger } from "../lib/logger.js";

import type { EmailTemplateMap, EmailTemplateName } from "@pluralscape/email/templates";
import type { JobPayloadMap } from "@pluralscape/types";
import type { PostgresJsDatabase } from "drizzle-orm/postgres-js";

/**
 * Assertion bridging the job payload's serialized vars to typed template vars.
 * Template name → vars shape is validated at enqueue time; this assertion
 * satisfies TypeScript at the deserialization boundary and throws on non-object input.
 */
function assertTemplateVars<T extends EmailTemplateName>(
  template: T,
  vars: unknown,
): asserts vars is EmailTemplateMap[T] {
  if (typeof vars !== "object" || vars === null) {
    throw new Error(`Invalid template vars for ${template}`);
  }
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
  const { accountId, template, vars, recipientOverride } = jobPayload;

  // Prefer an explicit recipient override (used when notifying an address no
  // longer attached to the account — e.g. account-change-email goes to the
  // OLD email after the new one was already persisted). `recipientOverride`
  // is required and nullable at the type level; `null` means "resolve from
  // the account".
  let recipientEmail: string | null;
  if (recipientOverride !== null) {
    recipientEmail = recipientOverride;
  } else {
    recipientEmail = await resolveAccountEmail(db, accountId);
  }

  if (!recipientEmail) {
    logger.warn("[email-worker] no email address found for account, skipping", { accountId });
    return;
  }

  // Validate vars shape at the deserialization boundary
  assertTemplateVars(template, vars);

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

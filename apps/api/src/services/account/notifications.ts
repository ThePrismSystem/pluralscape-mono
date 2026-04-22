import { logger } from "../../lib/logger.js";
import { buildAccountEmailChangeIdempotencyKey } from "../../routes/account/account.constants.js";

import type { AuditWriter } from "../../lib/audit-writer.js";
import type { JobQueue } from "@pluralscape/queue";
import type { AccountId } from "@pluralscape/types";
import type { PostgresJsDatabase } from "drizzle-orm/postgres-js";

/** Arguments describing which notification to enqueue. */
export interface EnqueueAccountEmailChangedNotificationArgs {
  readonly accountId: AccountId;
  /** Plaintext prior address. `null` disables the enqueue. */
  readonly oldEmail: string | null;
  /** Plaintext new address (post-change). */
  readonly newEmail: string;
  /** Post-change `accounts.version` — the idempotency-key suffix. */
  readonly version: number;
  /** Caller IP, surfaced in the template vars when non-null. */
  readonly ipAddress: string | null;
}

/**
 * Fire-and-forget enqueue of the `account-change-email` notification to the
 * OLD email address after a successful email change.
 *
 * Short-circuits when (a) the queue is null (local dev / queue disabled) or
 * (b) `oldEmail` is null (unresolvable via `resolveAccountEmail`). Enqueue
 * failures are caught, logged, and persisted as an audit event under the
 * `auth.email-change-notification-enqueue-failed` type so SOC/IR tooling can
 * query per-account for a missed breach-alert signal.
 *
 * Idempotency: keyed on `accountId + version`. Retries of the same change
 * produce identical keys and deduplicate; a later legitimate change bumps
 * `version` and gets its own key.
 *
 * `db` is only consulted if the enqueue fails (to write the audit row). It is
 * deliberately a positional parameter so callers do not nest the connection
 * handle inside the args shape that tests assert against.
 *
 * This helper never throws — callers should `void` the returned promise.
 */
export async function enqueueAccountEmailChangedNotification(
  queue: JobQueue | null,
  audit: AuditWriter,
  db: PostgresJsDatabase,
  args: EnqueueAccountEmailChangedNotificationArgs,
): Promise<void> {
  if (!queue || !args.oldEmail) return;

  const { accountId, oldEmail, newEmail, version, ipAddress } = args;

  try {
    await queue.enqueue({
      type: "email-send",
      systemId: null,
      payload: {
        accountId,
        template: "account-change-email",
        vars: {
          oldEmail,
          newEmail,
          timestamp: new Date().toISOString(),
          ...(ipAddress ? { ipAddress } : {}),
        },
        recipientOverride: oldEmail,
      },
      idempotencyKey: buildAccountEmailChangeIdempotencyKey(accountId, version),
    });
  } catch (err: unknown) {
    const errorMessage = err instanceof Error ? err.message : String(err);
    logger.warn("[account-notify] change-email enqueue failed", {
      accountId,
      error: errorMessage,
    });
    // Persist a forensic trail so ops can query which accounts missed a
    // breach-alert signal. Swallow secondary failures — we are already in a
    // fire-and-forget path and cannot surface errors to the caller.
    try {
      await audit(db, {
        eventType: "auth.email-change-notification-enqueue-failed",
        actor: { kind: "account", id: accountId },
        detail: `Enqueue failed: ${errorMessage}`,
      });
    } catch (auditErr: unknown) {
      const auditMessage = auditErr instanceof Error ? auditErr.message : String(auditErr);
      logger.error("[account-notify] audit write failed after enqueue failure", {
        accountId,
        error: auditMessage,
      });
    }
  }
}

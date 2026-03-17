import { writeAuditLog } from "./audit-log.js";
import { extractRequestMeta } from "./request-meta.js";

import type { AuthContext } from "./auth-context.js";
import type { DbAuditActor } from "@pluralscape/db";
import type { AuditEventType } from "@pluralscape/types";
import type { PgDatabase, PgQueryResultHKT } from "drizzle-orm/pg-core";
import type { Context } from "hono";

/** Parameters for an audit write via the factory-created writer. */
export interface AuditWriteParams {
  readonly eventType: AuditEventType;
  readonly actor: DbAuditActor;
  readonly detail?: string | null;
  /** Override accountId from auth context. */
  readonly accountId?: string | null;
  /** Override systemId from auth context. */
  readonly systemId?: string | null;
}

/** A pre-bound audit log writer that captures request metadata at creation time. */
export type AuditWriter = (
  db: PgDatabase<PgQueryResultHKT>,
  params: AuditWriteParams,
) => Promise<void>;

/**
 * Create an audit log writer pre-bound to the current request context.
 *
 * Captures IP address and user-agent from the Hono context at creation time.
 * When auth is provided, accountId and systemId are automatically included
 * unless explicitly overridden in the per-call params.
 */
export function createAuditWriter(c: Context, auth?: AuthContext | null): AuditWriter {
  const requestMeta = extractRequestMeta(c);

  return async (db: PgDatabase<PgQueryResultHKT>, params: AuditWriteParams): Promise<void> => {
    await writeAuditLog(db, {
      accountId: params.accountId ?? auth?.accountId ?? null,
      systemId: params.systemId ?? auth?.systemId ?? null,
      eventType: params.eventType,
      actor: params.actor,
      detail: params.detail,
      ipAddress: requestMeta.ipAddress,
      userAgent: requestMeta.userAgent,
    });
  };
}

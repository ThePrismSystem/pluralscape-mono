import { writeAuditLog } from "./audit-log.js";
import { extractRequestMeta } from "./request-meta.js";

import type { AuthContext } from "./auth-context.js";
import type { DbAuditActor } from "@pluralscape/db";
import type { AccountId, AuditEventType, SystemId } from "@pluralscape/types";
import type { PgDatabase, PgQueryResultHKT } from "drizzle-orm/pg-core";
import type { Context } from "hono";

/** Parameters for an audit write via the factory-created writer. */
export interface AuditWriteParams {
  readonly eventType: AuditEventType;
  readonly actor: DbAuditActor;
  readonly detail?: string;
  /** Override accountId from auth context. */
  readonly accountId?: AccountId | null;
  /** Override systemId from auth context. */
  readonly systemId?: SystemId | null;
  /** Override the captured auditLogIpTracking flag for this specific write (e.g. settings changes). */
  readonly overrideTrackIp?: boolean;
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
 *
 * When called without auth (e.g. login/register routes where no session exists
 * yet), callers are responsible for passing accountId/systemId per-call once
 * the values are known. The db argument is not captured in the closure to allow
 * callers to pass a transaction handle on some calls and the main db on others.
 */
export function createAuditWriter(c: Context, auth?: AuthContext | null): AuditWriter {
  const requestMeta = extractRequestMeta(c);
  const trackIp = auth?.auditLogIpTracking === true;

  return async (db: PgDatabase<PgQueryResultHKT>, params: AuditWriteParams): Promise<void> => {
    const shouldTrackIp = params.overrideTrackIp ?? trackIp;
    await writeAuditLog(db, {
      accountId: params.accountId ?? auth?.accountId ?? null,
      systemId: params.systemId ?? auth?.systemId ?? null,
      eventType: params.eventType,
      actor: params.actor,
      detail: params.detail,
      ipAddress: shouldTrackIp ? requestMeta.ipAddress : null,
      userAgent: shouldTrackIp ? requestMeta.userAgent : null,
    });
  };
}

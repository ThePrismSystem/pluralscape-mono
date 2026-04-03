import { createAuditWriter } from "../lib/audit-writer.js";
import { getDb } from "../lib/db.js";
import { extractRequestMeta } from "../lib/request-meta.js";

import type { AuditWriter } from "../lib/audit-writer.js";
import type { AuthContext, AuthEnv } from "../lib/auth-context.js";
import type { RequestMeta } from "../lib/request-meta.js";
import type { SystemId } from "@pluralscape/types";
import type { PostgresJsDatabase } from "drizzle-orm/postgres-js";
import type { Context } from "hono";

/** Base context available to all tRPC procedures. */
export interface TRPCContext {
  readonly db: PostgresJsDatabase;
  readonly auth: AuthContext | null;
  readonly createAudit: (auth?: AuthContext | null) => AuditWriter;
  readonly requestMeta: RequestMeta;
}

/**
 * Extended context after the system middleware has validated systemId.
 * Available to procedures built on `systemProcedure`.
 */
export interface SystemTRPCContext extends TRPCContext {
  readonly auth: AuthContext;
  readonly systemId: SystemId;
}

/**
 * Build a TRPCContext from plain data, without requiring HTTP objects.
 *
 * Used by server-side callers and tests. The Hono-specific
 * `createTRPCContext` calls this internally.
 */
export function createTRPCContextInner(opts: {
  db: PostgresJsDatabase;
  auth: AuthContext | null;
  createAudit: (auth?: AuthContext | null) => AuditWriter;
  requestMeta: RequestMeta;
}): TRPCContext {
  return {
    db: opts.db,
    auth: opts.auth,
    createAudit: opts.createAudit,
    requestMeta: opts.requestMeta,
  };
}

/**
 * Build a TRPCContext from the current Hono request context.
 *
 * Called once per request when `/trpc/*` is hit. Hono middleware (auth, CORS,
 * rate limiting) has already run, so `c.get("auth")` is populated for
 * authenticated requests.
 */
export async function createTRPCContext(c: Context<AuthEnv>): Promise<TRPCContext> {
  const db = await getDb();
  // Auth is optional for tRPC — public procedures run without auth.
  // AuthEnv types auth as required, so the undefined cast is necessary.
  const auth: AuthContext | null = (c.get("auth") as AuthContext | undefined) ?? null;

  return createTRPCContextInner({
    db,
    auth,
    createAudit: (authOverride) =>
      createAuditWriter(c, authOverride !== undefined ? authOverride : auth),
    requestMeta: extractRequestMeta(c),
  });
}

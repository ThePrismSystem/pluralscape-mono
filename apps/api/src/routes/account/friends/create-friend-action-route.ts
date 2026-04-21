import { ID_PREFIXES } from "@pluralscape/types";
import { Hono } from "hono";

import { createAuditWriter } from "../../../lib/audit-writer.js";
import { getDb } from "../../../lib/db.js";
import { requireIdParam } from "../../../lib/id-param.js";
import { envelope } from "../../../lib/response.js";
import { createCategoryRateLimiter } from "../../../middleware/rate-limit.js";

import type { AuditWriter } from "../../../lib/audit-writer.js";
import type { AuthContext, AuthEnv } from "../../../lib/auth-context.js";
import type { FriendConnectionResult } from "../../../services/friend-connection/internal.js";
import type { AccountId, FriendConnectionId } from "@pluralscape/types";
import type { PostgresJsDatabase } from "drizzle-orm/postgres-js";

type FriendActionFn = (
  db: PostgresJsDatabase,
  accountId: AccountId,
  connectionId: FriendConnectionId,
  auth: AuthContext,
  audit: AuditWriter,
) => Promise<FriendConnectionResult>;

export function createFriendActionRoute(action: string, serviceFn: FriendActionFn): Hono<AuthEnv> {
  const route = new Hono<AuthEnv>();

  route.use("*", createCategoryRateLimiter("write"));

  route.post(`/:connectionId/${action}`, async (c) => {
    const auth = c.get("auth");
    const connectionId = requireIdParam(
      c.req.param("connectionId"),
      "connectionId",
      ID_PREFIXES.friendConnection,
    );
    const audit = createAuditWriter(c, auth);

    const db = await getDb();
    const result = await serviceFn(db, auth.accountId, connectionId, auth, audit);
    return c.json(envelope(result));
  });

  return route;
}

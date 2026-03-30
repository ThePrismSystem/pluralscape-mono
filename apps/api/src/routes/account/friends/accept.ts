import { ID_PREFIXES } from "@pluralscape/types";
import { Hono } from "hono";

import { createAuditWriter } from "../../../lib/audit-writer.js";
import { getDb } from "../../../lib/db.js";
import { requireIdParam } from "../../../lib/id-param.js";
import { createCategoryRateLimiter } from "../../../middleware/rate-limit.js";
import { acceptFriendConnection } from "../../../services/friend-connection.service.js";

import type { AuthEnv } from "../../../lib/auth-context.js";

export const acceptRoute = new Hono<AuthEnv>();

acceptRoute.use("*", createCategoryRateLimiter("write"));

acceptRoute.post("/:connectionId/accept", async (c) => {
  const auth = c.get("auth");
  const connectionId = requireIdParam(
    c.req.param("connectionId"),
    "connectionId",
    ID_PREFIXES.friendConnection,
  );
  const audit = createAuditWriter(c, auth);

  const db = await getDb();
  const result = await acceptFriendConnection(db, auth.accountId, connectionId, auth, audit);
  return c.json(result);
});

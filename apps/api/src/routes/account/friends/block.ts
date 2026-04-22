import { ID_PREFIXES } from "@pluralscape/types";
import { Hono } from "hono";

import { createAuditWriter } from "../../../lib/audit-writer.js";
import { getDb } from "../../../lib/db.js";
import { requireIdParam } from "../../../lib/id-param.js";
import { envelope } from "../../../lib/response.js";
import { createCategoryRateLimiter } from "../../../middleware/rate-limit.js";
import { blockFriendConnection } from "../../../services/account/friends/transitions.js";

import type { AuthEnv } from "../../../lib/auth-context.js";

export const blockRoute = new Hono<AuthEnv>();

blockRoute.use("*", createCategoryRateLimiter("write"));

blockRoute.post("/:connectionId/block", async (c) => {
  const auth = c.get("auth");
  const connectionId = requireIdParam(
    c.req.param("connectionId"),
    "connectionId",
    ID_PREFIXES.friendConnection,
  );
  const audit = createAuditWriter(c, auth);

  const db = await getDb();
  const result = await blockFriendConnection(db, auth.accountId, connectionId, auth, audit);
  return c.json(envelope(result));
});

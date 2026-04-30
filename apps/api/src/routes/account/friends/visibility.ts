import { ID_PREFIXES } from "@pluralscape/types";
import { UpdateFriendVisibilityBodySchema } from "@pluralscape/validation";
import { Hono } from "hono";

import {} from "../../../http.constants.js";
import { createAuditWriter } from "../../../lib/audit-writer.js";
import { parseBody } from "../../../lib/body-parse.js";
import { getDb } from "../../../lib/db.js";
import { requireIdParam } from "../../../lib/id-param.js";
import { envelope } from "../../../lib/response.js";
import { createCategoryRateLimiter } from "../../../middleware/rate-limit.js";
import { updateFriendVisibility } from "../../../services/account/friends/update.js";

import type { AuthEnv } from "../../../lib/auth-context.js";

export const visibilityRoute = new Hono<AuthEnv>();

visibilityRoute.use("*", createCategoryRateLimiter("write"));

visibilityRoute.put("/:connectionId/visibility", async (c) => {
  const auth = c.get("auth");
  const connectionId = requireIdParam(
    c.req.param("connectionId"),
    "connectionId",
    ID_PREFIXES.friendConnection,
  );
  const audit = createAuditWriter(c, auth);
  const body = await parseBody(c, UpdateFriendVisibilityBodySchema);

  const db = await getDb();
  const result = await updateFriendVisibility(db, auth.accountId, connectionId, body, auth, audit);
  return c.json(envelope(result));
});

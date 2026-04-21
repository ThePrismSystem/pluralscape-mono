import { ID_PREFIXES } from "@pluralscape/types";
import { Hono } from "hono";

import { createAuditWriter } from "../../lib/audit-writer.js";
import { getDb } from "../../lib/db.js";
import { requireIdParam } from "../../lib/id-param.js";
import { envelope } from "../../lib/response.js";
import { createCategoryRateLimiter } from "../../middleware/rate-limit.js";
import { unpinBoardMessage } from "../../services/board-message/pin.js";

import type { AuthEnv } from "../../lib/auth-context.js";

export const unpinRoute = new Hono<AuthEnv>();

unpinRoute.use("*", createCategoryRateLimiter("write"));

unpinRoute.post("/:boardMessageId/unpin", async (c) => {
  const auth = c.get("auth");
  const systemId = requireIdParam(c.req.param("systemId"), "systemId", ID_PREFIXES.system);
  const boardMessageId = requireIdParam(
    c.req.param("boardMessageId"),
    "boardMessageId",
    ID_PREFIXES.boardMessage,
  );
  const audit = createAuditWriter(c, auth);

  const db = await getDb();
  const result = await unpinBoardMessage(db, systemId, boardMessageId, auth, audit);
  return c.json(envelope(result));
});

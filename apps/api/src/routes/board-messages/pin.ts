import { ID_PREFIXES } from "@pluralscape/types";
import { Hono } from "hono";

import { createAuditWriter } from "../../lib/audit-writer.js";
import { getDb } from "../../lib/db.js";
import { requireIdParam } from "../../lib/id-param.js";
import { envelope } from "../../lib/response.js";
import { createCategoryRateLimiter } from "../../middleware/rate-limit.js";
import { pinBoardMessage } from "../../services/board-message.service.js";

import type { AuthEnv } from "../../lib/auth-context.js";

export const pinRoute = new Hono<AuthEnv>();

pinRoute.use("*", createCategoryRateLimiter("write"));

pinRoute.post("/:boardMessageId/pin", async (c) => {
  const auth = c.get("auth");
  const systemId = requireIdParam(c.req.param("systemId"), "systemId", ID_PREFIXES.system);
  const boardMessageId = requireIdParam(
    c.req.param("boardMessageId"),
    "boardMessageId",
    ID_PREFIXES.boardMessage,
  );
  const audit = createAuditWriter(c, auth);

  const db = await getDb();
  const result = await pinBoardMessage(db, systemId, boardMessageId, auth, audit);
  return c.json(envelope(result));
});

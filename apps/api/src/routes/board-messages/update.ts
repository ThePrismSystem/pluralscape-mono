import { ID_PREFIXES } from "@pluralscape/types";
import { UpdateBoardMessageBodySchema } from "@pluralscape/validation";
import { Hono } from "hono";

import {} from "../../http.constants.js";
import { createAuditWriter } from "../../lib/audit-writer.js";
import { parseBody } from "../../lib/body-parse.js";
import { getDb } from "../../lib/db.js";
import { requireIdParam } from "../../lib/id-param.js";
import { envelope } from "../../lib/response.js";
import { createCategoryRateLimiter } from "../../middleware/rate-limit.js";
import { updateBoardMessage } from "../../services/board-message/update.js";

import type { AuthEnv } from "../../lib/auth-context.js";

export const updateRoute = new Hono<AuthEnv>();

updateRoute.use("*", createCategoryRateLimiter("write"));

updateRoute.put("/:boardMessageId", async (c) => {
  const body = await parseBody(c, UpdateBoardMessageBodySchema);

  const auth = c.get("auth");
  const systemId = requireIdParam(c.req.param("systemId"), "systemId", ID_PREFIXES.system);
  const boardMessageId = requireIdParam(
    c.req.param("boardMessageId"),
    "boardMessageId",
    ID_PREFIXES.boardMessage,
  );
  const audit = createAuditWriter(c, auth);

  const db = await getDb();
  const result = await updateBoardMessage(db, systemId, boardMessageId, body, auth, audit);
  return c.json(envelope(result));
});

import { ID_PREFIXES } from "@pluralscape/types";
import { Hono } from "hono";

import { HTTP_NO_CONTENT } from "../../http.constants.js";
import { createAuditWriter } from "../../lib/audit-writer.js";
import { getDb } from "../../lib/db.js";
import { requireIdParam } from "../../lib/id-param.js";
import { parseJsonBody } from "../../lib/parse-json-body.js";
import { createCategoryRateLimiter } from "../../middleware/rate-limit.js";
import { reorderBoardMessages } from "../../services/board-message/reorder.js";

import type { AuthEnv } from "../../lib/auth-context.js";

export const reorderRoute = new Hono<AuthEnv>();

reorderRoute.use("*", createCategoryRateLimiter("write"));

reorderRoute.post("/reorder", async (c) => {
  const body = await parseJsonBody(c);
  const auth = c.get("auth");
  const systemId = requireIdParam(c.req.param("systemId"), "systemId", ID_PREFIXES.system);
  const audit = createAuditWriter(c, auth);

  const db = await getDb();
  await reorderBoardMessages(db, systemId, body, auth, audit);
  return c.body(null, HTTP_NO_CONTENT);
});

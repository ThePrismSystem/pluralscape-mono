import { ID_PREFIXES } from "@pluralscape/types";
import { Hono } from "hono";

import { getDb } from "../../../lib/db.js";
import { parseIdParam, requireIdParam } from "../../../lib/id-param.js";
import { createCategoryRateLimiter } from "../../../middleware/rate-limit.js";
import { getFrontingComment } from "../../../services/fronting-comment.service.js";

import type { AuthEnv } from "../../../lib/auth-context.js";

export const getRoute = new Hono<AuthEnv>();

getRoute.use("*", createCategoryRateLimiter("readDefault"));

getRoute.get("/:commentId", async (c) => {
  const auth = c.get("auth");
  const systemId = requireIdParam(c.req.param("systemId"), "systemId", ID_PREFIXES.system);
  const commentId = parseIdParam(c.req.param("commentId"), ID_PREFIXES.frontingComment);

  const db = await getDb();
  const result = await getFrontingComment(db, systemId, commentId, auth);
  return c.json(result);
});

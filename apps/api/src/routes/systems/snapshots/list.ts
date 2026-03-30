import { ID_PREFIXES } from "@pluralscape/types";
import { Hono } from "hono";

import { HTTP_OK } from "../../../http.constants.js";
import { getDb } from "../../../lib/db.js";
import { requireIdParam } from "../../../lib/id-param.js";
import { parseCursor, parsePaginationLimit } from "../../../lib/pagination.js";
import { createCategoryRateLimiter } from "../../../middleware/rate-limit.js";
import { DEFAULT_PAGE_LIMIT, MAX_PAGE_LIMIT } from "../../../service.constants.js";
import { listSnapshots } from "../../../services/snapshot.service.js";

import type { AuthEnv } from "../../../lib/auth-context.js";

export const listRoute = new Hono<AuthEnv>();

listRoute.use("*", createCategoryRateLimiter("readDefault"));

listRoute.get("/", async (c) => {
  const auth = c.get("auth");
  const systemId = requireIdParam(c.req.param("systemId"), "systemId", ID_PREFIXES.system);
  const cursor = parseCursor(c.req.query("cursor"));
  const limit = parsePaginationLimit(c.req.query("limit"), DEFAULT_PAGE_LIMIT, MAX_PAGE_LIMIT);

  const db = await getDb();
  const result = await listSnapshots(db, systemId, auth, cursor, limit);
  return c.json(result, HTTP_OK);
});

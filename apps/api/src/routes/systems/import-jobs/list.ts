import { ID_PREFIXES } from "@pluralscape/types";
import { Hono } from "hono";

import { HTTP_OK } from "../../../http.constants.js";
import { getDb } from "../../../lib/db.js";
import { requireIdParam } from "../../../lib/id-param.js";
import { parseCursor, parsePaginationLimit } from "../../../lib/pagination.js";
import { createCategoryRateLimiter } from "../../../middleware/rate-limit.js";
import { DEFAULT_PAGE_LIMIT, MAX_PAGE_LIMIT } from "../../../service.constants.js";
import { listImportJobs } from "../../../services/import-job.service.js";

import type { AuthEnv } from "../../../lib/auth-context.js";
import type { ImportJobStatus, ImportSource } from "@pluralscape/types";

export const listRoute = new Hono<AuthEnv>();

listRoute.use("*", createCategoryRateLimiter("readDefault"));

listRoute.get("/", async (c) => {
  const auth = c.get("auth");
  const systemId = requireIdParam(c.req.param("systemId"), "systemId", ID_PREFIXES.system);
  const cursor = parseCursor(c.req.query("cursor"));
  const limit = parsePaginationLimit(c.req.query("limit"), DEFAULT_PAGE_LIMIT, MAX_PAGE_LIMIT);
  const status = c.req.query("status") as ImportJobStatus | undefined;
  const source = c.req.query("source") as ImportSource | undefined;

  const db = await getDb();
  const result = await listImportJobs(db, systemId, auth, { cursor, limit, status, source });
  return c.json(result, HTTP_OK);
});

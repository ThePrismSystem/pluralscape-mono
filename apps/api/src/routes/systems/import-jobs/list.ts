import { ID_PREFIXES, IMPORT_JOB_STATUSES, IMPORT_SOURCES } from "@pluralscape/types";
import { Hono } from "hono";
import { z } from "zod/v4";

import { HTTP_BAD_REQUEST, HTTP_OK } from "../../../http.constants.js";
import { ApiHttpError } from "../../../lib/api-error.js";
import { getDb } from "../../../lib/db.js";
import { requireIdParam } from "../../../lib/id-param.js";
import { createCategoryRateLimiter } from "../../../middleware/rate-limit.js";
import { MAX_PAGE_LIMIT } from "../../../service.constants.js";
import { listImportJobs } from "../../../services/system/import-jobs/list.js";

import type { AuthEnv } from "../../../lib/auth-context.js";

const QuerySchema = z
  .object({
    cursor: z.string().min(1).optional(),
    limit: z.coerce.number().int().min(1).max(MAX_PAGE_LIMIT).optional(),
    status: z.enum(IMPORT_JOB_STATUSES).optional(),
    source: z.enum(IMPORT_SOURCES).optional(),
  })
  .strict();

export const listRoute = new Hono<AuthEnv>();

listRoute.use("*", createCategoryRateLimiter("readDefault"));

listRoute.get("/", async (c) => {
  const auth = c.get("auth");
  const systemId = requireIdParam(c.req.param("systemId"), "systemId", ID_PREFIXES.system);
  const rawQuery = Object.fromEntries(new URL(c.req.url).searchParams);
  const parsed = QuerySchema.safeParse(rawQuery);
  if (!parsed.success) {
    throw new ApiHttpError(HTTP_BAD_REQUEST, "VALIDATION_ERROR", "Invalid query parameters", {
      issues: parsed.error.issues,
    });
  }

  const db = await getDb();
  const result = await listImportJobs(db, systemId, auth, {
    cursor: parsed.data.cursor,
    limit: parsed.data.limit,
    status: parsed.data.status,
    source: parsed.data.source,
  });
  return c.json(result, HTTP_OK);
});

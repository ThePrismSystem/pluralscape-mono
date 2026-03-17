import { Hono } from "hono";

import { HTTP_BAD_REQUEST } from "../../http.constants.js";
import { ApiHttpError } from "../../lib/api-error.js";
import { getDb } from "../../lib/db.js";
import { parseIdParam } from "../../lib/id-param.js";
import { extractRequestMeta } from "../../lib/request-meta.js";
import { createCategoryRateLimiter } from "../../middleware/rate-limit.js";
import { updateSystemProfile } from "../../services/system.service.js";

import type { AuthEnv } from "../../lib/auth-context.js";
import type { SystemId } from "@pluralscape/types";

export const updateRoute = new Hono<AuthEnv>();

updateRoute.use("*", createCategoryRateLimiter("write"));

updateRoute.put("/:id", async (c) => {
  let body: unknown;
  try {
    body = await c.req.json();
  } catch {
    throw new ApiHttpError(HTTP_BAD_REQUEST, "VALIDATION_ERROR", "Invalid JSON body");
  }

  const auth = c.get("auth");
  const systemId = parseIdParam<"SystemId">(c.req.param("id"), "sys_") as SystemId;
  const requestMeta = extractRequestMeta(c);

  const db = await getDb();
  const result = await updateSystemProfile(db, systemId, body, auth, requestMeta);
  return c.json(result);
});

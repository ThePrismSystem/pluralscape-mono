import { Hono } from "hono";

import { ApiHttpError } from "../../lib/api-error.js";
import { getDb } from "../../lib/db.js";
import { createCategoryRateLimiter } from "../../middleware/rate-limit.js";
import { extractIpAddress, extractUserAgent } from "../../services/auth.service.js";
import { type UpdateSystemParams, updateSystemProfile } from "../../services/system.service.js";

import { HTTP_BAD_REQUEST } from "./systems.constants.js";

import type { AuthEnv } from "../../lib/auth-context.js";

export const updateRoute = new Hono<AuthEnv>();

updateRoute.use("*", createCategoryRateLimiter("write"));

updateRoute.put("/:id", async (c) => {
  let body: UpdateSystemParams;
  try {
    body = await c.req.json<UpdateSystemParams>();
  } catch {
    throw new ApiHttpError(HTTP_BAD_REQUEST, "VALIDATION_ERROR", "Invalid JSON body");
  }

  const auth = c.get("auth");
  const systemId = c.req.param("id");
  const requestMeta = {
    ipAddress: extractIpAddress(c),
    userAgent: extractUserAgent(c),
  };

  const db = await getDb();
  const result = await updateSystemProfile(db, systemId, body, auth, requestMeta);
  return c.json(result);
});

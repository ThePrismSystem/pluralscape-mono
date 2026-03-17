import { Hono } from "hono";

import { getDb } from "../../lib/db.js";
import { createCategoryRateLimiter } from "../../middleware/rate-limit.js";
import { extractIpAddress, extractUserAgent } from "../../services/auth.service.js";
import { deleteSystem } from "../../services/system.service.js";

import type { AuthEnv } from "../../lib/auth-context.js";

export const deleteRoute = new Hono<AuthEnv>();

deleteRoute.use("*", createCategoryRateLimiter("write"));

deleteRoute.delete("/:id", async (c) => {
  const auth = c.get("auth");
  const systemId = c.req.param("id");
  const requestMeta = {
    ipAddress: extractIpAddress(c),
    userAgent: extractUserAgent(c),
  };

  const db = await getDb();
  await deleteSystem(db, systemId, auth, requestMeta);
  return c.json({ ok: true });
});

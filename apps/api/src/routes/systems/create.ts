import { Hono } from "hono";

import { HTTP_CREATED } from "../../http.constants.js";
import { getDb } from "../../lib/db.js";
import { createCategoryRateLimiter } from "../../middleware/rate-limit.js";
import { extractRequestMeta } from "../../services/auth.service.js";
import { createSystem } from "../../services/system.service.js";

import type { AuthEnv } from "../../lib/auth-context.js";

export const createRoute = new Hono<AuthEnv>();

createRoute.use("*", createCategoryRateLimiter("write"));

createRoute.post("/", async (c) => {
  const auth = c.get("auth");
  const requestMeta = extractRequestMeta(c);

  const db = await getDb();
  const result = await createSystem(db, auth, requestMeta);
  return c.json(result, HTTP_CREATED);
});

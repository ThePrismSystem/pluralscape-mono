import { Hono } from "hono";

import { getDb } from "../../lib/db.js";
import { createCategoryRateLimiter } from "../../middleware/rate-limit.js";
import { extractRequestMeta } from "../../services/auth.service.js";
import { archiveSystem } from "../../services/system.service.js";

import type { AuthEnv } from "../../lib/auth-context.js";
import type { SystemId } from "@pluralscape/types";

export const deleteRoute = new Hono<AuthEnv>();

deleteRoute.use("*", createCategoryRateLimiter("write"));

deleteRoute.delete("/:id", async (c) => {
  const auth = c.get("auth");
  const systemId = c.req.param("id") as SystemId;
  const requestMeta = extractRequestMeta(c);

  const db = await getDb();
  await archiveSystem(db, systemId, auth, requestMeta);
  return c.json({ ok: true });
});

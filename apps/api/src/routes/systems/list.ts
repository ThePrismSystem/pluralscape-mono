import { Hono } from "hono";

import { getDb } from "../../lib/db.js";
import { listSystems } from "../../services/system.service.js";

import { MAX_SYSTEM_LIMIT } from "./systems.constants.js";

import type { AuthEnv } from "../../lib/auth-context.js";

export const listRoute = new Hono<AuthEnv>();

listRoute.get("/", async (c) => {
  const auth = c.get("auth");
  const cursor = c.req.query("cursor") ?? undefined;
  const rawLimit = c.req.query("limit");
  const limit = rawLimit ? Math.min(Number(rawLimit), MAX_SYSTEM_LIMIT) : undefined;

  const db = await getDb();
  const result = await listSystems(db, auth.accountId, cursor, limit);
  return c.json(result);
});

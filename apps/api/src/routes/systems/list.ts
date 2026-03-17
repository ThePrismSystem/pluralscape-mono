import { toCursor } from "@pluralscape/types";
import { Hono } from "hono";

import { getDb } from "../../lib/db.js";
import { listSystems } from "../../services/system.service.js";

import { DEFAULT_SYSTEM_LIMIT, MAX_SYSTEM_LIMIT } from "./systems.constants.js";

import type { AuthEnv } from "../../lib/auth-context.js";

export const listRoute = new Hono<AuthEnv>();

listRoute.get("/", async (c) => {
  const auth = c.get("auth");
  const cursorParam = c.req.query("cursor");
  const limitParam = c.req.query("limit");
  const parsed = limitParam ? parseInt(limitParam, 10) : DEFAULT_SYSTEM_LIMIT;
  const limit =
    Number.isFinite(parsed) && parsed > 0
      ? Math.min(parsed, MAX_SYSTEM_LIMIT)
      : DEFAULT_SYSTEM_LIMIT;

  const db = await getDb();
  const result = await listSystems(
    db,
    auth.accountId,
    cursorParam ? toCursor(cursorParam) : undefined,
    limit,
  );
  return c.json(result);
});

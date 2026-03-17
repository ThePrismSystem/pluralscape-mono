import { ID_PREFIXES, toCursor } from "@pluralscape/types";
import { Hono } from "hono";

import { getDb } from "../../lib/db.js";
import { parseIdParam } from "../../lib/id-param.js";
import { listCustomFronts } from "../../services/custom-front.service.js";

import { DEFAULT_CUSTOM_FRONT_LIMIT, MAX_CUSTOM_FRONT_LIMIT } from "./custom-fronts.constants.js";

import type { AuthEnv } from "../../lib/auth-context.js";

export const listRoute = new Hono<AuthEnv>();

listRoute.get("/", async (c) => {
  const auth = c.get("auth");
  const systemId = parseIdParam(c.req.param("id") ?? "", ID_PREFIXES.system);
  const cursorParam = c.req.query("cursor");
  const limitParam = c.req.query("limit");
  const parsed = limitParam ? parseInt(limitParam, 10) : DEFAULT_CUSTOM_FRONT_LIMIT;
  const limit =
    Number.isFinite(parsed) && parsed > 0
      ? Math.min(parsed, MAX_CUSTOM_FRONT_LIMIT)
      : DEFAULT_CUSTOM_FRONT_LIMIT;

  const db = await getDb();
  const result = await listCustomFronts(
    db,
    systemId,
    auth,
    cursorParam ? toCursor(cursorParam) : undefined,
    limit,
  );
  return c.json(result);
});

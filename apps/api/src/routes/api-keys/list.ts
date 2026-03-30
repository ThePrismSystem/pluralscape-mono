import { ID_PREFIXES } from "@pluralscape/types";
import { Hono } from "hono";

import { getDb } from "../../lib/db.js";
import { requireIdParam } from "../../lib/id-param.js";
import { parseCursor, parsePaginationLimit } from "../../lib/pagination.js";
import { createCategoryRateLimiter } from "../../middleware/rate-limit.js";
import { listApiKeys } from "../../services/api-key.service.js";

import { DEFAULT_API_KEY_LIMIT, MAX_API_KEY_LIMIT } from "./api-keys.constants.js";

import type { AuthEnv } from "../../lib/auth-context.js";

export const listRoute = new Hono<AuthEnv>();

listRoute.use("*", createCategoryRateLimiter("readDefault"));

listRoute.get("/", async (c) => {
  const auth = c.get("auth");
  const systemId = requireIdParam(c.req.param("systemId"), "systemId", ID_PREFIXES.system);
  const cursorParam = c.req.query("cursor");
  const limit = parsePaginationLimit(
    c.req.query("limit"),
    DEFAULT_API_KEY_LIMIT,
    MAX_API_KEY_LIMIT,
  );
  const includeRevoked = c.req.query("includeRevoked") === "true";

  const db = await getDb();
  const result = await listApiKeys(db, systemId, auth, {
    cursor: parseCursor(cursorParam),
    limit,
    includeRevoked,
  });
  return c.json(result);
});

import { ID_PREFIXES } from "@pluralscape/types";
import { Hono } from "hono";

import { getDb } from "../../lib/db.js";
import { requireIdParam } from "../../lib/id-param.js";
import { parseCursor, parsePaginationLimit } from "../../lib/pagination.js";
import { createCategoryRateLimiter } from "../../middleware/rate-limit.js";
import {
  DEFAULT_DEVICE_TOKEN_LIMIT,
  MAX_DEVICE_TOKENS_PER_LIST,
} from "../../services/device-token.constants.js";
import { listDeviceTokens } from "../../services/device-token.service.js";

import type { AuthEnv } from "../../lib/auth-context.js";

export const listRoute = new Hono<AuthEnv>();

listRoute.use("*", createCategoryRateLimiter("readDefault"));

listRoute.get("/", async (c) => {
  const auth = c.get("auth");
  const systemId = requireIdParam(c.req.param("systemId"), "systemId", ID_PREFIXES.system);
  const cursor = parseCursor(c.req.query("cursor"));
  const limit = parsePaginationLimit(
    c.req.query("limit"),
    DEFAULT_DEVICE_TOKEN_LIMIT,
    MAX_DEVICE_TOKENS_PER_LIST,
  );

  const db = await getDb();
  const result = await listDeviceTokens(db, systemId, auth, { cursor, limit });
  return c.json(result);
});

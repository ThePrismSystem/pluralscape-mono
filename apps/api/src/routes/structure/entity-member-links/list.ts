import { ID_PREFIXES } from "@pluralscape/types";
import { Hono } from "hono";

import { getDb } from "../../../lib/db.js";
import { requireIdParam } from "../../../lib/id-param.js";
import { parseCursor, parsePaginationLimit } from "../../../lib/pagination.js";
import { createCategoryRateLimiter } from "../../../middleware/rate-limit.js";
import { listEntityMemberLinks } from "../../../services/structure-entity.service.js";

import {
  DEFAULT_ENTITY_MEMBER_LINK_LIMIT,
  MAX_ENTITY_MEMBER_LINK_LIMIT,
} from "./structure.constants.js";

import type { AuthEnv } from "../../../lib/auth-context.js";

export const listRoute = new Hono<AuthEnv>();

listRoute.use("*", createCategoryRateLimiter("readDefault"));

listRoute.get("/", async (c) => {
  const auth = c.get("auth");
  const systemId = requireIdParam(c.req.param("systemId"), "systemId", ID_PREFIXES.system);
  const limit = parsePaginationLimit(
    c.req.query("limit"),
    DEFAULT_ENTITY_MEMBER_LINK_LIMIT,
    MAX_ENTITY_MEMBER_LINK_LIMIT,
  );

  const db = await getDb();
  const result = await listEntityMemberLinks(db, systemId, auth, {
    cursor: parseCursor(c.req.query("cursor")),
    limit,
  });
  return c.json(result);
});

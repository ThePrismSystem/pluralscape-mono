import { ID_PREFIXES, toCursor } from "@pluralscape/types";
import { Hono } from "hono";

import { getDb } from "../../lib/db.js";
import { parseIdParam, requireParam } from "../../lib/id-param.js";
import { listFieldDefinitions } from "../../services/field-definition.service.js";

import { DEFAULT_FIELD_LIMIT, MAX_FIELD_LIMIT } from "./fields.constants.js";

import type { AuthEnv } from "../../lib/auth-context.js";

export const listRoute = new Hono<AuthEnv>();

listRoute.get("/", async (c) => {
  const auth = c.get("auth");
  const systemId = parseIdParam(
    requireParam(c.req.param("systemId"), "systemId"),
    ID_PREFIXES.system,
  );
  const cursorParam = c.req.query("cursor");
  const limitParam = c.req.query("limit");
  const includeArchived = c.req.query("include_archived") === "true";
  const parsed = limitParam ? parseInt(limitParam, 10) : DEFAULT_FIELD_LIMIT;
  const limit =
    Number.isFinite(parsed) && parsed > 0 ? Math.min(parsed, MAX_FIELD_LIMIT) : DEFAULT_FIELD_LIMIT;

  const db = await getDb();
  const result = await listFieldDefinitions(db, systemId, auth, {
    cursor: cursorParam ? toCursor(cursorParam) : undefined,
    limit,
    includeArchived,
  });
  return c.json(result);
});

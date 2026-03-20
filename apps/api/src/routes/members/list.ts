import { ID_PREFIXES, toCursor } from "@pluralscape/types";
import { IncludeArchivedQuerySchema } from "@pluralscape/validation";
import { Hono } from "hono";

import { getDb } from "../../lib/db.js";
import { requireIdParam } from "../../lib/id-param.js";
import { parsePaginationLimit } from "../../lib/pagination.js";
import { filterFields, parseSparseFields } from "../../lib/sparse-fieldset.js";
import { createCategoryRateLimiter } from "../../middleware/rate-limit.js";
import { listMembers } from "../../services/member.service.js";

import { DEFAULT_MEMBER_LIMIT, MAX_MEMBER_LIMIT } from "./members.constants.js";

import type { AuthEnv } from "../../lib/auth-context.js";
import type { MemberResult } from "../../services/member.service.js";

const MEMBER_FIELDS = [
  "id",
  "systemId",
  "encryptedData",
  "version",
  "createdAt",
  "updatedAt",
  "archived",
  "archivedAt",
] as const satisfies readonly (keyof MemberResult)[];

export const listRoute = new Hono<AuthEnv>();

listRoute.use("*", createCategoryRateLimiter("readDefault"));
listRoute.get("/", async (c) => {
  const auth = c.get("auth");
  const systemId = requireIdParam(c.req.param("systemId"), "systemId", ID_PREFIXES.system);
  const cursorParam = c.req.query("cursor");
  const limitParam = c.req.query("limit");
  const { includeArchived } = IncludeArchivedQuerySchema.parse({
    includeArchived: c.req.query("includeArchived"),
  });
  const limit = parsePaginationLimit(limitParam, DEFAULT_MEMBER_LIMIT, MAX_MEMBER_LIMIT);
  const fields = parseSparseFields(c.req.query("fields"), MEMBER_FIELDS);

  const db = await getDb();
  const result = await listMembers(db, systemId, auth, {
    cursor: cursorParam ? toCursor(cursorParam) : undefined,
    limit,
    includeArchived,
  });

  if (!fields) return c.json(result);

  return c.json({
    ...result,
    items: result.items.map((item) => filterFields(item, fields)),
  });
});

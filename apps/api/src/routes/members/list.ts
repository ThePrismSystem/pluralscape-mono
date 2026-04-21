import { ID_PREFIXES } from "@pluralscape/types";
import { MemberListQuerySchema } from "@pluralscape/validation";
import { Hono } from "hono";

import { getDb } from "../../lib/db.js";
import { requireIdParam } from "../../lib/id-param.js";
import { parseCursor, parsePaginationLimit } from "../../lib/pagination.js";
import { filterFields, parseSparseFields } from "../../lib/sparse-fieldset.js";
import { createCategoryRateLimiter } from "../../middleware/rate-limit.js";
import { listMembers } from "../../services/member.js";

import { DEFAULT_MEMBER_LIMIT, MAX_MEMBER_LIMIT } from "./members.constants.js";

import type { AuthEnv } from "../../lib/auth-context.js";
import type { MemberResult } from "../../services/member.js";

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
  const { includeArchived, groupId } = MemberListQuerySchema.parse({
    includeArchived: c.req.query("includeArchived"),
    groupId: c.req.query("groupId"),
  });
  const limit = parsePaginationLimit(limitParam, DEFAULT_MEMBER_LIMIT, MAX_MEMBER_LIMIT);
  const fields = parseSparseFields(c.req.query("fields"), MEMBER_FIELDS);

  const db = await getDb();
  const result = await listMembers(db, systemId, auth, {
    cursor: parseCursor(cursorParam),
    limit,
    includeArchived,
    groupId,
  });

  if (!fields) return c.json(result);

  return c.json({
    ...result,
    data: result.data.map((item) => filterFields(item, fields)),
  });
});

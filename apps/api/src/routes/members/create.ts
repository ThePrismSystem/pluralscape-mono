import { ID_PREFIXES } from "@pluralscape/types";
import { CreateMemberBodySchema } from "@pluralscape/validation";
import { Hono } from "hono";

import { HTTP_CREATED } from "../../http.constants.js";
import { createAuditWriter } from "../../lib/audit-writer.js";
import { parseBody } from "../../lib/body-parse.js";
import { getDb } from "../../lib/db.js";
import { requireIdParam } from "../../lib/id-param.js";
import { envelope } from "../../lib/response.js";
import { createIdempotencyMiddleware } from "../../middleware/idempotency.js";
import { createCategoryRateLimiter } from "../../middleware/rate-limit.js";
import { createMember } from "../../services/member/create.js";

import type { AuthEnv } from "../../lib/auth-context.js";

export const createRoute = new Hono<AuthEnv>();

createRoute.use("*", createCategoryRateLimiter("write"));
createRoute.use("*", createIdempotencyMiddleware());

createRoute.post("/", async (c) => {
  const body = await parseBody(c, CreateMemberBodySchema);

  const auth = c.get("auth");
  const systemId = requireIdParam(c.req.param("systemId"), "systemId", ID_PREFIXES.system);
  const audit = createAuditWriter(c, auth);

  const db = await getDb();
  const result = await createMember(db, systemId, body, auth, audit);
  return c.json(envelope(result), HTTP_CREATED);
});

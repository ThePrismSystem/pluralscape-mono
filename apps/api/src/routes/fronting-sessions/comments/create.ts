import { ID_PREFIXES } from "@pluralscape/types";
import { CreateFrontingCommentBodySchema } from "@pluralscape/validation";
import { Hono } from "hono";

import { HTTP_CREATED } from "../../../http.constants.js";
import { createAuditWriter } from "../../../lib/audit-writer.js";
import { parseBody } from "../../../lib/body-parse.js";
import { getDb } from "../../../lib/db.js";
import { requireIdParam } from "../../../lib/id-param.js";
import { envelope } from "../../../lib/response.js";
import { createIdempotencyMiddleware } from "../../../middleware/idempotency.js";
import { createCategoryRateLimiter } from "../../../middleware/rate-limit.js";
import { createFrontingComment } from "../../../services/fronting-session/comments/create.js";

import type { AuthEnv } from "../../../lib/auth-context.js";

export const createRoute = new Hono<AuthEnv>();

createRoute.use("*", createCategoryRateLimiter("write"));
createRoute.use("*", createIdempotencyMiddleware());

createRoute.post("/", async (c) => {
  const body = await parseBody(c, CreateFrontingCommentBodySchema);

  const auth = c.get("auth");
  const systemId = requireIdParam(c.req.param("systemId"), "systemId", ID_PREFIXES.system);
  const sessionId = requireIdParam(
    c.req.param("sessionId"),
    "sessionId",
    ID_PREFIXES.frontingSession,
  );
  const audit = createAuditWriter(c, auth);

  const db = await getDb();
  const result = await createFrontingComment(db, systemId, sessionId, body, auth, audit);
  return c.json(envelope(result), HTTP_CREATED);
});

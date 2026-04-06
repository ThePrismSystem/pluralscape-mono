import { ID_PREFIXES } from "@pluralscape/types";
import { AssignBucketBodySchema } from "@pluralscape/validation";
import { Hono } from "hono";

import { HTTP_BAD_REQUEST, HTTP_CREATED } from "../../../http.constants.js";
import { ApiHttpError } from "../../../lib/api-error.js";
import { createAuditWriter } from "../../../lib/audit-writer.js";
import { getDb } from "../../../lib/db.js";
import { requireIdParam } from "../../../lib/id-param.js";
import { parseJsonBody } from "../../../lib/parse-json-body.js";
import { envelope } from "../../../lib/response.js";
import { createCategoryRateLimiter } from "../../../middleware/rate-limit.js";
import { assignBucketToFriend } from "../../../services/bucket-assignment.service.js";

import type { AuthEnv } from "../../../lib/auth-context.js";

export const assignRoute = new Hono<AuthEnv>();

assignRoute.use("*", createCategoryRateLimiter("write"));

assignRoute.post("/", async (c) => {
  const auth = c.get("auth");
  const systemId = requireIdParam(c.req.param("systemId"), "systemId", ID_PREFIXES.system);
  const bucketId = requireIdParam(c.req.param("bucketId"), "bucketId", ID_PREFIXES.bucket);
  const audit = createAuditWriter(c, auth);
  const raw = await parseJsonBody(c);

  const parsed = AssignBucketBodySchema.safeParse(raw);
  if (!parsed.success) {
    throw new ApiHttpError(
      HTTP_BAD_REQUEST,
      "VALIDATION_ERROR",
      parsed.error.issues.map((i) => i.message).join("; "),
    );
  }

  const connectionId = requireIdParam(
    parsed.data.connectionId,
    "connectionId",
    ID_PREFIXES.friendConnection,
  );

  const db = await getDb();
  const result = await assignBucketToFriend(
    db,
    systemId,
    bucketId,
    {
      connectionId,
      encryptedBucketKey: parsed.data.encryptedBucketKey,
      keyVersion: parsed.data.keyVersion,
    },
    auth,
    audit,
  );
  return c.json(envelope(result), HTTP_CREATED);
});

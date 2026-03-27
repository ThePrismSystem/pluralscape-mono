import { ID_PREFIXES } from "@pluralscape/types";
import { Hono } from "hono";

import { HTTP_CREATED } from "../../../http.constants.js";
import { createAuditWriter } from "../../../lib/audit-writer.js";
import { getDb } from "../../../lib/db.js";
import { requireIdParam } from "../../../lib/id-param.js";
import { parseJsonBody } from "../../../lib/parse-json-body.js";
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
  const body = (await parseJsonBody(c)) as Record<string, unknown>;

  const connectionId = requireIdParam(
    body.connectionId as string | undefined,
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
      encryptedBucketKey: body.encryptedBucketKey as string,
      keyVersion: body.keyVersion as number,
    },
    auth,
    audit,
  );
  return c.json(result, HTTP_CREATED);
});

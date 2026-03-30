import { ID_PREFIXES } from "@pluralscape/types";
import { Hono } from "hono";

import { createAuditWriter } from "../../../lib/audit-writer.js";
import { getDb } from "../../../lib/db.js";
import { requireIdParam } from "../../../lib/id-param.js";
import { envelope } from "../../../lib/response.js";
import { createCategoryRateLimiter } from "../../../middleware/rate-limit.js";
import { unassignBucketFromFriend } from "../../../services/bucket-assignment.service.js";

import type { AuthEnv } from "../../../lib/auth-context.js";

export const unassignRoute = new Hono<AuthEnv>();

unassignRoute.use("*", createCategoryRateLimiter("write"));

unassignRoute.delete("/:connectionId", async (c) => {
  const auth = c.get("auth");
  const systemId = requireIdParam(c.req.param("systemId"), "systemId", ID_PREFIXES.system);
  const bucketId = requireIdParam(c.req.param("bucketId"), "bucketId", ID_PREFIXES.bucket);
  const connectionId = requireIdParam(
    c.req.param("connectionId"),
    "connectionId",
    ID_PREFIXES.friendConnection,
  );
  const audit = createAuditWriter(c, auth);

  const db = await getDb();
  const result = await unassignBucketFromFriend(db, systemId, bucketId, connectionId, auth, audit);
  return c.json(envelope(result));
});

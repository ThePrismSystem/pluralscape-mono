import { ID_PREFIXES } from "@pluralscape/types";
import { Hono } from "hono";

import { HTTP_NO_CONTENT } from "../../../http.constants.js";
import { createAuditWriter } from "../../../lib/audit-writer.js";
import { getDb } from "../../../lib/db.js";
import { requireIdParam } from "../../../lib/id-param.js";
import { createCategoryRateLimiter } from "../../../middleware/rate-limit.js";
import { deleteSnapshot } from "../../../services/snapshot.service.js";

import type { AuthEnv } from "../../../lib/auth-context.js";

export const deleteRoute = new Hono<AuthEnv>();

deleteRoute.use("*", createCategoryRateLimiter("write"));

deleteRoute.delete("/:snapshotId", async (c) => {
  const auth = c.get("auth");
  const systemId = requireIdParam(c.req.param("systemId"), "systemId", ID_PREFIXES.system);
  const snapshotId = requireIdParam(
    c.req.param("snapshotId"),
    "snapshotId",
    ID_PREFIXES.systemSnapshot,
  );
  const audit = createAuditWriter(c, auth);

  const db = await getDb();
  await deleteSnapshot(db, systemId, snapshotId, auth, audit);
  return c.body(null, HTTP_NO_CONTENT);
});

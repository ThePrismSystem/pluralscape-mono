import { ID_PREFIXES } from "@pluralscape/types";
import { Hono } from "hono";

import { HTTP_OK } from "../../../http.constants.js";
import { getDb } from "../../../lib/db.js";
import { requireIdParam } from "../../../lib/id-param.js";
import { envelope } from "../../../lib/response.js";
import { createCategoryRateLimiter } from "../../../middleware/rate-limit.js";
import { getSnapshot } from "../../../services/snapshot.service.js";

import type { AuthEnv } from "../../../lib/auth-context.js";

export const getRoute = new Hono<AuthEnv>();

getRoute.use("*", createCategoryRateLimiter("readDefault"));

getRoute.get("/:snapshotId", async (c) => {
  const auth = c.get("auth");
  const systemId = requireIdParam(c.req.param("systemId"), "systemId", ID_PREFIXES.system);
  const snapshotId = requireIdParam(
    c.req.param("snapshotId"),
    "snapshotId",
    ID_PREFIXES.systemSnapshot,
  );

  const db = await getDb();
  const result = await getSnapshot(db, systemId, snapshotId, auth);
  return c.json(envelope(result), HTTP_OK);
});

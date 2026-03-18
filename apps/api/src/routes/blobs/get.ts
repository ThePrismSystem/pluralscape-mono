import { ID_PREFIXES } from "@pluralscape/types";
import { Hono } from "hono";

import { getDb } from "../../lib/db.js";
import { parseIdParam, requireIdParam } from "../../lib/id-param.js";
import { getBlob } from "../../services/blob.service.js";

import type { AuthEnv } from "../../lib/auth-context.js";

export const getRoute = new Hono<AuthEnv>();

getRoute.get("/:blobId", async (c) => {
  const auth = c.get("auth");
  const systemId = requireIdParam(c.req.param("systemId"), "systemId", ID_PREFIXES.system);
  const blobId = parseIdParam(c.req.param("blobId"), ID_PREFIXES.blob);

  const db = await getDb();
  const result = await getBlob(db, systemId, blobId, auth);
  return c.json(result);
});

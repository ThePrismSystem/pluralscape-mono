import { ID_PREFIXES } from "@pluralscape/types";
import { Hono } from "hono";

import { getDb } from "../../../lib/db.js";
import { parseIdParam, requireParam } from "../../../lib/id-param.js";
import { getRotationProgress } from "../../../services/key-rotation.service.js";

import type { AuthEnv } from "../../../lib/auth-context.js";

export const progressRoute = new Hono<AuthEnv>();

progressRoute.get("/:rotationId", async (c) => {
  const auth = c.get("auth");
  const systemId = parseIdParam(requireParam(c.req.param("id"), "id"), ID_PREFIXES.system);
  const bucketId = parseIdParam(
    requireParam(c.req.param("bucketId"), "bucketId"),
    ID_PREFIXES.bucket,
  );
  const rotationId = parseIdParam(c.req.param("rotationId"), ID_PREFIXES.bucketKeyRotation);

  const db = await getDb();
  const result = await getRotationProgress(db, systemId, bucketId, rotationId, auth);
  return c.json(result);
});

import { ID_PREFIXES } from "@pluralscape/types";
import { Hono } from "hono";

import { createAuditWriter } from "../../../lib/audit-writer.js";
import { getDb } from "../../../lib/db.js";
import { parseIdParam } from "../../../lib/id-param.js";
import { parseJsonBody } from "../../../lib/parse-json-body.js";
import { createCategoryRateLimiter } from "../../../middleware/rate-limit.js";
import { getCanvas, upsertCanvas } from "../../../services/innerworld-canvas.service.js";

import type { AuthEnv } from "../../../lib/auth-context.js";

export const canvasRoutes = new Hono<AuthEnv>();

canvasRoutes.get("/", async (c) => {
  const auth = c.get("auth");
  const systemId = parseIdParam(c.req.param("systemId") as string, ID_PREFIXES.system);

  const db = await getDb();
  const result = await getCanvas(db, systemId, auth);
  return c.json(result);
});

const canvasWriteRoutes = new Hono<AuthEnv>();
canvasWriteRoutes.use("*", createCategoryRateLimiter("write"));

canvasWriteRoutes.put("/", async (c) => {
  const auth = c.get("auth");
  const systemId = parseIdParam(c.req.param("systemId") as string, ID_PREFIXES.system);
  const audit = createAuditWriter(c, auth);
  const body = await parseJsonBody(c);

  const db = await getDb();
  const result = await upsertCanvas(db, systemId, body, auth, audit);
  return c.json(result);
});

canvasRoutes.route("/", canvasWriteRoutes);

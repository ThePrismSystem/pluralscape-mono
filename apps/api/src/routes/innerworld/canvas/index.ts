import { ID_PREFIXES } from "@pluralscape/types";
import { UpdateCanvasBodySchema } from "@pluralscape/validation";
import { Hono } from "hono";

import {} from "../../../http.constants.js";
import { createAuditWriter } from "../../../lib/audit-writer.js";
import { parseBody } from "../../../lib/body-parse.js";
import { getDb } from "../../../lib/db.js";
import { requireIdParam } from "../../../lib/id-param.js";
import { envelope } from "../../../lib/response.js";
import { createCategoryRateLimiter } from "../../../middleware/rate-limit.js";
import { getCanvas, upsertCanvas } from "../../../services/innerworld/canvas.js";

import type { AuthEnv } from "../../../lib/auth-context.js";

export const canvasRoutes = new Hono<AuthEnv>();

const canvasReadRoutes = new Hono<AuthEnv>();
canvasReadRoutes.use("*", createCategoryRateLimiter("readDefault"));

canvasReadRoutes.get("/", async (c) => {
  const auth = c.get("auth");
  const systemId = requireIdParam(c.req.param("systemId"), "systemId", ID_PREFIXES.system);

  const db = await getDb();
  const result = await getCanvas(db, systemId, auth);
  return c.json(envelope(result));
});

canvasRoutes.route("/", canvasReadRoutes);

const canvasWriteRoutes = new Hono<AuthEnv>();
canvasWriteRoutes.use("*", createCategoryRateLimiter("write"));

canvasWriteRoutes.put("/", async (c) => {
  const body = await parseBody(c, UpdateCanvasBodySchema);

  const auth = c.get("auth");
  const systemId = requireIdParam(c.req.param("systemId"), "systemId", ID_PREFIXES.system);
  const audit = createAuditWriter(c, auth);

  const db = await getDb();
  const result = await upsertCanvas(db, systemId, body, auth, audit);
  return c.json(envelope(result));
});

canvasRoutes.route("/", canvasWriteRoutes);

import { ID_PREFIXES } from "@pluralscape/types";
import { Hono } from "hono";

import { createAuditWriter } from "../../../lib/audit-writer.js";
import { getDb } from "../../../lib/db.js";
import { requireIdParam } from "../../../lib/id-param.js";
import { parseJsonBody } from "../../../lib/parse-json-body.js";
import { envelope } from "../../../lib/response.js";
import { createCategoryRateLimiter } from "../../../middleware/rate-limit.js";
import { requireScopeMiddleware } from "../../../middleware/scope.js";
import { getCanvas, upsertCanvas } from "../../../services/innerworld-canvas.service.js";

import type { AuthEnv } from "../../../lib/auth-context.js";

export const canvasRoutes = new Hono<AuthEnv>();

const canvasReadRoutes = new Hono<AuthEnv>();
canvasReadRoutes.use("*", createCategoryRateLimiter("readDefault"));
canvasReadRoutes.use("*", requireScopeMiddleware("read:innerworld"));

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
canvasWriteRoutes.use("*", requireScopeMiddleware("write:innerworld"));

canvasWriteRoutes.put("/", async (c) => {
  const auth = c.get("auth");
  const systemId = requireIdParam(c.req.param("systemId"), "systemId", ID_PREFIXES.system);
  const audit = createAuditWriter(c, auth);
  const body = await parseJsonBody(c);

  const db = await getDb();
  const result = await upsertCanvas(db, systemId, body, auth, audit);
  return c.json(envelope(result));
});

canvasRoutes.route("/", canvasWriteRoutes);
